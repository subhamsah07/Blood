/**
 * BloodStock Test Suite: Phase 1 & Phase 2/3 Verification
 * Run with: npx tsx scripts/test_hospital_suite.ts
 */

import {
  authService,
  JAIPUR_DEMO_HOSPITALS,
  isLegacyHospital,
  matchJaipurHospital,
} from '../src/services/authService';
import { hospitalDataService } from '../src/services/hospitalDataService';
import { checkBiologicalCompatibility } from '../src/services/compatibilityRules';
import { supabase } from '../src/lib/supabase';

async function runTestSuite() {
  console.log('=== BLOODSTOCK TEST SUITE: PHASE 1 & 2 VERIFICATION ===\n');
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ': ' + detail : ''}`);
      failedCount++;
    }
  }

  // Configure Supabase client mocks for deterministic headless testing
  const mockUid = 'test-jaipur-operator-uid-001';
  (supabase.auth as any).signInWithPassword = async ({ email }: { email: string }) => {
    return {
      data: {
        user: { id: mockUid, email },
        session: { access_token: 'mock-jwt-token' } as any,
      },
      error: null,
    };
  };

  (supabase.auth as any).getSession = async () => {
    return {
      data: {
        session: {
          user: { id: mockUid, email: 'hospital1@gmail.com' },
        } as any,
      },
      error: null,
    };
  };

  // Mock from() to return the four Jaipur hospitals for hospital_user_access and hospitals tables
  const originalFrom = supabase.from.bind(supabase);
  (supabase as any).from = (tableName: string) => {
    if (tableName === 'hospital_user_access') {
      return {
        select: () => ({
          eq: async () => ({
            data: JAIPUR_DEMO_HOSPITALS.map((h) => ({
              hospital_id: h.id,
              role: 'admin',
            })),
            error: null,
          }),
        }),
      };
    }

    if (tableName === 'hospitals') {
      return {
        select: () => ({
          in: async () => ({
            data: JAIPUR_DEMO_HOSPITALS,
            error: null,
          }),
          eq: async () => ({
            data: [],
            error: null,
          }),
        }),
      };
    }

    if (tableName === 'blood_units') {
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [
                {
                  id: 'unit-db-101',
                  hospital_id: JAIPUR_DEMO_HOSPITALS[0].id,
                  component_type: 'PRBC',
                  blood_group: 'O_NEG',
                  unit_status: 'AVAILABLE',
                  expiry_at: new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString(),
                  created_at: new Date().toISOString(),
                },
              ],
              error: null,
            }),
            gt: () => ({
              order: () => ({
                limit: async () => ({
                  data: [{ id: 'unit-db-101' }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
        insert: (rows: any[]) => ({
          select: async () => ({
            data: rows.map((r, idx) => ({ id: `unit-inserted-${idx}` })),
            error: null,
          }),
        }),
        update: () => ({
          in: async () => ({ error: null }),
        }),
      };
    }

    if (tableName === 'blood_requests') {
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [],
              error: null,
            }),
          }),
          neq: () => ({
            in: () => ({
              order: async () => ({
                data: [
                  {
                    id: 'req-db-peer-201',
                    requesting_hospital_id: JAIPUR_DEMO_HOSPITALS[1].id,
                    component_type: 'PRBC',
                    required_blood_group: 'O_NEG',
                    quantity: 2,
                    urgency: 'CRITICAL_TRAUMA',
                    required_by: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
                    created_at: new Date().toISOString(),
                    request_status: 'PENDING',
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: { id: 'req-db-new-301' },
              error: null,
            }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: async () => ({ error: null }),
          }),
        }),
      };
    }

    return originalFrom(tableName);
  };

  (supabase as any).rpc = async (fnName: string, args: any) => {
    if (fnName === 'atomic_reserve_units') {
      return {
        data: {
          success: true,
          reserved_count: args.p_quantity || 1,
        },
        error: null,
      };
    }
    if (fnName === 'release_request_reservations') {
      return {
        data: {
          success: true,
          released_count: 1,
        },
        error: null,
      };
    }
    return { data: null, error: null };
  };

  // --------------------------------------------------------------------------
  // TEST CASE 1: Selecting each of the four hospitals activates the correct profile
  // --------------------------------------------------------------------------
  console.log('--- Test Case 1: Four Jaipur Hospital Logins ---');
  for (let i = 0; i < JAIPUR_DEMO_HOSPITALS.length; i++) {
    const targetHosp = JAIPUR_DEMO_HOSPITALS[i];
    const loginRes = await authService.signIn('hospital1@gmail.com', 'demoPassword', targetHosp.id);

    assert(
      loginRes.profile !== null && loginRes.profile.id === targetHosp.id,
      `Login targeting #${i + 1} (${targetHosp.name}) returns exact matching profile`,
      `Expected ${targetHosp.id}, got ${loginRes.profile?.id}`
    );
    assert(
      authService.getActiveHospitalId() === targetHosp.id,
      `Active hospital ID in authService is updated to #${i + 1} (${targetHosp.id})`
    );
    assert(
      loginRes.profile?.name !== 'Metro Central General Hospital' &&
      loginRes.profile?.name !== "Memorial Children's Specialty Hospital",
      `Active profile is NEVER Metro Central or Children's Specialty for target #${i + 1}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST CASE 2: Legacy / Unauthorized Hospital ID is cleared and rejected
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 2: Legacy Metro Central ID & Unauthorized Handling ---');
  authService.setActiveHospitalId('a0000000-0000-0000-0000-000000000001'); // Old Metro Central ID
  const cleanedId = authService.getActiveHospitalId();
  assert(
    cleanedId === null,
    'Legacy Metro Central ID in localStorage is automatically scrubbed and returns null'
  );

  // Unauthorized target ID
  const unauthorizedRes = await authService.signIn('hospital1@gmail.com', 'demoPassword', 'unauthorized-uuid-999');
  assert(
    unauthorizedRes.profile !== null &&
    JAIPUR_DEMO_HOSPITALS.some((h) => h.id === unauthorizedRes.profile?.id),
    'Unauthorized target ID defaults to authorized Jaipur hospital rather than accepting invalid ID'
  );

  // --------------------------------------------------------------------------
  // TEST CASE 3: Restoring session does not restore Metro Central
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 3: Refresh / Session Restoration Safety ---');
  authService.setActiveHospitalId(JAIPUR_DEMO_HOSPITALS[2].id); // Narayana
  const session = await authService.getSession();
  assert(
    session.profile?.id === JAIPUR_DEMO_HOSPITALS[2].id,
    'Session restoration accurately restores authorized Narayana hospital'
  );
  assert(
    session.profile?.name !== 'Metro Central General Hospital' &&
    session.profile?.name !== "Memorial Children's Specialty Hospital",
    'Session restoration NEVER returns Metro Central or Children\'s Specialty'
  );

  // --------------------------------------------------------------------------
  // TEST CASE 3B: isLegacyHospital & matchJaipurHospital Verification
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 3B: Legacy Hospital Filter & Jaipur Matcher ---');
  assert(
    isLegacyHospital({ name: 'Metro Central General Hospital', id: 'a0000000-0000-0000-0000-000000000001' }),
    'isLegacyHospital flags Metro Central General Hospital'
  );
  assert(
    isLegacyHospital({ name: "Memorial Children's Specialty Hospital", id: 'a0000000-0000-0000-0000-000000000003' }),
    'isLegacyHospital flags Memorial Children\'s Specialty Hospital'
  );
  assert(
    !isLegacyHospital(JAIPUR_DEMO_HOSPITALS[0]),
    'isLegacyHospital allows Fortis Escorts Hospital, Jaipur'
  );
  assert(
    !isLegacyHospital(JAIPUR_DEMO_HOSPITALS[1]),
    'isLegacyHospital allows Rukmani Birla Hospital (CK Birla Hospitals)'
  );
  assert(
    !isLegacyHospital(JAIPUR_DEMO_HOSPITALS[2]),
    'isLegacyHospital allows Narayana Multispeciality Hospital, Jaipur'
  );
  assert(
    !isLegacyHospital(JAIPUR_DEMO_HOSPITALS[3]),
    'isLegacyHospital allows Santokba Durlabhji Memorial Hospital (SDMH)'
  );

  // Test matchJaipurHospital resolution across all variants
  const fortisMatch = matchJaipurHospital(JAIPUR_DEMO_HOSPITALS, 'Fortis');
  assert(fortisMatch?.id === JAIPUR_DEMO_HOSPITALS[0].id, 'matchJaipurHospital resolves "Fortis" to Fortis Escorts');

  const birlaMatch = matchJaipurHospital(JAIPUR_DEMO_HOSPITALS, 'Rukmani Birla');
  assert(birlaMatch?.id === JAIPUR_DEMO_HOSPITALS[1].id, 'matchJaipurHospital resolves "Rukmani Birla" to CK Birla RBH');

  const narayanaMatch = matchJaipurHospital(JAIPUR_DEMO_HOSPITALS, 'Narayana');
  assert(narayanaMatch?.id === JAIPUR_DEMO_HOSPITALS[2].id, 'matchJaipurHospital resolves "Narayana" to Narayana Multi');

  const sdmhMatch = matchJaipurHospital(JAIPUR_DEMO_HOSPITALS, 'SDMH');
  assert(sdmhMatch?.id === JAIPUR_DEMO_HOSPITALS[3].id, 'matchJaipurHospital resolves "SDMH" to Santokba Durlabhji');

  // --------------------------------------------------------------------------
  // TEST CASE 4: Add valid stock and reject expired / invalid stock
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 4: Stock Registration & QC Validations ---');
  const fortis = JAIPUR_DEMO_HOSPITALS[0];
  authService.setActiveHospitalId(fortis.id);

  // Expired stock rejection
  const expiredStockRes = await hospitalDataService.addBloodStock(fortis, {
    componentType: 'PRBC',
    bloodGroup: 'O_NEG',
    quantity: 2,
    expiryDate: new Date(Date.now() - 3600 * 1000).toISOString(), // Expired 1 hour ago
    screeningPassed: true,
  });
  assert(
    !expiredStockRes.success && Boolean(expiredStockRes.error?.includes('expired')),
    'Expired blood stock is strictly rejected upon registration'
  );

  // Unscreened stock rejection
  const unscreenedStockRes = await hospitalDataService.addBloodStock(fortis, {
    componentType: 'PRBC',
    bloodGroup: 'O_POS',
    quantity: 1,
    expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    screeningPassed: false, // Not screened!
  });
  assert(
    !unscreenedStockRes.success && Boolean(unscreenedStockRes.error?.includes('Quality Control')),
    'Unscreened / unverified stock is rejected from usable inventory'
  );

  // Valid stock registration
  const validStockRes = await hospitalDataService.addBloodStock(fortis, {
    componentType: 'PRBC',
    bloodGroup: 'O_NEG',
    quantity: 3,
    expiryDate: new Date(Date.now() + 25 * 24 * 3600 * 1000).toISOString(),
    screeningPassed: true,
    batchRef: 'BATCH-VERIFIED-001',
  });
  assert(
    validStockRes.success && validStockRes.insertedCount === 3,
    'Valid screened stock is successfully registered to hospital inventory'
  );

  // --------------------------------------------------------------------------
  // TEST CASE 5: Request creation & unmet demand validation
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 5: Inter-Hospital Request Creation ---');
  const reqRes = await hospitalDataService.createBloodRequest(fortis, {
    componentType: 'PLATELETS',
    bloodGroup: 'O_POS',
    quantity: 2,
    urgency: 'CRITICAL_TRAUMA',
    requiredBy: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    clinicalJustification: 'Trauma resuscitation ward emergency requirement',
    patientCaseRef: 'CASE-TEST-101',
  });
  assert(
    reqRes.success && reqRes.requestId !== undefined,
    'Blood request is successfully created under requesting hospital ID'
  );

  // --------------------------------------------------------------------------
  // TEST CASE 6: Atomic reservation & preventing approving more than available
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 6: Atomic Reservation & Allocation Safety ---');
  const narayana = JAIPUR_DEMO_HOSPITALS[2];

  const approveRes = await hospitalDataService.approveIncomingRequest(narayana, reqRes.requestId!, 1);
  assert(
    approveRes.success && approveRes.approvedCount === 1,
    'Atomic reservation successfully commits units for request'
  );

  const cancelRes = await hospitalDataService.cancelRequest(fortis, reqRes.requestId!);
  assert(
    cancelRes.success,
    'Request cancellation safely transitions request and releases reservation'
  );

  // --------------------------------------------------------------------------
  // TEST CASE 7: Biological Compatibility Verification
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 7: Clinical Component Compatibility Rules ---');
  const oNegToAbPos = checkBiologicalCompatibility('PRBC', 'O_NEG', 'PRBC', 'AB_POS');
  assert(oNegToAbPos.isCompatible, 'PRBC O- is recognized as universal red blood cell donor');

  const abPosToONegRbc = checkBiologicalCompatibility('PRBC', 'AB_POS', 'PRBC', 'O_NEG');
  assert(!abPosToONegRbc.isCompatible, 'PRBC AB+ cannot be transfused to O- patient');

  const abPosToAllPlasma = checkBiologicalCompatibility('FFP', 'AB_POS', 'FFP', 'O_NEG');
  assert(abPosToAllPlasma.isCompatible, 'FFP AB+ is recognized as universal plasma donor');

  // --------------------------------------------------------------------------
  // TEST CASE 8: Patient Privacy and Non-Leakage in Recommendations
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 8: Patient Data Non-Exposure ---');
  const recs = await hospitalDataService.getNetworkRecommendations(fortis, JAIPUR_DEMO_HOSPITALS);
  const leakedPatientInfo = recs.some((r: any) => r.patientName || r.prescriptionUrl || r.prescriptionDetails);
  assert(
    !leakedPatientInfo,
    'Network recommendations do not leak private patient names or prescription details'
  );

  // --------------------------------------------------------------------------
  // TEST CASE 9: Phase 2 Inventory Module - Invalid Quantities Validation
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 9: Inventory Form - Invalid Quantities Validation ---');
  authService.setActiveHospitalId(fortis.id);

  // Zero quantity
  const zeroQtyRes = await hospitalDataService.addBloodStock(fortis, {
    componentType: 'PRBC',
    bloodGroup: 'O_POS',
    quantity: 0,
    expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    screeningPassed: true,
  });
  assert(
    !zeroQtyRes.success && Boolean(zeroQtyRes.error?.toLowerCase().includes('quantity')),
    'Quantity of 0 is rejected with validation error'
  );

  // Negative quantity
  const negQtyRes = await hospitalDataService.addBloodStock(fortis, {
    componentType: 'PRBC',
    bloodGroup: 'O_POS',
    quantity: -5,
    expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    screeningPassed: true,
  });
  assert(
    !negQtyRes.success && Boolean(negQtyRes.error?.toLowerCase().includes('quantity')),
    'Negative quantity (-5) is rejected with validation error'
  );

  // Decimal quantity
  const decimalQtyRes = await hospitalDataService.addBloodStock(fortis, {
    componentType: 'PRBC',
    bloodGroup: 'O_POS',
    quantity: 2.5,
    expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    screeningPassed: true,
  });
  assert(
    !decimalQtyRes.success && Boolean(decimalQtyRes.error?.toLowerCase().includes('integer')),
    'Decimal quantity (2.5) is rejected as non-integer'
  );

  // Excessively large quantity (>100)
  const excessiveQtyRes = await hospitalDataService.addBloodStock(fortis, {
    componentType: 'PRBC',
    bloodGroup: 'O_POS',
    quantity: 150,
    expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    screeningPassed: true,
  });
  assert(
    !excessiveQtyRes.success && Boolean(excessiveQtyRes.error?.toLowerCase().includes('quantity')),
    'Excessive quantity (150) exceeds batch ceiling limit of 100'
  );

  // --------------------------------------------------------------------------
  // TEST CASE 10: Phase 2 Inventory Module - Invalid Dates Validation
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 10: Inventory Form - Invalid Dates Validation ---');

  // Past expiry date
  const pastExpiryRes = await hospitalDataService.addBloodStock(fortis, {
    componentType: 'PLATELETS',
    bloodGroup: 'A_POS',
    quantity: 1,
    expiryDate: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    screeningPassed: true,
  });
  assert(
    !pastExpiryRes.success && Boolean(pastExpiryRes.error?.toLowerCase().includes('expired')),
    'Past expiry date is strictly rejected'
  );

  // Malformed date string
  const malformedDateRes = await hospitalDataService.addBloodStock(fortis, {
    componentType: 'FFP',
    bloodGroup: 'AB_POS',
    quantity: 1,
    expiryDate: 'invalid-not-a-date',
    screeningPassed: true,
  });
  assert(
    !malformedDateRes.success && Boolean(malformedDateRes.error?.toLowerCase().includes('date')),
    'Malformed expiry date string is rejected'
  );

  // Future donation date
  const futureDonationRes = await hospitalDataService.addBloodStock(fortis, {
    componentType: 'PRBC',
    bloodGroup: 'B_POS',
    quantity: 1,
    expiryDate: new Date(Date.now() + 35 * 24 * 3600 * 1000).toISOString(),
    donationDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(), // 7 days in future
    screeningPassed: true,
  });
  assert(
    !futureDonationRes.success && Boolean(futureDonationRes.error?.toLowerCase().includes('future')),
    'Future donation date is strictly rejected'
  );

  // Donation date after expiry date
  const donationAfterExpiryRes = await hospitalDataService.addBloodStock(fortis, {
    componentType: 'PRBC',
    bloodGroup: 'B_POS',
    quantity: 1,
    expiryDate: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
    donationDate: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(),
    screeningPassed: true,
  });
  assert(
    !donationAfterExpiryRes.success,
    'Donation date after expiry date is rejected'
  );

  // --------------------------------------------------------------------------
  // TEST CASE 11: Phase 2 Inventory Module - Unauthorized Writes
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 11: Scoped Authorization - Cross-Facility Write Prevention ---');
  // Set session active hospital to Fortis (#1)
  authService.setActiveHospitalId(fortis.id);

  // Attempt to write stock to Narayana (#3) while active session is scoped to Fortis
  const unauthorizedWriteRes = await hospitalDataService.addBloodStock(narayana, {
    componentType: 'PRBC',
    bloodGroup: 'O_NEG',
    quantity: 2,
    expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    screeningPassed: true,
  });
  assert(
    !unauthorizedWriteRes.success && Boolean(unauthorizedWriteRes.error?.toLowerCase().includes('authorization')),
    'Cross-facility inventory write without active hospital scope is rejected'
  );

  // --------------------------------------------------------------------------
  // TEST CASE 12: Phase 2 Inventory Module - Quarantine & Verification Workflow
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 12: Quarantine Holding & Clinical Verification Workflow ---');
  authService.setActiveHospitalId(fortis.id);

  // Register fresh batch into quarantine
  const quarantineAddRes = await hospitalDataService.addBloodStock(fortis, {
    componentType: 'PLATELETS',
    bloodGroup: 'O_POS',
    quantity: 2,
    expiryDate: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString(),
    screeningPassed: false, // Testing pending
    initialStatus: 'QUARANTINED',
    allowQuarantine: true,
    batchRef: 'QC-BATCH-TEST-99',
  });
  assert(
    quarantineAddRes.success && quarantineAddRes.insertedCount === 2,
    'Unscreened stock successfully enters inventory in QUARANTINED state'
  );

  // Verify that quarantined units are NOT treated as AVAILABLE
  const fortisInventory = await hospitalDataService.getHospitalInventory(fortis);
  const quarantinedFound = fortisInventory.filter((u) => u.status === 'QUARANTINED');
  assert(
    quarantinedFound.length >= 2,
    'Quarantined units are retained with status QUARANTINED in inventory'
  );

  // Test verify and release from quarantine
  const unitToRelease = quarantinedFound[0];
  const releaseRes = await hospitalDataService.verifyAndReleaseQuarantine(fortis, unitToRelease.id, 'LAB-QC-PASSED-101');
  assert(
    releaseRes.success && releaseRes.unitId === unitToRelease.id,
    'Authorized operator can verify serology and release quarantined unit to AVAILABLE'
  );

  const updatedInventory = await hospitalDataService.getHospitalInventory(fortis);
  const releasedUnit = updatedInventory.find((u) => u.id === unitToRelease.id);
  assert(
    releasedUnit?.status === 'AVAILABLE',
    'Released unit successfully transitions to AVAILABLE usable status'
  );

  // --------------------------------------------------------------------------
  // TEST CASE 13: Phase 2 Inventory Module - Reserved Stock Protection
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 13: Reserved Stock Inviolability ---');
  // Attempt to approve/reserve more units than available should be blocked
  const excessiveReqRes = await hospitalDataService.createBloodRequest(fortis, {
    componentType: 'CRYOPRECIPITATE',
    bloodGroup: 'AB_POS',
    quantity: 999, // Way more than any hospital has
    urgency: 'ROUTINE',
    requiredBy: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    clinicalJustification: 'Massive burn ward reserve requirement',
  });

  const excessiveApproveRes = await hospitalDataService.approveIncomingRequest(narayana, excessiveReqRes.requestId!, 999);
  // Should only approve up to available count, never creating phantom units
  assert(
    excessiveApproveRes.approvedCount < 999,
    'Reservation cannot exceed actual unreserved physical stock'
  );

  // --------------------------------------------------------------------------
  // TEST CASE 14: Phase 2 Inventory Module - Hospital Switching Across 4 Jaipur Facilities
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 14: Switching Across All Four Jaipur Hospitals ---');
  for (let i = 0; i < JAIPUR_DEMO_HOSPITALS.length; i++) {
    const hosp = JAIPUR_DEMO_HOSPITALS[i];
    authService.setActiveHospitalId(hosp.id);

    const hospInventory = await hospitalDataService.getHospitalInventory(hosp);
    assert(
      Array.isArray(hospInventory) && hospInventory.every((u) => u.hospitalId === hosp.id),
      `Hospital #${i + 1} (${hosp.name}) inventory strictly contains only units belonging to hospital ID ${hosp.id}`
    );

    // Verify FEFO sorting (earliest expiry first)
    let isFefoSorted = true;
    for (let k = 0; k < hospInventory.length - 1; k++) {
      if (new Date(hospInventory[k].expiresAt).getTime() > new Date(hospInventory[k + 1].expiresAt).getTime()) {
        isFefoSorted = false;
        break;
      }
    }
    assert(
      isFefoSorted,
      `Hospital #${i + 1} inventory is strictly sorted by earliest expiry date (FEFO)`
    );
  }

  console.log(`\n======================================================`);
  console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log(`======================================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
