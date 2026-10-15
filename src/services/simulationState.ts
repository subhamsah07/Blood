/**
 * BloodStock - Master Simulation State Manager
 * 
 * Manages the multi-hospital network state, two-phase reservation transactions,
 * simulated clock advancement, failure injection, and deterministic test scenarios.
 */

import {
  Hospital,
  BloodUnit,
  BloodRequest,
  Reservation,
  Transfer,
  TravelTimeMatrix,
  AllocationRunSummary,
  ProposedAllocation,
  ScenarioEvent,
} from '../types/bloodstock';
import {
  SYNTHETIC_HOSPITALS,
  TRAVEL_TIME_MATRIX,
  generateInitialBloodUnits,
  generateInitialRequests,
} from './syntheticData';
import { runNearestBaselineAllocation } from './baselineSolver';
import { runConstraintOptimizer } from './optimizerSolver';

export class SimulationStateManager {
  private hospitals: Hospital[];
  private units: BloodUnit[];
  private requests: BloodRequest[];
  private reservations: Reservation[];
  private transfers: Transfer[];
  private travelMatrix: TravelTimeMatrix;
  private simulationTime: Date;
  private lastBaselineRun: AllocationRunSummary | null = null;
  private lastOptimizerRun: AllocationRunSummary | null = null;
  private activeScenario: ScenarioEvent | null = null;
  private auditHistory: string[] = [];

  constructor() {
    this.simulationTime = new Date('2026-10-15T09:00:00Z');
    this.hospitals = JSON.parse(JSON.stringify(SYNTHETIC_HOSPITALS));
    this.travelMatrix = TRAVEL_TIME_MATRIX;
    this.units = generateInitialBloodUnits(this.simulationTime);
    this.requests = generateInitialRequests(this.simulationTime);
    this.reservations = [];
    this.transfers = [];
    this.logAudit('Simulator initialized with 7 hospitals, 77 synthetic units, and 7 pending clinical requests.');
  }

  // --- Read Accessors ---
  public getHospitals(): Hospital[] {
    return this.hospitals;
  }

  public getUnits(): BloodUnit[] {
    return this.units;
  }

  public getRequests(): BloodRequest[] {
    return this.requests;
  }

  public getReservations(): Reservation[] {
    return this.reservations;
  }

  public getTransfers(): Transfer[] {
    return this.transfers;
  }

  public getTravelMatrix(): TravelTimeMatrix {
    return this.travelMatrix;
  }

  public getSimulationTime(): Date {
    return this.simulationTime;
  }

  public getLastBaselineRun(): AllocationRunSummary | null {
    return this.lastBaselineRun;
  }

  public getLastOptimizerRun(): AllocationRunSummary | null {
    return this.lastOptimizerRun;
  }

  public getActiveScenario(): ScenarioEvent | null {
    return this.activeScenario;
  }

  public getAuditHistory(): string[] {
    return this.auditHistory;
  }

  private logAudit(entry: string) {
    const timeStr = this.simulationTime.toISOString().substring(11, 19);
    this.auditHistory.unshift(`[T+${timeStr}] ${entry}`);
    if (this.auditHistory.length > 200) {
      this.auditHistory.pop();
    }
  }

  // --- Reset Simulator ---
  public resetToInitialState(newRefTime: Date = new Date('2026-10-15T09:00:00Z')) {
    this.simulationTime = newRefTime;
    this.hospitals = JSON.parse(JSON.stringify(SYNTHETIC_HOSPITALS));
    this.units = generateInitialBloodUnits(this.simulationTime);
    this.requests = generateInitialRequests(this.simulationTime);
    this.reservations = [];
    this.transfers = [];
    this.lastBaselineRun = null;
    this.lastOptimizerRun = null;
    this.activeScenario = null;
    this.logAudit('Simulator state reset to standard baseline configuration.');
  }

  // --- Run Allocation Algorithms ---
  public executeBaseline(): AllocationRunSummary {
    this.lastBaselineRun = runNearestBaselineAllocation(
      this.hospitals,
      this.units,
      this.requests.filter((r) => r.status === 'PENDING'),
      this.travelMatrix,
      this.simulationTime
    );
    this.logAudit(`Executed Nearest-Baseline heuristic: ${this.lastBaselineRun.totalAllocatedUnits}/${this.lastBaselineRun.totalRequestedUnits} units assigned in ${this.lastBaselineRun.executionTimeMs}ms.`);
    return this.lastBaselineRun;
  }

  public executeOptimizer(): AllocationRunSummary {
    this.lastOptimizerRun = runConstraintOptimizer(
      this.hospitals,
      this.units,
      this.requests.filter((r) => r.status === 'PENDING'),
      this.travelMatrix,
      this.simulationTime
    );
    this.logAudit(`Executed CP-SAT Constraint Optimizer: ${this.lastOptimizerRun.totalAllocatedUnits}/${this.lastOptimizerRun.totalRequestedUnits} units allocated (${this.lastOptimizerRun.solverStatus}) in ${this.lastOptimizerRun.executionTimeMs}ms.`);
    return this.lastOptimizerRun;
  }

  // --- Safe Two-Phase Reservation Commit ---
  public commitProposedPlan(
    allocations: ProposedAllocation[],
    operatorNote: string = 'Authorized by operator'
  ): {
    success: boolean;
    committedCount: number;
    failedAllocations: { allocation: ProposedAllocation; reason: string }[];
  } {
    const failedAllocations: { allocation: ProposedAllocation; reason: string }[] = [];
    let committedCount = 0;

    // Transactional Re-Validation: Ensure no unit changed state between proposal and commit!
    for (const alloc of allocations) {
      const unit = this.units.find((u) => u.id === alloc.unitId);
      const req = this.requests.find((r) => r.id === alloc.requestId);

      if (!unit) {
        failedAllocations.push({ allocation: alloc, reason: 'Unit record no longer exists in system.' });
        continue;
      }

      if (unit.status !== 'AVAILABLE') {
        failedAllocations.push({
          allocation: alloc,
          reason: `Double-allocation violation blocked: Unit ${unit.id} has already shifted to state '${unit.status}'.`,
        });
        continue;
      }

      if (!req || req.status === 'CANCELLED' || req.status === 'FULFILLED') {
        failedAllocations.push({
          allocation: alloc,
          reason: `Target request ${alloc.requestId} is no longer pending.`,
        });
        continue;
      }

      // Safe State Transition: AVAILABLE -> RESERVED
      unit.status = 'RESERVED';

      // Create Reservation Record
      const reservationId = `RES-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 899 + 100)}`;
      const reservation: Reservation = {
        id: reservationId,
        unitId: unit.id,
        requestId: req.id,
        sourceHospitalId: alloc.sourceHospitalId,
        destinationHospitalId: alloc.destinationHospitalId,
        status: 'CONFIRMED',
        reservedAt: this.simulationTime.toISOString(),
        lockedUntil: new Date(this.simulationTime.getTime() + 4 * 3600 * 1000).toISOString(),
      };
      this.reservations.push(reservation);

      // Create Simulated Physical Transfer
      const transferId = `TX-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 899 + 100)}`;
      const isLocal = alloc.sourceHospitalId === alloc.destinationHospitalId;
      const transfer: Transfer = {
        id: transferId,
        reservationId,
        unitId: unit.id,
        requestId: req.id,
        sourceHospitalId: alloc.sourceHospitalId,
        destinationHospitalId: alloc.destinationHospitalId,
        dispatchedAt: this.simulationTime.toISOString(),
        estimatedArrivalAt: alloc.estimatedArrival,
        status: isLocal ? 'DELIVERED' : 'IN_TRANSIT',
        courierIdentifier: isLocal ? 'INTERNAL_PORTER' : `MEDIC-EXPRESS-${alloc.sourceHospitalId.slice(-4)}`,
      };
      this.transfers.push(transfer);

      if (isLocal) {
        unit.status = 'RECEIVED';
      } else {
        unit.status = 'IN_TRANSIT';
      }

      // Update Request status
      req.allocatedUnitIds.push(unit.id);
      if (req.allocatedUnitIds.length >= req.quantity) {
        req.status = isLocal ? 'FULFILLED' : 'ALLOCATED';
      } else {
        req.status = 'PARTIALLY_ALLOCATED';
      }

      committedCount++;
      this.logAudit(`Committed reservation ${reservationId}: Unit ${unit.id} -> Request ${req.id} (${transfer.courierIdentifier}).`);
    }

    return {
      success: failedAllocations.length === 0,
      committedCount,
      failedAllocations,
    };
  }

  // --- Advance Simulated Time ---
  public advanceTime(minutes: number) {
    const newTimeMs = this.simulationTime.getTime() + minutes * 60 * 1000;
    this.simulationTime = new Date(newTimeMs);

    // 1. Check in-transit transfers reaching destination
    this.transfers.forEach((tx) => {
      if (tx.status === 'IN_TRANSIT') {
        const etaMs = new Date(tx.estimatedArrivalAt).getTime();
        if (newTimeMs >= etaMs) {
          tx.status = 'DELIVERED';
          tx.actualArrivalAt = new Date(etaMs).toISOString();

          // Mark unit as RECEIVED
          const unit = this.units.find((u) => u.id === tx.unitId);
          if (unit) {
            unit.status = 'RECEIVED';
            unit.hospitalId = tx.destinationHospitalId; // Unit has physically arrived!
          }

          // Check if request is now fully delivered
          const req = this.requests.find((r) => r.id === tx.requestId);
          if (req) {
            const allDelivered = req.allocatedUnitIds.every((uid) => {
              const u = this.units.find((item) => item.id === uid);
              return u?.status === 'RECEIVED';
            });
            if (allDelivered && req.allocatedUnitIds.length >= req.quantity) {
              req.status = 'FULFILLED';
            }
          }

          this.logAudit(`Transfer ${tx.id} DELIVERED: Unit ${tx.unitId} arrived at destination hospital.`);
        }
      }
    });

    // 2. Check for units that expired during time advance
    this.units.forEach((u) => {
      if (u.status === 'AVAILABLE') {
        const expMs = new Date(u.expiresAt).getTime();
        if (newTimeMs >= expMs) {
          u.status = 'EXPIRED';
          this.logAudit(`Unit ${u.id} (${u.componentType} ${u.bloodGroup}) EXPIRED in inventory at hospital.`);
        }
      }
    });

    this.logAudit(`Simulated clock advanced by +${minutes} minutes (Current: ${this.simulationTime.toLocaleTimeString()}).`);
  }

  // --- Request Lifecycle Operations ---
  public createNewRequest(newReq: Omit<BloodRequest, 'id' | 'createdAt' | 'status' | 'allocatedUnitIds'>): BloodRequest {
    const id = `REQ-${Date.now().toString().slice(-4)}`;
    const created: BloodRequest = {
      ...newReq,
      id,
      createdAt: this.simulationTime.toISOString(),
      status: 'PENDING',
      allocatedUnitIds: [],
    };
    this.requests.unshift(created);
    this.logAudit(`New request created: ${created.id} (${created.urgency}, ${created.quantity}x ${created.componentType} ${created.bloodGroup}).`);
    return created;
  }

  public cancelRequest(requestId: string): { success: boolean; releasedUnitsCount: number } {
    const req = this.requests.find((r) => r.id === requestId);
    if (!req) return { success: false, releasedUnitsCount: 0 };

    req.status = 'CANCELLED';
    let releasedUnitsCount = 0;

    // Release reservations
    this.reservations.forEach((res) => {
      if (res.requestId === requestId && res.status === 'CONFIRMED') {
        res.status = 'CANCELLED';
        const unit = this.units.find((u) => u.id === res.unitId);
        if (unit && unit.status === 'RESERVED') {
          unit.status = 'AVAILABLE';
          releasedUnitsCount++;
          this.logAudit(`Safe cancellation: Unit ${unit.id} returned to AVAILABLE stock.`);
        }
      }
    });

    // Cancel transfers not yet dispatched
    this.transfers.forEach((tx) => {
      if (tx.requestId === requestId && tx.status === 'DISPATCHED') {
        tx.status = 'CANCELLED';
      }
    });

    this.logAudit(`Request ${requestId} cancelled. Safely released ${releasedUnitsCount} reserved units.`);
    return { success: true, releasedUnitsCount };
  }

  public simulateTransferFailure(transferId: string): { success: boolean; discardedUnitId?: string } {
    const tx = this.transfers.find((t) => t.id === transferId);
    if (!tx || tx.status !== 'IN_TRANSIT') return { success: false };

    tx.status = 'FAILED';
    tx.failureReason = 'Courier transport mechanical failure & cold-chain thermal container breach (>10°C).';

    const unit = this.units.find((u) => u.id === tx.unitId);
    if (unit) {
      unit.status = 'DISCARDED';
    }

    // Unassign from request and set request back to PENDING for replanning!
    const req = this.requests.find((r) => r.id === tx.requestId);
    if (req) {
      req.allocatedUnitIds = req.allocatedUnitIds.filter((id) => id !== tx.unitId);
      req.status = 'PENDING';
    }

    this.logAudit(`TRANSPORT FAILURE on ${transferId}: Unit ${tx.unitId} spoiled/discarded. Request ${tx.requestId} queued for automatic replan.`);
    return { success: true, discardedUnitId: tx.unitId };
  }

  public addSyntheticUnit(unitData: Omit<BloodUnit, 'id' | 'status' | 'syntheticBatchId'>): BloodUnit {
    const id = `UNIT-NEW-${Date.now().toString().slice(-4)}`;
    const newUnit: BloodUnit = {
      ...unitData,
      id,
      status: 'AVAILABLE',
      syntheticBatchId: `BATCH-SYNTH-DONOR-${Date.now().toString().slice(-4)}`,
    };
    this.units.push(newUnit);
    this.logAudit(`New stock recorded: Unit ${newUnit.id} (${newUnit.componentType} ${newUnit.bloodGroup}) registered at ${newUnit.hospitalId}.`);
    return newUnit;
  }

  // --- Deterministic Scenarios A through I ---
  public triggerScenario(scenarioCode: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I'): ScenarioEvent {
    this.resetToInitialState();

    switch (scenarioCode) {
      case 'A': {
        // Nearest hospital has sufficient eligible stock
        const req = this.createNewRequest({
          hospitalId: 'HOSP-METRO',
          patientCaseId: 'CASE-SCENARIO-A',
          componentType: 'PRBC',
          bloodGroup: 'O_POS',
          quantity: 2,
          urgency: 'ROUTINE',
          deadlineAt: new Date(this.simulationTime.getTime() + 180 * 60 * 1000).toISOString(),
          notes: 'Scenario A: Local stock sufficient at Metro Central.',
        });
        this.activeScenario = {
          id: 'SCENARIO-A',
          code: 'A',
          title: 'Scenario A: Nearest Hospital Has Sufficient Eligible Stock',
          description: 'A routine surgery at Metro Central requests 2 PRBC units. The facility itself has multiple eligible O+ units in stock, avoiding any external transfer.',
          triggeredAt: this.simulationTime.toISOString(),
          status: 'ACTIVE',
          injectedChanges: ['Created Request ' + req.id, 'Verified local stock availability at Metro Central'],
        };
        break;
      }

      case 'B': {
        // Nearest hospital has insufficient stock, multiple hospitals must jointly satisfy
        // Clear local PRBC at Memorial Children's
        this.units.forEach((u) => {
          if (u.hospitalId === 'HOSP-CHILDREN' && u.componentType === 'PRBC') {
            u.status = 'RESERVED'; // Pre-empted
          }
        });
        const req = this.createNewRequest({
          hospitalId: 'HOSP-CHILDREN',
          patientCaseId: 'CASE-SCENARIO-B',
          componentType: 'PRBC',
          bloodGroup: 'O_POS',
          quantity: 3,
          urgency: 'URGENT_SURGERY',
          deadlineAt: new Date(this.simulationTime.getTime() + 150 * 60 * 1000).toISOString(),
          notes: 'Scenario B: Multi-hospital collaborative transfer needed.',
        });
        this.activeScenario = {
          id: 'SCENARIO-B',
          code: 'B',
          title: 'Scenario B: Collaborative Multi-Hospital Fulfillment',
          description: "Memorial Children's requires 3 PRBC units but has 0 local available units. The optimizer coordinates joint transfers from Metro Central and Trauma Center to fulfill the order.",
          triggeredAt: this.simulationTime.toISOString(),
          status: 'ACTIVE',
          injectedChanges: [
            "Exhausted local PRBC stock at Memorial Children's",
            'Injected high-demand 3-unit request ' + req.id,
          ],
        };
        break;
      }

      case 'C': {
        // Nearby unit cannot meet usable deadline (perishability constraint)
        // Set nearest platelet unit to expire in 40 minutes (while transit + prep = 65m)
        const nearbyUnit = this.units.find(
          (u) => u.hospitalId === 'HOSP-EAST' && u.componentType === 'PLATELETS'
        );
        if (nearbyUnit) {
          nearbyUnit.expiresAt = new Date(this.simulationTime.getTime() + 40 * 60 * 1000).toISOString();
        }
        const req = this.createNewRequest({
          hospitalId: 'HOSP-HARBOR',
          patientCaseId: 'CASE-SCENARIO-C',
          componentType: 'PLATELETS',
          bloodGroup: 'O_POS',
          quantity: 1,
          urgency: 'CRITICAL_TRAUMA',
          deadlineAt: new Date(this.simulationTime.getTime() + 120 * 60 * 1000).toISOString(),
          notes: 'Scenario C: Nearest unit rejected due to in-transit expiration.',
        });
        this.activeScenario = {
          id: 'SCENARIO-C',
          code: 'C',
          title: 'Scenario C: Nearby Unit Cannot Meet Usable Deadline',
          description: 'A trauma patient at Harborview needs platelets. Eastside is geographically close, but its only platelet unit expires in 40 minutes (transit+prep is 65m). The system must reject Eastside and route a viable unit from a farther hospital.',
          triggeredAt: this.simulationTime.toISOString(),
          status: 'ACTIVE',
          injectedChanges: [
            'Modified Unit ' + nearbyUnit?.id + ' expiry to T+40m',
            'Created Critical Trauma Request ' + req.id,
          ],
        };
        break;
      }

      case 'D': {
        // Unit already reserved cannot be allocated again
        const targetUnit = this.units.find((u) => u.status === 'AVAILABLE' && u.bloodGroup === 'O_NEG');
        if (targetUnit) {
          targetUnit.status = 'RESERVED';
        }
        const req = this.createNewRequest({
          hospitalId: 'HOSP-TRAUMA',
          patientCaseId: 'CASE-SCENARIO-D',
          componentType: 'PRBC',
          bloodGroup: 'O_NEG',
          quantity: 1,
          urgency: 'CRITICAL_TRAUMA',
          deadlineAt: new Date(this.simulationTime.getTime() + 90 * 60 * 1000).toISOString(),
          notes: 'Scenario D: Pre-reserved unit must be skipped.',
        });
        this.activeScenario = {
          id: 'SCENARIO-D',
          code: 'D',
          title: 'Scenario D: Prevention of Double-Allocation of Reserved Stock',
          description: 'Universal donor O- unit ' + targetUnit?.id + ' is marked RESERVED for an ongoing cardiac bypass. When an emergent request arrives, the engine strictly excludes it from consideration.',
          triggeredAt: this.simulationTime.toISOString(),
          status: 'ACTIVE',
          injectedChanges: [
            'Locked Unit ' + targetUnit?.id + ' in RESERVED state',
            'Created emergent O- Request ' + req.id,
          ],
        };
        break;
      }

      case 'E': {
        // Multiple requests compete for limited inventory
        // Reduce O-Neg units to only 1 available in whole network
        let keptOne = false;
        this.units.forEach((u) => {
          if (u.bloodGroup === 'O_NEG') {
            if (!keptOne) {
              u.status = 'AVAILABLE';
              keptOne = true;
            } else {
              u.status = 'RESERVED';
            }
          }
        });
        const reqCritical = this.createNewRequest({
          hospitalId: 'HOSP-TRAUMA',
          patientCaseId: 'CASE-COMPETE-CRIT',
          componentType: 'PRBC',
          bloodGroup: 'O_NEG',
          quantity: 1,
          urgency: 'CRITICAL_TRAUMA',
          deadlineAt: new Date(this.simulationTime.getTime() + 60 * 60 * 1000).toISOString(),
          notes: 'Competing request 1: Critical trauma emergency.',
        });
        const reqRoutine = this.createNewRequest({
          hospitalId: 'HOSP-COMMUNITY',
          patientCaseId: 'CASE-COMPETE-ROUTINE',
          componentType: 'PRBC',
          bloodGroup: 'O_NEG',
          quantity: 1,
          urgency: 'ROUTINE',
          deadlineAt: new Date(this.simulationTime.getTime() + 240 * 60 * 1000).toISOString(),
          notes: 'Competing request 2: Routine elective transfusion.',
        });
        this.activeScenario = {
          id: 'SCENARIO-E',
          code: 'E',
          title: 'Scenario E: Competition Across Critical vs. Routine Requests',
          description: 'Only 1 unit of O- is available network-wide. Two hospitals request it simultaneously (one Critical Trauma, one Routine). The optimizer allocates the unit to Trauma, while baseline FIFO would unfairly serve whoever called first.',
          triggeredAt: this.simulationTime.toISOString(),
          status: 'ACTIVE',
          injectedChanges: [
            'Restricted network O- stock to 1 unit',
            'Injected competing requests ' + reqCritical.id + ' and ' + reqRoutine.id,
          ],
        };
        break;
      }

      case 'F': {
        // Transport fails after allocation proposal is created
        this.executeOptimizer();
        if (this.lastOptimizerRun && this.lastOptimizerRun.allocations.length > 0) {
          this.commitProposedPlan(this.lastOptimizerRun.allocations);
          const activeTransfer = this.transfers.find((t) => t.status === 'IN_TRANSIT');
          if (activeTransfer) {
            this.simulateTransferFailure(activeTransfer.id);
          }
        }
        this.activeScenario = {
          id: 'SCENARIO-F',
          code: 'F',
          title: 'Scenario F: Transport Failure & Replanning Recovery',
          description: 'Simulates a refrigeration malfunction during courier transit. The affected unit is safely marked DISCARDED, the destination request is returned to PENDING, and dynamic replanning is triggered.',
          triggeredAt: this.simulationTime.toISOString(),
          status: 'ACTIVE',
          injectedChanges: [
            'Committed initial allocation plan',
            'Injected courier mechanical breakdown & cold-chain breach',
            'Triggered state rollback for orphaned request',
          ],
        };
        break;
      }

      case 'G': {
        // A request is cancelled and its reservations must be handled safely
        this.executeOptimizer();
        if (this.lastOptimizerRun && this.lastOptimizerRun.allocations.length > 0) {
          this.commitProposedPlan(this.lastOptimizerRun.allocations);
          const firstReq = this.requests.find((r) => r.status === 'ALLOCATED' || r.status === 'PARTIALLY_ALLOCATED');
          if (firstReq) {
            this.cancelRequest(firstReq.id);
          }
        }
        this.activeScenario = {
          id: 'SCENARIO-G',
          code: 'G',
          title: 'Scenario G: Request Cancellation & Safe Stock Release',
          description: 'A planned surgery is deferred. The application cancels the request and safely returns all reserved units back to AVAILABLE inventory without dangling locks.',
          triggeredAt: this.simulationTime.toISOString(),
          status: 'ACTIVE',
          injectedChanges: [
            'Committed reservations',
            'Executed safe cancellation with database transactional rollback',
          ],
        };
        break;
      }

      case 'H': {
        // New stock arrives and changes the best feasible plan
        const newUnit = this.addSyntheticUnit({
          hospitalId: 'HOSP-TRAUMA',
          componentType: 'PRBC',
          bloodGroup: 'O_NEG',
          donationDate: this.simulationTime.toISOString(),
          expiresAt: new Date(this.simulationTime.getTime() + 40 * 24 * 3600 * 1000).toISOString(),
          handlingBufferMinutes: 20,
          storageTemperatureCelsius: 4,
        });
        this.activeScenario = {
          id: 'SCENARIO-H',
          code: 'H',
          title: 'Scenario H: Fresh Stock Arrival Triggering Optimized Replanning',
          description: 'A regional mobile blood drive delivers a fresh batch of O- units directly to St. Jude Trauma. Replanning detects the new local stock and substitutes out long-distance transfers.',
          triggeredAt: this.simulationTime.toISOString(),
          status: 'ACTIVE',
          injectedChanges: [
            'Registered new donor batch at St. Jude Trauma: ' + newUnit.id,
            'Initiated network replan evaluation',
          ],
        };
        break;
      }

      case 'I': {
        // No feasible allocation exists (unmet demand with transparent explanation)
        const req = this.createNewRequest({
          hospitalId: 'HOSP-COMMUNITY',
          patientCaseId: 'CASE-IMPOSSIBLE-01',
          componentType: 'CRYOPRECIPITATE',
          bloodGroup: 'AB_NEG',
          quantity: 6,
          urgency: 'CRITICAL_TRAUMA',
          deadlineAt: new Date(this.simulationTime.getTime() + 15 * 60 * 1000).toISOString(), // 15 mins deadline impossible for distant hops
          notes: 'Scenario I: Ultra-urgent rare blood component order with unfulfillable deadline.',
        });
        this.activeScenario = {
          id: 'SCENARIO-I',
          code: 'I',
          title: 'Scenario I: Infeasible Demand & Transparent Diagnostic Explanation',
          description: 'A remote facility requests 6 units of rare Cryoprecipitate with a 15-minute deadline. No valid allocation exists. BloodStock refuses to force an invalid plan and generates exact clinical rejection reasons for each candidate.',
          triggeredAt: this.simulationTime.toISOString(),
          status: 'ACTIVE',
          injectedChanges: [
            'Injected infeasible request ' + req.id + ' (6 units, 15m deadline)',
            'Generated explainability rejection breakdown',
          ],
        };
        break;
      }
    }

    return this.activeScenario!;
  }
}

// Singleton master simulator instance
export const simulator = new SimulationStateManager();
