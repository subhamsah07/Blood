import React from 'react';
import { UserCheck, Phone, Droplet, LogOut, Building2 } from 'lucide-react';
import { HospitalProfile } from '../services/authService';
import { HospitalSelector } from './HospitalSelector';

interface TopNavProps {
  onOpenLogin: () => void;
  onOpenContactUs: () => void;
  onLogout: () => void;
  profile: HospitalProfile | null;
  userHospitals?: HospitalProfile[];
  onSelectHospital?: (hospital: HospitalProfile) => void;
  currentView?: 'public' | 'hospital_dashboard' | 'allocation_studio';
  onSelectView?: (view: 'public' | 'hospital_dashboard' | 'allocation_studio') => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  onOpenLogin,
  onOpenContactUs,
  onLogout,
  profile,
  userHospitals = [],
  onSelectHospital,
  currentView = 'public',
  onSelectView,
}) => {
  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-blue-100 sticky top-0 z-50 px-4 sm:px-6 py-3 shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand Logo */}
        <div
          onClick={() => onSelectView && onSelectView('public')}
          className="flex items-center gap-2.5 shrink-0 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-blue-700 flex items-center justify-center text-white shadow-sm">
            <Droplet className="w-5 h-5 fill-white" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900 block leading-none">
              Blood<span className="text-red-600">Stock</span>
            </span>
            <span className="text-[10px] font-semibold text-blue-700 tracking-wider uppercase">
              Perishable Allocation Network
            </span>
          </div>
        </div>

        {/* Center View Switcher */}
        {onSelectView && (
          <div className="hidden md:flex items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold border border-slate-200">
            <button
              onClick={() => onSelectView('public')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentView === 'public'
                  ? 'bg-white text-blue-700 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Public Home
            </button>
            <button
              onClick={() => {
                if (profile) {
                  onSelectView('hospital_dashboard');
                } else {
                  onOpenLogin();
                }
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentView === 'hospital_dashboard'
                  ? 'bg-white text-blue-700 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hospital Dashboard
            </button>
          </div>
        )}

        {/* Task Bar Options: Contact Us and Hospital Switcher / Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Contact Us Option */}
          <button
            onClick={onOpenContactUs}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-semibold text-blue-900 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
          >
            <Phone className="w-4 h-4 text-red-600" />
            <span className="hidden sm:inline">Contact Us</span>
          </button>

          {/* Login or Logged In User Profile / Switcher / Logout */}
          {profile ? (
            <div className="flex items-center gap-2">
              {userHospitals && userHospitals.length > 1 && onSelectHospital ? (
                <HospitalSelector
                  userHospitals={userHospitals}
                  activeHospital={profile}
                  onSelectHospital={onSelectHospital}
                  isCompact={true}
                />
              ) : (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-lg text-xs font-semibold font-mono">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span className="truncate max-w-[150px]">{profile.name}</span>
                </div>
              )}

              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-300 cursor-pointer"
                title="Sign out of hospital account"
              >
                <LogOut className="w-4 h-4 text-slate-600" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-lg transition-all shadow-xs hover:shadow-sm cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
