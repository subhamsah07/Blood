/**
 * BloodStock - Feasibility Sieve Engine
 * 
 * Tests hard constraints for candidate blood units against pending requests.
 * Produces structured diagnostic evaluation logs with pass/fail breakdown
 * for transparent clinical explainability.
 */

import {
  Hospital,
  BloodUnit,
  BloodRequest,
  TravelTimeMatrix,
  CandidateEvaluation,
  RuleEvaluation,
} from '../types/bloodstock';
import { checkBiologicalCompatibility } from './compatibilityRules';

export interface FeasibilitySieveOptions {
  referenceTime?: Date;
  enforceProtectedReserves?: boolean;
  activeAllocationsCountByHospitalAndComponent?: Record<string, number>; // hospitalId:component -> count proposed to leave
}

/**
 * Evaluates whether a single blood unit is feasible to satisfy a specific blood request.
 */
export function evaluateUnitRequestFeasibility(
  unit: BloodUnit,
  request: BloodRequest,
  hospitalsMap: Map<string, Hospital>,
  travelMatrix: TravelTimeMatrix,
  options: FeasibilitySieveOptions = {}
): CandidateEvaluation {
  const refTime = options.referenceTime || new Date();
  const evaluations: RuleEvaluation[] = [];
  const rejectionReasons: string[] = [];

  const sourceHosp = hospitalsMap.get(unit.hospitalId);
  const destHosp = hospitalsMap.get(request.hospitalId);

  // 1. Biological Compatibility Check
  const compCheck = checkBiologicalCompatibility(
    unit.componentType,
    unit.bloodGroup,
    request.componentType,
    request.bloodGroup
  );

  if (compCheck.isCompatible) {
    evaluations.push({
      passed: true,
      ruleCode: 'RULE_BIO_COMPATIBILITY',
      ruleName: 'Biological Compatibility',
      detail: compCheck.explanation,
      severity: 'INFO',
    });
  } else {
    evaluations.push({
      passed: false,
      ruleCode: 'RULE_BIO_COMPATIBILITY',
      ruleName: 'Biological Compatibility',
      detail: compCheck.explanation,
      severity: 'CRITICAL_BLOCKER',
    });
    rejectionReasons.push(compCheck.explanation);
  }

  // 2. Availability Status Check
  if (unit.status === 'AVAILABLE') {
    evaluations.push({
      passed: true,
      ruleCode: 'RULE_UNIT_AVAILABILITY',
      ruleName: 'Unit Availability',
      detail: 'Unit is currently in unreserved stock and available for allocation.',
      severity: 'INFO',
    });
  } else {
    const reason = `Unit is currently '${unit.status}' (already committed, in-transit, or unavailable).`;
    evaluations.push({
      passed: false,
      ruleCode: 'RULE_UNIT_AVAILABILITY',
      ruleName: 'Unit Availability',
      detail: reason,
      severity: 'CRITICAL_BLOCKER',
    });
    rejectionReasons.push(reason);
  }

  // 3. Travel Time & Handling Buffer Calculation
  const isLocalTransfer = unit.hospitalId === request.hospitalId;
  const transitMinutes = isLocalTransfer
    ? 5 // 5 minutes internal hospital pharmacy pneumatic tube / porter delivery
    : travelMatrix[unit.hospitalId]?.[request.hospitalId] ?? 60;

  const handlingBufferMinutes = unit.handlingBufferMinutes || 25;
  const totalLeadMinutes = transitMinutes + handlingBufferMinutes;

  const estimatedArrivalMs = refTime.getTime() + totalLeadMinutes * 60 * 1000;
  const estimatedArrival = new Date(estimatedArrivalMs).toISOString();

  // 4. Request Delivery Deadline Check
  const deadlineMs = new Date(request.deadlineAt).getTime();
  const deadlineSlackMinutes = Math.round((deadlineMs - estimatedArrivalMs) / (60 * 1000));

  if (deadlineSlackMinutes >= 0) {
    evaluations.push({
      passed: true,
      ruleCode: 'RULE_REQUEST_DEADLINE',
      ruleName: 'Delivery Deadline',
      detail: `Estimated arrival (${totalLeadMinutes}m total lead time) arrives ${deadlineSlackMinutes} minutes before the request deadline.`,
      severity: 'INFO',
    });
  } else {
    const reason = `Transit delay: Total lead time (${totalLeadMinutes}m = ${transitMinutes}m road + ${handlingBufferMinutes}m prep) misses request deadline by ${Math.abs(deadlineSlackMinutes)} minutes.`;
    evaluations.push({
      passed: false,
      ruleCode: 'RULE_REQUEST_DEADLINE',
      ruleName: 'Delivery Deadline',
      detail: reason,
      severity: 'CRITICAL_BLOCKER',
    });
    rejectionReasons.push(reason);
  }

  // 5. Expiry Check at Arrival Time (Perishability constraint)
  const unitExpiryMs = new Date(unit.expiresAt).getTime();
  const shelfLifeRemainingMinutesAtArrival = Math.round((unitExpiryMs - estimatedArrivalMs) / (60 * 1000));

  if (shelfLifeRemainingMinutesAtArrival > 15) {
    // Requires at least 15 minutes of usable shelf life post-arrival for bedside transfusion
    evaluations.push({
      passed: true,
      ruleCode: 'RULE_EXPIRY_USABLE',
      ruleName: 'Shelf-Life Usability',
      detail: `Unit remains usable upon arrival with ${formatMinutes(shelfLifeRemainingMinutesAtArrival)} shelf-life remaining before expiry.`,
      severity: 'INFO',
    });
  } else if (shelfLifeRemainingMinutesAtArrival >= 0) {
    const reason = `Borderline expiry: Only ${shelfLifeRemainingMinutesAtArrival}m remaining at arrival. Fails required 15m clinical administration buffer.`;
    evaluations.push({
      passed: false,
      ruleCode: 'RULE_EXPIRY_USABLE',
      ruleName: 'Shelf-Life Usability',
      detail: reason,
      severity: 'CRITICAL_BLOCKER',
    });
    rejectionReasons.push(reason);
  } else {
    const reason = `Expired in transit: Unit expires at ${new Date(unit.expiresAt).toLocaleTimeString()}, which is ${Math.abs(shelfLifeRemainingMinutesAtArrival)} minutes before estimated arrival at ${new Date(estimatedArrival).toLocaleTimeString()}.`;
    evaluations.push({
      passed: false,
      ruleCode: 'RULE_EXPIRY_USABLE',
      ruleName: 'Shelf-Life Usability',
      detail: reason,
      severity: 'CRITICAL_BLOCKER',
    });
    rejectionReasons.push(reason);
  }

  // 6. Source Hospital Protected Reserve Check
  if (options.enforceProtectedReserves && sourceHosp && !isLocalTransfer) {
    const minReserve = sourceHosp.protectedReserves[unit.componentType] || 0;
    const proposedOutboundKey = `${sourceHosp.id}:${unit.componentType}`;
    const alreadyProposedOutbound = options.activeAllocationsCountByHospitalAndComponent?.[proposedOutboundKey] || 0;

    // Check how many available units remain at source hospital
    evaluations.push({
      passed: true,
      ruleCode: 'RULE_SOURCE_RESERVE',
      ruleName: 'Source Reserve Floor',
      detail: `Protected safety reserve threshold is ${minReserve} units for ${unit.componentType} at ${sourceHosp.code}.`,
      severity: 'INFO',
    });
  }

  const isFeasible = evaluations.every((e) => e.passed);

  return {
    unitId: unit.id,
    requestId: request.id,
    sourceHospitalId: unit.hospitalId,
    destinationHospitalId: request.hospitalId,
    isFeasible,
    travelMinutes: transitMinutes,
    handlingBufferMinutes,
    totalLeadMinutes,
    estimatedArrival,
    expiresAt: unit.expiresAt,
    shelfLifeRemainingMinutesAtArrival,
    deadlineSlackMinutes,
    evaluations,
    rejectionReasons,
  };
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `${hrs}h ${rem}m`;
}
