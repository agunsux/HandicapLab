-- Migration: Payment Hardening & Agnostic Infrastructure
-- Sequence number: 00000000000026

-- 1. Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  price INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  metadata JSONB DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed products
INSERT INTO public.products (slug, name, type, price, currency, active)
VALUES 
  ('lifetime_pro', 'Founder Lifetime Pro', 'LIFETIME', 7900, 'USD', TRUE),
  ('credit_pack_10', '10 Forensics Credits', 'CREDITS', 300, 'USD', TRUE),
  ('tournament_pass', 'Tournament Pass', 'TOURNAMENT_PASS', 1000, 'USD', TRUE)
ON CONFLICT (slug) DO UPDATE 
SET name = EXCLUDED.name, type = EXCLUDED.type, price = EXCLUDED.price, currency = EXCLUDED.currency, active = EXCLUDED.active;

-- 2. Update transactions table (Additive columns)
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Update user_entitlements table (Additive columns)
ALTER TABLE public.user_entitlements ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);
ALTER TABLE public.user_entitlements ADD COLUMN IF NOT EXISTS source_transaction_id UUID REFERENCES public.transactions(id);
ALTER TABLE public.user_entitlements ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';

-- 4. Create founder_campaigns & founder_claims tables
CREATE TABLE IF NOT EXISTS public.founder_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  max_slots INTEGER NOT NULL DEFAULT 500,
  claimed_slots INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.founder_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.founder_campaigns(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  founder_number INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_campaign_user UNIQUE (campaign_id, user_id),
  CONSTRAINT unique_campaign_founder_number UNIQUE (campaign_id, founder_number)
);

-- Seed a default founder campaign if not exists
INSERT INTO public.founder_campaigns (name, max_slots, claimed_slots, active)
VALUES ('Founder Campaign', 500, 0, TRUE)
ON CONFLICT DO NOTHING;

-- 5. Extend webhook_events table (Serving as payment_events)
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- Add compound unique constraint event_id + provider
-- First, drop constraint if it exists to be safe and rerun successfully
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_event_provider') THEN
    ALTER TABLE public.webhook_events DROP CONSTRAINT unique_event_provider;
  END IF;
END $$;

ALTER TABLE public.webhook_events ADD CONSTRAINT unique_event_provider UNIQUE(event_id, provider);

-- 6. Add indexes for performance & integrity
CREATE INDEX IF NOT EXISTS idx_transactions_provider_tx ON public.transactions(provider, provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_status ON public.user_entitlements(user_id, status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON public.webhook_events(event_id, provider);

-- 7. Define a secure PL/pgSQL function to claim founder campaign slots atomically
CREATE OR REPLACE FUNCTION public.claim_founder_slot(p_user_id UUID, p_campaign_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_claimed INTEGER;
  v_max INTEGER;
  v_founder_num INTEGER;
BEGIN
  -- Lock the campaign row
  SELECT claimed_slots, max_slots INTO v_claimed, v_max
  FROM public.founder_campaigns
  WHERE id = p_campaign_id AND active = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found or inactive';
  END IF;

  IF v_claimed >= v_max THEN
    RAISE EXCEPTION 'Campaign slots are full';
  END IF;

  -- Calculate next founder number
  v_founder_num := v_claimed + 1;

  -- Insert claim
  INSERT INTO public.founder_claims (campaign_id, user_id, founder_number, claimed_at)
  VALUES (p_campaign_id, p_user_id, v_founder_num, NOW())
  ON CONFLICT (campaign_id, user_id) DO NOTHING;

  -- Increment claimed slots
  UPDATE public.founder_campaigns
  SET claimed_slots = claimed_slots + 1
  WHERE id = p_campaign_id;

  RETURN v_founder_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
