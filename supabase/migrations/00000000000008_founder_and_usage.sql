-- Migration: Phase 5B-1 Monetization and Hardening foundation
-- Sequence number: 00000000000008

-- 1. Alter subscriptions table to add founder and lifetime properties
DO $$
BEGIN
  -- Drop existing check constraint on tier if it exists
  ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
  
  -- Add new check constraint on tier including founder
  ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_tier_check 
    CHECK (tier IN ('free', 'starter', 'pro', 'quant', 'founder'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS subscription_type TEXT CHECK (subscription_type IN ('monthly', 'yearly', 'lifetime')) DEFAULT 'monthly';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS is_founder BOOLEAN DEFAULT false;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS founder_number INTEGER;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS grandfathered_features JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_snapshot JSONB DEFAULT '{}'::jsonb;

-- 2. Create rate limit events table
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_ident_created ON public.rate_limit_events (identifier, created_at DESC);

-- Enable RLS and create policy for rate_limit_events
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access for rate limit events" ON public.rate_limit_events
  USING (true);

-- 3. Create founder slots table and seed
CREATE TABLE IF NOT EXISTS public.founder_slots (
  id SERIAL PRIMARY KEY,
  slot_number INTEGER UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('available', 'claimed')) DEFAULT 'available',
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed 100 slots
INSERT INTO public.founder_slots (slot_number)
SELECT s FROM generate_series(1, 100) s
ON CONFLICT DO NOTHING;

-- Function to claim founder slot atomically
CREATE OR REPLACE FUNCTION public.claim_founder_slot(user_uuid UUID)
RETURNS TABLE(ret_id INT, ret_slot_number INT) AS $$
DECLARE
  claimed_slot_id INT;
  claimed_slot_number INT;
BEGIN
  -- Select and lock one available slot
  SELECT id, slot_number INTO claimed_slot_id, claimed_slot_number
  FROM public.founder_slots
  WHERE status = 'available'
  ORDER BY slot_number ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF claimed_slot_id IS NOT NULL THEN
    -- Mark slot as claimed
    UPDATE public.founder_slots
    SET status = 'claimed',
        claimed_by = user_uuid,
        claimed_at = now(),
        updated_at = now()
    WHERE id = claimed_slot_id;

    -- Update user's subscription
    UPDATE public.subscriptions
    SET tier = 'founder',
        subscription_type = 'lifetime',
        is_founder = true,
        founder_number = claimed_slot_number,
        plan_snapshot = '{"plan": "FOUNDER", "price_locked": true}'::jsonb,
        grandfathered_features = '{"scanner": true, "edge": true}'::jsonb,
        updated_at = now()
    WHERE user_id = user_uuid;

    RETURN QUERY SELECT claimed_slot_id, claimed_slot_number;
  ELSE
    RAISE EXCEPTION 'No founder slots available';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create billing events table
CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  amount NUMERIC,
  currency TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select their own billing events." ON public.billing_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage billing events" ON public.billing_events
  USING (true);

-- 5. Create signal access logs table
CREATE TABLE IF NOT EXISTS public.signal_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  signal_id TEXT NOT NULL,
  access_type TEXT CHECK (access_type IN ('preview', 'full')) NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_signal_access UNIQUE (user_id, signal_id, access_type)
);
ALTER TABLE public.signal_access_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage signal access logs" ON public.signal_access_logs
  USING (true);

-- 6. Create events table (analytics)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select their own events." ON public.events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own events." ON public.events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role can manage all events" ON public.events
  USING (true);

-- 7. Add performance and freshness columns to signals table
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS model_version TEXT;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS opening_odds NUMERIC;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS closing_odds NUMERIC;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS clv_percentage NUMERIC;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
