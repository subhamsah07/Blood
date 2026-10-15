/**
 * BloodStock - Frontend API Client
 * Connects to the Express backend API with transparent fallback to simulator
 * singleton for offline/static evaluation resilience.
 */

import {
  Hospital,
  BloodUnit,
  BloodRequest,
  Transfer,
  TravelTimeMatrix,
  AllocationRunSummary,
  ProposedAllocation,
  ScenarioEvent,
} from '../types/bloodstock';
import { simulator } from './simulationState';

async function safeFetch<T>(url: string, options?: RequestInit, fallbackFn?: () => T): Promise<T> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });
    if (!res.ok) {
      throw new Error(`API HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    if (fallbackFn) {
      // Graceful fallback to client-side simulator
      return fallbackFn();
    }
    throw err;
  }
}

export const apiClient = {
  async getHospitals(): Promise<Hospital[]> {
    return safeFetch('/api/hospitals', undefined, () => simulator.getHospitals());
  },

  async getInventory(): Promise<BloodUnit[]> {
    return safeFetch('/api/inventory', undefined, () => simulator.getUnits());
  },

  async getRequests(): Promise<BloodRequest[]> {
    return safeFetch('/api/requests', undefined, () => simulator.getRequests());
  },

  async getTransfers(): Promise<Transfer[]> {
    return safeFetch('/api/transfers', undefined, () => simulator.getTransfers());
  },

  async getTravelMatrix(): Promise<TravelTimeMatrix> {
    return safeFetch('/api/travel-matrix', undefined, () => simulator.getTravelMatrix());
  },

  async getSystemState(): Promise<{
    simulationTime: string;
    activeScenario: ScenarioEvent | null;
    lastBaselineRun: AllocationRunSummary | null;
    lastOptimizerRun: AllocationRunSummary | null;
    auditHistory: string[];
  }> {
    return safeFetch('/api/system-state', undefined, () => ({
      simulationTime: simulator.getSimulationTime().toISOString(),
      activeScenario: simulator.getActiveScenario(),
      lastBaselineRun: simulator.getLastBaselineRun(),
      lastOptimizerRun: simulator.getLastOptimizerRun(),
      auditHistory: simulator.getAuditHistory(),
    }));
  },

  async runBaseline(): Promise<AllocationRunSummary> {
    return safeFetch(
      '/api/run-baseline',
      { method: 'POST' },
      () => simulator.executeBaseline()
    );
  },

  async runOptimizer(): Promise<AllocationRunSummary> {
    return safeFetch(
      '/api/run-optimizer',
      { method: 'POST' },
      () => simulator.executeOptimizer()
    );
  },

  async commitReservations(allocations: ProposedAllocation[], operatorNote?: string): Promise<{
    success: boolean;
    committedCount: number;
    failedAllocations: { allocation: ProposedAllocation; reason: string }[];
  }> {
    return safeFetch(
      '/api/commit-reservations',
      {
        method: 'POST',
        body: JSON.stringify({ allocations, operatorNote }),
      },
      () => simulator.commitProposedPlan(allocations, operatorNote)
    );
  },

  async advanceTime(minutes: number): Promise<{ simulationTime: string; message: string }> {
    return safeFetch(
      '/api/advance-time',
      {
        method: 'POST',
        body: JSON.stringify({ minutes }),
      },
      () => {
        simulator.advanceTime(minutes);
        return {
          simulationTime: simulator.getSimulationTime().toISOString(),
          message: `Simulated clock advanced by ${minutes} minutes.`,
        };
      }
    );
  },

  async triggerScenario(scenarioCode: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I'): Promise<ScenarioEvent> {
    return safeFetch(
      '/api/trigger-scenario',
      {
        method: 'POST',
        body: JSON.stringify({ scenarioCode }),
      },
      () => simulator.triggerScenario(scenarioCode)
    );
  },

  async createRequest(reqData: Omit<BloodRequest, 'id' | 'createdAt' | 'status' | 'allocatedUnitIds'>): Promise<BloodRequest> {
    return safeFetch(
      '/api/create-request',
      {
        method: 'POST',
        body: JSON.stringify(reqData),
      },
      () => simulator.createNewRequest(reqData)
    );
  },

  async cancelRequest(requestId: string): Promise<{ success: boolean; releasedUnitsCount: number }> {
    return safeFetch(
      '/api/cancel-request',
      {
        method: 'POST',
        body: JSON.stringify({ requestId }),
      },
      () => simulator.cancelRequest(requestId)
    );
  },

  async simulateTransferFailure(transferId: string): Promise<{ success: boolean; discardedUnitId?: string }> {
    return safeFetch(
      '/api/simulate-transfer-failure',
      {
        method: 'POST',
        body: JSON.stringify({ transferId }),
      },
      () => simulator.simulateTransferFailure(transferId)
    );
  },

  async addUnit(unitData: Omit<BloodUnit, 'id' | 'status' | 'syntheticBatchId'>): Promise<BloodUnit> {
    return safeFetch(
      '/api/add-unit',
      {
        method: 'POST',
        body: JSON.stringify(unitData),
      },
      () => simulator.addSyntheticUnit(unitData)
    );
  },

  async resetSimulation(): Promise<{ message: string }> {
    return safeFetch(
      '/api/reset',
      { method: 'POST' },
      () => {
        simulator.resetToInitialState();
        return { message: 'Reset simulator to initial state.' };
      }
    );
  },
};
