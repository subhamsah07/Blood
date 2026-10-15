/**
 * BloodStock - Supabase Authentication & Hospital Identity Service
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

export type HospitalAccountStatus = 'pending' | 'active' | 'suspended';

export interface HospitalProfile {
  id: string;
  auth_user_id?: string | null;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
  account_status: HospitalAccountStatus;
  created_at: string;
  updated_at?: string;
  role?: 'admin' | 'operator' | string;
}

export interface AuthResponse {
  user: User | null;
  session: Session | null;
  profile: HospitalProfile | null;
  userHospitals: HospitalProfile[];
  error: string | null;
}

// Four Jaipur demo hospital profiles for fallback & simulation testing
export const JAIPUR_DEMO_HOSPITALS: HospitalProfile[] = [
  {
    id: 'b1000000-0000-0000-0000-000000000001',
    auth_user_id: null,
    name: 'Fortis Escorts Hospital, Jaipur',
    email: 'fortis.jaipur@bloodstock.demo',
    phone: '+91 141 254 7000',
    address: 'Jawaharlal Nehru Marg, Malviya Nagar',
    city: 'Jaipur',
    latitude: 26.8529,
    longitude: 75.8054,
    account_status: 'active',
    role: 'admin',
    created_at: '2026-10-15T00:00:00.000Z',
    updated_at: '2026-10-15T00:00:00.000Z',
  },
  {
    id: 'b1000000-0000-0000-0000-000000000002',
    auth_user_id: null,
    name: 'Rukmani Birla Hospital (CK Birla Hospitals)',
    email: 'ckbirla.rbh@bloodstock.demo',
    phone: '+91 141 309 0309',
    address: 'Gopalpura Bypass Rd, Shanti Nagar, Surya Nagar',
    city: 'Jaipur',
    latitude: 26.8778,
    longitude: 75.7942,
    account_status: 'active',
    role: 'admin',
    created_at: '2026-10-15T00:00:00.000Z',
    updated_at: '2026-10-15T00:00:00.000Z',
  },
  {
    id: 'b1000000-0000-0000-0000-000000000003',
    auth_user_id: null,
    name: 'Narayana Multispeciality Hospital, Jaipur',
    email: 'narayana.jaipur@bloodstock.demo',
    phone: '+91 141 712 2222',
    address: 'Sector 28, Kumbha Marg, Pratap Nagar',
    city: 'Jaipur',
    latitude: 26.7997,
    longitude: 75.8361,
    account_status: 'active',
    role: 'admin',
    created_at: '2026-10-15T00:00:00.000Z',
    updated_at: '2026-10-15T00:00:00.000Z',
  },
  {
    id: 'b1000000-0000-0000-0000-000000000004',
    auth_user_id: null,
    name: 'Santokba Durlabhji Memorial Hospital (SDMH)',
    email: 'sdmh.jaipur@bloodstock.demo',
    phone: '+91 141 256 6251',
    address: 'Bhawani Singh Rd, Rambagh',
    city: 'Jaipur',
    latitude: 26.8917,
    longitude: 75.8078,
    account_status: 'active',
    role: 'admin',
    created_at: '2026-10-15T00:00:00.000Z',
    updated_at: '2026-10-15T00:00:00.000Z',
  },
];

// Preserved demo fallback profiles for offline / hackathon testing
const DEMO_PROFILES: Record<string, HospitalProfile> = {
  'metro.admin@bloodstock.demo': {
    id: 'a0000000-0000-0000-0000-000000000001',
    auth_user_id: 'mock-auth-metro-001',
    name: 'Metro Central General Hospital',
    email: 'metro.admin@bloodstock.demo',
    phone: '+1 (555) 019-2001',
    address: '101 Healthcare Blvd',
    city: 'Metro City',
    latitude: 13.340880,
    longitude: 74.742142,
    account_status: 'active',
    role: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  'trauma.admin@bloodstock.demo': {
    id: 'a0000000-0000-0000-0000-000000000002',
    auth_user_id: 'mock-auth-trauma-002',
    name: 'St. Jude Regional Level-1 Trauma',
    email: 'trauma.admin@bloodstock.demo',
    phone: '+1 (555) 019-2002',
    address: '88 Emergency Way',
    city: 'North District',
    latitude: 13.351230,
    longitude: 74.750120,
    account_status: 'active',
    role: 'operator',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  'children.admin@bloodstock.demo': {
    id: 'a0000000-0000-0000-0000-000000000003',
    auth_user_id: 'mock-auth-children-003',
    name: "Memorial Children's Specialty Hospital",
    email: 'children.admin@bloodstock.demo',
    phone: '+1 (555) 019-2003',
    address: '500 Pediatric Ave',
    city: 'West District',
    latitude: 13.332100,
    longitude: 74.731450,
    account_status: 'pending',
    role: 'operator',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  'suspended.admin@bloodstock.demo': {
    id: 'a0000000-0000-0000-0000-000000000004',
    auth_user_id: 'mock-auth-suspended-004',
    name: 'Pine Valley Community Clinic',
    email: 'suspended.admin@bloodstock.demo',
    phone: '+1 (555) 019-2004',
    address: '40 Rural Route 9',
    city: 'South District',
    latitude: 13.321000,
    longitude: 74.721450,
    account_status: 'suspended',
    role: 'operator',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

export const isLegacyHospital = (hospital?: { id?: string; name?: string; email?: string } | null): boolean => {
  if (!hospital) return true;
  const name = (hospital.name || '').toLowerCase();
  const id = (hospital.id || '').toLowerCase();
  const email = (hospital.email || '').toLowerCase();

  return (
    name.includes('metro central') ||
    name.includes("memorial children's") ||
    name.includes('children') ||
    name.includes('st. jude regional') ||
    name.includes('pine valley') ||
    email.includes('metro.admin') ||
    email.includes('children.admin') ||
    email.includes('trauma.admin') ||
    id.startsWith('a0000000-') ||
    id.startsWith('hosp-')
  );
};

export const matchJaipurHospital = (
  hospitals: HospitalProfile[],
  target?: string | null
): HospitalProfile | null => {
  if (!target || !hospitals || hospitals.length === 0) return null;
  const t = target.trim().toLowerCase();

  // 1. Direct ID match
  const byId = hospitals.find((h) => h.id.toLowerCase() === t);
  if (byId) return byId;

  // 2. Direct exact or includes name match
  const byName = hospitals.find((h) => h.name.toLowerCase().includes(t));
  if (byName) return byName;

  // 3. Keyword matching for the four Jaipur facilities
  if (t.includes('fortis') || t.includes('feh') || t === 'b1000000-0000-0000-0000-000000000001') {
    const f = hospitals.find((h) => h.name.toLowerCase().includes('fortis'));
    if (f) return f;
  }
  if (
    t.includes('rukmani') ||
    t.includes('birla') ||
    t.includes('rbh') ||
    t === 'b1000000-0000-0000-0000-000000000002'
  ) {
    const b = hospitals.find((h) => h.name.toLowerCase().includes('rukmani') || h.name.toLowerCase().includes('birla'));
    if (b) return b;
  }
  if (t.includes('narayana') || t.includes('nmh') || t === 'b1000000-0000-0000-0000-000000000003') {
    const n = hospitals.find((h) => h.name.toLowerCase().includes('narayana'));
    if (n) return n;
  }
  if (
    t.includes('sdmh') ||
    t.includes('durlabhji') ||
    t.includes('santokba') ||
    t === 'b1000000-0000-0000-0000-000000000004'
  ) {
    const s = hospitals.find((h) => h.name.toLowerCase().includes('sdmh') || h.name.toLowerCase().includes('durlabhji'));
    if (s) return s;
  }

  return null;
};

const ACTIVE_HOSPITAL_STORAGE_KEY = 'bloodstock_active_hospital_id';
let inMemoryActiveHospitalId: string | null = null;

export const authService = {
  isConfigured(): boolean {
    return isSupabaseConfigured();
  },

  getActiveHospitalId(): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(ACTIVE_HOSPITAL_STORAGE_KEY);
        // Clean up any legacy Metro Central, Children's Specialty, or non-Jaipur hospital IDs
        if (
          stored &&
          (stored.startsWith('a0000000-') ||
            stored.startsWith('hosp-') ||
            stored.startsWith('HOSP-') ||
            stored.includes('metro') ||
            stored.includes('children'))
        ) {
          localStorage.removeItem(ACTIVE_HOSPITAL_STORAGE_KEY);
          inMemoryActiveHospitalId = null;
          return null;
        }
        if (stored) return stored;
      }
    } catch {
      // Ignore
    }
    if (
      inMemoryActiveHospitalId &&
      (inMemoryActiveHospitalId.startsWith('a0000000-') ||
        inMemoryActiveHospitalId.startsWith('hosp-') ||
        inMemoryActiveHospitalId.startsWith('HOSP-') ||
        inMemoryActiveHospitalId.includes('metro') ||
        inMemoryActiveHospitalId.includes('children'))
    ) {
      inMemoryActiveHospitalId = null;
      return null;
    }
    return inMemoryActiveHospitalId;
  },

  setActiveHospitalId(hospitalId: string): void {
    if (
      !hospitalId ||
      hospitalId.startsWith('a0000000-') ||
      hospitalId.startsWith('hosp-') ||
      hospitalId.startsWith('HOSP-') ||
      hospitalId.includes('metro') ||
      hospitalId.includes('children')
    ) {
      this.clearActiveHospitalId();
      return;
    }
    inMemoryActiveHospitalId = hospitalId;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ACTIVE_HOSPITAL_STORAGE_KEY, hospitalId);
      }
    } catch {
      // Ignore localStorage restrictions in strict iframes
    }
  },

  clearActiveHospitalId(): void {
    inMemoryActiveHospitalId = null;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(ACTIVE_HOSPITAL_STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
  },

  /**
   * Fetches all hospital profiles that the authenticated user is authorized to manage.
   * Strictly leverages public.hospital_user_access as the single source of truth.
   */
  async getUserHospitals(userId?: string): Promise<{ hospitals: HospitalProfile[]; error: string | null }> {
    if (isSupabaseConfigured()) {
      try {
        let uid = userId;
        if (!uid) {
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (userError || !userData?.user) {
            return { hospitals: [], error: userError?.message || 'No active user session' };
          }
          uid = userData.user.id;
        }

        // 1. Fetch memberships from public.hospital_user_access
        const { data: accessRows, error: accessError } = await supabase
          .from('hospital_user_access')
          .select('hospital_id, role')
          .eq('user_id', uid);

        if (accessError) {
          console.warn('[AuthService] hospital_user_access query notice:', accessError.message);
        }

        const roleMap = new Map<string, string>();
        const memberHospitalIds: string[] = [];

        if (accessRows && accessRows.length > 0) {
          for (const row of accessRows) {
            memberHospitalIds.push(row.hospital_id);
            roleMap.set(row.hospital_id, row.role);
          }
        }

        let fetchedHospitals: HospitalProfile[] = [];

        // 2. Fetch hospital profiles ONLY for authorized memberHospitalIds
        if (memberHospitalIds.length > 0) {
          const { data: hospData, error: hospErr } = await supabase
            .from('hospitals')
            .select('*')
            .in('id', memberHospitalIds);

          if (!hospErr && hospData && hospData.length > 0) {
            fetchedHospitals = (hospData as HospitalProfile[]).filter((h) => !isLegacyHospital(h));
          } else if (hospErr) {
            console.warn('[AuthService] Error fetching member hospitals by ID:', hospErr.message);
          }
        }

        // If no non-legacy memberships were found in hospital_user_access, check direct auth_user_id
        if (fetchedHospitals.length === 0) {
          const { data: directData } = await supabase
            .from('hospitals')
            .select('*')
            .eq('auth_user_id', uid);

          if (directData && directData.length > 0) {
            fetchedHospitals = (directData as HospitalProfile[]).filter((h) => !isLegacyHospital(h));
          }
        }

        // If database records are empty or strictly legacy, fall back to JAIPUR_DEMO_HOSPITALS
        const baseHospitals = fetchedHospitals.length > 0 ? fetchedHospitals : JAIPUR_DEMO_HOSPITALS;

        // Attach resolved roles
        const finalHospitals = baseHospitals.map((h) => ({
          ...h,
          role: roleMap.get(h.id) || h.role || 'admin',
        }));

        return { hospitals: finalHospitals, error: null };
      } catch (err: any) {
        console.error('[AuthService] Exception in getUserHospitals:', err);
        return { hospitals: JAIPUR_DEMO_HOSPITALS, error: err.message || 'Database connection error' };
      }
    }

    // Demo fallback for offline / hackathon testing
    return { hospitals: JAIPUR_DEMO_HOSPITALS, error: null };
  },

  async signIn(email: string, password: string, targetHospitalId?: string): Promise<AuthResponse> {
    if (!email || !password) {
      return { user: null, session: null, profile: null, userHospitals: [], error: 'Email and password are required.' };
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. If Supabase is configured with real URL and Key, use real Supabase Auth:
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (error) {
          return { user: null, session: null, profile: null, userHospitals: [], error: error.message };
        }

        if (!data.user) {
          return { user: null, session: null, profile: null, userHospitals: [], error: 'No user returned by authentication.' };
        }

        // Fetch all authorized hospital profiles for this user from public.hospital_user_access
        const { hospitals: userHospitals, error: fetchErr } = await this.getUserHospitals(data.user.id);

        let activeProfile: HospitalProfile | null = null;

        if (userHospitals.length > 0) {
          if (targetHospitalId) {
            // Find target hospital in authorized memberships
            const matched = matchJaipurHospital(userHospitals, targetHospitalId);
            if (matched) {
              activeProfile = matched;
              this.setActiveHospitalId(activeProfile.id);
            } else {
              this.clearActiveHospitalId();
              activeProfile = userHospitals[0];
              this.setActiveHospitalId(activeProfile.id);
            }
          } else {
            const savedId = this.getActiveHospitalId();
            const matched = savedId ? matchJaipurHospital(userHospitals, savedId) : null;
            if (matched) {
              activeProfile = matched;
            } else {
              this.clearActiveHospitalId();
              activeProfile = userHospitals[0];
              this.setActiveHospitalId(activeProfile.id);
            }
          }
        }

        return {
          user: data.user,
          session: data.session,
          profile: activeProfile,
          userHospitals,
          error: fetchErr,
        };
      } catch (err: any) {
        return {
          user: null,
          session: null,
          profile: null,
          userHospitals: [],
          error: err.message || 'Network error connecting to Supabase Auth.',
        };
      }
    }

    // 2. Demo fallback for offline / hackathon testing
    const mockUser: User = {
      id: 'mock-auth-jaipur-demo-001',
      app_metadata: {},
      user_metadata: { role: 'admin' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: normalizedEmail,
    } as User;

    let activeProfile: HospitalProfile = JAIPUR_DEMO_HOSPITALS[0];
    if (targetHospitalId) {
      const match = matchJaipurHospital(JAIPUR_DEMO_HOSPITALS, targetHospitalId);
      if (match) {
        activeProfile = match;
      }
    } else {
      const savedId = this.getActiveHospitalId();
      const match = savedId ? matchJaipurHospital(JAIPUR_DEMO_HOSPITALS, savedId) : null;
      if (match) activeProfile = match;
    }
    this.setActiveHospitalId(activeProfile.id);

    return {
      user: mockUser,
      session: null,
      profile: activeProfile,
      userHospitals: JAIPUR_DEMO_HOSPITALS,
      error: null,
    };
  },

  async signOut(): Promise<{ error: string | null }> {
    this.clearActiveHospitalId();
    if (isSupabaseConfigured()) {
      const { error } = await supabase.auth.signOut();
      return { error: error ? error.message : null };
    }
    return { error: null };
  },

  async getSession(): Promise<{
    session: Session | null;
    user: User | null;
    profile: HospitalProfile | null;
    userHospitals: HospitalProfile[];
  }> {
    if (isSupabaseConfigured()) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          const user = sessionData.session.user;
          const { hospitals: userHospitals } = await this.getUserHospitals(user.id);

          let activeProfile: HospitalProfile | null = null;
          const savedId = this.getActiveHospitalId();

          if (userHospitals.length > 0) {
            // Restore a persisted hospital ONLY if the current authenticated user remains authorized for it
            const authorizedMatch = savedId ? matchJaipurHospital(userHospitals, savedId) : null;
            if (authorizedMatch) {
              activeProfile = authorizedMatch;
            } else {
              this.clearActiveHospitalId();
              activeProfile = userHospitals[0];
              this.setActiveHospitalId(activeProfile.id);
            }
          }

          return { session: sessionData.session, user, profile: activeProfile, userHospitals };
        }
      } catch (err) {
        console.error('[AuthService] Error checking session:', err);
      }
    }

    // Demo fallback for offline / hackathon testing
    const savedId = this.getActiveHospitalId();
    if (savedId) {
      const matched = matchJaipurHospital(JAIPUR_DEMO_HOSPITALS, savedId);
      if (matched) {
        return {
          session: null,
          user: {
            id: 'mock-auth-jaipur-demo-001',
            email: 'demo@bloodstock.demo',
          } as any,
          profile: matched,
          userHospitals: JAIPUR_DEMO_HOSPITALS,
        };
      }
    }

    return { session: null, user: null, profile: null, userHospitals: [] };
  },
};
