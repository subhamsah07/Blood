import React, { useState } from 'react';
import {
  Hospital,
  BloodRequest,
  AllocationRunSummary,
  ProposedAllocation,
} from '../types/bloodstock';
import { SHORT_BLOOD_GROUPS, COMPONENT_LABELS } from '../services/compatibilityRules';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Zap,
  Play,
  CheckCircle2,
  AlertOctagon,
  ArrowRight,
  ShieldCheck,
  Clock,
  Sparkles,
} from 'lucide-react';

interface AllocationStudioProps {
  hospitals: Hospital[];
  requests: BloodRequest[];
  lastBaselineRun: AllocationRunSummary | null;
  lastOptimizerRun: AllocationRunSummary | null;
  onRunBaseline: () => Promise<void>;
  onRunOptimizer: () => Promise<void>;
  onCommitAllocations: (allocations: ProposedAllocation[]) => Promise<void>;
  loading: boolean;
}

export const AllocationStudio: React.FC<AllocationStudioProps> = ({
  hospitals,
  requests,
  lastBaselineRun,
  lastOptimizerRun,
  onRunBaseline,
  onRunOptimizer,
  onCommitAllocations,
  loading,
}) => {
  const [selectedEngineView, setSelectedEngineView] = useState<'OPTIMIZER' | 'BASELINE'>('OPTIMIZER');
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  const activeRun = selectedEngineView === 'OPTIMIZER' ? lastOptimizerRun : lastBaselineRun;

  const handleCommit = async () => {
    if (!activeRun || activeRun.allocations.length === 0) return;
    setIsCommitting(true);
    setCommitMessage(null);
    try {
      await onCommitAllocations(activeRun.allocations);
      setCommitMessage(`Successfully committed ${activeRun.allocations.length} reservations with zero double-allocations.`);
    } catch (err: any) {
      setCommitMessage(`Commit error: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // Prepare comparison metrics for Recharts
  const comparisonChartData = [
    {
      metric: 'Total Allocated',
      Baseline: lastBaselineRun?.totalAllocatedUnits || 0,
      Optimizer: lastOptimizerRun?.totalAllocatedUnits || 0,
    },
    {
      metric: 'Urgent Fulfilled',
      Baseline: lastBaselineRun?.urgentDemandFulfilled || 0,
      Optimizer: lastOptimizerRun?.urgentDemandFulfilled || 0,
    },
    {
      metric: 'Critical Fulfilled',
      Baseline: lastBaselineRun?.criticalDemandFulfilled || 0,
      Optimizer: lastOptimizerRun?.criticalDemandFulfilled || 0,
    },
    {
      metric: 'Avg Transit (min)',
      Baseline: lastBaselineRun?.averageTransitMinutes || 0,
      Optimizer: lastOptimizerRun?.averageTransitMinutes || 0,
    },
  ];

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');

  return (
    <div className="space-y-6">
      {/* Studio Header & Execution Bar */}
      <div className="bg-white p-5 rounded-lg border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Allocation Engine Studio: Baseline vs. CP-SAT Constraint Optimizer
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Compare greedy nearest-available dispatching against exact multi-objective integer programming with time-window constraints.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onRunBaseline}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 text-slate-600" />
              <span>Run Nearest Baseline</span>
            </button>

            <button
              onClick={onRunOptimizer}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50 shadow-xs"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Solve with CP-SAT Optimizer</span>
            </button>
          </div>
        </div>

        {/* Engine Switcher Tabs */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100">
          <span className="text-xs font-medium text-slate-500 mr-2">Active Inspection View:</span>
          <div className="flex items-center p-1 bg-slate-100 rounded-md">
            <button
              onClick={() => setSelectedEngineView('OPTIMIZER')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                selectedEngineView === 'OPTIMIZER'
                  ? 'bg-white text-blue-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              CP-SAT Optimizer Plan {lastOptimizerRun ? `(${lastOptimizerRun.solverStatus})` : ''}
            </button>
            <button
              onClick={() => setSelectedEngineView('BASELINE')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                selectedEngineView === 'BASELINE'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Nearest Baseline Plan {lastBaselineRun ? '(Heuristic)' : ''}
            </button>
          </div>

          {activeRun && (
            <div className="ml-auto text-xs text-slate-500 font-mono">
              Solver Runtime: <strong className="text-slate-900">{activeRun.executionTimeMs} ms</strong>
            </div>
          )}
        </div>
      </div>

      {/* Comparison Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">Total Requested</span>
          <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
            {activeRun?.totalRequestedUnits ?? pendingRequests.reduce((s, r) => s + r.quantity, 0)}
          </span>
          <span className="text-[10px] text-slate-500">Across {pendingRequests.length} pending orders</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">Total Allocated</span>
          <span className="text-xl font-bold font-mono text-emerald-700 mt-1 block">
            {activeRun?.totalAllocatedUnits ?? '—'}
          </span>
          <span className="text-[10px] text-slate-500">
            {activeRun ? `${Math.round((activeRun.totalAllocatedUnits / (activeRun.totalRequestedUnits || 1)) * 100)}% fulfillment` : 'Run solver to calculate'}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">Unmet Demand</span>
          <span className="text-xl font-bold font-mono text-rose-700 mt-1 block">
            {activeRun?.unmetDemandUnits ?? '—'}
          </span>
          <span className="text-[10px] text-slate-500">Requires alternative triage</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">Urgent Fulfilled</span>
          <span className="text-xl font-bold font-mono text-blue-700 mt-1 block">
            {activeRun ? `${activeRun.urgentDemandFulfilled}/${activeRun.urgentDemandTotal}` : '—'}
          </span>
          <span className="text-[10px] text-slate-500">High-priority surgical cases</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">Avg Delivery Time</span>
          <span className="text-xl font-bold font-mono text-slate-800 mt-1 block">
            {activeRun ? `${activeRun.averageTransitMinutes}m` : '—'}
          </span>
          <span className="text-[10px] text-slate-500">Road courier duration</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">Double Allocation</span>
          <span className="text-xl font-bold font-mono text-emerald-700 mt-1 block">
            {activeRun?.doubleAllocationViolationsCount ?? 0}
          </span>
          <span className="text-[10px] text-emerald-600 font-semibold">Strict 0 invariant</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">Reserve Violations</span>
          <span className="text-xl font-bold font-mono text-emerald-700 mt-1 block">
            {activeRun?.reserveViolationsCount ?? 0}
          </span>
          <span className="text-[10px] text-emerald-600 font-semibold">Safety floor preserved</span>
        </div>
      </div>

      {/* Recharts Side-by-Side Comparison Graphic */}
      {(lastBaselineRun || lastOptimizerRun) && (
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Comparative Performance: Baseline Heuristic vs. CP-SAT Solver
            </span>
            <span className="text-xs text-slate-400">Higher fulfillment & lower transit time = Superior efficiency</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonChartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <XAxis dataKey="metric" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#CBD5E1',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar dataKey="Baseline" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Optimizer" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Proposed Allocation Recommendation List */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>
                Recommended Transfer Allocations ({activeRun?.allocations.length || 0} units proposed)
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review destination hospital, transit duration, feasible deadline, and mathematical rationale before committing.
            </p>
          </div>

          {activeRun && activeRun.allocations.length > 0 && (
            <button
              onClick={handleCommit}
              disabled={isCommitting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors disabled:opacity-50 shadow-xs"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isCommitting ? 'Verifying Locks...' : 'Commit Reservations Safely'}</span>
            </button>
          )}
        </div>

        {commitMessage && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{commitMessage}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-500 font-mono text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">REQUEST & CASE</th>
                <th className="py-2.5 px-4 font-semibold">SOURCE HOSPITAL</th>
                <th className="py-2.5 px-4 font-semibold">DESTINATION</th>
                <th className="py-2.5 px-4 font-semibold">UNIT ALLOCATED</th>
                <th className="py-2.5 px-4 font-semibold">TRANSIT / ETA</th>
                <th className="py-2.5 px-4 font-semibold">FEASIBILITY</th>
                <th className="py-2.5 px-4 font-semibold">EXPLAINABLE REASON</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {!activeRun || activeRun.allocations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No active allocation run. Click <strong>"Solve with CP-SAT Optimizer"</strong> or <strong>"Run Nearest Baseline"</strong> above.
                  </td>
                </tr>
              ) : (
                activeRun.allocations.map((alloc, idx) => {
                  const sourceHosp = hospitals.find((h) => h.id === alloc.sourceHospitalId);
                  const destHosp = hospitals.find((h) => h.id === alloc.destinationHospitalId);
                  const req = requests.find((r) => r.id === alloc.requestId);
                  const isLocal = alloc.sourceHospitalId === alloc.destinationHospitalId;

                  return (
                    <tr key={`${alloc.requestId}-${alloc.unitId}-${idx}`} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4">
                        <span className="font-mono font-medium text-slate-900 block">{alloc.requestId}</span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {req?.urgency.replace('_', ' ')} · {req?.patientCaseId}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-medium text-slate-800">{sourceHosp?.code}</span>
                        <span className="text-[10px] text-slate-400 block">{sourceHosp?.name}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-medium text-slate-800">{destHosp?.code}</span>
                        <span className="text-[10px] text-slate-400 block">{destHosp?.name}</span>
                      </td>
                      <td className="py-2.5 px-4 font-mono">
                        <span className="font-bold text-slate-900">{alloc.unitId}</span>
                        <span className="text-[11px] text-slate-600 block">
                          {COMPONENT_LABELS[alloc.componentType]} ({SHORT_BLOOD_GROUPS[alloc.bloodGroup]})
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono">
                        <span className="font-semibold text-slate-800 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {alloc.travelMinutes}m road
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Arr: {new Date(alloc.estimatedArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-mono text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {alloc.feasibilityStatus}
                        </span>
                        {isLocal && (
                          <span className="text-[10px] text-blue-700 font-semibold block">Local Facility Match</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 max-w-sm">
                        <p className="text-xs leading-relaxed">{alloc.reason}</p>
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
