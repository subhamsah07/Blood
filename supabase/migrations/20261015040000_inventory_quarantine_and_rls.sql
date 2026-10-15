-- ==============================================================================
-- BloodStock Phase 2 Migration: Inventory Quarantine & Multi-Hospital RLS
-- ==============================================================================

-- 1. Extend blood_unit_status ENUM with QUARANTINED if not present
DO $$
BEGIN
    ALTER TYPE public.blood_unit_status ADD VALUE IF NOT EXISTS 'QUARANTINED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Update blood_units RLS policies to support hospital_user_access memberships
-- Drop existing policies on blood_units to recreate with comprehensive authorization checks
DROP POLICY IF EXISTS "blood_units_select_policy" ON public.blood_units;
DROP POLICY IF EXISTS "blood_units_insert_policy" ON public.blood_units;
DROP POLICY IF EXISTS "blood_units_update_policy" ON public.blood_units;

-- SELECT POLICY:
-- Authorized users can view ALL units (including QUARANTINED, RESERVED, etc.) for hospitals they belong to.
-- Users from active network hospitals can view AVAILABLE units across the network for inter-hospital allocation.
CREATE POLICY "blood_units_select_policy"
ON public.blood_units
FOR SELECT
TO authenticated
USING (
    -- Hospital membership via hospital_user_access
    hospital_id IN (
        SELECT hospital_id FROM public.hospital_user_access WHERE user_id = auth.uid()
    )
    -- Or direct ownership
    OR hospital_id IN (
        SELECT id FROM public.hospitals WHERE auth_user_id = auth.uid()
    )
    -- Or network query for clinically AVAILABLE units only (QUARANTINED units are never visible across network)
    OR (
        unit_status = 'AVAILABLE'
        AND expiry_at > NOW()
        AND (
            EXISTS (SELECT 1 FROM public.hospital_user_access WHERE user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.hospitals WHERE auth_user_id = auth.uid() AND account_status = 'active')
        )
    )
);

-- INSERT POLICY:
-- Operators and admins can only insert blood units into hospitals they are authorized for.
CREATE POLICY "blood_units_insert_policy"
ON public.blood_units
FOR INSERT
TO authenticated
WITH CHECK (
    hospital_id IN (
        SELECT hospital_id FROM public.hospital_user_access 
        WHERE user_id = auth.uid() AND role IN ('admin', 'operator')
    )
    OR hospital_id IN (
        SELECT id FROM public.hospitals 
        WHERE auth_user_id = auth.uid() AND account_status = 'active'
    )
);

-- UPDATE POLICY:
-- Operators and admins can only update units belonging to their authorized hospitals.
CREATE POLICY "blood_units_update_policy"
ON public.blood_units
FOR UPDATE
TO authenticated
USING (
    hospital_id IN (
        SELECT hospital_id FROM public.hospital_user_access 
        WHERE user_id = auth.uid() AND role IN ('admin', 'operator')
    )
    OR hospital_id IN (
        SELECT id FROM public.hospitals 
        WHERE auth_user_id = auth.uid()
    )
);

-- 3. Verification & Quarantine Release Function
-- Secure database function for verifying quarantined stock and transitioning it to AVAILABLE.
CREATE OR REPLACE FUNCTION public.verify_and_release_quarantined_unit(
    p_unit_id UUID,
    p_hospital_id UUID,
    p_batch_ref TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID;
    v_is_authorized BOOLEAN;
    v_unit RECORD;
BEGIN
    v_caller_uid := auth.uid();

    -- Check caller authorization for the hospital
    SELECT EXISTS (
        SELECT 1 FROM public.hospital_user_access
        WHERE user_id = v_caller_uid 
          AND hospital_id = p_hospital_id
          AND role IN ('admin', 'operator')
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        SELECT EXISTS (
            SELECT 1 FROM public.hospitals
            WHERE id = p_hospital_id AND auth_user_id = v_caller_uid
        ) INTO v_is_authorized;
    END IF;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: caller does not have operator permissions for this hospital.');
    END IF;

    -- Fetch and lock the unit
    SELECT * INTO v_unit
    FROM public.blood_units
    WHERE id = p_unit_id AND hospital_id = p_hospital_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Blood unit not found in active hospital inventory.');
    END IF;

    IF v_unit.unit_status != 'QUARANTINED' THEN
        RETURN jsonb_build_object('success', false, 'error', format('Unit is in %s state, not QUARANTINED.', v_unit.unit_status));
    END IF;

    IF v_unit.expiry_at <= NOW() THEN
        UPDATE public.blood_units
        SET unit_status = 'EXPIRED', updated_at = NOW()
        WHERE id = p_unit_id;
        RETURN jsonb_build_object('success', false, 'error', 'Unit has already expired and cannot be released to available stock.');
    END IF;

    -- Release to AVAILABLE
    UPDATE public.blood_units
    SET unit_status = 'AVAILABLE', updated_at = NOW()
    WHERE id = p_unit_id;

    -- Record audit log if audit table exists
    INSERT INTO public.blood_transfer_audit_log (
        actor_hospital_id,
        actor_auth_user_id,
        action_type,
        units_count,
        unit_ids,
        notes
    ) VALUES (
        p_hospital_id,
        v_caller_uid,
        'APPROVED',
        1,
        to_jsonb(ARRAY[p_unit_id]),
        format('Quarantine cleared and released to AVAILABLE. Lab batch ref: %s', COALESCE(p_batch_ref, 'N/A'))
    );

    RETURN jsonb_build_object('success', true, 'unit_id', p_unit_id, 'new_status', 'AVAILABLE');
END;
$$;
