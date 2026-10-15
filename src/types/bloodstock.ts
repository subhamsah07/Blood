/**
 * BloodStock - Perishable Blood Component Allocation Simulator
 * Type definitions and schemas
 */

export type BloodComponentType = 'PRBC' | 'PLATELETS' | 'FFP' | 'CRYOPRECIPITATE';

export type BloodGroup = 'O_NEG' | 'O_POS' | 'A_NEG' | 'A_POS' | 'B_NEG' | 'B_POS' | 'AB_NEG' | 'AB_POS';

export type UnitStatus = 'AVAILABLE' | 'RESERVED' | 'IN_TRANSIT' | 'RECEIVED' | 'EXPIRED' | 'DISCARDED' | 'QUARANTINED';

export type RequestUrgency = 'CRITICAL_TRAUMA' | 'URGENT_SURGERY' | 'ROUTINE';

export type RequestStatus = 'PENDING' | 'PARTIALLY_ALLOCATED' | 'ALLOCATED' | 'IN_TRANSIT' | 'FULFILLED' | 'CANCELLED' | 'UNFULFILLED';

export type TransferStatus = 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';

export interface Hospital {
  id: string;
  name: string;
  code: string;
  address: string;
  coordinates: { x: number; y: number }; // Relative 2D coordinates for network map
  protectedReserves: Record<BloodComponentType, number>; // Minimum units to retain locally
  phone: string;
  isRegionalHub?: boolean;
}

export interface BloodUnit {
  id: string;
  hospitalId: string;
  componentType: BloodComponentType;
  bloodGroup: BloodGroup;
  donationDate: string; // ISO string
  expiresAt: string; // ISO string
  status: UnitStatus;
  handlingBufferMinutes: number; // Thawing, packaging, inspection time (e.g. 30m)
  storageTemperatureCelsius: number;
  syntheticBatchId: string;
}

export interface BloodRequest {
  id: string;
  hospitalId: string;
  patientCaseId: string;
  componentType: BloodComponentType;
  bloodGroup: BloodGroup;
  quantity: number;
  urgency: RequestUrgency;
  createdAt: string; // ISO string
  deadlineAt: string; // ISO string
  status: RequestStatus;
  allocatedUnitIds: string[];
  notes?: string;
}

export interface Reservation {
  id: string;
  unitId: string;
  requestId: string;
  sourceHospitalId: string;
  destinationHospitalId: string;
  status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'DISPATCHED' | 'CANCELLED' | 'EXPIRED_LOCK';
  reservedAt: string;
  lockedUntil: string;
}

export interface Transfer {
  id: string;
  reservationId: string;
  unitId: string;
  requestId: string;
  sourceHospitalId: string;
  destinationHospitalId: string;
  dispatchedAt: string;
  estimatedArrivalAt: string;
  actualArrivalAt?: string;
  status: TransferStatus;
  failureReason?: string;
  courierIdentifier: string;
}

export interface TravelTimeMatrix {
  [fromHospitalId: string]: {
    [toHospitalId: string]: number; // Travel time in minutes
  };
}

export interface RuleEvaluation {
  passed: boolean;
  ruleCode: string;
  ruleName: string;
  detail: string;
  severity: 'CRITICAL_BLOCKER' | 'VIOLATION' | 'INFO';
}

export interface CandidateEvaluation {
  unitId: string;
  requestId: string;
  sourceHospitalId: string;
  destinationHospitalId: string;
  isFeasible: boolean;
  travelMinutes: number;
  handlingBufferMinutes: number;
  totalLeadMinutes: number;
  estimatedArrival: string;
  expiresAt: string;
  shelfLifeRemainingMinutesAtArrival: number;
  deadlineSlackMinutes: number; // positive = arrives before deadline
  evaluations: RuleEvaluation[];
  rejectionReasons: string[];
}

export interface ProposedAllocation {
  requestId: string;
  unitId: string;
  sourceHospitalId: string;
  destinationHospitalId: string;
  componentType: BloodComponentType;
  bloodGroup: BloodGroup;
  estimatedArrival: string;
  travelMinutes: number;
  unitExpiresAt: string;
  feasibilityStatus: 'FEASIBLE' | 'INFEASIBLE';
  reason: string;
  solverScore?: number;
}

export interface AllocationRunSummary {
  runId: string;
  timestamp: string;
  mode: 'BASELINE' | 'OPTIMIZER';
  solverStatus: 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'HEURISTIC_COMPLETE';
  executionTimeMs: number;
  totalRequests: number;
  totalRequestedUnits: number;
  totalAllocatedUnits: number;
  unmetDemandUnits: number;
  urgentDemandFulfilled: number;
  urgentDemandTotal: number;
  criticalDemandFulfilled: number;
  criticalDemandTotal: number;
  averageTransitMinutes: number;
  totalTransitMinutes: number;
  expiredUnitsAvoidedScore: number;
  reserveViolationsCount: number;
  doubleAllocationViolationsCount: number;
  allocations: ProposedAllocation[];
  rejectedCandidates: CandidateEvaluation[];
  auditLogs: string[];
}

export interface ScenarioEvent {
  id: string;
  code: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';
  title: string;
  description: string;
  triggeredAt?: string;
  status: 'IDLE' | 'ACTIVE' | 'RESOLVED';
  injectedChanges: string[];
}

export type UserRole = 'HOSPITAL_ADMIN' | 'REQUESTING_CLINICIAN' | 'SYSTEM_OPERATOR';
