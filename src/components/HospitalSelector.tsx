import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  ChevronDown,
  Check,
  ShieldCheck,
  MapPin,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { HospitalProfile } from '../services/authService';

interface HospitalSelectorProps {
  userHospitals: HospitalProfile[];
  activeHospital: HospitalProfile | null;
  onSelectHospital: (hospital: HospitalProfile) => void;
  isLoading?: boolean;
  isCompact?: boolean;
  showQuickPills?: boolean;
}

export const HospitalSelector: React.FC<HospitalSelectorProps> = ({
  userHospitals,
  activeHospital,
  onSelectHospital,
  isLoading = false,
  isCompact = false,
  showQuickPills = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (userHospitals.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
        <span>No authorized hospital memberships found.</span>
      </div>
    );
  }

  const handleSelect = (hosp: HospitalProfile) => {
    if (hosp.id !== activeHospital?.id) {
      onSelectHospital(hosp);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Selector Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`group flex items-center justify-between gap-2.5 rounded-xl border transition-all cursor-pointer ${
          isCompact
            ? 'px-3 py-1.5 bg-blue-50/90 hover:bg-blue-100/90 border-blue-200 text-xs font-semibold text-blue-950 shadow-2xs'
            : 'px-4 py-2.5 bg-white hover:bg-slate-50 border-blue-200 shadow-xs hover:border-blue-300 text-slate-800'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 truncate">
          <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Building2 className="w-3.5 h-3.5" />
            )}
          </div>

          <div className="text-left truncate">
            <div className="flex items-center gap-1.5">
              <span className="font-bold truncate max-w-[200px] sm:max-w-[280px]">
                {activeHospital ? activeHospital.name : 'Select Hospital Profile'}
              </span>
              {activeHospital?.role && (
                <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                  {activeHospital.role}
                </span>
              )}
            </div>
            {!isCompact && activeHospital && (
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                {activeHospital.city || 'Jaipur'} · {userHospitals.length} Authorized Locations
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-500 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-blue-200 shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-blue-50 to-slate-50 border-b border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-900">Authorized Facility Switcher</span>
            </div>
            <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full">
              {userHospitals.length} Profiles
            </span>
          </div>

          {/* List of Authorized Hospitals */}
          <div className="max-h-80 overflow-y-auto p-2 space-y-1 divide-y divide-slate-100">
            {userHospitals.map((hosp) => {
              const isSelected = activeHospital?.id === hosp.id;
              return (
                <button
                  key={hosp.id}
                  onClick={() => handleSelect(hosp)}
                  className={`w-full text-left p-3 rounded-xl transition-colors flex items-start justify-between gap-3 cursor-pointer pt-2.5 ${
                    isSelected
                      ? 'bg-blue-50/80 border border-blue-200/90 text-blue-950 font-medium'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="space-y-1 truncate">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 block truncate">
                        {hosp.name}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{hosp.address}, {hosp.city}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {hosp.account_status}
                      </span>
                      {hosp.role && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                          Role: {hosp.role}
                        </span>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="px-3.5 py-2.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Linked via <code>public.hospital_user_access</code></span>
            <span className="text-blue-700 font-semibold">RLS Protected</span>
          </div>
        </div>
      )}

      {/* Quick Pills for instant 1-click toggling */}
      {showQuickPills && userHospitals.length > 1 && (
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
            Quick Switch:
          </span>
          {userHospitals.map((hosp) => {
            const isSelected = activeHospital?.id === hosp.id;
            // Short label
            const shortName = hosp.name
              .replace(', Jaipur', '')
              .replace('Hospitals — ', '')
              .replace(' Memorial Hospital', '')
              .replace(' Multispeciality Hospital', '');

            return (
              <button
                key={hosp.id}
                onClick={() => handleSelect(hosp)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-2xs ring-2 ring-blue-300'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300'
                }`}
                title={`Switch active context to ${hosp.name}`}
              >
                {shortName}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
