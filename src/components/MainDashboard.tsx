import React, { useState } from 'react';
import {
  Building2,
  Phone,
  Clock,
  ShieldCheck,
  Zap,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ThermometerSnowflake,
  Truck,
  HeartPulse,
  Send,
  MapPin,
  Mail,
  UserCheck,
  ArrowRight,
} from 'lucide-react';
import { Hospital, BloodUnit, BloodRequest } from '../types/bloodstock';

interface MainDashboardProps {
  hospitals: Hospital[];
  units: BloodUnit[];
  requests: BloodRequest[];
  onOpenLogin: () => void;
  onOpenHospitalList: () => void;
  onOpenContactUs: () => void;
  onOpenEmergencyRequest: () => void;
  simulationTime: string;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  hospitals,
  units,
  requests,
  onOpenLogin,
  onOpenHospitalList,
  onOpenContactUs,
  onOpenEmergencyRequest,
  simulationTime,
}) => {
  // Contact Form State
  const [contactName, setContactName] = useState('');
  const [contactHospital, setContactHospital] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactSent(true);
    setTimeout(() => {
      setContactSent(false);
      setContactName('');
      setContactHospital('');
      setContactEmail('');
      setContactMessage('');
    }, 3000);
  };

  const availableCount = units.filter((u) => u.status === 'AVAILABLE').length;

  return (
    <div className="space-y-16 pb-16 animate-in fade-in duration-300">
      {/* 1. HERO SECTION WITH IMAGE & BUTTONS DIRECTLY ON IT */}
      <section className="relative rounded-3xl overflow-hidden shadow-2xl border border-blue-200">
        {/* Background Image: Uploaded Lab Blood Tubes Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="/lab_hero.jpg"
            alt="Medical blood testing laboratory with blood collection tubes in rack"
            className="w-full h-full object-cover object-center scale-105 transition-transform duration-1000"
            referrerPolicy="no-referrer"
          />
          {/* Blue & Red Contrast Scrim Overlay for maximum legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-blue-950/85 to-slate-900/75" />
          <div className="absolute inset-0 bg-radial from-red-600/10 via-transparent to-blue-950/60" />
        </div>

        {/* Hero Content on top of Image */}
        <div className="relative z-10 p-8 sm:p-12 lg:p-16 text-white max-w-4xl space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-600/30 border border-blue-400/40 text-blue-200 text-xs font-semibold backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span>Time-Aware Allocation of Perishable Blood Components</span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight text-white drop-shadow-sm">
            Saving Lives with <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-rose-300 to-sky-300">
              Zero-Wastage Blood Logistics
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl font-normal drop-shadow">
            A specialized healthcare logistics platform that models biological compatibility, expiry deadlines, cold-chain transport times, and protected safety reserves to recommend optimal, explainable multi-hospital transfers without double-allocation.
          </p>

          {/* 3 Buttons on the Image (Login, Emergency Request, Hospital List) as requested */}
          <div className="flex flex-wrap items-center gap-4 pt-4">
            {/* 1. Login Button */}
            <button
              onClick={onOpenLogin}
              className="py-3 px-6 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-blue-500/30 flex items-center gap-2 cursor-pointer border border-blue-400/30"
            >
              <UserCheck className="w-4 h-4" />
              <span>Hospital Login</span>
            </button>

            {/* 2. Emergency Blood Request Button (Red) */}
            <button
              onClick={onOpenEmergencyRequest}
              className="py-3 px-6 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-red-600/40 flex items-center gap-2 cursor-pointer border border-red-400/30 animate-pulse"
            >
              <Flame className="w-4 h-4 fill-white" />
              <span>Emergency Blood Request</span>
            </button>

            {/* 3. Hospital List Button (White / Blue) */}
            <button
              onClick={onOpenHospitalList}
              className="py-3 px-6 bg-white hover:bg-slate-100 active:bg-slate-200 text-blue-900 font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 cursor-pointer border border-white"
            >
              <Building2 className="w-4 h-4 text-blue-700" />
              <span>Hospital List</span>
            </button>
          </div>

          {/* Live Quick Counter Badges on Image */}
          <div className="pt-6 border-t border-white/15 grid grid-cols-3 gap-4 font-mono max-w-lg">
            <div>
              <span className="text-[11px] text-slate-300 uppercase tracking-wider block">Network Facilities</span>
              <strong className="text-xl font-bold text-white">{hospitals.length} Hospitals</strong>
            </div>
            <div>
              <span className="text-[11px] text-slate-300 uppercase tracking-wider block">Available Units</span>
              <strong className="text-xl font-bold text-emerald-300">{availableCount} Units</strong>
            </div>
            <div>
              <span className="text-[11px] text-slate-300 uppercase tracking-wider block">Double Allocations</span>
              <strong className="text-xl font-bold text-red-300">0 Violations</strong>
            </div>
          </div>
        </div>
      </section>

      {/* 2. "HOW TO USE" SECTION */}
      <section id="how-to-use" className="bg-white rounded-3xl border border-blue-100 p-8 sm:p-12 shadow-sm space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-200">
            Simple 4-Step Process
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            How to Use BloodStock
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Designed for rapid clinical intake, constraint validation, and zero-confusion emergency dispatch.
          </p>
        </div>

        {/* 4 Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Step 1 */}
          <div className="bg-gradient-to-b from-blue-50/60 to-white p-6 rounded-2xl border border-blue-100 relative group hover:border-blue-300 transition-all shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center mb-4 shadow-sm">
              01
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-2">Hospital Demand Intake</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Hospital enters the patient case, clinical urgency level (Critical Trauma, Urgent Surgery, or Routine), required blood component (PRBC, Platelets, FFP), quantity, and required delivery deadline.
            </p>
            <div className="mt-4 pt-3 border-t border-blue-50">
              <span className="text-[11px] font-semibold text-blue-700 flex items-center gap-1">
                Emergency or Routine orders <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-gradient-to-b from-blue-50/60 to-white p-6 rounded-2xl border border-blue-100 relative group hover:border-blue-300 transition-all shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white font-extrabold text-sm flex items-center justify-center mb-4 shadow-sm">
              02
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-2">Time-Window Feasibility</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              The feasibility sieve tests every candidate unit in the network against biological cross-matching rules, transit road durations, preparation buffers, and usable shelf-life at arrival.
            </p>
            <div className="mt-4 pt-3 border-t border-blue-50">
              <span className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                Filters in-transit expiry <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-gradient-to-b from-blue-50/60 to-white p-6 rounded-2xl border border-blue-100 relative group hover:border-blue-300 transition-all shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-blue-700 text-white font-extrabold text-sm flex items-center justify-center mb-4 shadow-sm">
              03
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-2">CP-SAT Optimization</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              A constraint solver finds the optimal global matching. Trauma cases take priority, travel times are minimized, and units expiring sooner are safely allocated first (FEFO) to avoid spoilage.
            </p>
            <div className="mt-4 pt-3 border-t border-blue-50">
              <span className="text-[11px] font-semibold text-blue-700 flex items-center gap-1">
                Multi-objective matching <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-gradient-to-b from-blue-50/60 to-white p-6 rounded-2xl border border-blue-100 relative group hover:border-blue-300 transition-all shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-extrabold text-sm flex items-center justify-center mb-4 shadow-sm">
              04
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-2">Safe Lock & Dispatch</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              The proposed transfer is transactionally locked (`AVAILABLE` → `RESERVED` → `IN_TRANSIT`). Double allocations are strictly blocked, and simulated cold-chain couriers are dispatched.
            </p>
            <div className="mt-4 pt-3 border-t border-blue-50">
              <span className="text-[11px] font-semibold text-slate-800 flex items-center gap-1">
                Zero double allocations <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. "FEATURES OF OUR WEBSITE" SECTION */}
      <section className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Core Capabilities
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Features of Our Website
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Built specifically to address the official Code-e-Manipal 2.0 Track 02 HealthTech requirements.
          </p>
        </div>

        {/* 6 Core Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-xs hover:border-blue-300 hover:shadow-md transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Time-Aware Expiration Sieve</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every unit's remaining shelf-life is evaluated against estimated transit minutes plus preparation buffer. Units that would expire before or during arrival are disqualified automatically.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-xs hover:border-blue-300 hover:shadow-md transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Zero Double-Allocation Guarantee</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              A strict two-phase commit lock ensures that blood units already committed to an active surgical patient or in transit cannot be allocated to another request under any circumstances.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-xs hover:border-blue-300 hover:shadow-md transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <HeartPulse className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Urgent Trauma Priority Triage</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Lexicographic optimization ensures that when multiple requests compete for scarce universal donor O− blood, critical emergencies receive allocations before routine elective surgeries.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-xs hover:border-blue-300 hover:shadow-md transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Multi-Hospital Joint Fulfillment</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              When a local hospital has insufficient inventory to fulfill a large order, the system coordinates collaborative transfers from multiple neighboring facilities to satisfy demand.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-xs hover:border-blue-300 hover:shadow-md transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ThermometerSnowflake className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Protected Hospital Safety Reserves</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Each facility maintains an inviolable minimum stock threshold (e.g., 3 PRBC, 2 Platelets). Outbound transfers that would deplete a hospital below its safety floor are blocked.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-xs hover:border-blue-300 hover:shadow-md transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Explainable Causal Diagnostics</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every allocation recommendation and rejection includes human-readable causal reasoning directly tied to rule outcomes, showing why each option was chosen or disqualified.
            </p>
          </div>
        </div>
      </section>

      {/* 4. "CONTACT US" SECTION AT THE LAST */}
      <section id="contact-us" className="bg-white rounded-3xl border border-blue-200 overflow-hidden shadow-sm">
        {/* Banner with Emergency Red Accent */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 text-white p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400 bg-red-950/60 px-3 py-1 rounded-full border border-red-500/30">
              <Phone className="w-3.5 h-3.5" />
              <span>24/7 Regional Emergency Dispatch Desk</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black">
              Contact BloodStock Operations
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              For emergency blood transfers, courier dispatch coordination, or technical assistance during surgical emergencies.
            </p>
          </div>

          <a
            href="tel:18005552566"
            className="py-3 px-6 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 cursor-pointer shrink-0 border border-red-400/30"
          >
            <Phone className="w-4 h-4" />
            <span>Call Hotline: +1 (800) 555-BLOOD</span>
          </a>
        </div>

        {/* Contact Form and Information Grid */}
        <div className="p-8 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Direct Info */}
          <div className="lg:col-span-5 space-y-5 text-xs text-slate-600 bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">
              Operations Center Coordinates
            </h3>

            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 block">Regional Logistics Hub:</strong>
                <span>Code-e-Manipal 2.0 HealthTech Operations, Innovation Block, Tech Campus</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <strong className="text-slate-900 block">Dispatch Email:</strong>
                <span className="font-mono">dispatch@bloodstock.health</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-red-600 shrink-0" />
              <div>
                <strong className="text-slate-900 block">24/7 Transfusion Helpline:</strong>
                <span className="font-mono text-red-700 font-bold">+1 (800) 555-BLOOD (25663)</span>
              </div>
            </div>

            <div className="pt-3 border-t border-blue-200/60 space-y-1.5 text-[11px]">
              <div><strong>Level 1 Response:</strong> &lt; 3 Minutes for emergent surgical orders</div>
              <div><strong>Cold-Chain Telemetry:</strong> Polled continuously every 60 seconds</div>
            </div>
          </div>

          {/* Right Column: Contact & Message Form */}
          <div className="lg:col-span-7">
            {contactSent ? (
              <div className="h-full flex flex-col items-center justify-center p-8 bg-blue-50/50 rounded-2xl border border-blue-200 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-blue-600 animate-bounce" />
                <h4 className="font-bold text-slate-900 text-base">Message Received</h4>
                <p className="text-xs text-slate-600 max-w-sm">
                  Our regional operations and transfusion logistics desk will respond immediately.
                </p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Your Name</label>
                    <input
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Dr. Samantha Carter"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Hospital / Institute</label>
                    <input
                      type="text"
                      required
                      value={contactHospital}
                      onChange={(e) => setContactHospital(e.target.value)}
                      placeholder="Metro Central General Hospital"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Email</label>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="physician@hospital.org"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Message / Transfer Inquiry</label>
                  <textarea
                    required
                    rows={3}
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="Describe your inquiry, urgent requirement, or onboarding question..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="py-3 px-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Message to Operations Desk</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
