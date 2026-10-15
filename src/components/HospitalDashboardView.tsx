import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  LogOut,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  RotateCw,
  Clock,
  Sparkles,
  Truck,
  Droplet,
  AlertTriangle,
  PlusCircle,
  Filter,
  Check,
  X,
  FileText,
  Activity,
  Layers,
  Send,
  Calendar,
  Box,
  TrendingUp,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { HospitalProfile } from '../services/authService';
import { BloodUnit, BloodRequest, BloodComponentType, BloodGroup, RequestUrgency } from '../types/bloodstock';
import {
  hospitalDataService,
  NetworkRecommendation,
  IncomingHospitalRequest,
  JAIPUR_TRANSIT_MATRIX,
} from '../services/hospitalDataService';
import {
  checkBiologicalCompatibility,
  BLOOD_GROUP_LABELS,
  SHORT_BLOOD_GROUPS,
  COMPONENT_LABELS,
} from '../services/compatibilityRules';
import { HospitalSelector } from './HospitalSelector';

interface HospitalDashboardViewProps {
  profile: HospitalProfile;
  userHospitals: HospitalProfile[];
  onSelectHospital: (hospital: HospitalProfile) => void;
  units: BloodUnit[];
  requests: BloodRequest[];
  recommendations: NetworkRecommendation[];
  isRefreshing: boolean;
  onRefreshData: () => Promise<void>;
  onLogout: () => void;
  onOpenEmergencyRequest: () => void;
}

type DashboardTab = 'OVERVIEW' | 'INVENTORY' | 'ADD_STOCK' | 'REQUEST_BLOOD' | 'NETWORK_FULFILMENT';

export const HospitalDashboardView: React.FC<HospitalDashboardViewProps> = ({
  profile,
  userHospitals,
  onSelectHospital,
  units,
  requests,
  recommendations,
  isRefreshing,
  onRefreshData,
  onLogout,
  onOpenEmergencyRequest,
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('OVERVIEW');

  // Inventory Filters & Sorting
  const [componentFilter, setComponentFilter] = useState<string>('ALL');
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'FEFO_ASC' | 'FEFO_DESC' | 'GROUP' | 'COMPONENT' | 'DONATION'>('FEFO_ASC');

  // Add Stock Form State
  const [newStockComponent, setNewStockComponent] = useState<BloodComponentType>('PRBC');
  const [newStockGroup, setNewStockGroup] = useState<BloodGroup>('O_NEG');
  const [newStockQuantity, setNewStockQuantity] = useState<number>(2);
  const [newStockExpiryDays, setNewStockExpiryDays] = useState<number>(35);
  const [newStockDonationDate, setNewStockDonationDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [newStockInitialStatus, setNewStockInitialStatus] = useState<'QUARANTINED' | 'AVAILABLE'>('QUARANTINED');
  const [newStockBatchRef, setNewStockBatchRef] = useState<string>('');
  const [newStockScreened, setNewStockScreened] = useState<boolean>(false);
  const [isSubmittingStock, setIsSubmittingStock] = useState<boolean>(false);
  const isSubmittingStockRef = React.useRef<boolean>(false);
  const [stockFeedback, setStockFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Quarantine release state
  const [isReleasingUnitId, setIsReleasingUnitId] = useState<string | null>(null);

  // Discard Modal & Reason State
  const [discardTargetUnit, setDiscardTargetUnit] = useState<BloodUnit | null>(null);
  const [discardReasonCategory, setDiscardReasonCategory] = useState<string>('QC Screening Failed (TTI Positive)');
  const [discardNote, setDiscardNote] = useState<string>('');
  const [isDiscardingUnit, setIsDiscardingUnit] = useState<boolean>(false);

  // Reset form feedback and filters when hospital context switches
  useEffect(() => {
    setStockFeedback(null);
    setActionFeedback(null);
    setRequestFeedback(null);
    setDiscardTargetUnit(null);
  }, [profile.id]);

  // Adjust suggested shelf life when component type changes
  const handleComponentChange = (comp: BloodComponentType) => {
    setNewStockComponent(comp);
    if (comp === 'PLATELETS') {
      setNewStockExpiryDays(5);
    } else if (comp === 'PRBC') {
      setNewStockExpiryDays(35);
    } else if (comp === 'FFP' || comp === 'CRYOPRECIPITATE') {
      setNewStockExpiryDays(365);
    }
  };

  // Blood Request Form State
  const [reqComponent, setReqComponent] = useState<BloodComponentType>('PRBC');
  const [reqGroup, setReqGroup] = useState<BloodGroup>('O_NEG');
  const [reqQuantity, setReqQuantity] = useState<number>(2);
  const [reqUrgency, setReqUrgency] = useState<RequestUrgency>('URGENT_SURGERY');
  const [reqRequiredHours, setReqRequiredHours] = useState<number>(4);
  const [reqJustification, setReqJustification] = useState<string>('');
  const [reqPatientRef, setReqPatientRef] = useState<string>('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState<boolean>(false);
  const [requestFeedback, setRequestFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Incoming peer requests state
  const [incomingRequests, setIncomingRequests] = useState<IncomingHospitalRequest[]>([]);
  const [isLoadingIncoming, setIsLoadingIncoming] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load incoming requests from peer hospitals
  const fetchIncoming = async () => {
    setIsLoadingIncoming(true);
    try {
      const inc = await hospitalDataService.getIncomingPeerRequests(profile, userHospitals);
      setIncomingRequests(inc);
    } catch (e) {
      console.warn('Failed to fetch incoming requests:', e);
    } finally {
      setIsLoadingIncoming(false);
    }
  };

  useEffect(() => {
    fetchIncoming();
  }, [profile.id, userHospitals]);

  // Deduplicate inventory by unique unit ID to ensure each record is displayed strictly once
  const uniqueUnits = useMemo(() => {
    const seen = new Set<string>();
    const result: BloodUnit[] = [];
    for (const u of units) {
      if (!u.id || seen.has(u.id)) continue;
      seen.add(u.id);
      result.push(u);
    }
    return result;
  }, [units]);

  // Derived stock statistics: Never count quarantined, discarded or expired stock as usable inventory
  const now = Date.now();
  const quarantinedUnits = uniqueUnits.filter((u) => u.status === 'QUARANTINED');
  const usableUnits = uniqueUnits.filter(
    (u) => u.status === 'AVAILABLE' && new Date(u.expiresAt).getTime() > now
  );
  const reservedUnits = uniqueUnits.filter((u) => u.status === 'RESERVED' || u.status === 'IN_TRANSIT');
  const expiredUnits = uniqueUnits.filter(
    (u) => new Date(u.expiresAt).getTime() <= now || u.status === 'EXPIRED' || u.status === 'DISCARDED'
  );

  // Critical near-expiry units (< 48 hours remaining)
  const nearExpiryUnits = usableUnits.filter((u) => {
    const hoursLeft = (new Date(u.expiresAt).getTime() - now) / (3600 * 1000);
    return hoursLeft <= 48 && hoursLeft > 0;
  });

  // Group inventory by component and blood group
  const inventoryMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {
      PRBC: {},
      PLATELETS: {},
      FFP: {},
      CRYOPRECIPITATE: {},
    };

    usableUnits.forEach((u) => {
      if (!matrix[u.componentType]) matrix[u.componentType] = {};
      matrix[u.componentType][u.bloodGroup] = (matrix[u.componentType][u.bloodGroup] || 0) + 1;
    });

    return matrix;
  }, [usableUnits]);

  // Filtered & sorted inventory list
  const filteredUnits = useMemo(() => {
    return uniqueUnits
      .filter((u) => {
        if (componentFilter !== 'ALL' && u.componentType !== componentFilter) return false;
        if (groupFilter !== 'ALL' && u.bloodGroup !== groupFilter) return false;
        if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'FEFO_ASC') {
          return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
        }
        if (sortBy === 'FEFO_DESC') {
          return new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime();
        }
        if (sortBy === 'GROUP') {
          return a.bloodGroup.localeCompare(b.bloodGroup);
        }
        if (sortBy === 'COMPONENT') {
          return a.componentType.localeCompare(b.componentType);
        }
        if (sortBy === 'DONATION') {
          return new Date(b.donationDate || 0).getTime() - new Date(a.donationDate || 0).getTime();
        }
        return 0;
      });
  }, [uniqueUnits, componentFilter, groupFilter, statusFilter, sortBy]);

  // Requests breakdown
  const pendingRequests = requests.filter((r) => r.status === 'PENDING' || r.status === 'PARTIALLY_ALLOCATED');
  const fulfilledRequests = requests.filter((r) => r.status === 'FULFILLED');

  // Handle Quarantine Release
  const handleReleaseQuarantine = async (unit: BloodUnit) => {
    setIsReleasingUnitId(unit.id);
    setActionFeedback(null);
    try {
      const res = await hospitalDataService.verifyAndReleaseQuarantine(profile, unit.id, unit.syntheticBatchId);
      if (res.success) {
        setActionFeedback({
          type: 'success',
          message: `Unit ${unit.syntheticBatchId || unit.id.slice(0, 8)} (${unit.componentType} ${SHORT_BLOOD_GROUPS[unit.bloodGroup]}) successfully cleared QC and released to AVAILABLE usable stock.`,
        });
        await onRefreshData();
      } else {
        setActionFeedback({ type: 'error', message: res.error || 'Failed to release unit from quarantine.' });
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Error releasing unit.' });
    } finally {
      setIsReleasingUnitId(null);
    }
  };

  // Open Discard Confirmation Modal
  const openDiscardModal = (unit: BloodUnit) => {
    setDiscardTargetUnit(unit);
    setDiscardReasonCategory(
      unit.status === 'QUARANTINED'
        ? 'QC Screening Failed (TTI Positive)'
        : unit.status === 'EXPIRED'
        ? 'Expired / Stability Exceeded'
        : 'Quality Control Defect'
    );
    setDiscardNote('');
  };

  // Execute Confirmed Discard with Required Reason
  const handleConfirmDiscard = async () => {
    if (!discardTargetUnit) return;
    setIsDiscardingUnit(true);
    setActionFeedback(null);
    try {
      const finalReason = discardNote.trim()
        ? `${discardReasonCategory} — ${discardNote.trim()}`
        : discardReasonCategory;

      const res = await hospitalDataService.discardUnit(profile, discardTargetUnit.id, finalReason);
      if (res.success) {
        setActionFeedback({
          type: 'success',
          message: `Unit ${discardTargetUnit.syntheticBatchId || discardTargetUnit.id.slice(0, 8)} (${discardTargetUnit.componentType}) marked as DISCARDED. Reason: ${finalReason}`,
        });
        setDiscardTargetUnit(null);
        await onRefreshData();
      } else {
        setActionFeedback({ type: 'error', message: res.error || 'Failed to discard unit.' });
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Error discarding unit.' });
    } finally {
      setIsDiscardingUnit(false);
    }
  };

  // Handle Add Stock submission with strict deduplication guard
  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingStockRef.current || isSubmittingStock) {
      return;
    }
    isSubmittingStockRef.current = true;
    setIsSubmittingStock(true);
    setStockFeedback(null);

    try {
      const expiryDate = new Date(Date.now() + newStockExpiryDays * 24 * 3600 * 1000).toISOString();
      const donationIso = newStockDonationDate
        ? new Date(newStockDonationDate).toISOString()
        : new Date().toISOString();

      const res = await hospitalDataService.addBloodStock(profile, {
        componentType: newStockComponent,
        bloodGroup: newStockGroup,
        quantity: Number(newStockQuantity),
        expiryDate,
        donationDate: donationIso,
        batchRef: newStockBatchRef.trim() || undefined,
        screeningPassed: newStockScreened,
        initialStatus: newStockInitialStatus,
        allowQuarantine: true,
      });

      if (!res.success) {
        setStockFeedback({ type: 'error', message: res.error || 'Failed to register blood stock.' });
      } else {
        const statusLabel = newStockInitialStatus === 'QUARANTINED' ? 'QUARANTINED (Testing Pending)' : 'AVAILABLE (Usable)';
        setStockFeedback({
          type: 'success',
          message: `Successfully registered ${res.insertedCount} unit(s) of ${newStockComponent} (${SHORT_BLOOD_GROUPS[newStockGroup]}) into ${statusLabel}.`,
        });
        setNewStockBatchRef('');
        await onRefreshData();
      }
    } catch (err: any) {
      setStockFeedback({ type: 'error', message: err.message || 'An unexpected error occurred.' });
    } finally {
      // Cooldown to lock out double-clicks
      setTimeout(() => {
        isSubmittingStockRef.current = false;
        setIsSubmittingStock(false);
      }, 500);
    }
  };

  // Handle Request Blood submission
  const handleCreateRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestFeedback(null);
    setIsSubmittingRequest(true);

    try {
      // Check current hospital's eligible inventory
      const existingEligible = usableUnits.filter((u) => {
        const comp = checkBiologicalCompatibility(u.componentType, u.bloodGroup, reqComponent, reqGroup);
        return comp.isCompatible;
      });

      const requiredBy = new Date(Date.now() + reqRequiredHours * 3600 * 1000).toISOString();
      const res = await hospitalDataService.createBloodRequest(profile, {
        componentType: reqComponent,
        bloodGroup: reqGroup,
        quantity: Number(reqQuantity),
        urgency: reqUrgency,
        requiredBy,
        clinicalJustification: reqJustification,
        patientCaseRef: reqPatientRef.trim() || undefined,
      });

      if (!res.success) {
        setRequestFeedback({ type: 'error', message: res.error || 'Failed to create request.' });
      } else {
        const advice =
          existingEligible.length > 0
            ? `Note: ${existingEligible.length} compatible unit(s) currently exist in local reserves.`
            : 'Zero local compatible units available — routed to Jaipur regional network.';

        setRequestFeedback({
          type: 'success',
          message: `Inter-hospital request created (ID: ${res.requestId?.slice(0, 8)}). ${advice}`,
        });
        setReqJustification('');
        setReqPatientRef('');
        await onRefreshData();
        await fetchIncoming();
      }
    } catch (err: any) {
      setRequestFeedback({ type: 'error', message: err.message || 'An unexpected error occurred.' });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Approve an incoming request
  const handleApproveIncoming = async (req: IncomingHospitalRequest) => {
    setActionFeedback(null);
    try {
      const approveQty = Math.min(req.quantity, req.eligibleQuantityAtCurrentHospital);
      if (approveQty <= 0) {
        setActionFeedback({
          type: 'error',
          message: 'Cannot approve: Current hospital has 0 eligible unreserved units for this request.',
        });
        return;
      }

      const res = await hospitalDataService.approveIncomingRequest(profile, req.id, approveQty);
      if (res.success) {
        setActionFeedback({
          type: 'success',
          message: `Approved and atomically reserved ${res.approvedCount} unit(s) for ${req.requestingHospitalName}. Dispatch corridor initiated.`,
        });
        await onRefreshData();
        await fetchIncoming();
      } else {
        setActionFeedback({ type: 'error', message: res.error || 'Failed to approve request.' });
      }
    } catch (e: any) {
      setActionFeedback({ type: 'error', message: e.message || 'Error executing atomic reservation.' });
    }
  };

  // Reject an incoming request
  const handleRejectIncoming = async (requestId: string) => {
    setActionFeedback(null);
    try {
      const res = await hospitalDataService.rejectIncomingRequest(profile, requestId, 'Insufficient local inventory reserves');
      if (res.success) {
        setActionFeedback({ type: 'success', message: 'Incoming request rejected.' });
        await fetchIncoming();
      } else {
        setActionFeedback({ type: 'error', message: res.error || 'Failed to reject request.' });
      }
    } catch (e: any) {
      setActionFeedback({ type: 'error', message: e.message });
    }
  };

  // Cancel an outgoing request
  const handleCancelOutgoing = async (requestId: string) => {
    try {
      const res = await hospitalDataService.cancelRequest(profile, requestId);
      if (res.success) {
        await onRefreshData();
      }
    } catch (e) {
      console.warn('Failed to cancel request:', e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Card with Hospital Identity & Switcher */}
      <div className="bg-white rounded-2xl border border-blue-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold shadow-md shrink-0">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">{profile.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>{profile.account_status}</span>
                </span>
                {profile.role && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                    Role: {profile.role}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{profile.address}, {profile.city}</span>
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{profile.phone}</span>
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{profile.email}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Refresh, Emergency Request & Logout */}
          <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto flex-wrap">
            <button
              onClick={onRefreshData}
              disabled={isRefreshing}
              className="py-2.5 px-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs transition-colors border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh inventory and requests from database"
            >
              <RotateCw className={`w-3.5 h-3.5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Live'}</span>
            </button>

            <button
              onClick={onOpenEmergencyRequest}
              className="flex-1 md:flex-initial py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Droplet className="w-4 h-4 fill-white" />
              <span>Emergency STAT</span>
            </button>

            <button
              onClick={onLogout}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors border border-slate-300 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-slate-600" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Dedicated Hospital Switcher Bar */}
        <div className="pt-4 border-t border-slate-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-blue-50/40 p-4 rounded-xl border border-blue-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-900">Active Hospital Facility Context</span>
              <span className="text-[10px] font-mono bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">
                RLS Scoped
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Only inventory and clinical orders authorized for this hospital facility are displayed and modified.
            </p>
          </div>

          <div className="w-full lg:w-auto">
            <HospitalSelector
              userHospitals={userHospitals}
              activeHospital={profile}
              onSelectHospital={onSelectHospital}
              isLoading={isRefreshing}
              showQuickPills={true}
            />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
            activeTab === 'OVERVIEW'
              ? 'border-blue-600 text-blue-700 bg-white font-bold shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>A. Overview & Metrics</span>
        </button>

        <button
          onClick={() => setActiveTab('INVENTORY')}
          className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
            activeTab === 'INVENTORY'
              ? 'border-blue-600 text-blue-700 bg-white font-bold shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Box className="w-4 h-4" />
          <span>B. Blood Inventory ({units.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ADD_STOCK')}
          className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
            activeTab === 'ADD_STOCK'
              ? 'border-blue-600 text-blue-700 bg-white font-bold shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <PlusCircle className="w-4 h-4 text-emerald-600" />
          <span>C. Add Blood Stock</span>
        </button>

        <button
          onClick={() => setActiveTab('REQUEST_BLOOD')}
          className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
            activeTab === 'REQUEST_BLOOD'
              ? 'border-blue-600 text-blue-700 bg-white font-bold shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Send className="w-4 h-4 text-blue-600" />
          <span>D. Request Blood</span>
        </button>

        <button
          onClick={() => setActiveTab('NETWORK_FULFILMENT')}
          className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
            activeTab === 'NETWORK_FULFILMENT'
              ? 'border-blue-600 text-blue-700 bg-white font-bold shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Truck className="w-4 h-4 text-indigo-600" />
          <span>E. Network Fulfilment ({incomingRequests.length})</span>
        </button>
      </div>

      {/* =========================================================================
          TAB A: OVERVIEW & ALERTS
         ========================================================================= */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Critical Clinical Alerts Bar */}
          {(nearExpiryUnits.length > 0 || usableUnits.length < 5) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {nearExpiryUnits.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-amber-900 text-xs">FEFO Alert: Near-Expiry Units Detected</h4>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      {nearExpiryUnits.length} unit(s) have less than 48 hours remaining before expiry. Prioritize for local transfusion or emergency allocation.
                    </p>
                  </div>
                </div>
              )}

              {usableUnits.length < 5 && (
                <div className="p-4 bg-red-50 border border-red-300 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-red-900 text-xs">Low Reserve Alert: Critical Supply Level</h4>
                    <p className="text-[11px] text-red-800 mt-0.5">
                      Usable inventory is critically low ({usableUnits.length} units). Request emergency stock from peer Jaipur facilities.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Metric Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">Usable Stock</span>
                <Droplet className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">{usableUnits.length}</div>
              <p className="text-[10px] text-emerald-700 mt-0.5 font-semibold">Clinically Cleared</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Quarantine / QC</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-900">{quarantinedUnits.length}</div>
              <button
                onClick={() => {
                  setStatusFilter('QUARANTINED');
                  setActiveTab('INVENTORY');
                }}
                className="text-[10px] text-amber-700 hover:text-amber-900 mt-0.5 font-semibold underline cursor-pointer text-left block"
              >
                Review Testing ({quarantinedUnits.length})
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">Reserved</span>
                <ShieldCheck className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">{reservedUnits.length}</div>
              <p className="text-[10px] text-amber-700 mt-0.5 font-semibold">Committed to Orders</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">Expired / Discard</span>
                <X className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">{expiredUnits.length}</div>
              <p className="text-[10px] text-red-600 mt-0.5 font-semibold">Excluded from Supply</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">Pending Orders</span>
                <Activity className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">{pendingRequests.length}</div>
              <p className="text-[10px] text-blue-700 mt-0.5 font-semibold">{fulfilledRequests.length} Fulfilled</p>
            </div>
          </div>

          {/* Component & Group Matrix Breakdown */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Usable Inventory Breakdown (Component × Blood Group)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Actual counts from database records strictly under PostgreSQL Row-Level Security.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('ADD_STOCK')}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs border border-emerald-200 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Add Stock</span>
              </button>
            </div>

            {usableUnits.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                <Box className="w-8 h-8 text-slate-400 mx-auto" />
                <h4 className="font-bold text-slate-700 text-sm">No usable stock currently registered in database</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  This facility currently has zero units in <code>public.blood_units</code>. Use the Add Blood Stock form to register verified units.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="p-3">Component Type</th>
                      <th className="p-3 text-center">O−</th>
                      <th className="p-3 text-center">O+</th>
                      <th className="p-3 text-center">A−</th>
                      <th className="p-3 text-center">A+</th>
                      <th className="p-3 text-center">B−</th>
                      <th className="p-3 text-center">B+</th>
                      <th className="p-3 text-center">AB−</th>
                      <th className="p-3 text-center">AB+</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(['PRBC', 'PLATELETS', 'FFP', 'CRYOPRECIPITATE'] as BloodComponentType[]).map((comp) => {
                      const counts = inventoryMatrix[comp] || {};
                      const rowTotal = Object.values(counts).reduce((a, b) => a + b, 0);

                      return (
                        <tr key={comp} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-bold text-slate-800">
                            {COMPONENT_LABELS[comp] || comp}
                          </td>
                          {(['O_NEG', 'O_POS', 'A_NEG', 'A_POS', 'B_NEG', 'B_POS', 'AB_NEG', 'AB_POS'] as BloodGroup[]).map((grp) => {
                            const val = counts[grp] || 0;
                            return (
                              <td key={grp} className="p-3 text-center font-mono">
                                {val > 0 ? (
                                  <span className="inline-block px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                    {val}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="p-3 text-right font-mono font-bold text-slate-900">
                            {rowTotal}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB B: BLOOD INVENTORY TABLE
         ========================================================================= */}
      {activeTab === 'INVENTORY' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5 animate-in fade-in duration-150">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Box className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Facility Blood Stock Inventory
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  {profile.name}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Displaying {filteredUnits.length} of {units.length} total units. Sorted by FEFO (Earliest Expiry first) for clinical safety.
              </p>
            </div>

            {/* Filter & Sort Bar */}
            <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
              {/* Component Filter */}
              <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-500 ml-1" />
                <select
                  value={componentFilter}
                  onChange={(e) => setComponentFilter(e.target.value)}
                  className="bg-transparent border-none text-slate-700 font-semibold focus:outline-none pr-1 cursor-pointer"
                  title="Filter by Blood Component Type"
                >
                  <option value="ALL">All Components</option>
                  <option value="PRBC">PRBC (Red Cells)</option>
                  <option value="PLATELETS">Platelets (Apheresis)</option>
                  <option value="FFP">Plasma (FFP)</option>
                  <option value="CRYOPRECIPITATE">Cryoprecipitate</option>
                </select>
              </div>

              {/* Blood Group Filter */}
              <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="bg-transparent border-none text-slate-700 font-semibold focus:outline-none pr-1 cursor-pointer font-mono"
                  title="Filter by Blood Group"
                >
                  <option value="ALL">All Groups</option>
                  <option value="O_NEG">O−</option>
                  <option value="O_POS">O+</option>
                  <option value="A_NEG">A−</option>
                  <option value="A_POS">A+</option>
                  <option value="B_NEG">B−</option>
                  <option value="B_POS">B+</option>
                  <option value="AB_NEG">AB−</option>
                  <option value="AB_POS">AB+</option>
                </select>
              </div>

              {/* Stock Status Filter */}
              <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent border-none text-slate-700 font-semibold focus:outline-none pr-1 cursor-pointer"
                  title="Filter by Unit Status"
                >
                  <option value="ALL">All Statuses ({units.length})</option>
                  <option value="AVAILABLE">Available / Usable ({usableUnits.length})</option>
                  <option value="QUARANTINED">Quarantined / In-QC ({quarantinedUnits.length})</option>
                  <option value="RESERVED">Reserved ({reservedUnits.length})</option>
                  <option value="IN_TRANSIT">In Transit</option>
                  <option value="EXPIRED">Expired ({expiredUnits.length})</option>
                  <option value="DISCARDED">Discarded</option>
                </select>
              </div>

              {/* Sort By Dropdown */}
              <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent border-none text-slate-700 font-semibold focus:outline-none pr-1 cursor-pointer"
                  title="Sort Order"
                >
                  <option value="FEFO_ASC">Sort: Earliest Expiry (FEFO)</option>
                  <option value="FEFO_DESC">Sort: Furthest Expiry</option>
                  <option value="GROUP">Sort: Blood Group (A-Z)</option>
                  <option value="COMPONENT">Sort: Component Type</option>
                  <option value="DONATION">Sort: Most Recently Donated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Feedback Banner */}
          {actionFeedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                actionFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {actionFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{actionFeedback.message}</span>
              </div>
              <button
                onClick={() => setActionFeedback(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Loading State */}
          {isRefreshing ? (
            <div className="p-12 text-center bg-blue-50/40 rounded-xl border border-blue-200 animate-pulse space-y-3">
              <RotateCw className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
              <h4 className="font-bold text-slate-800 text-sm">
                Refreshing live inventory for {profile.name}...
              </h4>
              <p className="text-xs text-slate-500">
                Synchronizing with PostgreSQL <code>public.blood_units</code> under active facility authorization.
              </p>
            </div>
          ) : filteredUnits.length === 0 ? (
            /* Honest Empty States */
            units.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
                <Box className="w-10 h-10 text-slate-400 mx-auto" />
                <h4 className="font-bold text-slate-800 text-base">
                  No Blood Units in Database for {profile.name}
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  The database currently contains zero blood units for this facility. No placeholder stock is fabricated. Use the form below to record newly screened blood units.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('ADD_STOCK')}
                    className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Register First Blood Batch</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                <Filter className="w-8 h-8 text-slate-400 mx-auto" />
                <h4 className="font-bold text-slate-800 text-sm">No inventory matches active filters</h4>
                <p className="text-xs text-slate-500">
                  Try adjusting the Component, Blood Group, or Status filters to inspect other units.
                </p>
                <button
                  onClick={() => {
                    setComponentFilter('ALL');
                    setGroupFilter('ALL');
                    setStatusFilter('ALL');
                  }}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition-colors mt-2"
                >
                  Reset All Filters
                </button>
              </div>
            )
          ) : (
            /* Populated Inventory Table */
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="p-3">Batch / Inventory ID</th>
                    <th className="p-3">Component</th>
                    <th className="p-3">Blood Group</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Expiry (FEFO)</th>
                    <th className="p-3">Shelf Life Remaining</th>
                    <th className="p-3">QC & Verification</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUnits.map((unit) => {
                    const hoursLeft = Math.round(
                      (new Date(unit.expiresAt).getTime() - now) / (3600 * 1000)
                    );
                    const isExpired = hoursLeft <= 0 || unit.status === 'EXPIRED';
                    const isNearExpiry = hoursLeft > 0 && hoursLeft <= 48;
                    const isQuarantined = unit.status === 'QUARANTINED';
                    const isAvailable = unit.status === 'AVAILABLE' && !isExpired;
                    const isReleasing = isReleasingUnitId === unit.id;

                    return (
                      <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Batch / Inventory ID */}
                        <td className="p-3 font-mono text-slate-800">
                          <div className="font-bold text-slate-900">
                            {unit.syntheticBatchId || `BATCH-${unit.id.slice(0, 8).toUpperCase()}`}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            UUID: {unit.id.slice(0, 8)}...
                          </div>
                        </td>

                        {/* Component */}
                        <td className="p-3 font-bold text-slate-800">
                          {unit.componentType}
                        </td>

                        {/* Blood Group */}
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded font-mono font-bold bg-blue-50 text-blue-900 border border-blue-200">
                            {SHORT_BLOOD_GROUPS[unit.bloodGroup] || unit.bloodGroup}
                          </span>
                        </td>

                        {/* Quantity */}
                        <td className="p-3 font-mono text-slate-800 font-semibold">
                          1 Unit
                        </td>

                        {/* Status */}
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider inline-flex items-center gap-1 ${
                              isQuarantined
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : isAvailable
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : unit.status === 'RESERVED'
                                ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                : isExpired
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : 'bg-slate-100 text-slate-800 border border-slate-200'
                            }`}
                          >
                            {isQuarantined ? (
                              <>
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Quarantined</span>
                              </>
                            ) : isAvailable ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Available</span>
                              </>
                            ) : (
                              <span>{unit.status}</span>
                            )}
                          </span>
                        </td>

                        {/* Expiry Date (FEFO) */}
                        <td className="p-3 font-mono text-[11px]">
                          {new Date(unit.expiresAt).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>

                        {/* Shelf Life Remaining */}
                        <td className="p-3">
                          {isExpired ? (
                            <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[10px]">
                              EXPIRED
                            </span>
                          ) : (
                            <span
                              className={`text-[11px] font-semibold ${
                                isNearExpiry ? 'text-amber-700 font-bold flex items-center gap-1' : 'text-slate-700'
                              }`}
                            >
                              {isNearExpiry && <AlertTriangle className="w-3 h-3 text-amber-600 inline shrink-0" />}
                              <span>{hoursLeft} hours</span>
                            </span>
                          )}
                        </td>

                        {/* QC / Verification Status */}
                        <td className="p-3">
                          {isQuarantined ? (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1 w-fit">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Testing Pending</span>
                            </span>
                          ) : isExpired ? (
                            <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold flex items-center gap-1 w-fit">
                              <X className="w-3 h-3 text-red-500" />
                              <span>Expired / Unusable</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center gap-1 w-fit">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Screened & Cleared</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isQuarantined && (
                              <button
                                onClick={() => handleReleaseQuarantine(unit)}
                                disabled={isReleasing}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                title="Release QC: Authorized clinical release verifying mandatory infectious disease (TTI) screening is negative. Transitions unit into AVAILABLE usable inventory."
                              >
                                {isReleasing ? (
                                  <RotateCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                                <span>Release QC</span>
                              </button>
                            )}

                            {(isQuarantined || isExpired) && (
                              <button
                                onClick={() => openDiscardModal(unit)}
                                className="px-2 py-1 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 border border-slate-300 hover:border-red-300 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                                title="Discard: Safely mark unit unusable with a mandatory operational/clinical reason. Excludes unit from usable inventory while preserving full clinical audit history."
                              >
                                Discard
                              </button>
                            )}

                            {isAvailable && (
                              <span className="text-[10px] text-emerald-700 font-semibold px-2 py-0.5">
                                Active Ready
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB C: ADD BLOOD STOCK FORM
         ========================================================================= */}
      {activeTab === 'ADD_STOCK' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs max-w-2xl mx-auto space-y-6 animate-in fade-in duration-150">
          <div>
            <div className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">
                Register New Blood Stock
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Add newly donated or delivered units to <strong>{profile.name}</strong>. Stock defaults to Quarantine until laboratory serological screening (TTI) is verified.
            </p>
          </div>

          {stockFeedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                stockFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {stockFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <span className="font-semibold">{stockFeedback.message}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleAddStockSubmit} className="space-y-5">
            {/* Entry Mode / Quarantine Selector */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Registration & Quality Control Status
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                    newStockInitialStatus === 'QUARANTINED'
                      ? 'bg-amber-50/80 border-amber-300 text-amber-900 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="stockStatusMode"
                    checked={newStockInitialStatus === 'QUARANTINED'}
                    onChange={() => {
                      setNewStockInitialStatus('QUARANTINED');
                      setNewStockScreened(false);
                    }}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="font-bold text-xs block">
                      Quarantine / Testing Pending
                    </span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      Recommended. Units are held in quarantine and cannot be allocated until certified in lab QC.
                    </span>
                  </div>
                </label>

                <label
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                    newStockInitialStatus === 'AVAILABLE'
                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="stockStatusMode"
                    checked={newStockInitialStatus === 'AVAILABLE'}
                    onChange={() => {
                      setNewStockInitialStatus('AVAILABLE');
                      setNewStockScreened(true);
                    }}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-bold text-xs block">
                      Direct Usable Release
                    </span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      Requires certified serological TTI screening results and valid batch reference.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Component & Blood Group */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Component Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={newStockComponent}
                  onChange={(e) => handleComponentChange(e.target.value as BloodComponentType)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="PRBC">Packed Red Blood Cells (PRBC) ~35-42d</option>
                  <option value="PLATELETS">Platelets (Apheresis) ~5d</option>
                  <option value="FFP">Fresh Frozen Plasma (FFP) ~365d</option>
                  <option value="CRYOPRECIPITATE">Cryoprecipitate (CRYO) ~365d</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Blood Group <span className="text-red-500">*</span>
                </label>
                <select
                  value={newStockGroup}
                  onChange={(e) => setNewStockGroup(e.target.value as BloodGroup)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono cursor-pointer"
                >
                  <option value="O_NEG">O− (O Negative - Universal Red Cell)</option>
                  <option value="O_POS">O+ (O Positive)</option>
                  <option value="A_NEG">A− (A Negative)</option>
                  <option value="A_POS">A+ (A Positive)</option>
                  <option value="B_NEG">B− (B Negative)</option>
                  <option value="B_POS">B+ (B Positive)</option>
                  <option value="AB_NEG">AB− (AB Negative)</option>
                  <option value="AB_POS">AB+ (AB Positive - Universal Recipient)</option>
                </select>
              </div>
            </div>

            {/* Quantity & Donation Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Quantity (Units) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={newStockQuantity}
                  onChange={(e) => setNewStockQuantity(parseInt(e.target.value, 10) || 1)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Integer between 1 and 100 units per batch.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Donation Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  value={newStockDonationDate}
                  onChange={(e) => setNewStockDonationDate(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Must be today or a past date.
                </span>
              </div>
            </div>

            {/* Shelf Life & Batch Ref */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Shelf Life Remaining (Days) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={newStockExpiryDays}
                  onChange={(e) => setNewStockExpiryDays(parseInt(e.target.value, 10) || 1)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Calculated expiry: {new Date(Date.now() + newStockExpiryDays * 24 * 3600 * 1000).toLocaleDateString()}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Batch / Donation Reference {newStockInitialStatus === 'AVAILABLE' && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  placeholder="e.g. BATCH-JPR-2026-09A"
                  value={newStockBatchRef}
                  onChange={(e) => setNewStockBatchRef(e.target.value)}
                  required={newStockInitialStatus === 'AVAILABLE'}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Donor blood bank laboratory identification code.
                </span>
              </div>
            </div>

            {/* Quality & Serology Screening Checkbox */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newStockScreened}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setNewStockScreened(checked);
                    if (!checked && newStockInitialStatus === 'AVAILABLE') {
                      setNewStockInitialStatus('QUARANTINED');
                    }
                  }}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">
                    Quality Control & Serology Testing Verified
                  </span>
                  <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                    Confirm that mandatory transfusion-transmissible infection (TTI) screenings (HIV, Hep B/C, Syphilis, Malaria) have cleared according to Indian Drug & Cosmetics Act rules.
                  </span>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmittingStock}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmittingStock ? (
                <span>Registering Units to Database...</span>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>
                    Register {newStockQuantity} Unit(s) to {profile.name}
                  </span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* =========================================================================
          TAB D: REQUEST BLOOD FORM
         ========================================================================= */}
      {activeTab === 'REQUEST_BLOOD' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs max-w-2xl mx-auto space-y-6 animate-in fade-in duration-150">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-600" />
              <span>Request Blood from Regional Network</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Order blood components for unmet clinical demand at {profile.name}. Peer Jaipur facilities are evaluated using biological compatibility and transit corridors.
            </p>
          </div>

          {requestFeedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                requestFeedback.type === 'success'
                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {requestFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              )}
              <span>{requestFeedback.message}</span>
            </div>
          )}

          <form onSubmit={handleCreateRequestSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Required Component <span className="text-red-500">*</span>
                </label>
                <select
                  value={reqComponent}
                  onChange={(e) => setReqComponent(e.target.value as BloodComponentType)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PRBC">Packed Red Blood Cells (PRBC)</option>
                  <option value="PLATELETS">Platelets (Apheresis)</option>
                  <option value="FFP">Fresh Frozen Plasma (FFP)</option>
                  <option value="CRYOPRECIPITATE">Cryoprecipitate (CRYO)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Recipient Blood Group <span className="text-red-500">*</span>
                </label>
                <select
                  value={reqGroup}
                  onChange={(e) => setReqGroup(e.target.value as BloodGroup)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                >
                  <option value="O_NEG">O− (O Negative)</option>
                  <option value="O_POS">O+ (O Positive)</option>
                  <option value="A_NEG">A− (A Negative)</option>
                  <option value="A_POS">A+ (A Positive)</option>
                  <option value="B_NEG">B− (B Negative)</option>
                  <option value="B_POS">B+ (B Positive)</option>
                  <option value="AB_NEG">AB− (AB Negative)</option>
                  <option value="AB_POS">AB+ (AB Positive)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Quantity (Units) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={reqQuantity}
                  onChange={(e) => setReqQuantity(parseInt(e.target.value, 10) || 1)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Clinical Urgency <span className="text-red-500">*</span>
                </label>
                <select
                  value={reqUrgency}
                  onChange={(e) => setReqUrgency(e.target.value as RequestUrgency)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                >
                  <option value="CRITICAL_TRAUMA">CRITICAL_TRAUMA (STAT Emergency)</option>
                  <option value="URGENT_SURGERY">URGENT_SURGERY (&lt; 4-6 Hours)</option>
                  <option value="ROUTINE">ROUTINE (Scheduled Surgery)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Required Within (Hours) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="72"
                  value={reqRequiredHours}
                  onChange={(e) => setReqRequiredHours(parseInt(e.target.value, 10) || 1)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Clinical Justification & Ward Reference <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                placeholder="e.g. ICU post-operative haemorrhage or acute trauma resuscitation."
                value={reqJustification}
                onChange={(e) => setReqJustification(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Patient Case Identifier (Confidential Hospital Reference)
              </label>
              <input
                type="text"
                placeholder="e.g. CASE-ICU-772 (Protected reference; not shared publicly)"
                value={reqPatientRef}
                onChange={(e) => setReqPatientRef(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Complies with patient-data confidentiality: Only minimum case ID is preserved for local reconciliation.
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmittingRequest}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmittingRequest ? (
                <span>Submitting Request...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Inter-Hospital Request</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* =========================================================================
          TAB E: NETWORK FULFILMENT & PEER REQUESTS
         ========================================================================= */}
      {activeTab === 'NETWORK_FULFILMENT' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {actionFeedback && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-start gap-2.5 ${
                actionFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {actionFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              )}
              <span>{actionFeedback.message}</span>
            </div>
          )}

          {/* Incoming Requests Section: Donor Fulfilment */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-indigo-600" />
                  <span>Incoming Peer Requests (Current Facility as Donor)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review and fulfill urgent demand from other Jaipur network facilities. Approvals use atomic row locking.
                </p>
              </div>
              <button
                onClick={fetchIncoming}
                disabled={isLoadingIncoming}
                className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 text-blue-600 ${isLoadingIncoming ? 'animate-spin' : ''}`} />
                <span>Refresh Requests</span>
              </button>
            </div>

            {incomingRequests.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-slate-800 text-xs">No pending requests from peer facilities</h4>
                <p className="text-[11px] text-slate-500">
                  All inter-hospital requests across Jaipur are currently fulfilled or in transit.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {incomingRequests.map((req) => {
                  const hasEligibleStock = req.eligibleQuantityAtCurrentHospital > 0;

                  return (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 bg-white transition-all shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">
                            {req.requestingHospitalName}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              req.urgency === 'CRITICAL_TRAUMA'
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : req.urgency === 'URGENT_SURGERY'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {req.urgency === 'CRITICAL_TRAUMA' ? 'STAT / CRITICAL' : req.urgency === 'URGENT_SURGERY' ? 'URGENT' : 'ROUTINE'}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {req.patientCaseRef}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                          <span>
                            Demands: <strong>{req.quantity} unit(s)</strong> of{' '}
                            <strong>{req.componentType} ({req.bloodGroup})</strong>
                          </span>
                          <span>·</span>
                          <span className="font-mono text-[11px]">
                            Deadline: {new Date(req.requiredBy).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span
                            className={`font-semibold ${
                              hasEligibleStock ? 'text-emerald-700' : 'text-slate-500'
                            }`}
                          >
                            Eligible at {profile.name}: {req.eligibleQuantityAtCurrentHospital} unit(s)
                          </span>
                          <span>·</span>
                          <span className={req.isFeasible ? 'text-blue-700' : 'text-amber-700'}>
                            {req.isFeasible ? '✓ Transit Feasible' : '⚠ Tight Window'}
                          </span>
                        </div>
                      </div>

                      {/* Donor Approval / Reject Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRejectIncoming(req.id)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          disabled={!hasEligibleStock}
                          onClick={() => handleApproveIncoming(req)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                            hasEligibleStock
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve & Reserve ({Math.min(req.quantity, req.eligibleQuantityAtCurrentHospital)})</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Network Recommendations: Potential Sources for Current Hospital */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Peer Jaipur Hospital Transfer Corridors & Allocation Recommendations</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Biological compatibility and shortest FEFO transfer times from partner Jaipur hospitals.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {recommendations.slice(0, 6).map((rec) => (
                <div
                  key={rec.unitId}
                  className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 hover:bg-blue-50/70 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">{rec.sourceHospitalName}</span>
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-blue-600 text-white">
                      Score: {rec.priorityScore}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 flex items-center justify-between">
                    <span>
                      {rec.componentType} · <strong>{rec.bloodGroup}</strong>
                    </span>
                    <span className="text-[11px] text-blue-800 font-mono">
                      Corridor ETA: ~{rec.estimatedTransitMinutes}m
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed border-t border-blue-100 pt-1.5">
                    {rec.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Discard Confirmation Modal */}
      {discardTargetUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-red-600 font-bold text-base">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <h4>Discard Blood Unit</h4>
              </div>
              <button
                onClick={() => setDiscardTargetUnit(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Mark this unit as unusable. A specific clinical or operational reason is mandatory to maintain regulatory compliance and audit history.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1 font-mono">
              <div className="flex justify-between text-slate-600">
                <span>Unit ID:</span>
                <span className="font-bold text-slate-900">{discardTargetUnit.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Component / Group:</span>
                <span className="font-bold text-slate-900">
                  {discardTargetUnit.componentType} ({SHORT_BLOOD_GROUPS[discardTargetUnit.bloodGroup] || discardTargetUnit.bloodGroup})
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Current Status:</span>
                <span className="font-bold text-amber-700">{discardTargetUnit.status}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Discard Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={discardReasonCategory}
                  onChange={(e) => setDiscardReasonCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                >
                  <option value="QC Screening Failed (TTI Positive)">QC Screening Failed (TTI Positive)</option>
                  <option value="Expired / Stability Exceeded">Expired / Stability Exceeded</option>
                  <option value="Hemolysis / Clot Observed">Hemolysis / Clot Observed</option>
                  <option value="Temperature Excursion / Cold-Chain Deviation">Temperature Excursion / Cold-Chain Deviation</option>
                  <option value="Broken Port Seal / Leakage / Container Defect">Broken Port Seal / Leakage / Container Defect</option>
                  <option value="Operator Clinical Discard">Operator Clinical Discard</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Additional Operator Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Visual inspection showed micro-clots during cross-match"
                  value={discardNote}
                  onChange={(e) => setDiscardNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 leading-tight">
              <strong>Notice:</strong> Discarded units are immediately excluded from all usable supply and cannot be allocated. Full history is preserved.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDiscardTargetUnit(null)}
                disabled={isDiscardingUnit}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                disabled={isDiscardingUnit}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDiscardingUnit ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}
                <span>Confirm Discard</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
