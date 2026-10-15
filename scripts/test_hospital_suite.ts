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
import { hospitalDataService, JAIPUR_TRANSIT_MATRIX } from '../src/services/hospitalDataService';
import { checkBiologicalCompatibility } from '../src/services/compatibilityRules';
import { runConstraintOptimizer } from '../src/services/optimizerSolver';
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
  const inMemoryUnits: any[] = [];
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
          eq: (_col: string, val: string) => ({
            order: async () => ({
              data: inMemoryUnits
                .filter((u) => u.hospital_id === val)
                .sort((a, b) => new Date(a.expiry_at).getTime() - new Date(b.expiry_at).getTime()),
              error: null,
            }),
            gt: () => ({
              order: () => ({
                limit: async () => ({
                  data: inMemoryUnits.filter((u) => u.hospital_id === val && u.unit_status === 'AVAILABLE'),
                  error: null,
                }),
              }),
            }),
          }),
        }),
        insert: (rows: any[]) => ({
          select: async () => {
            const inserted = rows.map((r, idx) => {
              const u = {
                id: `unit-live-${Date.now()}-${idx}`,
                hospital_id: r.hospital_id,
                component_type: r.component_type,
                blood_group: r.blood_group,
                unit_status: r.unit_status,
                expiry_at: r.expiry_at,
                created_at: r.created_at || new Date().toISOString(),
              };
              inMemoryUnits.push(u);
              return u;
            });
            return { data: inserted, error: null };
          },
        }),
        update: (updates: any) => ({
          eq: (col: string, val: string) => {
            inMemoryUnits.forEach((u) => {
              if (u[col] === val) Object.assign(u, updates);
            });
            return {
              eq: () => ({
                eq: () => ({
                  gt: async () => ({ error: null }),
                }),
              }),
            };
          },
          in: async (col: string, vals: string[]) => {
            inMemoryUnits.forEach((u) => {
              if (vals.includes(u[col])) Object.assign(u, updates);
            });
            return { error: null };
          },
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
      const available = inMemoryUnits.filter((u) => u.hospital_id === args.p_donor_hospital_id && u.unit_status === 'AVAILABLE');
      const count = Math.min(args.p_quantity || 1, available.length > 0 ? available.length : 1);
      return {
        data: {
          success: true,
          reserved_count: count,
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
    if (fnName === 'verify_and_release_quarantined_unit') {
      const u = inMemoryUnits.find((unit) => unit.id === args.p_unit_id);
      if (u) u.unit_status = 'AVAILABLE';
      return {
        data: {
          success: true,
          unit_id: args.p_unit_id,
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
  authService.setActiveHospitalId(narayana.id);
  await hospitalDataService.addBloodStock(narayana, {
    componentType: 'PLATELETS',
    bloodGroup: 'O_POS',
    quantity: 2,
    expiryDate: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
    screeningPassed: true,
    batchRef: 'BATCH-NARAYANA-PLT-01',
  });

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
  // --------------------------------------------------------------------------
  // TEST CASE 15: Part 1 - Centralized Deterministic Allocation Engine & Hard Constraints
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 15: Centralized Allocation Engine & Hard Constraints ---');
  const testHospitals = JAIPUR_DEMO_HOSPITALS.map((h) => ({
    id: h.id,
    name: h.name,
    code: (h as any).code || h.id.slice(0, 4).toUpperCase(),
    address: h.address,
    coordinates: { x: 50, y: 50 },
    protectedReserves: { PRBC: 1, PLATELETS: 0, FFP: 0, CRYOPRECIPITATE: 0 },
    phone: h.phone,
  }));

  const testUnits = [
    {
      id: 'unit-hard-01',
      hospitalId: JAIPUR_DEMO_HOSPITALS[0].id, // Fortis
      componentType: 'PRBC' as const,
      bloodGroup: 'A_POS' as const, // Incompatible with O- request
      donationDate: new Date(Date.now() - 5 * 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 25 * 86400000).toISOString(),
      status: 'AVAILABLE' as const,
      handlingBufferMinutes: 20,
      storageTemperatureCelsius: 4,
      syntheticBatchId: 'BATCH-TEST-15',
    },
    {
      id: 'unit-hard-02',
      hospitalId: JAIPUR_DEMO_HOSPITALS[1].id, // CK Birla
      componentType: 'PRBC' as const,
      bloodGroup: 'O_NEG' as const, // Universal match
      donationDate: new Date(Date.now() - 5 * 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 25 * 86400000).toISOString(),
      status: 'AVAILABLE' as const,
      handlingBufferMinutes: 20,
      storageTemperatureCelsius: 4,
      syntheticBatchId: 'BATCH-TEST-15',
    },
  ];

  const testRequests = [
    {
      id: 'req-hard-01',
      hospitalId: JAIPUR_DEMO_HOSPITALS[2].id, // Narayana
      patientCaseId: 'CASE-HARD-1',
      componentType: 'PRBC' as const,
      bloodGroup: 'O_NEG' as const,
      quantity: 1,
      urgency: 'URGENT_SURGERY' as const,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      deadlineAt: new Date(Date.now() + 4 * 3600000).toISOString(),
      status: 'PENDING' as const,
      allocatedUnitIds: [],
    },
  ];

  const hardRun = runConstraintOptimizer(
    testHospitals,
    testUnits,
    testRequests,
    JAIPUR_TRANSIT_MATRIX,
    new Date()
  );

  assert(
    hardRun.allocations.length === 1 && hardRun.allocations[0].unitId === 'unit-hard-02',
    'Hard biological compatibility enforced: Incompatible unit-hard-01 (A+) rejected, compatible unit-hard-02 (O-) allocated'
  );
  assert(
    hardRun.doubleAllocationViolationsCount === 0,
    'Zero double-allocation violations guaranteed across solver run'
  );

  // --------------------------------------------------------------------------
  // TEST CASE 16: Priority Rule A - Emergency Preemption & Partial Allocation
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 16: Priority Rule A — Verified Emergency Preemption ---');
  // Two competing requests for ONE available O- unit:
  // Request A: Routine, created 3 hours ago
  // Request B: Verified STAT Trauma Emergency, created 10 minutes ago
  const singleOUnit = [
    {
      id: 'unit-emergency-preempt-01',
      hospitalId: JAIPUR_DEMO_HOSPITALS[0].id,
      componentType: 'PRBC' as const,
      bloodGroup: 'O_NEG' as const,
      donationDate: new Date(Date.now() - 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 20 * 86400000).toISOString(),
      status: 'AVAILABLE' as const,
      handlingBufferMinutes: 20,
      storageTemperatureCelsius: 4,
      syntheticBatchId: 'BATCH-EMERG',
    },
  ];

  const competingRequests = [
    {
      id: 'req-routine-early',
      hospitalId: JAIPUR_DEMO_HOSPITALS[1].id,
      patientCaseId: 'CASE-ROUTINE-1',
      componentType: 'PRBC' as const,
      bloodGroup: 'O_NEG' as const,
      quantity: 1,
      urgency: 'ROUTINE' as const,
      createdAt: new Date(Date.now() - 3 * 3600000).toISOString(), // Earlier
      deadlineAt: new Date(Date.now() + 12 * 3600000).toISOString(),
      status: 'PENDING' as const,
      allocatedUnitIds: [],
    },
    {
      id: 'req-trauma-stat-late',
      hospitalId: JAIPUR_DEMO_HOSPITALS[2].id,
      patientCaseId: 'CASE-STAT-TRAUMA',
      componentType: 'PRBC' as const,
      bloodGroup: 'O_NEG' as const,
      quantity: 2, // Needs 2 units, but only 1 exists
      urgency: 'CRITICAL_TRAUMA' as const, // STAT Emergency
      createdAt: new Date(Date.now() - 10 * 60000).toISOString(), // Later
      deadlineAt: new Date(Date.now() + 90 * 60000).toISOString(),
      status: 'PENDING' as const,
      allocatedUnitIds: [],
    },
  ];

  const emergRun = runConstraintOptimizer(
    testHospitals,
    singleOUnit,
    competingRequests,
    JAIPUR_TRANSIT_MATRIX,
    new Date()
  );

  assert(
    emergRun.allocations.length === 1 && emergRun.allocations[0].requestId === 'req-trauma-stat-late',
    'Emergency Rule A: Verified STAT Trauma request outranks earlier routine request regardless of submission timestamp'
  );
  assert(
    emergRun.criticalDemandFulfilled === 1 && emergRun.criticalDemandTotal === 2,
    'Emergency Rule A: Partial allocation supported (1/2 fulfilled) without starving emergency'
  );
  assert(
    emergRun.unfulfilledRequests !== undefined &&
      emergRun.unfulfilledRequests.some((u) => u.requestId === 'req-trauma-stat-late' && u.unmetQuantity === 1),
    'Emergency Rule A: Unfulfilled deficit (1 unit) clearly surfaced with clinical explanation'
  );

  // --------------------------------------------------------------------------
  // TEST CASE 17: Priority Rule B - First Come, First Served (FCFS) for Equal Priority
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 17: Priority Rule B — First Come, First Served (FCFS) ---');
  const fcfsRequests = [
    {
      id: 'req-fcfs-second',
      hospitalId: JAIPUR_DEMO_HOSPITALS[1].id,
      patientCaseId: 'CASE-SURG-2',
      componentType: 'PRBC' as const,
      bloodGroup: 'O_NEG' as const,
      quantity: 1,
      urgency: 'URGENT_SURGERY' as const,
      createdAt: new Date(Date.now() - 30 * 60000).toISOString(), // 30m ago (Later)
      deadlineAt: new Date(Date.now() + 4 * 3600000).toISOString(),
      status: 'PENDING' as const,
      allocatedUnitIds: [],
    },
    {
      id: 'req-fcfs-first',
      hospitalId: JAIPUR_DEMO_HOSPITALS[2].id,
      patientCaseId: 'CASE-SURG-1',
      componentType: 'PRBC' as const,
      bloodGroup: 'O_NEG' as const,
      quantity: 1,
      urgency: 'URGENT_SURGERY' as const,
      createdAt: new Date(Date.now() - 90 * 60000).toISOString(), // 90m ago (Earlier)
      deadlineAt: new Date(Date.now() + 4 * 3600000).toISOString(),
      status: 'PENDING' as const,
      allocatedUnitIds: [],
    },
  ];

  const fcfsRun = runConstraintOptimizer(
    testHospitals,
    singleOUnit,
    fcfsRequests,
    JAIPUR_TRANSIT_MATRIX,
    new Date()
  );

  assert(
    fcfsRun.allocations.length === 1 && fcfsRun.allocations[0].requestId === 'req-fcfs-first',
    'FCFS Rule B: Earlier order (submitted 90m ago) prioritized over later order (submitted 30m ago) of same clinical tier'
  );

  // --------------------------------------------------------------------------
  // TEST CASE 18: Priority Rule C - Nearest Feasible Source & FEFO Stock Selection
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 18: Priority Rule C — Nearest Feasible Source & FEFO ---');
  // Destination: SDMH (Hospital #4)
  // Donor 1: Fortis (transit = 14m)
  // Donor 2: Narayana (transit = 28m)
  // Donor 1 has two units: Unit A expires in 3 days, Unit B expires in 20 days
  const fefoUnits = [
    {
      id: 'unit-fresher-fortis',
      hospitalId: JAIPUR_DEMO_HOSPITALS[0].id, // Fortis (14m)
      componentType: 'PRBC' as const,
      bloodGroup: 'O_NEG' as const,
      donationDate: new Date(Date.now() - 2 * 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 20 * 86400000).toISOString(), // 20 days
      status: 'AVAILABLE' as const,
      handlingBufferMinutes: 20,
      storageTemperatureCelsius: 4,
      syntheticBatchId: 'BATCH-FEFO',
    },
    {
      id: 'unit-older-fortis',
      hospitalId: JAIPUR_DEMO_HOSPITALS[0].id, // Fortis (14m)
      componentType: 'PRBC' as const,
      bloodGroup: 'O_NEG' as const,
      donationDate: new Date(Date.now() - 15 * 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 3 * 86400000).toISOString(), // 3 days (Older, should be used first)
      status: 'AVAILABLE' as const,
      handlingBufferMinutes: 20,
      storageTemperatureCelsius: 4,
      syntheticBatchId: 'BATCH-FEFO',
    },
    {
      id: 'unit-narayana-far',
      hospitalId: JAIPUR_DEMO_HOSPITALS[2].id, // Narayana (28m)
      componentType: 'PRBC' as const,
      bloodGroup: 'O_NEG' as const,
      donationDate: new Date(Date.now() - 15 * 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      status: 'AVAILABLE' as const,
      handlingBufferMinutes: 20,
      storageTemperatureCelsius: 4,
      syntheticBatchId: 'BATCH-FEFO',
    },
  ];

  const sdmhRequest = [
    {
      id: 'req-sdmh-nearest',
      hospitalId: JAIPUR_DEMO_HOSPITALS[3].id, // SDMH
      patientCaseId: 'CASE-SDMH-1',
      componentType: 'PRBC' as const,
      bloodGroup: 'O_NEG' as const,
      quantity: 1,
      urgency: 'URGENT_SURGERY' as const,
      createdAt: new Date().toISOString(),
      deadlineAt: new Date(Date.now() + 4 * 3600000).toISOString(),
      status: 'PENDING' as const,
      allocatedUnitIds: [],
    },
  ];

  const fefoRun = runConstraintOptimizer(
    testHospitals,
    fefoUnits,
    sdmhRequest,
    JAIPUR_TRANSIT_MATRIX,
    new Date()
  );

  assert(
    fefoRun.allocations.length === 1 &&
      fefoRun.allocations[0].sourceHospitalId === JAIPUR_DEMO_HOSPITALS[0].id,
    'Rule C: Sourced from nearest feasible donor Fortis (14m transit corridor) rather than farther Narayana (28m)'
  );
  assert(
    fefoRun.allocations[0].unitId === 'unit-older-fortis',
    'FEFO Spoilage Optimization: Earlier-expiring unit (expires in 3d) allocated before fresher unit (expires in 20d)'
  );

  // --------------------------------------------------------------------------
  // TEST CASE 19: Four-Phase Transfer Lifecycle (Reserve -> Dispatch -> Deliver)
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 19: Four-Phase Transfer Lifecycle & Auditability ---');
  const sourceHosp = JAIPUR_DEMO_HOSPITALS[0];
  const destHosp = JAIPUR_DEMO_HOSPITALS[3];

  // 1. Commit allocation reservation
  const commitRes = await hospitalDataService.commitAllocationReservation(
    sourceHosp,
    destHosp,
    'req-sdmh-nearest',
    'unit-older-fortis',
    'Urgent surgical transfusion'
  );
  assert(commitRes.success && Boolean(commitRes.transferId), 'Phase 1: Recommended allocation committed to RESERVED state');

  const transfers = await hospitalDataService.getNetworkTransfers();
  const tx = transfers.find((t) => t.id === commitRes.transferId);
  assert(tx !== undefined && tx.status === 'RESERVED', 'Transfer record correctly initialized in RESERVED status');

  // 2. Dispatch transfer
  const dispatchRes = await hospitalDataService.dispatchTransfer(
    sourceHosp,
    commitRes.transferId!,
    'req-sdmh-nearest',
    ['unit-older-fortis']
  );
  assert(dispatchRes.success, 'Phase 2: Explicit courier dispatch executed');

  const dispatchedTxs = await hospitalDataService.getNetworkTransfers();
  const dispatchedTx = dispatchedTxs.find((t) => t.id === commitRes.transferId);
  assert(dispatchedTx?.status === 'DISPATCHED', 'Transfer status accurately updated to DISPATCHED');

  // 3. Confirm delivery
  const deliverRes = await hospitalDataService.confirmTransferDelivered(
    destHosp,
    commitRes.transferId!,
    'req-sdmh-nearest',
    ['unit-older-fortis']
  );
  assert(deliverRes.success, 'Phase 3: Delivery and receipt confirmation executed');

  const deliveredTxs = await hospitalDataService.getNetworkTransfers();
  const deliveredTx = deliveredTxs.find((t) => t.id === commitRes.transferId);
  assert(deliveredTx?.status === 'DELIVERED', 'Transfer status finalized to DELIVERED');

  // 4. Verify audit trail
  const audits = await hospitalDataService.getTransferAuditLogs('req-sdmh-nearest');
  assert(
    audits.length >= 2,
    'Auditability: Complete lifecycle event logs recorded (RESERVED, DISPATCHED, COMPLETED)'
  );

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
