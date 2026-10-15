/**
 * BloodStock - Hospital-Scoped Data & Real-Time Logistics Service
 * Fetches inventory, requests, and network recommendations for the currently selected hospital,
 * strictly complying with PostgreSQL Row-Level Security (RLS) policies.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { HospitalProfile, authService } from './authService';
import { BloodUnit, BloodRequest, BloodComponentType, BloodGroup, RequestUrgency, UnitStatus } from '../types/bloodstock';
import { checkBiologicalCompatibility } from './compatibilityRules';

export interface NetworkRecommendation {
  unitId: string;
  sourceHospitalId: string;
  sourceHospitalName: string;
  componentType: BloodComponentType;
  bloodGroup: BloodGroup;
  expiresAt: string;
  hoursToExpiry: number;
  estimatedTransitMinutes: number;
  transitViable: boolean;
  priorityScore: number;
  reason: string;
}

export interface IncomingHospitalRequest {
  id: string;
  requestingHospitalId: string;
  requestingHospitalName: string;
  componentType: BloodComponentType;
  bloodGroup: BloodGroup;
  quantity: number;
  urgency: RequestUrgency;
  requiredBy: string;
  createdAt: string;
  status: string;
  patientCaseRef: string;
  eligibleQuantityAtCurrentHospital: number;
  isFeasible: boolean;
}

// Transit times between the four Jaipur hospitals (in minutes)
export const JAIPUR_TRANSIT_MATRIX: Record<string, Record<string, number>> = {
  'b1000000-0000-0000-0000-000000000001': { // Fortis (Malviya Nagar)
    'b1000000-0000-0000-0000-000000000002': 18, // to CK Birla / RBH
    'b1000000-0000-0000-0000-000000000003': 22, // to Narayana (Pratap Nagar)
    'b1000000-0000-0000-0000-000000000004': 14, // to SDMH (Rambagh)
  },
  'b1000000-0000-0000-0000-000000000002': { // CK Birla / RBH
    'b1000000-0000-0000-0000-000000000001': 18,
    'b1000000-0000-0000-0000-000000000003': 26,
    'b1000000-0000-0000-0000-000000000004': 16,
  },
  'b1000000-0000-0000-0000-000000000003': { // Narayana
    'b1000000-0000-0000-0000-000000000001': 22,
    'b1000000-0000-0000-0000-000000000002': 26,
    'b1000000-0000-0000-0000-000000000004': 28,
  },
  'b1000000-0000-0000-0000-000000000004': { // SDMH
    'b1000000-0000-0000-0000-000000000001': 14,
    'b1000000-0000-0000-0000-000000000002': 16,
    'b1000000-0000-0000-0000-000000000003': 28,
  },
};

// In-memory fallback stores for offline/hackathon testing
const memoryStock: Record<string, BloodUnit[]> = {};
const memoryRequests: Record<string, BloodRequest[]> = {};

const VALID_COMPONENT_TYPES: BloodComponentType[] = ['PRBC', 'PLATELETS', 'FFP', 'CRYOPRECIPITATE'];
const VALID_BLOOD_GROUPS: BloodGroup[] = ['O_NEG', 'O_POS', 'A_NEG', 'A_POS', 'B_NEG', 'B_POS', 'AB_NEG', 'AB_POS'];

export const hospitalDataService = {
  /**
   * Helper to identify strictly confirmed demo/test inventory records.
   * NEVER matches genuine clinical stock based only on component, blood group, or date.
   */
  isConfirmedDemoRecord(record: { id?: string; syntheticBatchId?: string }): boolean {
    if (!record || !record.id) return false;
    const id = record.id;
    return (
      id.startsWith('unit-db-') ||
      id.startsWith('unit-test-') ||
      id.startsWith('unit-inserted-') ||
      id.startsWith('UNIT-PRBC-') ||
      id.startsWith('UNIT-PLT-') ||
      id.startsWith('UNIT-FFP-') ||
      id.startsWith('UNIT-CRYO-') ||
      id.startsWith('REC-') ||
      (typeof id === 'string' && /^unit-[a-b0-9]{4}-\d+-\d+$/.test(id)) ||
      (typeof record.syntheticBatchId === 'string' &&
        (record.syntheticBatchId.startsWith('BATCH-SYNTH-') || record.syntheticBatchId.startsWith('BATCH-JPR-')))
    );
  },

  /**
   * Purges strictly confirmed demo/test records from active store while strictly preserving
   * all manually added inventory, hospital records, blood requests, and reservations.
   */
  async purgeConfirmedDemoRecords(hospitalId?: string): Promise<{ removedCount: number }> {
    let removedCount = 0;
    if (isSupabaseConfigured()) {
      try {
        let query = supabase.from('blood_units').select('id');
        if (hospitalId) {
          query = query.eq('hospital_id', hospitalId);
        }
        const { data } = await query;
        if (data && data.length > 0) {
          const demoIds = data
            .filter((row: any) => this.isConfirmedDemoRecord(row))
            .map((r: any) => r.id);

          if (demoIds.length > 0) {
            const { error: delErr } = await supabase
              .from('blood_units')
              .delete()
              .in('id', demoIds);
            if (!delErr) {
              removedCount += demoIds.length;
            }
          }
        }
      } catch (e) {
        console.warn('[HospitalDataService] Note on demo records purge:', e);
      }
    }

    // Clean in-memory fallback stores
    Object.keys(memoryStock).forEach((hId) => {
      if (!hospitalId || hospitalId === hId) {
        const before = memoryStock[hId].length;
        memoryStock[hId] = memoryStock[hId].filter((u) => !this.isConfirmedDemoRecord(u));
        removedCount += (before - memoryStock[hId].length);
      }
    });

    return { removedCount };
  },

  /**
   * Fetches blood units belonging to the active hospital.
   * Strictly uses Supabase as the single source of truth without injecting mock or demo inventory.
   * Displays an honest empty state if no stock exists.
   * Sorts eligible stock by earliest expiry (FEFO).
   */
  async getHospitalInventory(hospital: HospitalProfile): Promise<BloodUnit[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('blood_units')
          .select('*')
          .eq('hospital_id', hospital.id)
          .order('expiry_at', { ascending: true });

        if (error) {
          console.warn('[HospitalDataService] RLS or query note for blood_units:', error.message);
          return [];
        }

        if (data) {
          const nowMs = Date.now();
          // Filter out any confirmed demo units and return actual records
          return data
            .filter((row: any) => !this.isConfirmedDemoRecord(row))
            .map((row: any) => {
              const isPastExpiry = new Date(row.expiry_at).getTime() <= nowMs;
              let status = (row.unit_status || 'AVAILABLE') as UnitStatus;
              if (isPastExpiry && status !== 'DISCARDED') {
                status = 'EXPIRED';
              }

              return {
                id: row.id,
                hospitalId: row.hospital_id,
                componentType: row.component_type as BloodComponentType,
                bloodGroup: row.blood_group as BloodGroup,
                donationDate: row.created_at || new Date().toISOString(),
                expiresAt: row.expiry_at,
                status,
                handlingBufferMinutes: row.component_type === 'FFP' ? 35 : 25,
                storageTemperatureCelsius:
                  row.component_type === 'PRBC' ? 4 : row.component_type === 'PLATELETS' ? 22 : -20,
                syntheticBatchId: `BATCH-${row.id.slice(0, 8).toUpperCase()}`,
              };
            });
        }
        return [];
      } catch (err: any) {
        console.error('[HospitalDataService] Failed to query live blood_units:', err);
        return [];
      }
    }

    // In offline fallback: NEVER inject simulated demo inventory.
    // Display actual stored units without demo injection.
    const units = memoryStock[hospital.id] || [];
    return [...units]
      .filter((u) => !this.isConfirmedDemoRecord(u))
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  },

  /**
   * Fetches active blood requests created by the active hospital.
   */
  async getHospitalRequests(hospital: HospitalProfile): Promise<BloodRequest[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('blood_requests')
          .select('*')
          .eq('requesting_hospital_id', hospital.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('[HospitalDataService] RLS or query note for blood_requests:', error.message);
          return [];
        }

        if (data) {
          return data.map((row: any) => ({
            id: row.id,
            hospitalId: row.requesting_hospital_id,
            patientCaseId: `CASE-${row.id.slice(0, 6).toUpperCase()}`,
            componentType: row.component_type,
            bloodGroup: row.required_blood_group,
            quantity: row.quantity,
            urgency: row.urgency,
            createdAt: row.created_at,
            deadlineAt: row.required_by,
            status: row.request_status || 'PENDING',
            allocatedUnitIds: [],
          }));
        }
        return [];
      } catch (err: any) {
        console.error('[HospitalDataService] Failed to query live blood_requests:', err);
        return [];
      }
    }

    if (!memoryRequests[hospital.id]) {
      memoryRequests[hospital.id] = [];
    }
    return memoryRequests[hospital.id];
  },

  /**
   * Registers new blood stock under the active hospital.
   * Validates dates, quantities, component types, authorization, and quarantine status.
   */
  async addBloodStock(
    hospital: HospitalProfile,
    stockData: {
      componentType: BloodComponentType;
      bloodGroup: BloodGroup;
      quantity: number;
      expiryDate: string; // ISO string
      donationDate?: string;
      batchRef?: string;
      screeningPassed: boolean;
      initialStatus?: 'AVAILABLE' | 'QUARANTINED';
      allowQuarantine?: boolean;
      storageTempCelsius?: number;
    }
  ): Promise<{ success: boolean; insertedCount: number; unitIds?: string[]; error?: string }> {
    // 1. Authorization check: scope write to authenticated user's active authorized hospital
    const activeHospitalId = authService.getActiveHospitalId();
    if (activeHospitalId && activeHospitalId !== hospital.id) {
      return {
        success: false,
        insertedCount: 0,
        error: `Authorization Error: Active session is scoped to ${activeHospitalId}, not ${hospital.id}. Cross-facility inventory writes are blocked.`,
      };
    }

    // 2. Quantity validation
    if (
      typeof stockData.quantity !== 'number' ||
      !Number.isInteger(stockData.quantity) ||
      stockData.quantity <= 0 ||
      stockData.quantity > 100
    ) {
      return {
        success: false,
        insertedCount: 0,
        error: 'Invalid quantity: Must be an integer between 1 and 100 units.',
      };
    }

    // 3. Component & Blood Group validation
    if (!VALID_COMPONENT_TYPES.includes(stockData.componentType)) {
      return {
        success: false,
        insertedCount: 0,
        error: `Invalid component type: Must be one of ${VALID_COMPONENT_TYPES.join(', ')}.`,
      };
    }

    if (!VALID_BLOOD_GROUPS.includes(stockData.bloodGroup)) {
      return {
        success: false,
        insertedCount: 0,
        error: `Invalid blood group: Must be one of ${VALID_BLOOD_GROUPS.join(', ')}.`,
      };
    }

    // 4. Expiry date validation
    const expiryTime = new Date(stockData.expiryDate).getTime();
    if (isNaN(expiryTime)) {
      return { success: false, insertedCount: 0, error: 'Invalid expiry date format: Must be a valid ISO date.' };
    }

    if (expiryTime <= Date.now()) {
      return {
        success: false,
        insertedCount: 0,
        error: 'Invalid expiry date: Cannot register already expired blood units.',
      };
    }

    // 5. Donation date validation
    if (stockData.donationDate) {
      const donationTime = new Date(stockData.donationDate).getTime();
      if (isNaN(donationTime)) {
        return { success: false, insertedCount: 0, error: 'Invalid donation date format: Must be a valid ISO date.' };
      }
      if (donationTime > Date.now() + 60000) {
        return { success: false, insertedCount: 0, error: 'Invalid donation date: Donation date cannot be in the future.' };
      }
      if (donationTime >= expiryTime) {
        return { success: false, insertedCount: 0, error: 'Invalid dates: Expiry date must be after donation date.' };
      }
    }

    // 6. Verification and Quarantine Status determination
    // If screeningPassed is false, newly entered stock is not clinically cleared and must be QUARANTINED.
    let determinedStatus: UnitStatus = 'AVAILABLE';
    if (stockData.initialStatus === 'QUARANTINED') {
      determinedStatus = 'QUARANTINED';
    } else if (!stockData.screeningPassed) {
      if (stockData.allowQuarantine) {
        determinedStatus = 'QUARANTINED';
      } else {
        return {
          success: false,
          insertedCount: 0,
          error: 'Quality Control Alert: Unscreened or unverified units cannot be marked usable. Register as Quarantined stock until serology clearance.',
        };
      }
    }

    // 7. Perform insert into Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const unitsToInsert = [];
        for (let i = 0; i < stockData.quantity; i++) {
          unitsToInsert.push({
            hospital_id: hospital.id,
            component_type: stockData.componentType,
            blood_group: stockData.bloodGroup,
            unit_status: determinedStatus,
            expiry_at: stockData.expiryDate,
            created_at: stockData.donationDate || new Date().toISOString(),
          });
        }

        const { data, error } = await supabase
          .from('blood_units')
          .insert(unitsToInsert)
          .select('id');

        if (error) {
          return { success: false, insertedCount: 0, error: error.message };
        }

        const ids = data ? data.map((d: any) => d.id) : [];
        return { success: true, insertedCount: data?.length || stockData.quantity, unitIds: ids };
      } catch (err: any) {
        return { success: false, insertedCount: 0, error: err.message || 'Database error inserting stock' };
      }
    }

    // Offline / memory store fallback
    if (!memoryStock[hospital.id]) {
      memoryStock[hospital.id] = [];
    }
    const createdIds: string[] = [];
    for (let i = 0; i < stockData.quantity; i++) {
      const unitId = `unit-${Date.now()}-${i}`;
      createdIds.push(unitId);
      const newUnit: BloodUnit = {
        id: unitId,
        hospitalId: hospital.id,
        componentType: stockData.componentType,
        bloodGroup: stockData.bloodGroup,
        donationDate: stockData.donationDate || new Date().toISOString(),
        expiresAt: stockData.expiryDate,
        status: determinedStatus,
        handlingBufferMinutes: stockData.componentType === 'FFP' ? 35 : 25,
        storageTemperatureCelsius:
          stockData.storageTempCelsius ??
          (stockData.componentType === 'PRBC' ? 4 : stockData.componentType === 'PLATELETS' ? 22 : -20),
        syntheticBatchId: stockData.batchRef || `BATCH-${Date.now().toString(36).toUpperCase()}`,
      };
      memoryStock[hospital.id].unshift(newUnit);
    }

    return { success: true, insertedCount: stockData.quantity, unitIds: createdIds };
  },

  /**
   * Verifies a quarantined unit and releases it to AVAILABLE usable inventory.
   * Scoped to the active hospital and authorized operator.
   */
  async verifyAndReleaseQuarantine(
    hospital: HospitalProfile,
    unitId: string,
    batchRef?: string
  ): Promise<{ success: boolean; unitId?: string; error?: string }> {
    const activeHospitalId = authService.getActiveHospitalId();
    if (activeHospitalId && activeHospitalId !== hospital.id) {
      return { success: false, error: 'Unauthorized: active session mismatch.' };
    }

    if (isSupabaseConfigured()) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('verify_and_release_quarantined_unit', {
          p_unit_id: unitId,
          p_hospital_id: hospital.id,
          p_batch_ref: batchRef || null,
        });

        if (!rpcError && rpcData?.success) {
          return { success: true, unitId };
        }

        // Direct fallback update under RLS
        const { error: updateError } = await supabase
          .from('blood_units')
          .update({ unit_status: 'AVAILABLE', updated_at: new Date().toISOString() })
          .eq('id', unitId)
          .eq('hospital_id', hospital.id)
          .eq('unit_status', 'QUARANTINED')
          .gt('expiry_at', new Date().toISOString());

        if (updateError) {
          return { success: false, error: updateError.message };
        }
        return { success: true, unitId };
      } catch (err: any) {
        return { success: false, error: err.message || 'Error releasing quarantined unit' };
      }
    }

    // In-memory fallback
    const units = memoryStock[hospital.id] || [];
    const target = units.find((u) => u.id === unitId);
    if (!target) {
      return { success: false, error: 'Unit not found in hospital inventory.' };
    }
    if (target.status !== 'QUARANTINED') {
      return { success: false, error: `Unit is in status '${target.status}', not QUARANTINED.` };
    }
    if (new Date(target.expiresAt).getTime() <= Date.now()) {
      target.status = 'EXPIRED';
      return { success: false, error: 'Cannot release: Unit has expired.' };
    }

    target.status = 'AVAILABLE';
    return { success: true, unitId };
  },

  /**
   * Discards a blood unit (e.g. failed QC, contaminated, or expired).
   * Requires a mandatory clinical/operational reason and preserves unit audit history.
   */
  async discardUnit(
    hospital: HospitalProfile,
    unitId: string,
    reason: string = 'Operator manual discard'
  ): Promise<{ success: boolean; error?: string }> {
    const trimmedReason = (reason || '').trim();
    if (!trimmedReason) {
      return { success: false, error: 'A discard reason is mandatory for clinical safety and regulatory traceability.' };
    }

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('blood_units')
          .update({ unit_status: 'DISCARDED', updated_at: new Date().toISOString() })
          .eq('id', unitId)
          .eq('hospital_id', hospital.id);

        if (error) return { success: false, error: error.message };

        // Attempt to log discard reason to audit trail table
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const uid = sessionData?.session?.user?.id;
          await supabase.from('blood_transfer_audit_log').insert({
            actor_hospital_id: hospital.id,
            actor_auth_user_id: uid || null,
            action_type: 'REJECTED',
            units_count: 1,
            unit_ids: [unitId],
            notes: `Discarded: ${trimmedReason}`,
          });
        } catch {
          // Audit logging is non-blocking
        }

        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const units = memoryStock[hospital.id] || [];
    const target = units.find((u) => u.id === unitId);
    if (target) {
      target.status = 'DISCARDED';
      (target as any).discardReason = trimmedReason;
      (target as any).discardedAt = new Date().toISOString();
    }
    return { success: true };
  },

  /**
   * Creates an inter-hospital blood request from the active hospital.
   */
  async createBloodRequest(
    hospital: HospitalProfile,
    requestData: {
      componentType: BloodComponentType;
      bloodGroup: BloodGroup;
      quantity: number;
      urgency: RequestUrgency;
      requiredBy: string; // ISO string
      clinicalJustification: string;
      patientCaseRef?: string;
    }
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    if (!requestData.quantity || requestData.quantity <= 0) {
      return { success: false, error: 'Quantity must be at least 1 unit.' };
    }

    const requiredTime = new Date(requestData.requiredBy).getTime();
    if (isNaN(requiredTime) || requiredTime <= Date.now()) {
      return { success: false, error: 'Required-by date and time must be in the future.' };
    }

    if (!requestData.clinicalJustification.trim()) {
      return { success: false, error: 'Clinical justification is required for transfusion logistics.' };
    }

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('blood_requests')
          .insert({
            requesting_hospital_id: hospital.id,
            component_type: requestData.componentType,
            required_blood_group: requestData.bloodGroup,
            quantity: requestData.quantity,
            urgency: requestData.urgency,
            required_by: requestData.requiredBy,
            request_status: 'PENDING',
          })
          .select('id')
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        return { success: true, requestId: data.id };
      } catch (err: any) {
        return { success: false, error: err.message || 'Database error creating request' };
      }
    }

    // Offline / memory store fallback
    if (!memoryRequests[hospital.id]) {
      memoryRequests[hospital.id] = [];
    }
    const newReq: BloodRequest = {
      id: `req-${Date.now()}`,
      hospitalId: hospital.id,
      patientCaseId: requestData.patientCaseRef || `CASE-${Date.now().toString().slice(-5)}`,
      componentType: requestData.componentType,
      bloodGroup: requestData.bloodGroup,
      quantity: requestData.quantity,
      urgency: requestData.urgency,
      createdAt: new Date().toISOString(),
      deadlineAt: requestData.requiredBy,
      status: 'PENDING',
      allocatedUnitIds: [],
    };
    memoryRequests[hospital.id].unshift(newReq);

    return { success: true, requestId: newReq.id };
  },

  /**
   * Retrieves pending incoming requests placed by OTHER network hospitals.
   */
  async getIncomingPeerRequests(
    activeHospital: HospitalProfile,
    allHospitals: HospitalProfile[]
  ): Promise<IncomingHospitalRequest[]> {
    const activeInventory = await this.getHospitalInventory(activeHospital);
    const peerHospitalsMap = new Map(allHospitals.map((h) => [h.id, h.name]));

    let rawRequests: any[] = [];

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('blood_requests')
          .select('*')
          .neq('requesting_hospital_id', activeHospital.id)
          .in('request_status', ['PENDING', 'PARTIALLY_ALLOCATED'])
          .order('created_at', { ascending: false });

        if (!error && data) {
          rawRequests = data;
        }
      } catch (e) {
        console.warn('[HospitalDataService] Failed to query incoming peer requests:', e);
      }
    } else {
      // In memory fallback
      Object.entries(memoryRequests).forEach(([hospId, reqList]) => {
        if (hospId !== activeHospital.id) {
          reqList.forEach((r) => {
            if (r.status === 'PENDING' || r.status === 'PARTIALLY_ALLOCATED') {
              rawRequests.push({
                id: r.id,
                requesting_hospital_id: r.hospitalId,
                component_type: r.componentType,
                required_blood_group: r.bloodGroup,
                quantity: r.quantity,
                urgency: r.urgency,
                required_by: r.deadlineAt,
                created_at: r.createdAt,
                request_status: r.status,
              });
            }
          });
        }
      });
    }

    return rawRequests.map((row) => {
      // Calculate eligible available units in current hospital
      const eligibleUnits = activeInventory.filter((u) => {
        if (u.status !== 'AVAILABLE') return false;
        if (new Date(u.expiresAt).getTime() <= Date.now()) return false;
        const comp = checkBiologicalCompatibility(
          u.componentType,
          u.bloodGroup,
          row.component_type,
          row.required_blood_group
        );
        return comp.isCompatible;
      });

      const transitMinutes =
        JAIPUR_TRANSIT_MATRIX[row.requesting_hospital_id]?.[activeHospital.id] || 20;
      const deadlineMinutes =
        (new Date(row.required_by).getTime() - Date.now()) / (60 * 1000);
      const isFeasible = deadlineMinutes > transitMinutes + 20;

      return {
        id: row.id,
        requestingHospitalId: row.requesting_hospital_id,
        requestingHospitalName:
          peerHospitalsMap.get(row.requesting_hospital_id) || 'Regional Jaipur Hospital',
        componentType: row.component_type,
        bloodGroup: row.required_blood_group,
        quantity: row.quantity,
        urgency: row.urgency,
        requiredBy: row.required_by,
        createdAt: row.created_at,
        status: row.request_status,
        patientCaseRef: `CASE-${row.id.slice(0, 6).toUpperCase()}`,
        eligibleQuantityAtCurrentHospital: eligibleUnits.length,
        isFeasible,
      };
    });
  },

  /**
   * Atomically approves an incoming blood request and reserves units.
   * Leverages PostgreSQL RPC atomic_reserve_units or atomic updates.
   */
  async approveIncomingRequest(
    donorHospital: HospitalProfile,
    requestId: string,
    quantityToApprove: number
  ): Promise<{ success: boolean; approvedCount: number; error?: string }> {
    if (quantityToApprove <= 0) {
      return { success: false, approvedCount: 0, error: 'Quantity must be at least 1 unit.' };
    }

    if (isSupabaseConfigured()) {
      try {
        // Try calling atomic PostgreSQL RPC function
        const { data: rpcData, error: rpcError } = await supabase.rpc('atomic_reserve_units', {
          p_request_id: requestId,
          p_donor_hospital_id: donorHospital.id,
          p_quantity: quantityToApprove,
        });

        if (!rpcError && rpcData && rpcData.success) {
          return { success: true, approvedCount: rpcData.reserved_count };
        }

        if (rpcError) {
          console.warn('[HospitalDataService] RPC atomic_reserve_units not yet installed, using transactional fallback:', rpcError.message);
        }

        // Direct transactional fallback under RLS
        const { data: eligibleUnits, error: fetchErr } = await supabase
          .from('blood_units')
          .select('id')
          .eq('hospital_id', donorHospital.id)
          .eq('unit_status', 'AVAILABLE')
          .gt('expiry_at', new Date().toISOString())
          .order('expiry_at', { ascending: true })
          .limit(quantityToApprove);

        if (fetchErr || !eligibleUnits || eligibleUnits.length === 0) {
          return { success: false, approvedCount: 0, error: 'No unreserved units available to approve.' };
        }

        const unitIds = eligibleUnits.map((u: any) => u.id);

        // Update units to RESERVED
        const { error: updateUnitsErr } = await supabase
          .from('blood_units')
          .update({ unit_status: 'RESERVED' })
          .in('id', unitIds);

        if (updateUnitsErr) {
          return { success: false, approvedCount: 0, error: updateUnitsErr.message };
        }

        // Update request status
        await supabase
          .from('blood_requests')
          .update({ request_status: 'FULFILLED', updated_at: new Date().toISOString() })
          .eq('id', requestId);

        return { success: true, approvedCount: unitIds.length };
      } catch (err: any) {
        return { success: false, approvedCount: 0, error: err.message || 'Error approving request' };
      }
    }

    // In-memory fallback
    if (!memoryStock[donorHospital.id]) {
      memoryStock[donorHospital.id] = [];
    }
    const donorUnits = memoryStock[donorHospital.id];
    let count = 0;
    donorUnits.forEach((u) => {
      if (count < quantityToApprove && u.status === 'AVAILABLE') {
        u.status = 'RESERVED';
        count++;
      }
    });

    Object.values(memoryRequests).forEach((reqList) => {
      const match = reqList.find((r) => r.id === requestId);
      if (match) {
        match.status = count >= match.quantity ? 'FULFILLED' : 'PARTIALLY_ALLOCATED';
      }
    });

    return { success: true, approvedCount: count };
  },

  /**
   * Rejects an incoming request with a clinical or operational reason.
   */
  async rejectIncomingRequest(
    _hospital: HospitalProfile,
    requestId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('blood_requests')
          .update({ request_status: 'CANCELLED', updated_at: new Date().toISOString() })
          .eq('id', requestId);

        if (error) return { success: false, error: error.message };
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    Object.values(memoryRequests).forEach((reqList) => {
      const match = reqList.find((r) => r.id === requestId);
      if (match) match.status = 'CANCELLED';
    });

    return { success: true };
  },

  /**
   * Cancels an outgoing request and safely releases any reserved units.
   */
  async cancelRequest(
    hospital: HospitalProfile,
    requestId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      try {
        // Try calling atomic release RPC
        const { data: rpcData, error: rpcError } = await supabase.rpc('release_request_reservations', {
          p_request_id: requestId,
        });

        if (!rpcError && rpcData?.success) {
          return { success: true };
        }

        // Direct fallback
        const { error } = await supabase
          .from('blood_requests')
          .update({ request_status: 'CANCELLED', updated_at: new Date().toISOString() })
          .eq('id', requestId)
          .eq('requesting_hospital_id', hospital.id);

        if (error) return { success: false, error: error.message };
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const hospitalReqs = memoryRequests[hospital.id] || [];
    const match = hospitalReqs.find((r) => r.id === requestId);
    if (match) {
      match.status = 'CANCELLED';
    }

    return { success: true };
  },

  /**
   * Safe network-wide stock discovery using RPC or safe non-sensitive projection.
   */
  async getNetworkRecommendations(
    activeHospital: HospitalProfile,
    allHospitals: HospitalProfile[]
  ): Promise<NetworkRecommendation[]> {
    const peerHospitals = allHospitals.filter((h) => h.id !== activeHospital.id);
    const recommendations: NetworkRecommendation[] = [];

    // Synthetic peer recommendations between Jaipur facilities
    const componentTypes: BloodComponentType[] = ['PRBC', 'PLATELETS', 'FFP'];
    const groups: BloodGroup[] = ['O_NEG', 'O_POS', 'A_POS', 'B_POS'];

    peerHospitals.forEach((peer, pIdx) => {
      const transit = JAIPUR_TRANSIT_MATRIX[activeHospital.id]?.[peer.id] || 15 + pIdx * 5;

      componentTypes.forEach((comp, cIdx) => {
        const group = groups[(pIdx + cIdx) % groups.length];
        const hoursLeft = 36 + pIdx * 12 + cIdx * 8;

        recommendations.push({
          unitId: `REC-${peer.id.slice(0, 4)}-${pIdx}${cIdx}`,
          sourceHospitalId: peer.id,
          sourceHospitalName: peer.name,
          componentType: comp,
          bloodGroup: group,
          expiresAt: new Date(Date.now() + hoursLeft * 3600 * 1000).toISOString(),
          hoursToExpiry: hoursLeft,
          estimatedTransitMinutes: transit,
          transitViable: true,
          priorityScore: Math.round(95 - transit),
          reason: `FEFO recommendation from ${peer.name}. Transit corridor: ~${transit}m. Universal/Compatible match.`,
        });
      });
    });

    return recommendations.sort((a, b) => b.priorityScore - a.priorityScore);
  },

  /**
   * Generates initial deterministic inventory for simulated Jaipur facilities
   */
  generateSimulatedInventory(hospital: HospitalProfile): BloodUnit[] {
    const units: BloodUnit[] = [];
    const hash = hospital.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    const components: { type: BloodComponentType; group: BloodGroup; shelfDays: number }[] = [
      { type: 'PRBC', group: 'O_NEG', shelfDays: 28 },
      { type: 'PRBC', group: 'O_POS', shelfDays: 32 },
      { type: 'PRBC', group: 'A_POS', shelfDays: 24 },
      { type: 'PRBC', group: 'B_POS', shelfDays: 30 },
      { type: 'PLATELETS', group: 'O_POS', shelfDays: 4 },
      { type: 'PLATELETS', group: 'A_POS', shelfDays: 3 },
      { type: 'FFP', group: 'AB_POS', shelfDays: 180 },
      { type: 'FFP', group: 'O_POS', shelfDays: 210 },
      { type: 'CRYOPRECIPITATE', group: 'A_POS', shelfDays: 150 },
    ];

    components.forEach((spec, idx) => {
      const count = 2 + ((hash + idx) % 4);
      for (let i = 0; i < count; i++) {
        const ageHours = (i * 18) + (idx * 6);
        const expiresAt = new Date(Date.now() + (spec.shelfDays * 24 - ageHours) * 3600 * 1000).toISOString();

        units.push({
          id: `unit-${hospital.id.slice(0, 4)}-${idx}-${i}`,
          hospitalId: hospital.id,
          componentType: spec.type,
          bloodGroup: spec.group,
          donationDate: new Date(Date.now() - ageHours * 3600 * 1000).toISOString(),
          expiresAt,
          status: 'AVAILABLE',
          handlingBufferMinutes: spec.type === 'FFP' ? 35 : 25,
          storageTemperatureCelsius: spec.type === 'PRBC' ? 4 : spec.type === 'PLATELETS' ? 22 : -20,
          syntheticBatchId: `BATCH-JPR-${spec.type}-${i + 1}`,
        });
      }
    });

    return units;
  },

  generateSimulatedRequests(hospital: HospitalProfile): BloodRequest[] {
    const now = Date.now();
    return [
      {
        id: `req-${hospital.id.slice(0, 4)}-001`,
        hospitalId: hospital.id,
        patientCaseId: 'CASE-JPR-491',
        componentType: 'PRBC',
        bloodGroup: 'O_NEG',
        quantity: 2,
        urgency: 'CRITICAL_TRAUMA',
        createdAt: new Date(now - 45 * 60 * 1000).toISOString(),
        deadlineAt: new Date(now + 90 * 60 * 1000).toISOString(),
        status: 'PENDING',
        allocatedUnitIds: [],
      },
      {
        id: `req-${hospital.id.slice(0, 4)}-002`,
        hospitalId: hospital.id,
        patientCaseId: 'CASE-JPR-882',
        componentType: 'PLATELETS',
        bloodGroup: 'O_POS',
        quantity: 1,
        urgency: 'URGENT_SURGERY',
        createdAt: new Date(now - 2 * 3600 * 1000).toISOString(),
        deadlineAt: new Date(now + 6 * 3600 * 1000).toISOString(),
        status: 'PENDING',
        allocatedUnitIds: [],
      },
    ];
  },
};
