import React, { useState } from 'react';
import { X, Phone, Mail, MapPin, Send, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ContactUsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactUsModal: React.FC<ContactUsModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl border border-sky-200 shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-50 via-blue-50 to-white px-6 py-4 border-b border-sky-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Contact BloodStock Network & Support</h3>
            <p className="text-xs text-slate-500">24/7 Regional Transfusion Dispatch & Technical Coordination</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {/* Emergency Hotline Banner with Red Button */}
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white shrink-0">
                <Phone className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <span className="font-bold text-red-900 text-sm block">Emergency Dispatch Line (24/7)</span>
                <span className="font-mono text-xs text-red-700">+1 (800) 555-BLOOD (25663)</span>
                <p className="text-[11px] text-red-600/90 mt-0.5">Direct link to regional courier dispatchers</p>
              </div>
            </div>
            <a
              href="tel:18005552566"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors whitespace-nowrap shadow-sm text-xs cursor-pointer"
            >
              Call Hotline
            </a>
          </div>

          {/* Contact Details & Inquiry Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Info Column */}
            <div className="space-y-3.5 text-slate-600 bg-sky-50/50 p-4 rounded-xl border border-sky-100">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Regional Operations Center</h4>
              
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <span>Code-e-Manipal 2.0 HealthTech Operations, Innovation Block, Tech Campus</span>
              </div>

              <div className="flex items-center gap-2.5 font-mono">
                <Mail className="w-4 h-4 text-sky-600 shrink-0" />
                <a href="mailto:bloodraise.helpline@gmail.com" className="hover:underline text-sky-800 font-bold">
                  bloodraise.helpline@gmail.com
                </a>
              </div>

              <div className="flex items-center gap-2.5 font-mono text-slate-500 text-[11px]">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>dispatch@bloodstock.health</span>
              </div>

              <div className="pt-2 border-t border-sky-100 text-[11px] text-slate-500 space-y-1">
                <div><strong>Standard Response Time:</strong> &lt; 3 minutes for Level 1 Trauma calls</div>
                <div><strong>Cold-Chain Telemetry:</strong> Monitored every 60 seconds</div>
              </div>
            </div>

            {/* Inquiry Form */}
            <form onSubmit={handleSubmit} className="space-y-2.5">
              {submitted ? (
                <div className="py-8 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
                  <h4 className="font-bold text-slate-900 text-sm">Message Sent!</h4>
                  <p className="text-slate-500 text-xs">Our coordination team will respond shortly.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Your Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Dr. Jordan Reed"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Hospital / Institute</label>
                    <input
                      type="text"
                      required
                      value={hospitalName}
                      onChange={(e) => setHospitalName(e.target.value)}
                      placeholder="Metro Central General"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Contact Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="physician@hospital.org"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Inquiry / Dispatch Request</label>
                    <textarea
                      required
                      rows={2}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Inquire about regional mesh integration..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:ring-1 focus:ring-sky-500 focus:outline-none resize-none"
                    />
                  </div>

                  {/* Green Submit Button as requested */}
                  <button
                    type="submit"
                    className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 text-xs shadow-xs cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Message to Operations</span>
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
