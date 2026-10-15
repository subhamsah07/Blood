import React from 'react';
import { X, Building2, Phone, MapPin, ShieldAlert, ArrowRight } from 'lucide-react';
import { Hospital, BloodUnit } from '../types/bloodstock';

interface HospitalListModalProps {
  isOpen: boolean;
  onClose: () => void;
  hospitals: Hospital[];
  units: BloodUnit[];
  onSelectHospital: (hospitalId: string) => void;
  onRequestFromHospital: (hospitalId: string) => void;
}

export const HospitalListModal: React.FC<HospitalListModalProps> = ({
  isOpen,
  onClose,
  hospitals,
  units,
  onSelectHospital,
  onRequestFromHospital,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl border border-sky-200 shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-50 via-blue-50 to-white px-6 py-4 border-b border-sky-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Partner Hospital Network Directory</h3>
              <p className="text-xs text-slate-500">Connected medical centers, regional blood banks & active reserves</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hospitals.map((hosp) => {
              const localUnits = units.filter((u) => u.hospitalId === hosp.id);
              const availableUnits = localUnits.filter((u) => u.status === 'AVAILABLE');
              const reservedUnits = localUnits.filter((u) => u.status === 'RESERVED' || u.status === 'IN_TRANSIT');

              return (
                <div
                  key={hosp.id}
                  className="p-4 bg-sky-50/40 hover:bg-sky-50/80 border border-sky-200/80 rounded-xl transition-all shadow-xs hover:shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{hosp.name}</h4>
                          <span className="font-mono text-xs font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                            {hosp.code}
                          </span>
                        </div>
                        {hosp.isRegionalHub && (
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full mt-1 inline-block">
                            Regional Hub Facility
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 my-3">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{hosp.address}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{hosp.phone}</span>
                      </div>
                    </div>

                    {/* Stock Counts Strip */}
                    <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-sky-100 font-mono text-[11px] mb-3">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Available</span>
                        <strong className="text-emerald-700 text-sm font-bold">{availableUnits.length}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Reserved</span>
                        <strong className="text-blue-700 text-sm font-bold">{reservedUnits.length}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">PRBC Floor</span>
                        <strong className="text-slate-700 text-sm font-bold">{hosp.protectedReserves.PRBC}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: Red and Green as requested */}
                  <div className="flex items-center gap-2 pt-2 border-t border-sky-100">
                    <button
                      onClick={() => {
                        onSelectHospital(hosp.id);
                        onClose();
                      }}
                      className="flex-1 py-1.5 px-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    >
                      <span>View Inventory</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        onRequestFromHospital(hosp.id);
                        onClose();
                      }}
                      className="py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs transition-colors shadow-xs cursor-pointer whitespace-nowrap"
                    >
                      Emergency Request
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>7 Network Facilities · Continuous Cold-Chain Courier Coverage</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-medium cursor-pointer"
          >
            Close Directory
          </button>
        </div>
      </div>
    </div>
  );
};
