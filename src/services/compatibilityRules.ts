/**
 * BloodStock - Perishable Blood Component Allocation Simulator
 * Compatibility Rules Engine
 * 
 * NOTE: For simulation and planning purposes only.
 * Clinical transfusion compatibility must always be cross-matched and authorized
 * by qualified medical professionals according to institutional laboratory protocols.
 */

import { BloodComponentType, BloodGroup } from '../types/bloodstock';

// Standard ABO/Rh red blood cell (PRBC) compatibility: donor -> recipient
const PRBC_COMPATIBILITY_MAP: Record<BloodGroup, BloodGroup[]> = {
  O_NEG: ['O_NEG', 'O_POS', 'A_NEG', 'A_POS', 'B_NEG', 'B_POS', 'AB_NEG', 'AB_POS'], // Universal RBC donor
  O_POS: ['O_POS', 'A_POS', 'B_POS', 'AB_POS'],
  A_NEG: ['A_NEG', 'A_POS', 'AB_NEG', 'AB_POS'],
  A_POS: ['A_POS', 'AB_POS'],
  B_NEG: ['B_NEG', 'B_POS', 'AB_NEG', 'AB_POS'],
  B_POS: ['B_POS', 'AB_POS'],
  AB_NEG: ['AB_NEG', 'AB_POS'],
  AB_POS: ['AB_POS'], // Universal RBC recipient
};

// Standard Fresh Frozen Plasma (FFP) compatibility (opposite of RBC antibodies)
const FFP_COMPATIBILITY_MAP: Record<BloodGroup, BloodGroup[]> = {
  AB_POS: ['O_NEG', 'O_POS', 'A_NEG', 'A_POS', 'B_NEG', 'B_POS', 'AB_NEG', 'AB_POS'], // Universal plasma donor
  AB_NEG: ['O_NEG', 'O_POS', 'A_NEG', 'A_POS', 'B_NEG', 'B_POS', 'AB_NEG', 'AB_POS'],
  A_POS: ['A_POS', 'A_NEG', 'O_POS', 'O_NEG'],
  A_NEG: ['A_POS', 'A_NEG', 'O_POS', 'O_NEG'],
  B_POS: ['B_POS', 'B_NEG', 'O_POS', 'O_NEG'],
  B_NEG: ['B_POS', 'B_NEG', 'O_POS', 'O_NEG'],
  O_POS: ['O_POS', 'O_NEG'],
  O_NEG: ['O_POS', 'O_NEG'],
};

// Platelets compatibility (ABO-identical preferred, but cross-ABO acceptable if necessary)
const PLATELETS_COMPATIBILITY_MAP: Record<BloodGroup, BloodGroup[]> = {
  O_NEG: ['O_NEG', 'O_POS', 'A_NEG', 'A_POS', 'B_NEG', 'B_POS', 'AB_NEG', 'AB_POS'],
  O_POS: ['O_POS', 'A_POS', 'B_POS', 'AB_POS'],
  A_NEG: ['A_NEG', 'A_POS', 'AB_NEG', 'AB_POS'],
  A_POS: ['A_POS', 'AB_POS'],
  B_NEG: ['B_NEG', 'B_POS', 'AB_NEG', 'AB_POS'],
  B_POS: ['B_POS', 'AB_POS'],
  AB_NEG: ['AB_NEG', 'AB_POS', 'A_NEG', 'B_NEG', 'O_NEG'],
  AB_POS: ['AB_POS', 'A_POS', 'B_POS', 'O_POS'],
};

// Human-friendly display labels
export const BLOOD_GROUP_LABELS: Record<BloodGroup, string> = {
  O_NEG: 'O− (O Negative)',
  O_POS: 'O+ (O Positive)',
  A_NEG: 'A− (A Negative)',
  A_POS: 'A+ (A Positive)',
  B_NEG: 'B− (B Negative)',
  B_POS: 'B+ (B Positive)',
  AB_NEG: 'AB− (AB Negative)',
  AB_POS: 'AB+ (AB Positive)',
};

export const SHORT_BLOOD_GROUPS: Record<BloodGroup, string> = {
  O_NEG: 'O−',
  O_POS: 'O+',
  A_NEG: 'A−',
  A_POS: 'A+',
  B_NEG: 'B−',
  B_POS: 'B+',
  AB_NEG: 'AB−',
  AB_POS: 'AB+',
};

export const COMPONENT_LABELS: Record<BloodComponentType, string> = {
  PRBC: 'Packed Red Blood Cells (PRBC)',
  PLATELETS: 'Platelets (PLT, Apheresis)',
  FFP: 'Fresh Frozen Plasma (FFP)',
  CRYOPRECIPITATE: 'Cryoprecipitate (CRYO)',
};

export const COMPONENT_STORAGE_INFO: Record<BloodComponentType, { defaultTempC: number; typicalLifespanDays: number }> = {
  PRBC: { defaultTempC: 4, typicalLifespanDays: 42 },
  PLATELETS: { defaultTempC: 22, typicalLifespanDays: 5 },
  FFP: { defaultTempC: -20, typicalLifespanDays: 365 },
  CRYOPRECIPITATE: { defaultTempC: -20, typicalLifespanDays: 365 },
};

/**
 * Checks if a unit's blood group and component type are biologically compatible
 * with a patient's requested blood group and component type.
 */
export function checkBiologicalCompatibility(
  unitComponent: BloodComponentType,
  unitGroup: BloodGroup,
  requestedComponent: BloodComponentType,
  requestedGroup: BloodGroup
): { isCompatible: boolean; explanation: string; isExactMatch: boolean } {
  // Component must be identical
  if (unitComponent !== requestedComponent) {
    return {
      isCompatible: false,
      explanation: `Component mismatch: Unit is ${COMPONENT_LABELS[unitComponent]}, but request requires ${COMPONENT_LABELS[requestedComponent]}.`,
      isExactMatch: false,
    };
  }

  const isExactMatch = unitGroup === requestedGroup;

  let compatibleRecipients: BloodGroup[] = [];

  switch (unitComponent) {
    case 'PRBC':
      compatibleRecipients = PRBC_COMPATIBILITY_MAP[unitGroup] || [];
      break;
    case 'FFP':
      compatibleRecipients = FFP_COMPATIBILITY_MAP[unitGroup] || [];
      break;
    case 'PLATELETS':
      compatibleRecipients = PLATELETS_COMPATIBILITY_MAP[unitGroup] || [];
      break;
    case 'CRYOPRECIPITATE':
      compatibleRecipients = FFP_COMPATIBILITY_MAP[unitGroup] || [];
      break;
    default:
      compatibleRecipients = [unitGroup];
  }

  const isCompatible = compatibleRecipients.includes(requestedGroup);

  if (isCompatible) {
    const detail = isExactMatch
      ? `Exact ABO/Rh match (${SHORT_BLOOD_GROUPS[unitGroup]} to ${SHORT_BLOOD_GROUPS[requestedGroup]}).`
      : `Compatible cross-match (${SHORT_BLOOD_GROUPS[unitGroup]} donor is eligible for ${SHORT_BLOOD_GROUPS[requestedGroup]} recipient for ${unitComponent}).`;
    return { isCompatible: true, explanation: detail, isExactMatch };
  } else {
    return {
      isCompatible: false,
      explanation: `Incompatible ABO/Rh: ${SHORT_BLOOD_GROUPS[unitGroup]} donor cannot be administered to ${SHORT_BLOOD_GROUPS[requestedGroup]} recipient for ${unitComponent}.`,
      isExactMatch: false,
    };
  }
}
