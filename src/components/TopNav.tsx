import React from 'react';
import { UserCheck, Phone, Droplet } from 'lucide-react';

interface TopNavProps {
  onOpenLogin: () => void;
  onOpenContactUs: () => void;
  loggedInHospitalName?: string | null;
}

export const TopNav: React.FC<TopNavProps> = ({
  onOpenLogin,
  onOpenContactUs,
  loggedInHospitalName,
}) => {
  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-blue-100 sticky top-0 z-50 px-6 py-3.5 shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5">
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

        {/* Task Bar Options: Login & Contact Us ONLY as requested */}
        <div className="flex items-center gap-3">
          {/* Contact Us Option */}
          <button
            onClick={onOpenContactUs}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-900 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
          >
            <Phone className="w-4 h-4 text-red-600" />
            <span>Contact Us</span>
          </button>

          {/* Login Option */}
          <button
            onClick={onOpenLogin}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-lg transition-all shadow-xs hover:shadow-sm cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            <span>{loggedInHospitalName ? `Logged In: ${loggedInHospitalName}` : 'Login'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
