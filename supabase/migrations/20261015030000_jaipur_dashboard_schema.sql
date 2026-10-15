-- ==============================================================================
-- BloodStock Jaipur Regional Network Schema & Atomic Safety Migration
-- Adds membership access, transfer audit log, and atomic reservation RPC.
-- Safe to rerun (IF NOT EXISTS / OR REPLACE).
-- ==============================================================================

-- 1. Ensure hospital_user_access table exists for RBAC & multi-hospital switcher
CREATE TABLE IF NOT EXISTS public.hospital_user_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'operator', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, hospital_id)
);

-- Enable RLS on hospital_user_access
ALTER TABLE public.hospital_user_access ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view only their own memberships
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'hospital_user_access' 
          AND policyname = 'user_access_select_own'
    ) THEN
        CREATE POLICY "user_access_select_own"
        ON public.hospital_user_access
        FOR SELECT
        TO authenticated
        USING (user_id = auth.uid());
    END IF;
END $$;

-- 2. Audit Log for Stock & Request Lifecycle (Approvals, Reservations, Dispatches, Cancellations)
CREATE TABLE IF NOT EXISTS public.blood_transfer_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.blood_requests(id) ON DELETE SET NULL,
    actor_hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
    actor_auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('CREATED', 'RECOMMENDED', 'APPROVED', 'RESERVED', 'DISPATCHED', 'COMPLETED', 'REJECTED', 'CANCELLED')),
    units_count INTEGER NOT NULL DEFAULT 0,
    unit_ids JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.blood_transfer_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'blood_transfer_audit_log' 
          AND policyname = 'transfer_audit_select_authorized'
    ) THEN
        CREATE POLICY "transfer_audit_select_authorized"
        ON public.blood_transfer_audit_log
        FOR SELECT
        TO authenticated
        USING (
            actor_hospital_id IN (
                SELECT hospital_id FROM public.hospital_user_access WHERE user_id = auth.uid()
            )
            OR actor_auth_user_id = auth.uid()
        );
    END IF;
END $$;

-- 3. Atomic Unit Reservation Function (Row Locking with SELECT ... FOR UPDATE)
-- Prevents two concurrent requests from reserving the exact same units.
CREATE OR REPLACE FUNCTION public.atomic_reserve_units(
    p_request_id UUID,
    p_donor_hospital_id UUID,
    p_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_req RECORD;
    v_caller_uid UUID;
    v_is_authorized BOOLEAN;
    v_unit_ids UUID[];
    v_allocated_count INTEGER := 0;
BEGIN
    v_caller_uid := auth.uid();

    -- Authorization check: caller must be an authorized operator for donor hospital
    SELECT EXISTS (
        SELECT 1 FROM public.hospital_user_access
        WHERE user_id = v_caller_uid 
          AND hospital_id = p_donor_hospital_id
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        SELECT EXISTS (
            SELECT 1 FROM public.hospitals
            WHERE id = p_donor_hospital_id AND auth_user_id = v_caller_uid
        ) INTO v_is_authorized;
    END IF;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: caller is not an operator of the donor hospital.');
    END IF;

    -- Retrieve and lock the blood request row
    SELECT * INTO v_req
    FROM public.blood_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Blood request not found.');
    END IF;

    IF v_req.request_status IN ('FULFILLED', 'CANCELLED', 'EXPIRED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Request is already finalized.');
    END IF;

    -- Select eligible available units for this component & blood group at donor hospital with ROW LOCKING
    SELECT ARRAY_AGG(id) INTO v_unit_ids
    FROM (
        SELECT id
        FROM public.blood_units
        WHERE hospital_id = p_donor_hospital_id
          AND component_type = v_req.component_type
          AND blood_group = v_req.required_blood_group
          AND unit_status = 'AVAILABLE'
          AND expiry_at > NOW()
        ORDER BY expiry_at ASC -- FEFO (First Expiry First Out)
        LIMIT p_quantity
        FOR UPDATE SKIP LOCKED -- Concurrency protection: skip units being locked by other transactions
    ) locked_units;

    IF v_unit_ids IS NULL OR ARRAY_LENGTH(v_unit_ids, 1) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No eligible unreserved units available at donor hospital.');
    END IF;

    v_allocated_count := ARRAY_LENGTH(v_unit_ids, 1);

    -- Mark units atomically as RESERVED
    UPDATE public.blood_units
    SET unit_status = 'RESERVED'
    WHERE id = ANY(v_unit_ids);

    -- Update request status
    UPDATE public.blood_requests
    SET request_status = CASE 
            WHEN v_allocated_count >= v_req.quantity THEN 'FULFILLED'::public.blood_request_status
            ELSE 'PARTIALLY_ALLOCATED'::public.blood_request_status
        END,
        updated_at = NOW()
    WHERE id = p_request_id;

    -- Record audit log
    INSERT INTO public.blood_transfer_audit_log (
        request_id,
        actor_hospital_id,
        actor_auth_user_id,
        action_type,
        units_count,
        unit_ids,
        notes
    ) VALUES (
        p_request_id,
        p_donor_hospital_id,
        v_caller_uid,
        'RESERVED',
        v_allocated_count,
        to_jsonb(v_unit_ids),
        format('Atomically reserved %s units via FEFO allocation.', v_allocated_count)
    );

    RETURN jsonb_build_object(
        'success', true,
        'reserved_count', v_allocated_count,
        'unit_ids', to_jsonb(v_unit_ids),
        'request_status', CASE WHEN v_allocated_count >= v_req.quantity THEN 'FULFILLED' ELSE 'PARTIALLY_ALLOCATED' END
    );
END;
$$;

-- 4. Safe Request Cancellation & Reservation Release Function
CREATE OR REPLACE FUNCTION public.release_request_reservations(
    p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_req RECORD;
    v_caller_uid UUID;
    v_is_authorized BOOLEAN;
    v_released_count INTEGER := 0;
BEGIN
    v_caller_uid := auth.uid();

    SELECT * INTO v_req
    FROM public.blood_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Request not found.');
    END IF;

    -- Caller must be authorized for requesting hospital or donor
    SELECT EXISTS (
        SELECT 1 FROM public.hospital_user_access
        WHERE user_id = v_caller_uid 
          AND hospital_id = v_req.requesting_hospital_id
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized to cancel this request.');
    END IF;

    -- Mark request as CANCELLED
    UPDATE public.blood_requests
    SET request_status = 'CANCELLED'::public.blood_request_status,
        updated_at = NOW()
    WHERE id = p_request_id;

    -- Release any reserved units linked via audit logs
    WITH reserved_units AS (
        SELECT jsonb_array_elements_text(unit_ids)::uuid AS unit_id
        FROM public.blood_transfer_audit_log
        WHERE request_id = p_request_id AND action_type = 'RESERVED'
    )
    UPDATE public.blood_units
    SET unit_status = 'AVAILABLE'
    WHERE id IN (SELECT unit_id FROM reserved_units)
      AND unit_status = 'RESERVED';

    GET DIAGNOSTICS v_released_count = ROW_COUNT;

    -- Record cancellation in audit log
    INSERT INTO public.blood_transfer_audit_log (
        request_id,
        actor_hospital_id,
        actor_auth_user_id,
        action_type,
        units_count,
        notes
    ) VALUES (
        p_request_id,
        v_req.requesting_hospital_id,
        v_caller_uid,
        'CANCELLED',
        v_released_count,
        'Request cancelled by hospital operator; reserved units restored to AVAILABLE.'
    );

    RETURN jsonb_build_object('success', true, 'released_count', v_released_count);
END;
$$;
