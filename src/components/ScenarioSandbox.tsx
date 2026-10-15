import React from 'react';
import { ScenarioEvent } from '../types/bloodstock';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Truck,
  ShieldCheck,
  UserX,
  PackagePlus,
  Flame,
  GitCompare,
} from 'lucide-react';

interface ScenarioSandboxProps {
  activeScenario: ScenarioEvent | null;
  onTriggerScenario: (scenarioCode: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I') => Promise<void>;
  onReset: () => Promise<void>;
  loading: boolean;
}

interface ScenarioCardDef {
  code: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';
  title: string;
  icon: React.ReactNode;
  subtitle: string;
  keyConstraint: string;
  expectedOutcome: string;
}

export const ScenarioSandbox: React.FC<ScenarioSandboxProps> = ({
  activeScenario,
  onTriggerScenario,
  onReset,
  loading,
}) => {
  const scenarios: ScenarioCardDef[] = [
    {
      code: 'A',
      title: 'A. Nearest Hospital Sufficient Stock',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      subtitle: 'Routine request with sufficient local supply.',
      keyConstraint: 'Proximity & Zero Transit Overhead',
      expectedOutcome: 'Fulfills locally from Metro Central with 0m road courier transit.',
    },
    {
      code: 'B',
      title: 'B. Collaborative Multi-Hospital Fulfillment',
      icon: <GitCompare className="w-5 h-5 text-blue-600" />,
      subtitle: 'Local stock exhausted; request requires joint transfers.',
      keyConstraint: 'Multi-Commodity Joint Sourcing',
      expectedOutcome: "Memorial Children's receives units coordinated jointly from Trauma and Metro.",
    },
    {
      code: 'C',
      title: 'C. In-Transit Usable Expiry Failure',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
      subtitle: 'Nearby unit expires before transit + prep buffer finishes.',
      keyConstraint: 'Perishability Window (t_arrival <= T_expiry)',
      expectedOutcome: 'Nearby Eastside unit rejected (expires in 40m); routes fresh unit from farther hub.',
    },
    {
      code: 'D',
      title: 'D. Double-Allocation Prevention (Pre-Reserved)',
      icon: <ShieldCheck className="w-5 h-5 text-indigo-600" />,
      subtitle: 'Unit already locked for another surgical procedure.',
      keyConstraint: 'Unit Uniqueness (sum x_{u,r} <= 1)',
      expectedOutcome: 'Engine excludes locked O- unit; avoids surgical collision.',
    },
    {
      code: 'E',
      title: 'E. Competing Demands for Scarce Stock',
      icon: <Flame className="w-5 h-5 text-rose-600" />,
      subtitle: '1 unit of O- left; Critical Trauma vs Routine Surgery.',
      keyConstraint: 'Lexicographic Urgency Triage',
      expectedOutcome: 'CP-SAT prioritizes Critical Trauma; baseline FIFO would risk patient mortality.',
    },
    {
      code: 'F',
      title: 'F. Transport Failure & Dynamic Replan',
      icon: <Truck className="w-5 h-5 text-red-600" />,
      subtitle: 'Courier refrigeration breakdown en route (>10°C thermal breach).',
      keyConstraint: 'Resilient Failure Recovery & Rollback',
      expectedOutcome: 'Unit marked DISCARDED; request returns to PENDING and triggers immediate replan.',
    },
    {
      code: 'G',
      title: 'G. Surgical Cancellation & Safe Release',
      icon: <UserX className="w-5 h-5 text-slate-600" />,
      subtitle: 'Surgeon cancels deferred procedure.',
      keyConstraint: 'Transactional Lock Release',
      expectedOutcome: 'All reserved units return safely to AVAILABLE stock with zero orphaned locks.',
    },
    {
      code: 'H',
      title: 'H. Fresh Blood Donation Batch Arrival',
      icon: <PackagePlus className="w-5 h-5 text-emerald-600" />,
      subtitle: 'Mobile blood drive delivers fresh units directly to Trauma Center.',
      keyConstraint: 'Replanning Efficiency & Local Substitution',
      expectedOutcome: 'Optimizer substitutes out long-distance transfers in favor of newly arrived local units.',
    },
    {
      code: 'I',
      title: 'I. Infeasible Demand & Diagnostic Explanation',
      icon: <AlertTriangle className="w-5 h-5 text-rose-600" />,
      subtitle: 'Extreme rare order with impossible 15-minute deadline.',
      keyConstraint: 'Hard Constraint Preservation (Zero False Allocations)',
      expectedOutcome: 'System refuses to force an invalid plan; outputs transparent rejection causes for each candidate.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-lg border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Scenario Control Sandbox (9 Mandatory Validation Benchmarks)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Deterministic scenario suite designed for Code-e-Manipal 2.0 evaluation. Trigger disruptions, test boundary conditions, and verify replanning resilience.
            </p>
          </div>
          <button
            onClick={onReset}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Scenario State</span>
          </button>
        </div>

        {/* Active Scenario Banner */}
        {activeScenario && (
          <div className="mt-4 p-3.5 bg-blue-50/80 border border-blue-200 rounded-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                  Active Simulation: {activeScenario.title}
                </span>
                <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                  {activeScenario.description}
                </p>
                <div className="mt-2 text-[11px] font-mono text-blue-700 space-y-0.5">
                  {activeScenario.injectedChanges.map((change, idx) => (
                    <div key={idx}>✓ {change}</div>
                  ))}
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-blue-600 text-white rounded shrink-0">
                SCENARIO {activeScenario.code} ACTIVE
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 9 Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scenarios.map((sc) => {
          const isActive = activeScenario?.code === sc.code;

          return (
            <div
              key={sc.code}
              className={`p-4 rounded-lg border transition-all ${
                isActive
                  ? 'bg-blue-50/40 border-blue-500 ring-1 ring-blue-500'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {sc.icon}
                  <h3 className="text-xs font-bold text-slate-900">{sc.title}</h3>
                </div>
                <span className="font-mono text-[11px] font-bold text-slate-400">
                  [{sc.code}]
                </span>
              </div>

              <p className="text-xs text-slate-600 min-h-[36px]">{sc.subtitle}</p>

              <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] space-y-1">
                <div>
                  <span className="text-slate-400 font-medium">Core Invariant:</span>{' '}
                  <span className="text-slate-800 font-semibold">{sc.keyConstraint}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Expected Result:</span>{' '}
                  <span className="text-slate-600">{sc.expectedOutcome}</span>
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={() => onTriggerScenario(sc.code)}
                  disabled={loading}
                  className={`w-full py-1.5 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                  }`}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{isActive ? 'Scenario Active (Click to Re-run)' : 'Trigger Scenario ' + sc.code}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
