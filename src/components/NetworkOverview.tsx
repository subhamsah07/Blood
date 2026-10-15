import React, { useState } from 'react';
import {
  Hospital,
  BloodUnit,
  TravelTimeMatrix,
  BloodComponentType,
  BloodGroup,
} from '../types/bloodstock';
import { SHORT_BLOOD_GROUPS, COMPONENT_LABELS } from '../services/compatibilityRules';
import { Building2, Layers, AlertTriangle, ArrowRight } from 'lucide-react';

interface NetworkOverviewProps {
  hospitals: Hospital[];
  units: BloodUnit[];
  travelMatrix: TravelTimeMatrix;
  simulationTime: string;
  onSelectHospital?: (hospitalId: string) => void;
}

export const NetworkOverview: React.FC<NetworkOverviewProps> = ({
  hospitals,
  units,
  travelMatrix,
  simulationTime,
}) => {
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const [componentFilter, setComponentFilter] = useState<string>('ALL');
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [hoveredRoute, setHoveredRoute] = useState<{ from: string; to: string } | null>(null);

  const selectedHospital = hospitals.find((h) => h.id === selectedHospitalId);

  // Compute stock counts per hospital
  const stockCountsByHospital: Record<string, { total: number; available: number; reserved: number; expiringSoon: number }> = {};
  hospitals.forEach((h) => {
    stockCountsByHospital[h.id] = { total: 0, available: 0, reserved: 0, expiringSoon: 0 };
  });

  const nowMs = new Date(simulationTime).getTime();

  units.forEach((u) => {
    if (!stockCountsByHospital[u.hospitalId]) return;
    stockCountsByHospital[u.hospitalId].total++;
    if (u.status === 'AVAILABLE') stockCountsByHospital[u.hospitalId].available++;
    if (u.status === 'RESERVED' || u.status === 'IN_TRANSIT') stockCountsByHospital[u.hospitalId].reserved++;

    const expMs = new Date(u.expiresAt).getTime();
    if (expMs - nowMs < 24 * 3600 * 1000 && u.status === 'AVAILABLE') {
      stockCountsByHospital[u.hospitalId].expiringSoon++;
    }
  });

  // Filter units
  const filteredUnits = units.filter((u) => {
    if (selectedHospitalId && u.hospitalId !== selectedHospitalId) return false;
    if (componentFilter !== 'ALL' && u.componentType !== componentFilter) return false;
    if (groupFilter !== 'ALL' && u.bloodGroup !== groupFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Overview Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-lg border border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Regional Blood Banking Network Map & Live Inventory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Synthetic multi-hospital mesh tracking real-time perishable component stock, transport corridors, and protected emergency safety reserves.
          </p>
        </div>
        <div className="flex items-center gap-6 text-xs text-slate-600 font-mono">
          <div>
            <span className="text-slate-400">Total Facilities:</span>{' '}
            <strong className="text-slate-900 font-bold">{hospitals.length}</strong>
          </div>
          <div>
            <span className="text-slate-400">Units in Network:</span>{' '}
            <strong className="text-slate-900 font-bold">{units.length}</strong>
          </div>
          <div>
            <span className="text-slate-400">Available Stock:</span>{' '}
            <strong className="text-emerald-700 font-bold">
              {units.filter((u) => u.status === 'AVAILABLE').length}
            </strong>
          </div>
          <div>
            <span className="text-slate-400">In-Transit / Reserved:</span>{' '}
            <strong className="text-blue-700 font-bold">
              {units.filter((u) => u.status === 'RESERVED' || u.status === 'IN_TRANSIT').length}
            </strong>
          </div>
        </div>
      </div>

      {/* Network Interactive Map & Facility Grid Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Interactive SVG Transit Network Map (7 Cols) */}
        <div className="lg:col-span-7 bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Corridor Transit Map (Minutes by Road Courier)
            </span>
            <span className="text-xs text-slate-400">Click a node to filter inventory</span>
          </div>

          <div className="relative w-full h-[360px] bg-slate-50 border border-slate-200 rounded overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              {/* Transit Routes (Corridors) */}
              {hospitals.map((h1) =>
                hospitals.map((h2) => {
                  if (h1.id >= h2.id) return null;
                  const time = travelMatrix[h1.id]?.[h2.id] || 0;
                  const isHovered =
                    hoveredRoute &&
                    ((hoveredRoute.from === h1.id && hoveredRoute.to === h2.id) ||
                      (hoveredRoute.from === h2.id && hoveredRoute.to === h1.id));
                  const isSelected =
                    selectedHospitalId && (selectedHospitalId === h1.id || selectedHospitalId === h2.id);

                  return (
                    <g key={`${h1.id}-${h2.id}`}>
                      <line
                        x1={h1.coordinates.x}
                        y1={h1.coordinates.y}
                        x2={h2.coordinates.x}
                        y2={h2.coordinates.y}
                        stroke={isHovered ? '#2563EB' : isSelected ? '#93C5FD' : '#E2E8F0'}
                        strokeWidth={isHovered ? '0.8' : isSelected ? '0.6' : '0.4'}
                        strokeDasharray={isSelected ? '1,1' : undefined}
                      />
                      {/* Midpoint transit time badge */}
                      {isSelected && (
                        <text
                          x={(h1.coordinates.x + h2.coordinates.x) / 2}
                          y={(h1.coordinates.y + h2.coordinates.y) / 2}
                          fontSize="2.5"
                          fill="#1E293B"
                          textAnchor="middle"
                          className="font-mono select-none"
                        >
                          {time}m
                        </text>
                      )}
                    </g>
                  );
                })
              )}

              {/* Hospital Nodes */}
              {hospitals.map((h) => {
                const isSelected = selectedHospitalId === h.id;
                const stats = stockCountsByHospital[h.id];

                return (
                  <g
                    key={h.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedHospitalId(isSelected ? null : h.id)}
                    onMouseEnter={() => setHoveredRoute({ from: h.id, to: '' })}
                    onMouseLeave={() => setHoveredRoute(null)}
                  >
                    {/* Node circle */}
                    <circle
                      cx={h.coordinates.x}
                      cy={h.coordinates.y}
                      r={h.isRegionalHub ? '4.5' : '3.5'}
                      fill={isSelected ? '#2563EB' : '#FFFFFF'}
                      stroke={isSelected ? '#1D4ED8' : '#334155'}
                      strokeWidth={h.isRegionalHub ? '1.0' : '0.6'}
                    />
                    {/* Available count in center */}
                    <text
                      x={h.coordinates.x}
                      y={h.coordinates.y + 1}
                      fontSize="2.6"
                      fontWeight="bold"
                      fill={isSelected ? '#FFFFFF' : '#0F172A'}
                      textAnchor="middle"
                      className="font-mono select-none"
                    >
                      {stats?.available || 0}
                    </text>
                    {/* Facility label */}
                    <text
                      x={h.coordinates.x}
                      y={h.coordinates.y + 6.5}
                      fontSize="2.8"
                      fontWeight="600"
                      fill="#1E293B"
                      textAnchor="middle"
                      className="select-none"
                    >
                      {h.code}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Map Legend */}
            <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-xs border border-slate-200 rounded px-2.5 py-1.5 text-[11px] text-slate-600 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full border border-slate-700 bg-white inline-block" /> Local Hub
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Selected
              </span>
              <span className="text-slate-400">·</span>
              <span>Center number = Available units</span>
            </div>
          </div>
        </div>

        {/* Selected Facility Profile & Reserves (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">
                  {selectedHospital ? selectedHospital.name : 'Network Reserve Overview'}
                </h3>
              </div>
              {selectedHospital && (
                <button
                  onClick={() => setSelectedHospitalId(null)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {selectedHospital ? (
              <div className="mt-3 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div>
                    <span className="text-slate-400">Code:</span>{' '}
                    <span className="font-mono font-semibold text-slate-900">{selectedHospital.code}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Facility Type:</span>{' '}
                    <span className="text-slate-900">{selectedHospital.isRegionalHub ? 'Regional Hub' : 'Acute Hospital'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Location:</span> {selectedHospital.address}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-800 block mb-2">
                    Protected Safety Reserves (Inviolable Minimum Floor):
                  </span>
                  <div className="grid grid-cols-2 gap-2 font-mono">
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <div className="text-slate-400 text-[10px]">PRBC Floor</div>
                      <div className="font-bold text-slate-800">
                        {selectedHospital.protectedReserves.PRBC} units
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <div className="text-slate-400 text-[10px]">Platelets Floor</div>
                      <div className="font-bold text-slate-800">
                        {selectedHospital.protectedReserves.PLATELETS} units
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <div className="text-slate-400 text-[10px]">FFP Floor</div>
                      <div className="font-bold text-slate-800">
                        {selectedHospital.protectedReserves.FFP} units
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <div className="text-slate-400 text-[10px]">Cryoprecipitate</div>
                      <div className="font-bold text-slate-800">
                        {selectedHospital.protectedReserves.CRYOPRECIPITATE} units
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Outbound transfers are mathematically blocked if local inventory would breach these thresholds.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-xs text-slate-500 space-y-2">
                <p>
                  Select any hospital node on the map to inspect its protected safety reserves, courier transit durations, and dedicated inventory.
                </p>
                <div className="space-y-1.5 pt-2">
                  {hospitals.map((h) => {
                    const stats = stockCountsByHospital[h.id];
                    return (
                      <div
                        key={h.id}
                        onClick={() => setSelectedHospitalId(h.id)}
                        className="flex items-center justify-between p-2 rounded hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200 transition-colors"
                      >
                        <span className="font-medium text-slate-800">{h.name}</span>
                        <span className="font-mono text-slate-600">
                          {stats?.available || 0} avail · {stats?.reserved || 0} res
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Synthetic Unit Records Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">
              Synthetic Blood Unit Inventory Records ({filteredUnits.length} units displayed)
            </h3>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 text-xs">
            <select
              value={componentFilter}
              onChange={(e) => setComponentFilter(e.target.value)}
              aria-label="Filter by component type"
              className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700"
            >
              <option value="ALL">All Components</option>
              <option value="PRBC">PRBC (Red Cells)</option>
              <option value="PLATELETS">Platelets</option>
              <option value="FFP">Fresh Frozen Plasma</option>
              <option value="CRYOPRECIPITATE">Cryoprecipitate</option>
            </select>

            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              aria-label="Filter by blood group"
              className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700"
            >
              <option value="ALL">All ABO/Rh Groups</option>
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

        <div className="overflow-x-auto max-h-[380px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-500 font-mono text-[11px] sticky top-0 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">UNIT IDENTIFIER</th>
                <th className="py-2.5 px-4 font-semibold">CURRENT FACILITY</th>
                <th className="py-2.5 px-4 font-semibold">COMPONENT</th>
                <th className="py-2.5 px-4 font-semibold">ABO/Rh</th>
                <th className="py-2.5 px-4 font-semibold">STATUS</th>
                <th className="py-2.5 px-4 font-semibold">USABLE DEADLINE (EXPIRY)</th>
                <th className="py-2.5 px-4 font-semibold">STORAGE TEMP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No blood unit records match the active filters.
                  </td>
                </tr>
              ) : (
                filteredUnits.map((u) => {
                  const hosp = hospitals.find((h) => h.id === u.hospitalId);
                  const expMs = new Date(u.expiresAt).getTime();
                  const hoursLeft = Math.round((expMs - nowMs) / (3600 * 1000));
                  const isExpiringUrgent = hoursLeft <= 24 && u.status === 'AVAILABLE';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-4 font-mono font-medium text-slate-900">{u.id}</td>
                      <td className="py-2 px-4 text-slate-700">
                        {hosp?.name} <span className="text-slate-400 font-mono">({hosp?.code})</span>
                      </td>
                      <td className="py-2 px-4 font-medium text-slate-800">{COMPONENT_LABELS[u.componentType]}</td>
                      <td className="py-2 px-4 font-mono font-bold text-slate-900">
                        {SHORT_BLOOD_GROUPS[u.bloodGroup]}
                      </td>
                      <td className="py-2 px-4">
                        <span
                          className={`font-mono text-[11px] font-semibold ${
                            u.status === 'AVAILABLE'
                              ? 'text-emerald-700'
                              : u.status === 'RESERVED'
                              ? 'text-blue-700'
                              : u.status === 'IN_TRANSIT'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-2 px-4 font-mono">
                        <span className={isExpiringUrgent ? 'text-rose-600 font-semibold flex items-center gap-1' : 'text-slate-600'}>
                          {isExpiringUrgent && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                          {new Date(u.expiresAt).toLocaleDateString()} {new Date(u.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' '}
                          <span className="text-[10px] text-slate-400">({hoursLeft}h left)</span>
                        </span>
                      </td>
                      <td className="py-2 px-4 font-mono text-slate-600">
                        {u.storageTemperatureCelsius > 0 ? `+${u.storageTemperatureCelsius}` : u.storageTemperatureCelsius}°C
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
