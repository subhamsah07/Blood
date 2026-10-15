import React, { useState } from 'react';
import {
  Hospital,
  BloodComponentType,
  BloodGroup,
  RequestUrgency,
  BloodRequest,
} from '../types/bloodstock';
import { X, AlertCircle } from 'lucide-react';

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  hospitals: Hospital[];
  simulationTime: string;
  onCreateRequest: (reqData: Omit<BloodRequest, 'id' | 'createdAt' | 'status' | 'allocatedUnitIds'>) => Promise<void>;
}

export const NewRequestModal: React.FC<NewRequestModalProps> = ({
  isOpen,
  onClose,
  hospitals,
  simulationTime,
  onCreateRequest,
}) => {
  const [hospitalId, setHospitalId] = useState<string>(hospitals[0]?.id || 'HOSP-TRAUMA');
  const [patientCaseId, setPatientCaseId] = useState<string>('CASE-OR-' + Math.floor(Math.random() * 8999 + 1000));
  const [componentType, setComponentType] = useState<BloodComponentType>('PRBC');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O_NEG');
  const [quantity, setQuantity] = useState<number>(2);
  const [urgency, setUrgency] = useState<RequestUrgency>('URGENT_SURGERY');
  const [deadlineMinutes, setDeadlineMinutes] = useState<number>(90);
  const [notes, setNotes] = useState<string>('Surgical standby reservation.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const now = new Date(simulationTime);
      const deadlineAt = new Date(now.getTime() + deadlineMinutes * 60 * 1000).toISOString();

      await onCreateRequest({
        hospitalId,
        patientCaseId,
        componentType,
        bloodGroup,
        quantity,
        urgency,
        deadlineAt,
        notes,
      });
      onClose();
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Create Clinical Blood Component Request</h3>
            <span className="text-[11px] text-slate-500">Synthetic clinical intake simulation</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Requesting Hospital</label>
              <select
                value={hospitalId}
                onChange={(e) => setHospitalId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 font-medium"
              >
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.code} · {h.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Patient / Case ID</label>
              <input
                type="text"
                value={patientCaseId}
                onChange={(e) => setPatientCaseId(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 font-mono text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Component Required</label>
              <select
                value={componentType}
                onChange={(e) => setComponentType(e.target.value as BloodComponentType)}
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 font-medium"
              >
                <option value="PRBC">Packed Red Blood Cells (PRBC)</option>
                <option value="PLATELETS">Platelets (PLT, Apheresis)</option>
                <option value="FFP">Fresh Frozen Plasma (FFP)</option>
                <option value="CRYOPRECIPITATE">Cryoprecipitate</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Patient ABO / Rh Group</label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 font-mono font-bold"
              >
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
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Quantity (Units)</label>
              <input
                type="number"
                min="1"
                max="8"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Clinical Urgency</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as RequestUrgency)}
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 font-semibold"
              >
                <option value="CRITICAL_TRAUMA">Critical Trauma (Emergent)</option>
                <option value="URGENT_SURGERY">Urgent Surgery</option>
                <option value="ROUTINE">Routine Elective</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Deadline Window</label>
              <select
                value={deadlineMinutes}
                onChange={(e) => setDeadlineMinutes(parseInt(e.target.value, 10))}
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 font-mono text-slate-800"
              >
                <option value={30}>30 Minutes</option>
                <option value={60}>60 Minutes (1h)</option>
                <option value={90}>90 Minutes (1.5h)</option>
                <option value={150}>150 Minutes (2.5h)</option>
                <option value={300}>300 Minutes (5h)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Clinical Indication / Procedure Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
