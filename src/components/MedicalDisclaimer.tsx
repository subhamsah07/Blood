import React from 'react';
import { ShieldAlert } from 'lucide-react';

export const MedicalDisclaimer: React.FC = () => {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
        <span>
          <strong className="font-semibold">RESEARCH & PLANNING SIMULATOR ONLY:</strong> All hospital names, blood units, inventory numbers, and patient cases are entirely synthetic. This software does not make clinical decisions or authorize transfusions. Cross-matching and authorization must be performed by certified medical personnel.
        </span>
      </div>
      <span className="font-mono text-amber-700/80 uppercase tracking-wider text-[11px] shrink-0">
        Code-e-Manipal 2.0 · Track 02 HealthTech
      </span>
    </div>
  );
};
