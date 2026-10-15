-- ==============================================================================
-- BloodStock: Time-Aware Allocation of Perishable Blood Components
-- Supabase PostgreSQL Database Schema & Security Migration
-- Track 02 — HealthTech (Code-e-Manipal 2.0)
-- ==============================================================================
-- NOTE: Uses synthetic data only. This database is designed for research simulation
-- and logistics planning, not clinical transfusion authorization.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS & DOMAINS
DO $$ BEGIN
    CREATE TYPE blood_component_type AS ENUM ('PRBC', 'PLATELETS', 'FFP', 'CRYOPRECIPITATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE blood_group_type AS ENUM ('O_NEG', 'O_POS', 'A_NEG', 'A_POS', 'B_NEG', 'B_POS', 'AB_NEG', 'AB_POS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE hospital_account_status AS ENUM ('pending', 'active', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE blood_unit_status AS ENUM ('AVAILABLE', 'RESERVED', 'IN_TRANSIT', 'RECEIVED', 'EXPIRED', 'DISCARDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE blood_request_urgency AS ENUM ('CRITICAL_TRAUMA', 'URGENT_SURGERY', 'ROUTINE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE blood_request_status AS ENUM ('PENDING', 'PARTIALLY_ALLOCATED', 'ALLOCATED', 'IN_TRANSIT', 'FULFILLED', 'CANCELLED', 'UNFULFILLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- ==============================================================================
-- 3. TABLES
-- ==============================================================================

-- TABLE: hospitals
-- Stores verified profiles for participating regional hospitals linked to Supabase Auth users
CREATE TABLE IF NOT EXISTS public.hospitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    account_status hospital_account_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE: blood_units
-- Prepares the unit inventory table for perishable blood components
CREATE TABLE IF NOT EXISTS public.blood_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    component_type blood_component_type NOT NULL,
    blood_group blood_group_type NOT NULL,
    unit_status blood_unit_status NOT NULL DEFAULT 'AVAILABLE',
    expiry_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE: blood_requests
-- Prepares hospital emergency & routine blood component requests
CREATE TABLE IF NOT EXISTS public.blood_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requesting_hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    component_type blood_component_type NOT NULL,
    required_blood_group blood_group_type NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    urgency blood_request_urgency NOT NULL,
    required_by TIMESTAMPTZ NOT NULL,
    request_status blood_request_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 4. INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_hospitals_auth_user_id ON public.hospitals(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_hospitals_status ON public.hospitals(account_status);
CREATE INDEX IF NOT EXISTS idx_blood_units_hospital_id ON public.blood_units(hospital_id);
CREATE INDEX IF NOT EXISTS idx_blood_units_status_expiry ON public.blood_units(unit_status, expiry_at);
CREATE INDEX IF NOT EXISTS idx_blood_requests_hospital_id ON public.blood_requests(requesting_hospital_id);
CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON public.blood_requests(request_status);

-- ==============================================================================
-- 5. TRIGGER: PREVENT SELF-STATUS ELEVATION
-- ==============================================================================
-- Ensures hospital users cannot elevate their own account_status to 'active' or 'verified'
CREATE OR REPLACE FUNCTION public.check_hospital_status_update()
RETURNS TRIGGER AS $$
BEGIN
    -- If user is calling via frontend authenticated role (not service_role), block status edits
    IF auth.role() = 'authenticated' AND NEW.account_status != OLD.account_status THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can modify hospital account status.';
    END IF;
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_hospital_status ON public.hospitals;
CREATE TRIGGER tr_check_hospital_status
    BEFORE UPDATE ON public.hospitals
    FOR EACH ROW
    EXECUTE FUNCTION public.check_hospital_status_update();

-- ==============================================================================
-- 6. ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- POLICIES FOR: hospitals
-- ------------------------------------------------------------------------------

-- Policy 1: Authenticated hospitals can view their own profile, or view public profile of active hospitals
CREATE POLICY "hospitals_select_policy"
ON public.hospitals
FOR SELECT
TO authenticated
USING (
    auth.uid() = auth_user_id 
    OR account_status = 'active'
);

-- Policy 2: Authenticated hospital can update their own profile details (excluding status, enforced by trigger)
CREATE POLICY "hospitals_update_policy"
ON public.hospitals
FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- Policy 3: New hospital registration (must start as 'pending')
CREATE POLICY "hospitals_insert_policy"
ON public.hospitals
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = auth_user_id
    AND account_status = 'pending'
);

-- ------------------------------------------------------------------------------
-- POLICIES FOR: blood_units
-- ------------------------------------------------------------------------------

-- Policy 1: Active hospitals can view inventory for network allocation queries
CREATE POLICY "blood_units_select_policy"
ON public.blood_units
FOR SELECT
TO authenticated
USING (
    hospital_id IN (
        SELECT id FROM public.hospitals WHERE auth_user_id = auth.uid()
    )
    OR (
        unit_status = 'AVAILABLE' 
        AND EXISTS (SELECT 1 FROM public.hospitals WHERE auth_user_id = auth.uid() AND account_status = 'active')
    )
);

-- Policy 2: A hospital can only insert units into its own inventory
CREATE POLICY "blood_units_insert_policy"
ON public.blood_units
FOR INSERT
TO authenticated
WITH CHECK (
    hospital_id IN (
        SELECT id FROM public.hospitals WHERE auth_user_id = auth.uid() AND account_status = 'active'
    )
);

-- Policy 3: A hospital can only update/modify its own units
CREATE POLICY "blood_units_update_policy"
ON public.blood_units
FOR UPDATE
TO authenticated
USING (
    hospital_id IN (
        SELECT id FROM public.hospitals WHERE auth_user_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- POLICIES FOR: blood_requests
-- ------------------------------------------------------------------------------

-- Policy 1: A hospital can view its own requests, or active hospitals can view pending orders
CREATE POLICY "blood_requests_select_policy"
ON public.blood_requests
FOR SELECT
TO authenticated
USING (
    requesting_hospital_id IN (
        SELECT id FROM public.hospitals WHERE auth_user_id = auth.uid()
    )
    OR (
        request_status = 'PENDING'
        AND EXISTS (SELECT 1 FROM public.hospitals WHERE auth_user_id = auth.uid() AND account_status = 'active')
    )
);

-- Policy 2: A hospital can only create requests for itself
CREATE POLICY "blood_requests_insert_policy"
ON public.blood_requests
FOR INSERT
TO authenticated
WITH CHECK (
    requesting_hospital_id IN (
        SELECT id FROM public.hospitals WHERE auth_user_id = auth.uid() AND account_status = 'active'
    )
);

-- Policy 3: A hospital can only update its own requests
CREATE POLICY "blood_requests_update_policy"
ON public.blood_requests
FOR UPDATE
TO authenticated
USING (
    requesting_hospital_id IN (
        SELECT id FROM public.hospitals WHERE auth_user_id = auth.uid()
    )
);

-- ==============================================================================
-- 7. SEED DATA (Synthetic Fictional Hospitals)
-- ==============================================================================
-- Insert demonstration hospitals with pending/active status for evaluation.
-- For actual testing with a real Supabase Auth user, update auth_user_id to your user's UUID.
INSERT INTO public.hospitals (id, name, email, phone, address, city, latitude, longitude, account_status)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Metro Central General Hospital', 'metro.admin@bloodstock.demo', '+1 (555) 019-2001', '101 Healthcare Blvd', 'Metro City', 13.340880, 74.742142, 'active'),
    ('a0000000-0000-0000-0000-000000000002', 'St. Jude Regional Level-1 Trauma', 'trauma.admin@bloodstock.demo', '+1 (555) 019-2002', '88 Emergency Way', 'North District', 13.351230, 74.750120, 'active'),
    ('a0000000-0000-0000-0000-000000000003', 'Memorial Children''s Specialty Hospital', 'children.admin@bloodstock.demo', '+1 (555) 019-2003', '500 Pediatric Ave', 'West District', 13.332100, 74.731450, 'pending')
ON CONFLICT (email) DO NOTHING;
