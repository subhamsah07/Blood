import React, { useState } from 'react';
import { X, Building2, Lock, UserCheck, ShieldCheck } from 'lucide-react';
import { Hospital } from '../types/bloodstock';

interface HospitalLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  hospitals: Hospital[];
  onLoginSuccess: (hospitalId: string, roleName: string) => void;
}

export const HospitalLoginModal: React.FC<HospitalLoginModalProps> = ({
  isOpen,
  onClose,
  hospitals,
  onLoginSuccess,
}) => {
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(hospitals[0]?.id || 'HOSP-METRO');
  const [email, setEmail] = useState<string>('admin@metrocentral.health');
  const [password, setPassword] = useState<string>('••••••••••••');
  const [role, setRole] = useState<string>('Blood Bank Director');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    setTimeout(() => {
      setLoading(false);
      onLoginSuccess(selectedHospitalId, role);
      onClose();
    }, 600);
  };

  const handleQuickDemo = (hospId: string, demoEmail: string, demoRole: string) => {
    setSelectedHospitalId(hospId);
    setEmail(demoEmail);
    setRole(demoRole);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLoginSuccess(hospId, demoRole);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl border border-sky-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-50 to-blue-50 px-6 py-4 border-b border-sky-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center text-white shadow-xs">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Hospital Portal Login</h3>
              <p className="text-[11px] text-slate-500">Access local inventory, dispatches & requests</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-md"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleLogin} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Select Affiliated Hospital</label>
            <select
              value={selectedHospitalId}
              onChange={(e) => setSelectedHospitalId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Clinical / Admin Staff Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              placeholder="e.g. physician@trauma-hospital.org"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Password / PIN</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-800 pr-8 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                placeholder="Enter password"
              />
              <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">User Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              <option value="Blood Bank Administrator">Blood Bank Administrator</option>
              <option value="Trauma / Surgical Attending">Trauma / Surgical Attending</option>
              <option value="Dispatch & Logistics Coordinator">Dispatch & Logistics Coordinator</option>
            </select>
          </div>

          {/* Green Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 text-xs uppercase tracking-wide cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            <span>{loading ? 'Authenticating...' : 'Sign In to Hospital Portal'}</span>
          </button>

          {/* Quick Demo Credentials */}
          <div className="pt-3 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
              Quick Demo 1-Click Sign In:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  handleQuickDemo('HOSP-METRO', 'admin@metrocentral.health', 'Blood Bank Administrator')
                }
                className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-md text-[11px] font-medium text-left truncate transition-colors"
              >
                Metro Central (Admin)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickDemo('HOSP-TRAUMA', 'trauma.lead@stjude.health', 'Trauma Surgeon')
                }
                className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-md text-[11px] font-medium text-left truncate transition-colors"
              >
                St. Jude (Surgeon)
              </button>
            </div>
          </div>
        </form>

        <div className="bg-slate-50 px-6 py-2.5 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-green-600 shrink-0" />
          <span>Fictional demonstration environment. Real credentials not required.</span>
        </div>
      </div>
    </div>
  );
};
