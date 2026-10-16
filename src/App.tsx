import React, { useState, useEffect, useCallback } from 'react';
import {
  Hospital,
  BloodUnit,
  BloodRequest,
  Transfer,
  TravelTimeMatrix,
  ProposedAllocation,
  AllocationRunSummary,
} from './types/bloodstock';
import { apiClient } from './services/apiClient';
import { authService, HospitalProfile } from './services/authService';
import { hospitalDataService, NetworkRecommendation } from './services/hospitalDataService';
import { TopNav } from './components/TopNav';
import { MainDashboard } from './components/MainDashboard';
import { HospitalDashboardView } from './components/HospitalDashboardView';
import { AllocationStudio } from './components/AllocationStudio';
import { ExplainabilityInspector } from './components/ExplainabilityInspector';
import { HospitalLoginPage } from './components/HospitalLoginPage';
import { HospitalSelector } from './components/HospitalSelector';
import { NewRequestModal } from './components/NewRequestModal';
import { HospitalListModal } from './components/HospitalListModal';
import { ContactUsModal } from './components/ContactUsModal';

export default function App() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [units, setUnits] = useState<BloodUnit[]>([]);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [travelMatrix, setTravelMatrix] = useState<TravelTimeMatrix>({});
  const [simulationTime, setSimulationTime] = useState<string>(new Date('2026-10-15T09:00:00Z').toISOString());

  // Supabase Authentication & Multi-Hospital Profile State
  const [authenticatedProfile, setAuthenticatedProfile] = useState<HospitalProfile | null>(null);
  const [userHospitals, setUserHospitals] = useState<HospitalProfile[]>([]);
  const [activeHospitalUnits, setActiveHospitalUnits] = useState<BloodUnit[]>([]);
  const [activeHospitalRequests, setActiveHospitalRequests] = useState<BloodRequest[]>([]);
  const [activeRecommendations, setActiveRecommendations] = useState<NetworkRecommendation[]>([]);
  const [isRefreshingHospitalData, setIsRefreshingHospitalData] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<'public' | 'hospital_dashboard' | 'allocation_studio'>('public');

  // Allocation Studio & Explainability State
  const [lastBaselineRun, setLastBaselineRun] = useState<AllocationRunSummary | null>(null);
  const [lastOptimizerRun, setLastOptimizerRun] = useState<AllocationRunSummary | null>(null);
  const [isSolving, setIsSolving] = useState<boolean>(false);

  // Modals
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isNewRequestOpen, setIsNewRequestOpen] = useState<boolean>(false);
  const [isHospitalListOpen, setIsHospitalListOpen] = useState<boolean>(false);
  const [isContactUsOpen, setIsContactUsOpen] = useState<boolean>(false);

  // Load initial application data
  const refreshState = useCallback(async () => {
    try {
      const [hospData, unitData, reqData, txData, matrixData, sysState] = await Promise.all([
        apiClient.getHospitals(),
        apiClient.getInventory(),
        apiClient.getRequests(),
        apiClient.getTransfers(),
        apiClient.getTravelMatrix(),
        apiClient.getSystemState(),
      ]);

      setHospitals(hospData);
      setUnits(unitData);
      setRequests(reqData);
      setTransfers(txData);
      setTravelMatrix(matrixData);
      setSimulationTime(sysState.simulationTime);
      if (sysState.lastBaselineRun) setLastBaselineRun(sysState.lastBaselineRun);
      if (sysState.lastOptimizerRun) setLastOptimizerRun(sysState.lastOptimizerRun);
    } catch (err) {
      console.error('Error refreshing state:', err);
    }
  }, []);

  const handleRunBaseline = async () => {
    setIsSolving(true);
    try {
      const run = await apiClient.runBaseline();
      setLastBaselineRun(run);
    } catch (e) {
      console.error('Failed to run baseline solver:', e);
    } finally {
      setIsSolving(false);
    }
  };

  const handleRunOptimizer = async () => {
    setIsSolving(true);
    try {
      const run = await apiClient.runOptimizer();
      setLastOptimizerRun(run);
    } catch (e) {
      console.error('Failed to run constraint optimizer:', e);
    } finally {
      setIsSolving(false);
    }
  };

  const handleCommitAllocations = async (allocations: ProposedAllocation[]) => {
    setIsSolving(true);
    try {
      await apiClient.commitReservations(allocations);
      await refreshState();
      if (authenticatedProfile) {
        await refreshHospitalScopedData(authenticatedProfile, userHospitals);
      }
    } catch (e) {
      console.error('Failed to commit allocations:', e);
    } finally {
      setIsSolving(false);
    }
  };

  // Request sequence ref to cancel/ignore outdated asynchronous responses
  const dataRequestSeqRef = React.useRef<number>(0);
  const userHospitalsRef = React.useRef<HospitalProfile[]>(userHospitals);
  useEffect(() => {
    userHospitalsRef.current = userHospitals;
  }, [userHospitals]);

  // Fetch data specifically scoped to the active hospital context
  const refreshHospitalScopedData = useCallback(async (hosp: HospitalProfile, availableHospitals?: HospitalProfile[]) => {
    // Clear stale hospital-specific cached data immediately when active hospital changes
    setActiveHospitalUnits([]);
    setActiveHospitalRequests([]);
    setActiveRecommendations([]);
    setIsRefreshingHospitalData(true);

    const currentSeq = ++dataRequestSeqRef.current;

    try {
      const allList = availableHospitals && availableHospitals.length > 0 ? availableHospitals : userHospitalsRef.current;
      await hospitalDataService.purgeConfirmedDemoRecords(hosp.id);
      const [localUnits, localReqs, localRecs] = await Promise.all([
        hospitalDataService.getHospitalInventory(hosp),
        hospitalDataService.getHospitalRequests(hosp),
        hospitalDataService.getNetworkRecommendations(hosp, allList),
      ]);

      // Cancel or ignore outdated asynchronous responses so previous hospital data cannot overwrite dashboard
      if (currentSeq !== dataRequestSeqRef.current) {
        return;
      }

      setActiveHospitalUnits(localUnits);
      setActiveHospitalRequests(localReqs);
      setActiveRecommendations(localRecs);
    } catch (err) {
      console.error('[App] Failed to refresh hospital scoped data:', err);
    } finally {
      if (currentSeq === dataRequestSeqRef.current) {
        setIsRefreshingHospitalData(false);
      }
    }
  }, []);

  const isInitialSessionCheckedRef = React.useRef<boolean>(false);

  // Check Supabase session on startup (strictly once on mount)
  useEffect(() => {
    refreshState();

    if (!isInitialSessionCheckedRef.current) {
      isInitialSessionCheckedRef.current = true;
      const checkSession = async () => {
        try {
          const { profile, userHospitals: sessionHospitals } = await authService.getSession();
          if (profile && profile.account_status === 'active') {
            setAuthenticatedProfile(profile);
            setUserHospitals(sessionHospitals);
            setCurrentView('hospital_dashboard');
            await refreshHospitalScopedData(profile, sessionHospitals);
          }
        } catch (e) {
          console.error('Session check failed:', e);
        }
      };
      checkSession();
    }
  }, [refreshState, refreshHospitalScopedData]);

  // Handle Switching Active Hospital Context
  const handleSwitchHospital = async (targetHospital: HospitalProfile) => {
    // Rule 2 & 3: Verify target hospital is authorized
    const isAuthorized = userHospitals.some((h) => h.id === targetHospital.id);
    if (!isAuthorized) {
      console.warn('[App] Blocked switch: hospital is not in authorized memberships:', targetHospital.name);
      return;
    }

    authService.setActiveHospitalId(targetHospital.id);
    setAuthenticatedProfile(targetHospital);
    await refreshHospitalScopedData(targetHospital, userHospitals);
  };

  // Handle Logout
  const handleLogout = async () => {
    await authService.signOut();
    setAuthenticatedProfile(null);
    setUserHospitals([]);
    setActiveHospitalUnits([]);
    setActiveHospitalRequests([]);
    setActiveRecommendations([]);
    setCurrentView('public');
  };

  // Handle Login Success
  const handleLoginSuccess = async (profile: HospitalProfile, hospitalsList: HospitalProfile[]) => {
    // Rule 3: Set active hospital only after authorization succeeds
    authService.setActiveHospitalId(profile.id);
    setAuthenticatedProfile(profile);
    setUserHospitals(hospitalsList);
    setIsLoginModalOpen(false);
    setCurrentView('hospital_dashboard');
    await refreshHospitalScopedData(profile, hospitalsList);
  };

  const handleCreateRequest = async (reqData: Omit<BloodRequest, 'id' | 'createdAt' | 'status' | 'allocatedUnitIds'>) => {
    try {
      await apiClient.createRequest(reqData);
      await refreshState();
      if (authenticatedProfile) {
        await refreshHospitalScopedData(authenticatedProfile, userHospitals);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const scrollToContact = () => {
    if (currentView !== 'public') {
      setCurrentView('public');
      setTimeout(() => {
        document.getElementById('contact-us')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      document.getElementById('contact-us')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navigation Bar with Hospital Switcher */}
      <TopNav
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onOpenContactUs={scrollToContact}
        onLogout={handleLogout}
        profile={authenticatedProfile}
        userHospitals={userHospitals}
        onSelectHospital={handleSwitchHospital}
        currentView={currentView}
        onSelectView={(v) => setCurrentView(v)}
      />

      {/* 3. Main Stage Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-8">
        {/* Navigation / Context Switcher Bar */}
        <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-slate-600 font-medium">
                Active Context:
              </span>
            </div>
            {authenticatedProfile ? (
              userHospitals.length > 1 ? (
                <HospitalSelector
                  userHospitals={userHospitals}
                  activeHospital={authenticatedProfile}
                  onSelectHospital={handleSwitchHospital}
                  isLoading={isRefreshingHospitalData}
                  isCompact={true}
                />
              ) : (
                <strong className="text-slate-900">{authenticatedProfile.name}</strong>
              )
            ) : (
              <span className="text-slate-500 italic">Regional Jaipur Public View</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => setCurrentView('public')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                currentView === 'public'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Public Home
            </button>
            <button
              onClick={() => {
                if (authenticatedProfile) {
                  setCurrentView('hospital_dashboard');
                } else {
                  setIsLoginModalOpen(true);
                }
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                currentView === 'hospital_dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Hospital Dashboard
            </button>
          </div>
        </div>

        {/* View Routing */}
        {currentView === 'allocation_studio' ? (
          <div className="space-y-8 animate-in fade-in duration-200">
            <AllocationStudio
              hospitals={hospitals}
              requests={requests}
              lastBaselineRun={lastBaselineRun}
              lastOptimizerRun={lastOptimizerRun}
              onRunBaseline={handleRunBaseline}
              onRunOptimizer={handleRunOptimizer}
              onCommitAllocations={handleCommitAllocations}
              loading={isSolving}
            />
            <ExplainabilityInspector
              hospitals={hospitals}
              requests={requests}
              lastOptimizerRun={lastOptimizerRun}
              lastBaselineRun={lastBaselineRun}
            />
          </div>
        ) : currentView === 'hospital_dashboard' && authenticatedProfile ? (
          <HospitalDashboardView
            profile={authenticatedProfile}
            userHospitals={userHospitals}
            onSelectHospital={handleSwitchHospital}
            units={activeHospitalUnits}
            requests={activeHospitalRequests}
            recommendations={activeRecommendations}
            isRefreshing={isRefreshingHospitalData}
            onRefreshData={() => refreshHospitalScopedData(authenticatedProfile, userHospitals)}
            onLogout={handleLogout}
            onOpenEmergencyRequest={() => setIsNewRequestOpen(true)}
          />
        ) : (
          <MainDashboard
            hospitals={hospitals}
            units={units}
            requests={requests}
            onOpenLogin={() => setIsLoginModalOpen(true)}
            onOpenHospitalList={() => setIsHospitalListOpen(true)}
            onOpenContactUs={scrollToContact}
            onOpenEmergencyRequest={() => setIsNewRequestOpen(true)}
            simulationTime={simulationTime}
          />
        )}
      </main>

      {/* 4. Footer */}
      <footer className="bg-white border-t border-blue-100 py-6 px-6 text-xs text-slate-500 font-sans">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">BloodStock</span>
            <span>·</span>
            <span>Time-Aware Allocation of Perishable Blood Components</span>
          </div>
          <div className="flex items-center gap-6 text-slate-400">
            <button
              onClick={() => setIsHospitalListOpen(true)}
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              Hospital Directory
            </button>
            <button
              onClick={scrollToContact}
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              Emergency Helpline
            </button>
            <span>Code-e-Manipal 2.0 (Track 02 HealthTech)</span>
          </div>
        </div>
      </footer>

      {/* 5. Modals */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <HospitalLoginPage
            onLoginSuccess={handleLoginSuccess}
            onCancel={() => setIsLoginModalOpen(false)}
            isModal={true}
          />
        </div>
      )}

      <HospitalListModal
        isOpen={isHospitalListOpen}
        onClose={() => setIsHospitalListOpen(false)}
        hospitals={hospitals}
        units={units}
        onSelectHospital={() => {
          setIsLoginModalOpen(true);
        }}
        onRequestFromHospital={() => {
          setIsNewRequestOpen(true);
        }}
      />

      <ContactUsModal
        isOpen={isContactUsOpen}
        onClose={() => setIsContactUsOpen(false)}
      />

      <NewRequestModal
        isOpen={isNewRequestOpen}
        onClose={() => setIsNewRequestOpen(false)}
        hospitals={hospitals}
        simulationTime={simulationTime}
        onCreateRequest={handleCreateRequest}
      />
    </div>
  );
}
