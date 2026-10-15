import React, { useState } from 'react';
import {
  Hospital,
  BloodUnit,
  Transfer,
  BloodComponentType,
  BloodGroup,
} from '../types/bloodstock';
import { SHORT_BLOOD_GROUPS, COMPONENT_LABELS } from '../services/compatibilityRules';
import {
  Building2,
  PackagePlus,
  Truck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';

interface HospitalAdminConsoleProps {
  hospitals: Hospital[];
  units: BloodUnit[];
  transfers: Transfer[];
  onAddUnit: (unitData: Omit<BloodUnit, 'id' | 'status' | 'syntheticBatchId'>) => Promise<void>;
  onSimulateTransferFailure: (transferId: string) => Promise<void>;
  simulationTime: string;
}

export const HospitalAdminConsole: React.FC<HospitalAdminConsoleProps> = ({
  hospitals,
  units,
  transfers,
  onAddUnit,
  onSimulateTransferFailure,
  simulationTime,
}) => {
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(hospitals[0]?.id || 'HOSP-METRO');
  const [newComponent, setNewComponent] = useState<BloodComponentType>('PRBC');
  const [newGroup, setNewGroup] = useState<BloodGroup>('O_NEG');
  const [expiryDays, setExpiryDays] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const selectedHospital = hospitals.find((h) => h.id === selectedHospitalId);
  const localUnits = units.filter((u) => u.hospitalId === selectedHospitalId);

  // Transfers involving this hospital
  const incomingTransfers = transfers.filter((t) => t.destinationHospitalId === selectedHospitalId);
  const outgoingTransfers = transfers.filter((t) => t.sourceHospitalId === selectedHospitalId);

  const handleRegisterUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setNotification(null);
    try {
      const now = new Date(simulationTime);
      const expiresAt = new Date(now.getTime() + expiryDays * 24 * 3600 * 1000).toISOString();
      const storageTemp = newComponent === 'PRBC' ? 4 : newComponent === 'PLATELETS' ? 22 : -20;

      await onAddUnit({
        hospitalId: selectedHospitalId,
        componentType: newComponent,
        bloodGroup: newGroup,
        donationDate: now.toISOString(),
        expiresAt,
        handlingBufferMinutes: newComponent === 'FFP' ? 35 : 25,
        storageTemperatureCelsius: storageTemp,
      });

      setNotification(`Synthetic unit successfully registered in ${selectedHospital?.code} inventory.`);
    } catch (err: any) {
      setNotification(`Registration failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hospital Selection Strip */}
      <div className="bg-white p-5 rounded-lg border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Hospital Administration & Local Blood Bank Management
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect local blood inventory, monitor dispatched cold-chain couriers, and register synthetic donation records.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Managing Facility:</span>
            <select
              value={selectedHospitalId}
              onChange={(e) => setSelectedHospitalId(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {notification && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-xs text-blue-800 rounded-md flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="text-blue-600 hover:text-blue-900 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Grid: Register New Unit & Active Transfers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Register Synthetic Unit Form (5 Cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-lg border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
            <PackagePlus className="w-4 h-4 text-emerald-600" />
            <span>Register Synthetic Blood Donation Unit</span>
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Simulate intake of newly collected donor units at {selectedHospital?.code}. Newly added stock immediately becomes available for network replanning.
          </p>

          <form onSubmit={handleRegisterUnit} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Blood Component Type</label>
              <select
                value={newComponent}
                onChange={(e) => setNewComponent(e.target.value as BloodComponentType)}
                className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 font-medium"
              >
                <option value="PRBC">Packed Red Blood Cells (PRBC)</option>
                <option value="PLATELETS">Platelets (PLT, 5-Day Max)</option>
                <option value="FFP">Fresh Frozen Plasma (FFP)</option>
                <option value="CRYOPRECIPITATE">Cryoprecipitate</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">ABO / Rh Blood Group</label>
              <select
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value as BloodGroup)}
                className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 font-mono font-bold"
              >
                <option value="O_NEG">O− (Universal RBC Donor)</option>
                <option value="O_POS">O+</option>
                <option value="A_NEG">A−</option>
                <option value="A_POS">A+</option>
                <option value="B_NEG">B−</option>
                <option value="B_POS">B+</option>
                <option value="AB_NEG">AB−</option>
                <option value="AB_POS">AB+ (Universal RBC Recipient)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Shelf-Life Duration (Days from Intake)</label>
              <input
                type="number"
                min="0.1"
                max="365"
                step="0.5"
                value={expiryDays}
                onChange={(e) => setExpiryDays(parseFloat(e.target.value) || 1)}
                className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Standard: Platelets = 3–5 days, PRBC = 35–42 days, FFP = 365 days.
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded text-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : '+ Commit Unit into Local Stock'}
            </button>
          </form>
        </div>

        {/* Courier Transfers & Active Logistics (7 Cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600" />
              <span>Simulated Courier Transit & Cold-Chain Monitoring</span>
            </h3>
            <span className="text-xs text-slate-400">
              {incomingTransfers.length + outgoingTransfers.length} total transfers recorded
            </span>
          </div>

          <div className="space-y-4">
            {/* Outgoing transfers */}
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
                Outbound Courier Dispatches ({outgoingTransfers.length})
              </span>
              {outgoingTransfers.length === 0 ? (
                <div className="p-3 bg-slate-50 rounded text-xs text-slate-400 text-center">
                  No active outbound transfers from this facility.
                </div>
              ) : (
                <div className="space-y-2 max-h-[160px] overflow-y-auto">
                  {outgoingTransfers.map((tx) => {
                    const dest = hospitals.find((h) => h.id === tx.destinationHospitalId)?.code;
                    return (
                      <div
                        key={tx.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="font-mono font-bold text-slate-900">
                            {tx.id} · Unit {tx.unitId} → {dest}
                          </div>
                          <div className="text-slate-500 text-[11px]">
                            Courier: {tx.courierIdentifier} · ETA: {new Date(tx.estimatedArrivalAt).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-[11px] font-bold ${
                              tx.status === 'DELIVERED'
                                ? 'text-emerald-700'
                                : tx.status === 'IN_TRANSIT'
                                ? 'text-blue-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {tx.status}
                          </span>
                          {tx.status === 'IN_TRANSIT' && (
                            <button
                              onClick={() => onSimulateTransferFailure(tx.id)}
                              title="Simulate courier breakdown or temperature breach"
                              className="px-2 py-0.5 text-[10px] bg-rose-50 text-rose-700 border border-rose-200 rounded hover:bg-rose-100 font-semibold"
                            >
                              Simulate Failure
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Incoming transfers */}
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
                Inbound Transfusions & Shipments ({incomingTransfers.length})
              </span>
              {incomingTransfers.length === 0 ? (
                <div className="p-3 bg-slate-50 rounded text-xs text-slate-400 text-center">
                  No incoming units en route to this facility.
                </div>
              ) : (
                <div className="space-y-2 max-h-[160px] overflow-y-auto">
                  {incomingTransfers.map((tx) => {
                    const src = hospitals.find((h) => h.id === tx.sourceHospitalId)?.code;
                    return (
                      <div
                        key={tx.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="font-mono font-bold text-slate-900">
                            {tx.id} · Unit {tx.unitId} from {src}
                          </div>
                          <div className="text-slate-500 text-[11px]">
                            Arriving: {new Date(tx.estimatedArrivalAt).toLocaleTimeString()}
                          </div>
                        </div>
                        <span
                          className={`font-mono text-[11px] font-bold ${
                            tx.status === 'DELIVERED'
                              ? 'text-emerald-700'
                              : tx.status === 'IN_TRANSIT'
                              ? 'text-blue-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
