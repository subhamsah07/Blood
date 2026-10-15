import React, { useState } from 'react';
import {
  Building2,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  ShieldCheck,
  AlertCircle,
  Clock,
  Ban,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  MapPin,
  Phone,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { authService, HospitalProfile } from '../services/authService';

interface HospitalLoginPageProps {
  onLoginSuccess: (profile: HospitalProfile, userHospitals: HospitalProfile[]) => void;
  onCancel?: () => void;
  isModal?: boolean;
}

interface JaipurHospitalOption {
  id: string;
  name: string;
  shortLabel: string;
  location: string;
  phone: string;
  code: string;
  matcher: (h: HospitalProfile) => boolean;
}

export const JAIPUR_HOSPITAL_OPTIONS: JaipurHospitalOption[] = [
  {
    id: 'b1000000-0000-0000-0000-000000000001',
    name: 'Fortis Escorts Hospital, Jaipur',
    shortLabel: 'Fortis Escorts',
    location: 'JLN Marg, Malviya Nagar, Jaipur',
    phone: '+91 141 254 7000',
    code: 'FEH-JPR',
    matcher: (h) =>
      h.id === 'b1000000-0000-0000-0000-000000000001' ||
      h.name.toLowerCase().includes('fortis'),
  },
  {
    id: 'b1000000-0000-0000-0000-000000000002',
    name: 'Rukmani Birla Hospital (CK Birla Hospitals)',
    shortLabel: 'Rukmani Birla',
    location: 'Gopalpura Bypass Rd, Shanti Nagar, Jaipur',
    phone: '+91 141 309 0309',
    code: 'RBH-CKB',
    matcher: (h) =>
      h.id === 'b1000000-0000-0000-0000-000000000002' ||
      h.name.toLowerCase().includes('rukmani') ||
      h.name.toLowerCase().includes('birla'),
  },
  {
    id: 'b1000000-0000-0000-0000-000000000003',
    name: 'Narayana Multispeciality Hospital, Jaipur',
    shortLabel: 'Narayana Multi',
    location: 'Sector 28, Kumbha Marg, Pratap Nagar, Jaipur',
    phone: '+91 141 712 2222',
    code: 'NMH-JPR',
    matcher: (h) =>
      h.id === 'b1000000-0000-0000-0000-000000000003' ||
      h.name.toLowerCase().includes('narayana'),
  },
  {
    id: 'b1000000-0000-0000-0000-000000000004',
    name: 'Santokba Durlabhji Memorial Hospital (SDMH)',
    shortLabel: 'SDMH Jaipur',
    location: 'Bhawani Singh Rd, Rambagh, Jaipur',
    phone: '+91 141 256 6251',
    code: 'SDMH-JPR',
    matcher: (h) =>
      h.id === 'b1000000-0000-0000-0000-000000000004' ||
      h.name.toLowerCase().includes('durlabhji') ||
      h.name.toLowerCase().includes('sdmh'),
  },
];

const SHARED_DEMO_EMAIL = 'hospital1@gmail.com';
const SHARED_DEMO_PASSWORD = 'BloodStockDemo2026!';

export const HospitalLoginPage: React.FC<HospitalLoginPageProps> = ({
  onLoginSuccess,
  onCancel,
  isModal = false,
}) => {
  const [email, setEmail] = useState(SHARED_DEMO_EMAIL);
  const [password, setPassword] = useState(SHARED_DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeLoggingInId, setActiveLoggingInId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);

  // Status screens for pending / suspended / missing profile
  const [statusScreen, setStatusScreen] = useState<{
    type: 'pending' | 'suspended' | 'missing';
    hospitalName?: string;
    email?: string;
  } | null>(null);

  // Authenticate and set the specific target hospital as active
  const loginWithTargetHospital = async (
    targetHospital: JaipurHospitalOption,
    loginEmail: string = email,
    loginPass: string = password
  ) => {
    setErrorMessage(null);
    setStatusScreen(null);
    setLoading(true);
    setActiveLoggingInId(targetHospital.id);

    try {
      // 1. Pre-configure active hospital in authService
      authService.setActiveHospitalId(targetHospital.id);

      // 2. Perform authentication with the shared demo credentials
      const response = await authService.signIn(
        loginEmail.trim() || SHARED_DEMO_EMAIL,
        loginPass || SHARED_DEMO_PASSWORD,
        targetHospital.id
      );

      if (response.error && !response.profile && response.userHospitals.length === 0) {
        setErrorMessage(response.error);
        setLoading(false);
        setActiveLoggingInId(null);
        return;
      }

      // Check hospital memberships
      if (!response.profile && response.userHospitals.length === 0) {
        setStatusScreen({
          type: 'missing',
          email: response.user?.email || loginEmail,
        });
        setLoading(false);
        setActiveLoggingInId(null);
        return;
      }

      // Find and verify specific hospital in userHospitals matching target selection
      let active =
        response.userHospitals.find(targetHospital.matcher) ||
        response.userHospitals.find((h) => h.id === targetHospital.id) ||
        (response.profile && targetHospital.matcher(response.profile) ? response.profile : null) ||
        response.profile;

      if (!active) {
        if (response.userHospitals.length > 0) {
          // If specific match failed, verify authorized memberships
          active = response.userHospitals[0];
        } else {
          setErrorMessage(`Authorization error: Your account is not authorized for ${targetHospital.name}.`);
          setLoading(false);
          setActiveLoggingInId(null);
          return;
        }
      }

      // Check account status under RLS
      if (active.account_status === 'pending') {
        setStatusScreen({
          type: 'pending',
          hospitalName: active.name,
          email: active.email,
        });
        setLoading(false);
        setActiveLoggingInId(null);
        return;
      }

      if (active.account_status === 'suspended') {
        setStatusScreen({
          type: 'suspended',
          hospitalName: active.name,
          email: active.email,
        });
        setLoading(false);
        setActiveLoggingInId(null);
        return;
      }

      // Set active hospital in local storage and auth service
      authService.setActiveHospitalId(active.id);

      // Navigate immediately into the hospital dashboard with that hospital's data
      onLoginSuccess(active, response.userHospitals);
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected authentication error occurred.');
    } finally {
      setLoading(false);
      setActiveLoggingInId(null);
    }
  };

  // Handle standard manual form submission
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please provide both hospital email and password.');
      return;
    }
    // Default to the first Jaipur hospital if not selected
    await loginWithTargetHospital(JAIPUR_HOSPITAL_OPTIONS[0], email, password);
  };

  // Render Status Screens
  if (statusScreen) {
    return (
      <div className={isModal ? 'p-6 max-w-lg mx-auto text-xs' : 'min-h-[70vh] flex items-center justify-center p-6'}>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8 max-w-lg w-full text-center space-y-4 animate-in fade-in duration-200">
          {statusScreen.type === 'pending' && (
            <>
              <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-200">
                <Clock className="w-7 h-7 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Hospital Account Pending Approval</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your hospital profile for <strong>{statusScreen.hospitalName}</strong> has been registered but is awaiting authorization by regional health administrators.
              </p>
              <div className="p-3 bg-amber-50/70 rounded-lg border border-amber-200/80 text-[11px] text-amber-800 text-left space-y-1">
                <div><strong>Hospital Email:</strong> {statusScreen.email}</div>
                <div><strong>Status:</strong> <span className="font-mono font-bold text-amber-700">PENDING_VERIFICATION</span></div>
                <div><strong>Security Rule:</strong> Unverified accounts cannot access operational blood stock.</div>
              </div>
            </>
          )}

          {statusScreen.type === 'suspended' && (
            <>
              <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-200">
                <Ban className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Hospital Account Suspended</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Access for <strong>{statusScreen.hospitalName}</strong> has been temporarily suspended by network compliance.
              </p>
              <div className="p-3 bg-red-50/70 rounded-lg border border-red-200/80 text-[11px] text-red-800 text-left space-y-1">
                <div><strong>Hospital Email:</strong> {statusScreen.email}</div>
                <div><strong>Status:</strong> <span className="font-mono font-bold text-red-700">SUSPENDED</span></div>
                <div><strong>Action:</strong> Contact regional operations hotline to request reinstatement.</div>
              </div>
            </>
          )}

          {statusScreen.type === 'missing' && (
            <>
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto border border-blue-200">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No Hospital Memberships Found</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your login succeeded for <strong>{statusScreen.email}</strong>, but no associated records were returned from <code>public.hospital_user_access</code> or <code>public.hospitals</code>.
              </p>
              <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200/80 text-[11px] text-blue-900 text-left space-y-1">
                <div><strong>Check RLS:</strong> Ensure your user UID has active membership rows in <code>hospital_user_access</code>.</div>
                <div><strong>Security Constraint:</strong> RLS blocks access until an administrator grants hospital membership.</div>
              </div>
            </>
          )}

          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => setStatusScreen(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
            >
              Back to Login
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={isModal ? 'w-full max-w-xl mx-auto text-xs' : 'min-h-[85vh] flex items-center justify-center p-4'}>
      <div className="bg-white rounded-2xl border border-blue-200 shadow-2xl overflow-hidden w-full max-w-xl animate-in fade-in duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-6 text-white text-center relative shrink-0">
          {onCancel && (
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 text-white/70 hover:text-white p-1.5 rounded-lg text-base cursor-pointer hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          )}

          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-3 border border-white/20 shadow-inner">
            <Building2 className="w-6 h-6 text-white" />
          </div>

          <h2 className="text-xl font-black tracking-tight">Hospital Portal Login</h2>
          <p className="text-xs text-blue-200 mt-1 max-w-md mx-auto">
            Jaipur Regional Blood Network · Select an authorized hospital facility to open its live inventory and operational dashboard.
          </p>

          {/* Shared Demo Badge */}
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/60 border border-blue-400/30 text-[11px] text-blue-100">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>Shared Demo ID: <code className="font-mono text-white font-bold">{SHARED_DEMO_EMAIL}</code></span>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 4 Separate Jaipur Hospital Login Cards */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Select Jaipur Hospital Facility:</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                4 Separate Options
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {JAIPUR_HOSPITAL_OPTIONS.map((opt, idx) => {
                const isLoggingIn = activeLoggingInId === opt.id;

                return (
                  <div
                    key={opt.id}
                    className={`group relative rounded-xl border p-4 transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left ${
                      isLoggingIn
                        ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-300'
                        : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-blue-300 shadow-xs hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Number Badge & Facility Icon */}
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-black text-sm flex items-center justify-center shrink-0 border border-blue-200/80 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        {idx + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">
                            {opt.name}
                          </h4>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {opt.code}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{opt.location}</span>
                          </span>
                          <span className="flex items-center gap-1 font-mono text-[10px]">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{opt.phone}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Dedicated 1-Click Action Button for this Hospital */}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => loginWithTargetHospital(opt)}
                      className={`w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50 ${
                        isLoggingIn
                          ? 'bg-blue-700 text-white ring-2 ring-blue-400'
                          : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white hover:shadow-md'
                      }`}
                    >
                      {isLoggingIn ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Opening Dashboard...</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Log In as Facility</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Credentials Notice & Manual Login Accordion */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowManualForm(!showManualForm)}
              className="w-full flex items-center justify-between text-left text-xs font-semibold text-slate-600 hover:text-blue-700 py-1 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Advanced: Manual Credentials & Password Verification</span>
              </div>
              {showManualForm ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showManualForm && (
              <form onSubmit={handleManualSubmit} className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in duration-150">
                <div className="text-[11px] text-slate-600 leading-relaxed">
                  All four Jaipur hospital profiles above use the shared credentials below. You may verify or enter custom credentials here:
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 text-[11px] mb-1">
                    Supabase Auth Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="hospital1@gmail.com"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 text-[11px] mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Enter hospital password"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-800 text-xs pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying Credentials...</span>
                    </span>
                  ) : (
                    <span>Authenticate via Supabase Auth</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer info bar */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-[10px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Supabase Auth & PostgreSQL Row-Level Security Protected</span>
          </div>
          <span className="text-blue-700 font-semibold font-mono">
            Jaipur Blood Network · 4 Active Facilities
          </span>
        </div>
      </div>
    </div>
  );
};
