-- P0-A: Quota State and Quota Reservations (Hardened)

-- 1. quota_state table
CREATE TABLE IF NOT EXISTS public.quota_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    quota_type VARCHAR(20) NOT NULL, -- 'DAILY', 'MONTHLY'
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    limit_value INTEGER NOT NULL CHECK (limit_value >= 0),
    safe_limit INTEGER NOT NULL CHECK (safe_limit >= 0),
    safety_reserve_pct INTEGER NOT NULL DEFAULT 0 CHECK (safety_reserve_pct >= 0 AND safety_reserve_pct <= 100),
    consumed INTEGER NOT NULL DEFAULT 0 CHECK (consumed >= 0),
    reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_quota_state UNIQUE (provider, quota_type, period_start)
);

-- 2. quota_reservations table
CREATE TABLE IF NOT EXISTS public.quota_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    quota_type VARCHAR(20) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED', 'CONFIRMED', 'ROLLED_BACK')),
    endpoint VARCHAR(255),
    request_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_quota_res_status ON public.quota_reservations(status);
CREATE INDEX IF NOT EXISTS idx_quota_res_created_at ON public.quota_reservations(created_at);
CREATE INDEX IF NOT EXISTS idx_quota_res_req_id ON public.quota_reservations(provider, request_id) WHERE request_id IS NOT NULL;

-- 3. reserve_quota RPC
CREATE OR REPLACE FUNCTION public.reserve_quota(
    p_provider VARCHAR,
    p_quota_type VARCHAR,
    p_period_start TIMESTAMPTZ,
    p_period_end TIMESTAMPTZ,
    p_amount INTEGER,
    p_endpoint VARCHAR,
    p_request_id VARCHAR,
    p_default_limit INTEGER,
    p_safety_reserve_pct INTEGER
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_state public.quota_state%ROWTYPE;
    v_existing_res public.quota_reservations%ROWTYPE;
    v_safe_remaining INTEGER;
    v_reservation_id UUID;
    v_safe_limit INTEGER;
    v_clamped_pct INTEGER;
BEGIN
    -- Input validation
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_AMOUNT');
    END IF;

    -- Idempotency check: Return existing reservation if request_id already processed
    IF p_request_id IS NOT NULL AND p_request_id != '' THEN
        SELECT * INTO v_existing_res
        FROM public.quota_reservations
        WHERE provider = p_provider
          AND request_id = p_request_id
        ORDER BY created_at DESC
        LIMIT 1;

        IF FOUND THEN
            IF v_existing_res.status = 'RESERVED' THEN
                RETURN jsonb_build_object(
                    'ok', true,
                    'reservation_id', v_existing_res.id,
                    'idempotent', true
                );
            ELSIF v_existing_res.status = 'CONFIRMED' THEN
                RETURN jsonb_build_object(
                    'ok', true,
                    'already_confirmed', true,
                    'idempotent', true
                );
            END IF;
        END IF;
    END IF;

    v_clamped_pct := GREATEST(0, LEAST(100, COALESCE(p_safety_reserve_pct, 0)));
    v_safe_limit := (p_default_limit * (100 - v_clamped_pct)) / 100;
    
    INSERT INTO public.quota_state (
        provider, quota_type, period_start, period_end,
        limit_value, safe_limit, safety_reserve_pct, consumed, reserved
    )
    VALUES (
        p_provider, p_quota_type, p_period_start, p_period_end,
        p_default_limit, v_safe_limit, v_clamped_pct, 0, 0
    )
    ON CONFLICT (provider, quota_type, period_start) DO NOTHING;

    -- Lock the row for update to prevent concurrent modifications
    SELECT * INTO v_state
    FROM public.quota_state
    WHERE provider = p_provider
      AND quota_type = p_quota_type
      AND period_start = p_period_start
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'STATE_NOT_FOUND');
    END IF;

    -- Calculate safe remaining
    v_safe_remaining := v_state.safe_limit - v_state.consumed - v_state.reserved;

    -- Check if we have enough quota
    IF v_safe_remaining < p_amount THEN
        RETURN jsonb_build_object(
            'ok', false, 
            'reason', 'QUOTA_EXHAUSTED',
            'safe_limit', v_state.safe_limit,
            'consumed', v_state.consumed,
            'reserved', v_state.reserved,
            'safe_remaining', v_safe_remaining
        );
    END IF;

    -- Increment reserved
    UPDATE public.quota_state
    SET reserved = reserved + p_amount,
        updated_at = NOW()
    WHERE id = v_state.id;

    -- Create reservation record
    INSERT INTO public.quota_reservations (
        provider, quota_type, period_start, amount, endpoint, request_id
    )
    VALUES (
        p_provider, p_quota_type, p_period_start, p_amount, p_endpoint, p_request_id
    )
    RETURNING id INTO v_reservation_id;

    RETURN jsonb_build_object(
        'ok', true,
        'reservation_id', v_reservation_id,
        'safe_limit', v_state.safe_limit,
        'consumed', v_state.consumed,
        'reserved', v_state.reserved + p_amount,
        'safe_remaining', v_safe_remaining - p_amount
    );
END;
$$;

-- 4. confirm_quota RPC
CREATE OR REPLACE FUNCTION public.confirm_quota(
    p_reservation_id UUID,
    p_actual_cost INTEGER,
    p_provider_limit INTEGER,      -- Can be NULL if provider doesn't report headers
    p_provider_remaining INTEGER   -- Can be NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_res public.quota_reservations%ROWTYPE;
    v_state public.quota_state%ROWTYPE;
    v_consumed_inc INTEGER;
    v_reserved_dec INTEGER;
BEGIN
    -- Lock reservation
    SELECT * INTO v_res
    FROM public.quota_reservations
    WHERE id = p_reservation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'RESERVATION_NOT_FOUND');
    END IF;

    IF v_res.status = 'CONFIRMED' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'ALREADY_CONFIRMED');
    END IF;

    IF v_res.status = 'ROLLED_BACK' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'ALREADY_ROLLED_BACK');
    END IF;

    -- Lock state
    SELECT * INTO v_state
    FROM public.quota_state
    WHERE provider = v_res.provider
      AND quota_type = v_res.quota_type
      AND period_start = v_res.period_start
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'STATE_NOT_FOUND');
    END IF;

    -- Update reservation status
    UPDATE public.quota_reservations
    SET status = 'CONFIRMED',
        resolved_at = NOW()
    WHERE id = p_reservation_id;

    -- Update state
    v_reserved_dec := v_res.amount;
    v_consumed_inc := COALESCE(p_actual_cost, v_res.amount);

    UPDATE public.quota_state
    SET reserved = GREATEST(0, reserved - v_reserved_dec),
        consumed = consumed + v_consumed_inc,
        limit_value = COALESCE(p_provider_limit, limit_value),
        safe_limit = (COALESCE(p_provider_limit, limit_value) * (100 - safety_reserve_pct)) / 100,
        updated_at = NOW()
    WHERE id = v_state.id
    RETURNING * INTO v_state;
    
    RETURN jsonb_build_object(
        'ok', true,
        'state', jsonb_build_object(
            'limit_value', v_state.limit_value,
            'consumed', v_state.consumed,
            'reserved', v_state.reserved
        )
    );
END;
$$;

-- 5. rollback_quota RPC
CREATE OR REPLACE FUNCTION public.rollback_quota(
    p_reservation_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_res public.quota_reservations%ROWTYPE;
    v_state public.quota_state%ROWTYPE;
BEGIN
    -- Lock reservation
    SELECT * INTO v_res
    FROM public.quota_reservations
    WHERE id = p_reservation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'RESERVATION_NOT_FOUND');
    END IF;

    IF v_res.status = 'ROLLED_BACK' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'ALREADY_ROLLED_BACK');
    END IF;

    IF v_res.status = 'CONFIRMED' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'ALREADY_CONFIRMED');
    END IF;

    -- Lock state
    SELECT * INTO v_state
    FROM public.quota_state
    WHERE provider = v_res.provider
      AND quota_type = v_res.quota_type
      AND period_start = v_res.period_start
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'STATE_NOT_FOUND');
    END IF;

    -- Update reservation status
    UPDATE public.quota_reservations
    SET status = 'ROLLED_BACK',
        resolved_at = NOW()
    WHERE id = p_reservation_id;

    -- Update state
    UPDATE public.quota_state
    SET reserved = GREATEST(0, reserved - v_res.amount),
        updated_at = NOW()
    WHERE id = v_state.id
    RETURNING * INTO v_state;

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- 6. cleanup_stale_reservations RPC
CREATE OR REPLACE FUNCTION public.cleanup_stale_reservations(p_stale_minutes INTEGER) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_res RECORD;
BEGIN
    FOR v_res IN 
        SELECT id, provider, quota_type, period_start, amount 
        FROM public.quota_reservations 
        WHERE status = 'RESERVED' 
          AND created_at < NOW() - (p_stale_minutes || ' minutes')::interval
        FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE public.quota_reservations 
        SET status = 'ROLLED_BACK', resolved_at = NOW() 
        WHERE id = v_res.id;
        
        UPDATE public.quota_state 
        SET reserved = GREATEST(0, reserved - v_res.amount), updated_at = NOW() 
        WHERE provider = v_res.provider 
          AND quota_type = v_res.quota_type 
          AND period_start = v_res.period_start;
    END LOOP;
END;
$$;