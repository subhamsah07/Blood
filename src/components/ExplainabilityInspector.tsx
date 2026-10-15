import React, { useState } from 'react';
import {
  Hospital,
  BloodRequest,
  AllocationRunSummary,
  CandidateEvaluation,
} from '../types/bloodstock';
import {
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Layers,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface ExplainabilityInspectorProps {
  hospitals: Hospital[];
  requests: BloodRequest[];
  lastOptimizerRun: AllocationRunSummary | null;
  lastBaselineRun: AllocationRunSummary | null;
}

export const ExplainabilityInspector: React.FC<ExplainabilityInspectorProps> = ({
  hospitals,
  requests,
  lastOptimizerRun,
  lastBaselineRun,
}) => {
  const [selectedEngine, setSelectedEngine] = useState<'OPTIMIZER' | 'BASELINE'>('OPTIMIZER');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'FEASIBLE' | 'REJECTED'>('ALL');
  const [selectedRequestId, setSelectedRequestId] = useState<string>('ALL');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const activeRun = selectedEngine === 'OPTIMIZER' ? lastOptimizerRun : lastBaselineRun;

  const rejectedCandidates: CandidateEvaluation[] = activeRun?.rejectedCandidates || [];
  const allocatedUnits = new Set(activeRun?.allocations.map((a) => `${a.requestId}:${a.unitId}`));

  // Combine and format records for inspection
  const candidateRows = rejectedCandidates.map((c) => ({
    ...c,
    status: 'REJECTED' as const,
  }));

  const filteredRows = candidateRows.filter((row) => {
    if (selectedRequestId !== 'ALL' && row.requestId !== selectedRequestId) return false;
    if (statusFilter === 'FEASIBLE' && !row.isFeasible) return false;
    if (statusFilter === 'REJECTED' && row.isFeasible) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Explainability Engine Intro */}
      <div className="bg-white p-5 rounded-lg border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Explainability & Constraint Audit Inspector
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Deterministic diagnostic traces showing why every candidate blood unit was either selected or rejected by the rule engine and solver.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Run:</span>
            <div className="flex items-center p-1 bg-slate-100 rounded text-xs">
              <button
                onClick={() => setSelectedEngine('OPTIMIZER')}
                className={`px-3 py-1 font-medium rounded ${
                  selectedEngine === 'OPTIMIZER'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Optimizer Run
              </button>
              <button
                onClick={() => setSelectedEngine('BASELINE')}
                className={`px-3 py-1 font-medium rounded ${
                  selectedEngine === 'BASELINE'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Baseline Run
              </button>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Filter Request:</span>
            <select
              value={selectedRequestId}
              onChange={(e) => setSelectedRequestId(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-700 font-mono"
            >
              <option value="ALL">All Active Requests</option>
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} · {r.urgency} ({r.componentType} {r.bloodGroup})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Feasibility Outcome:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-700 font-mono"
            >
              <option value="ALL">All Evaluated Units</option>
              <option value="REJECTED">Infeasible / Rejected Only</option>
              <option value="FEASIBLE">Feasible Only</option>
            </select>
          </div>

          <div className="ml-auto text-xs font-mono text-slate-500">
            Showing <strong className="text-slate-900">{filteredRows.length}</strong> candidate audit traces
          </div>
        </div>
      </div>

      {/* Selected Accepted Allocations Rationale Box */}
      {activeRun && activeRun.allocations.length > 0 && (
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-4">
          <span className="text-xs font-semibold text-emerald-900 uppercase tracking-wider block mb-2">
            Accepted Units Selection Justification ({activeRun.allocations.length} committed)
          </span>
          <div className="space-y-2">
            {activeRun.allocations.map((a) => {
              const src = hospitals.find((h) => h.id === a.sourceHospitalId)?.code;
              const dst = hospitals.find((h) => h.id === a.destinationHospitalId)?.code;
              return (
                <div key={`${a.requestId}-${a.unitId}`} className="text-xs bg-white p-2.5 rounded border border-emerald-200/80 flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-mono text-slate-900 font-semibold">
                      {a.unitId} allocated to {a.requestId} ({src} → {dst})
                    </div>
                    <p className="text-slate-600 mt-0.5">{a.reason}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rejected / Evaluated Candidates Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Rejection Traces & Constraint Rule Outcomes
          </h3>
          <span className="text-xs text-slate-400">Click any row to view full 6-rule breakdown</span>
        </div>

        <div className="overflow-x-auto max-h-[460px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-500 font-mono text-[11px] sticky top-0 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold w-8"></th>
                <th className="py-2.5 px-4 font-semibold">UNIT ID</th>
                <th className="py-2.5 px-4 font-semibold">REQUEST ID</th>
                <th className="py-2.5 px-4 font-semibold">ROUTE</th>
                <th className="py-2.5 px-4 font-semibold">LEAD TIME</th>
                <th className="py-2.5 px-4 font-semibold">EXPIRY AT ARRIVAL</th>
                <th className="py-2.5 px-4 font-semibold">PRIMARY REJECTION CAUSE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No candidate audit records match the current filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const key = `${row.requestId}-${row.unitId}`;
                  const isExpanded = expandedRow === key;
                  const src = hospitals.find((h) => h.id === row.sourceHospitalId)?.code;
                  const dst = hospitals.find((h) => h.id === row.destinationHospitalId)?.code;

                  return (
                    <React.Fragment key={key}>
                      <tr
                        onClick={() => setExpandedRow(isExpanded ? null : key)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-4 text-slate-400">
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-medium text-slate-900">{row.unitId}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">{row.requestId}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">
                          {src} → {dst}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">
                          {row.totalLeadMinutes}m ({row.travelMinutes}m transit + {row.handlingBufferMinutes}m prep)
                        </td>
                        <td className="py-2.5 px-4 font-mono">
                          <span
                            className={
                              row.shelfLifeRemainingMinutesAtArrival > 15
                                ? 'text-emerald-700'
                                : 'text-rose-600 font-semibold'
                            }
                          >
                            {row.shelfLifeRemainingMinutesAtArrival > 0
                              ? `${row.shelfLifeRemainingMinutesAtArrival}m remaining`
                              : `Expired by ${Math.abs(row.shelfLifeRemainingMinutesAtArrival)}m`}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-rose-700 font-medium max-w-md">
                          <div className="flex items-start gap-1.5">
                            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                            <span>{row.rejectionReasons[0] || 'Infeasible candidate'}</span>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Rule Evaluation Breakdown */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={7} className="p-4 border-y border-slate-200">
                            <div className="bg-white p-3.5 rounded border border-slate-200 space-y-2">
                              <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider block">
                                Full Constraint Sieve Rule Outcomes for Unit {row.unitId} against Request {row.requestId}:
                              </span>
                              <div className="space-y-1.5">
                                {row.evaluations.map((rule, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-start gap-2 text-xs py-1 px-2 rounded border border-slate-100"
                                  >
                                    {rule.passed ? (
                                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                    ) : (
                                      <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                    )}
                                    <div className="flex-1">
                                      <div className="font-semibold text-slate-800">
                                        {rule.ruleName}{' '}
                                        <span className="text-[10px] font-mono text-slate-400 font-normal">
                                          ({rule.ruleCode})
                                        </span>
                                      </div>
                                      <div className={rule.passed ? 'text-slate-600' : 'text-rose-700 font-medium'}>
                                        {rule.detail}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
