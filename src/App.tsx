import React, { useState, useEffect, useCallback } from 'react';
import {
  Hospital,
  BloodUnit,
  BloodRequest,
  Transfer,
  TravelTimeMatrix,
  AllocationRunSummary,
  ProposedAllocation,
  ScenarioEvent,
  UserRole,
} from './types/bloodstock';
import { apiClient } from './services/apiClient';
import { MedicalDisclaimer } from './components/MedicalDisclaimer';
import { TopNav } from './components/TopNav';
import { MainDashboard } from './components/MainDashboard';
import { NewRequestModal } from './components/NewRequestModal';
import { HospitalLoginModal } from './components/HospitalLoginModal';
import { HospitalListModal } from './components/HospitalListModal';
import { ContactUsModal } from './components/ContactUsModal';

export default function App() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [units, setUnits] = useState<BloodUnit[]>([]);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [travelMatrix, setTravelMatrix] = useState<TravelTimeMatrix>({});
  const [simulationTime, setSimulationTime] = useState<string>(new Date('2026-10-15T09:00:00Z').toISOString());
  const [activeScenario, setActiveScenario] = useState<ScenarioEvent | null>(null);
  const [lastBaselineRun, setLastBaselineRun] = useState<AllocationRunSummary | null>(null);
  const [lastOptimizerRun, setLastOptimizerRun] = useState<AllocationRunSummary | null>(null);
  const [auditHistory, setAuditHistory] = useState<string[]>([]);

  // Modals
  const [isNewRequestOpen, setIsNewRequestOpen] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isHospitalListOpen, setIsHospitalListOpen] = useState<boolean>(false);
  const [isContactUsOpen, setIsContactUsOpen] = useState<boolean>(false);
  const [loggedInHospitalId, setLoggedInHospitalId] = useState<string | null>(null);
  const [loggedInRole, setLoggedInRole] = useState<string | null>(null);

  // Load state
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
      setActiveScenario(sysState.activeScenario);
      setLastBaselineRun(sysState.lastBaselineRun);
      setLastOptimizerRun(sysState.lastOptimizerRun);
      setAuditHistory(sysState.auditHistory);
    } catch (err) {
      console.error('Error refreshing state:', err);
    }
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const handleCreateRequest = async (reqData: Omit<BloodRequest, 'id' | 'createdAt' | 'status' | 'allocatedUnitIds'>) => {
    try {
      await apiClient.createRequest(reqData);
      await refreshState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoginSuccess = (hospitalId: string, roleName: string) => {
    setLoggedInHospitalId(hospitalId);
    setLoggedInRole(roleName);
  };

  const loggedInHospital = hospitals.find((h) => h.id === loggedInHospitalId);

  const scrollToContact = () => {
    const el = document.getElementById('contact-us');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      setIsContactUsOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* 1. Scientific & Clinical Disclaimer */}
      <MedicalDisclaimer />

      {/* 2. Task Bar (Navbar): Logo, Login, and Contact Us ONLY as requested */}
      <TopNav
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onOpenContactUs={scrollToContact}
        loggedInHospitalName={loggedInHospital ? loggedInHospital.code : null}
      />

      {/* 3. Main Dashboard Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-12">
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

      {/* Modals */}
      <HospitalLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        hospitals={hospitals}
        onLoginSuccess={handleLoginSuccess}
      />

      <HospitalListModal
        isOpen={isHospitalListOpen}
        onClose={() => setIsHospitalListOpen(false)}
        hospitals={hospitals}
        units={units}
        onSelectHospital={(hospId) => {
          setLoggedInHospitalId(hospId);
        }}
        onRequestFromHospital={(hospId) => {
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
