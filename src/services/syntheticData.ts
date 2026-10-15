/**
 * BloodStock - Synthetic Multi-Hospital Data Generator
 * Produces deterministic, reproducible synthetic test data for simulation.
 * 
 * DISCLAIMER: All hospital names, unit IDs, quantities, and coordinates
 * are entirely fictional and generated for software simulation only.
 */

import {
  Hospital,
  BloodUnit,
  BloodRequest,
  TravelTimeMatrix,
  BloodComponentType,
  BloodGroup,
} from '../types/bloodstock';

export const SYNTHETIC_HOSPITALS: Hospital[] = [
  {
    id: 'HOSP-METRO',
    name: 'Metro Central General Hospital',
    code: 'MCGH',
    address: '101 Healthcare Blvd, Central District',
    coordinates: { x: 50, y: 48 }, // Center of network
    isRegionalHub: true,
    phone: '+1 (555) 019-2001',
    protectedReserves: {
      PRBC: 3,
      PLATELETS: 2,
      FFP: 2,
      CRYOPRECIPITATE: 1,
    },
  },
  {
    id: 'HOSP-TRAUMA',
    name: 'St. Jude Regional Level-1 Trauma',
    code: 'SJTR',
    address: '88 Emergency Way, North District',
    coordinates: { x: 42, y: 18 },
    isRegionalHub: false,
    phone: '+1 (555) 019-2002',
    protectedReserves: {
      PRBC: 4,
      PLATELETS: 2,
      FFP: 3,
      CRYOPRECIPITATE: 2,
    },
  },
  {
    id: 'HOSP-CHILDREN',
    name: "Memorial Children's Specialty Hospital",
    code: 'MCSH',
    address: '500 Pediatric Ave, West District',
    coordinates: { x: 20, y: 55 },
    isRegionalHub: false,
    phone: '+1 (555) 019-2003',
    protectedReserves: {
      PRBC: 2,
      PLATELETS: 2,
      FFP: 1,
      CRYOPRECIPITATE: 1,
    },
  },
  {
    id: 'HOSP-HARBOR',
    name: 'Harborview Maritime Medical Center',
    code: 'HMMC',
    address: '12 Pier Road, Bay District',
    coordinates: { x: 82, y: 32 },
    isRegionalHub: false,
    phone: '+1 (555) 019-2004',
    protectedReserves: {
      PRBC: 2,
      PLATELETS: 1,
      FFP: 1,
      CRYOPRECIPITATE: 1,
    },
  },
  {
    id: 'HOSP-COMMUNITY',
    name: 'Pine Valley Community Hospital',
    code: 'PVCH',
    address: '40 Rural Route 9, South District',
    coordinates: { x: 30, y: 84 },
    isRegionalHub: false,
    phone: '+1 (555) 019-2005',
    protectedReserves: {
      PRBC: 1,
      PLATELETS: 1,
      FFP: 1,
      CRYOPRECIPITATE: 1,
    },
  },
  {
    id: 'HOSP-EAST',
    name: 'Eastside Acute Surgical Institute',
    code: 'EASI',
    address: '900 Summit Ave, East Ridge',
    coordinates: { x: 78, y: 72 },
    isRegionalHub: false,
    phone: '+1 (555) 019-2006',
    protectedReserves: {
      PRBC: 2,
      PLATELETS: 1,
      FFP: 1,
      CRYOPRECIPITATE: 1,
    },
  },
  {
    id: 'HOSP-UNIV',
    name: 'University Academic Medical Center',
    code: 'UAMC',
    address: '22 Science Park, University Campus',
    coordinates: { x: 62, y: 22 },
    isRegionalHub: true,
    phone: '+1 (555) 019-2007',
    protectedReserves: {
      PRBC: 3,
      PLATELETS: 2,
      FFP: 2,
      CRYOPRECIPITATE: 2,
    },
  },
];

/**
 * Builds realistic road/transit travel times (minutes) based on Euclidean distance
 * + road tortuosity + traffic density.
 */
export function buildTravelTimeMatrix(hospitals: Hospital[]): TravelTimeMatrix {
  const matrix: TravelTimeMatrix = {};

  hospitals.forEach((h1) => {
    matrix[h1.id] = {};
    hospitals.forEach((h2) => {
      if (h1.id === h2.id) {
        matrix[h1.id][h2.id] = 0; // Same hospital internal transfer
      } else {
        const dx = h1.coordinates.x - h2.coordinates.x;
        const dy = h1.coordinates.y - h2.coordinates.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Base 12 minutes minimum courier dispatch + 1.15 minutes per distance unit
        const transitMinutes = Math.round(14 + dist * 1.18);
        matrix[h1.id][h2.id] = transitMinutes;
      }
    });
  });

  return matrix;
}

export const TRAVEL_TIME_MATRIX: TravelTimeMatrix = buildTravelTimeMatrix(SYNTHETIC_HOSPITALS);

/**
 * Generates initial synthetic blood units (~75-80 units across 7 hospitals)
 * with controlled expiration distributions.
 */
export function generateInitialBloodUnits(referenceTime: Date = new Date()): BloodUnit[] {
  const units: BloodUnit[] = [];
  const refMs = referenceTime.getTime();

  let counter = 1001;

  SYNTHETIC_HOSPITALS.forEach((hosp) => {
    // 1. Packed Red Blood Cells (PRBC) - typically 5 to 7 units per hospital
    const prbcGroups: BloodGroup[] = ['O_POS', 'O_POS', 'O_NEG', 'A_POS', 'A_NEG', 'B_POS', 'AB_POS'];
    prbcGroups.forEach((group, idx) => {
      // Expiration spread: 2 days to 30 days into future
      const hoursUntilExpiry = 36 + idx * 72 + (counter % 5) * 24;
      const expiresAt = new Date(refMs + hoursUntilExpiry * 3600 * 1000).toISOString();
      const donationDate = new Date(refMs - (42 * 24 - hoursUntilExpiry) * 3600 * 1000).toISOString();

      units.push({
        id: `UNIT-PRBC-${counter++}`,
        hospitalId: hosp.id,
        componentType: 'PRBC',
        bloodGroup: group,
        donationDate,
        expiresAt,
        status: 'AVAILABLE',
        handlingBufferMinutes: 20, // PRBC preparation / verification buffer
        storageTemperatureCelsius: 4,
        syntheticBatchId: `BATCH-SYNTH-26A-${hosp.code}`,
      });
    });

    // 2. Platelets (Highly perishable, 5-day shelf life) - 3 to 4 units per hospital
    // Include some that expire within 2 to 6 hours for Scenario C testing!
    const pltGroups: BloodGroup[] = ['O_POS', 'A_POS', 'O_NEG', 'B_POS'];
    pltGroups.forEach((group, idx) => {
      // Intentionally vary shelf life: some urgent expiring in 3 hours, some in 36 hours
      let hoursUntilExpiry = 18 + idx * 14;
      if (hosp.id === 'HOSP-EAST' && idx === 0) {
        // Specifically for Scenario C: nearby unit expiring in 45 minutes (cannot meet travel + buffer!)
        hoursUntilExpiry = 0.75; // 45 minutes
      } else if (hosp.id === 'HOSP-CHILDREN' && idx === 0) {
        hoursUntilExpiry = 2.5; // 150 minutes
      }

      const expiresAt = new Date(refMs + hoursUntilExpiry * 3600 * 1000).toISOString();
      const donationDate = new Date(refMs - (5 * 24 - hoursUntilExpiry) * 3600 * 1000).toISOString();

      units.push({
        id: `UNIT-PLT-${counter++}`,
        hospitalId: hosp.id,
        componentType: 'PLATELETS',
        bloodGroup: group,
        donationDate,
        expiresAt,
        status: 'AVAILABLE',
        handlingBufferMinutes: 25, // Agitation check and packaging buffer
        storageTemperatureCelsius: 22,
        syntheticBatchId: `BATCH-SYNTH-26B-${hosp.code}`,
      });
    });

    // 3. Fresh Frozen Plasma (FFP, 1 year shelf life) - 2 to 3 units
    const ffpGroups: BloodGroup[] = ['AB_POS', 'A_POS', 'O_POS'];
    ffpGroups.forEach((group, idx) => {
      const daysUntilExpiry = 90 + idx * 45;
      const expiresAt = new Date(refMs + daysUntilExpiry * 24 * 3600 * 1000).toISOString();
      const donationDate = new Date(refMs - 30 * 24 * 3600 * 1000).toISOString();

      units.push({
        id: `UNIT-FFP-${counter++}`,
        hospitalId: hosp.id,
        componentType: 'FFP',
        bloodGroup: group,
        donationDate,
        expiresAt,
        status: 'AVAILABLE',
        handlingBufferMinutes: 35, // Requires 30m rapid thawing in waterbath
        storageTemperatureCelsius: -20,
        syntheticBatchId: `BATCH-SYNTH-26C-${hosp.code}`,
      });
    });
  });

  return units;
}

/**
 * Generates initial pending blood requests (~12-14 requests) representing
 * real emergency and scheduled patient surgical needs.
 */
export function generateInitialRequests(referenceTime: Date = new Date()): BloodRequest[] {
  const refMs = referenceTime.getTime();

  return [
    {
      id: 'REQ-2026-001',
      hospitalId: 'HOSP-TRAUMA',
      patientCaseId: 'CASE-ED-9921',
      componentType: 'PRBC',
      bloodGroup: 'O_NEG',
      quantity: 2,
      urgency: 'CRITICAL_TRAUMA',
      createdAt: new Date(refMs - 15 * 60 * 1000).toISOString(),
      deadlineAt: new Date(refMs + 75 * 60 * 1000).toISOString(), // 75 mins deadline
      status: 'PENDING',
      allocatedUnitIds: [],
      notes: 'Multi-vehicle collision victim in shock; emergent O- transfusion required.',
    },
    {
      id: 'REQ-2026-002',
      hospitalId: 'HOSP-CHILDREN',
      patientCaseId: 'CASE-PED-4412',
      componentType: 'PLATELETS',
      bloodGroup: 'A_POS',
      quantity: 2,
      urgency: 'URGENT_SURGERY',
      createdAt: new Date(refMs - 20 * 60 * 1000).toISOString(),
      deadlineAt: new Date(refMs + 150 * 60 * 1000).toISOString(), // 2.5 hrs deadline
      status: 'PENDING',
      allocatedUnitIds: [],
      notes: 'Pediatric leukemia patient undergoing urgent line placement; severe thrombocytopenia.',
    },
    {
      id: 'REQ-2026-003',
      hospitalId: 'HOSP-COMMUNITY',
      patientCaseId: 'CASE-SURG-1109',
      componentType: 'PRBC',
      bloodGroup: 'A_POS',
      quantity: 3,
      urgency: 'URGENT_SURGERY',
      createdAt: new Date(refMs - 30 * 60 * 1000).toISOString(),
      deadlineAt: new Date(refMs + 180 * 60 * 1000).toISOString(),
      status: 'PENDING',
      allocatedUnitIds: [],
      notes: 'Bowel resection surgery scheduled; pre-op reserve crossmatch required.',
    },
    {
      id: 'REQ-2026-004',
      hospitalId: 'HOSP-HARBOR',
      patientCaseId: 'CASE-ICU-8820',
      componentType: 'FFP',
      bloodGroup: 'B_POS',
      quantity: 2,
      urgency: 'ROUTINE',
      createdAt: new Date(refMs - 45 * 60 * 1000).toISOString(),
      deadlineAt: new Date(refMs + 360 * 60 * 1000).toISOString(),
      status: 'PENDING',
      allocatedUnitIds: [],
      notes: 'Liver disease patient coagulopathy correction prior to paracentesis.',
    },
    {
      id: 'REQ-2026-005',
      hospitalId: 'HOSP-EAST',
      patientCaseId: 'CASE-OR-3301',
      componentType: 'PLATELETS',
      bloodGroup: 'O_POS',
      quantity: 1,
      urgency: 'CRITICAL_TRAUMA',
      createdAt: new Date(refMs - 5 * 60 * 1000).toISOString(),
      deadlineAt: new Date(refMs + 60 * 60 * 1000).toISOString(), // 1 hr deadline
      status: 'PENDING',
      allocatedUnitIds: [],
      notes: 'Active massive hemorrhage in OR; immediate platelet support needed.',
    },
    {
      id: 'REQ-2026-006',
      hospitalId: 'HOSP-METRO',
      patientCaseId: 'CASE-CARD-7734',
      componentType: 'PRBC',
      bloodGroup: 'B_POS',
      quantity: 2,
      urgency: 'ROUTINE',
      createdAt: new Date(refMs - 50 * 60 * 1000).toISOString(),
      deadlineAt: new Date(refMs + 480 * 60 * 1000).toISOString(),
      status: 'PENDING',
      allocatedUnitIds: [],
      notes: 'Elective coronary artery bypass graft blood standby.',
    },
    {
      id: 'REQ-2026-007',
      hospitalId: 'HOSP-UNIV',
      patientCaseId: 'CASE-ONC-5510',
      componentType: 'PLATELETS',
      bloodGroup: 'AB_POS',
      quantity: 1,
      urgency: 'URGENT_SURGERY',
      createdAt: new Date(refMs - 10 * 60 * 1000).toISOString(),
      deadlineAt: new Date(refMs + 120 * 60 * 1000).toISOString(),
      status: 'PENDING',
      allocatedUnitIds: [],
      notes: 'Stem-cell transplant conditioning protocol transfusion.',
    },
  ];
}
