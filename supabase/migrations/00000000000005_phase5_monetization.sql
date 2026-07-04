-- Phase 5: Monetization & Ops Layer
-- Location: supabase/migrations/00000000000005_phase5_monetization.sql

-- Products
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

-- Seed default products
INSERT INTO public.products (slug, name, type, price, currency, active)
VALUES 
  ('lifetime_pro', 'Founder Lifetime Pro', 'LIFETIME', 7900, 'USD', TRUE),
  ('credit_pack_10', '10 Forensics Credits', 'CREDITS', 300, 'USD', TRUE),
  ('tournament_pass', 'Tournament Pass', 'TOURNAMENT_PASS', 1000, 'USD', TRUE)
ON CONFLICT (slug) DO UPDATE 
SET name = EXCLUDED.name, type = EXCLUDED.type, price = EXCLUDED.price, currency = EXCLUDED.currency, active = EXCLUDED.active;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products viewable by everyone" ON public.products FOR SELECT USING (true);

-- Subscriptions (monthly/yearly recurring tier-based access)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status TEXT CHECK (status IN ('active', 'trialing', 'canceled', 'incomplete', 'past_due', 'unpaid')) NOT NULL DEFAULT 'trialing',
  tier TEXT CHECK (tier IN ('free', 'starter', 'pro', 'quant', 'founder')) NOT NULL DEFAULT 'free',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  subscription_type TEXT CHECK (subscription_type IN ('monthly', 'yearly', 'lifetime')) DEFAULT 'monthly',
  is_founder BOOLEAN DEFAULT false,
  founder_number INTEGER,
  grandfathered_features JSONB DEFAULT '{}'::jsonb,
  plan_snapshot JSONB DEFAULT '{}'::jsonb
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select their own subscription." ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own subscription." ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all subscriptions." ON public.subscriptions USING (true);

-- Transactions (All payment gateway events)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount_usd DECIMAL(10, 2) NOT NULL,
  ppp_tier VARCHAR(20) NOT NULL,
  payment_gateway VARCHAR(50) NOT NULL,
  gateway_session_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  idempotency_key VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  provider TEXT,
  provider_transaction_id TEXT,
  amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  product_id UUID REFERENCES public.products(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_provider_tx ON public.transactions(provider, provider_transaction_id);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);

-- User Entitlements (Fine-grained resource keys, e.g. Credits, Lifetime Pro)
CREATE TABLE IF NOT EXISTS public.user_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  access_type VARCHAR(50) NOT NULL,
  credits_balance INTEGER DEFAULT 0,
  tournament_slug VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  product_id UUID REFERENCES public.products(id),
  source_transaction_id UUID REFERENCES public.transactions(id),
  status TEXT DEFAULT 'ACTIVE'
);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_status ON public.user_entitlements(user_id, status);
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can view own entitlements" ON public.user_entitlements FOR SELECT USING (auth.uid() = user_id);

-- Credit Deductions (Usage log)
CREATE TABLE IF NOT EXISTS public.credit_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 1,
  action_type VARCHAR(100) NOT NULL,
  reference_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.credit_deductions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can view own deductions" ON public.credit_deductions FOR SELECT USING (auth.uid() = user_id);

-- Founders table
CREATE TABLE IF NOT EXISTS public.founders (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  founder_number INTEGER UNIQUE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.founders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders are public" ON public.founders FOR SELECT USING (true);

-- Webhook Events (Payment system webhook payloads)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway VARCHAR(50) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  provider TEXT,
  transaction_id TEXT,
  status TEXT DEFAULT 'PENDING',
  processed_at TIMESTAMPTZ,
  CONSTRAINT unique_event_provider UNIQUE(event_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON public.webhook_events(event_id, provider);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Payment Status History
CREATE TABLE IF NOT EXISTS public.payment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  from_status VARCHAR(20) NOT NULL,
  to_status VARCHAR(20) NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.payment_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can view own payment history" ON public.payment_status_history FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.transactions 
    WHERE id = payment_status_history.transaction_id AND user_id = auth.uid()
  )
);

-- Paywall Events
CREATE TABLE IF NOT EXISTS public.paywall_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  product_type VARCHAR(50),
  ppp_tier VARCHAR(20),
  amount_usd DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.paywall_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can view own paywall events" ON public.paywall_events FOR SELECT USING (auth.uid() = user_id);

-- Entitlement Audit Log
CREATE TABLE IF NOT EXISTS public.entitlement_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entitlement_id UUID REFERENCES public.user_entitlements(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  access_type VARCHAR(50) NOT NULL,
  credits_balance_before INTEGER,
  credits_balance_after INTEGER,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.entitlement_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can view own entitlement audit logs" ON public.entitlement_audit_log FOR SELECT USING (auth.uid() = user_id);

-- Founder Campaigns & Claims
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
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  founder_number INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_campaign_user UNIQUE (campaign_id, user_id),
  CONSTRAINT unique_campaign_founder_number UNIQUE (campaign_id, founder_number)
);

-- Seed a default campaign if not exists
INSERT INTO public.founder_campaigns (name, max_slots, claimed_slots, active)
VALUES ('Founder Campaign', 500, 0, TRUE)
ON CONFLICT DO NOTHING;

ALTER TABLE public.founder_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founder campaigns readable by everyone" ON public.founder_campaigns FOR SELECT USING (true);
CREATE POLICY "Founder claims readable by everyone" ON public.founder_claims FOR SELECT USING (true);

-- Atomic founder slot claims function
CREATE OR REPLACE FUNCTION public.claim_founder_slot(p_user_id UUID, p_campaign_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_claimed INTEGER;
  v_max INTEGER;
  v_founder_num INTEGER;
BEGIN
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

  v_founder_num := v_claimed + 1;

  INSERT INTO public.founder_claims (campaign_id, user_id, founder_number, claimed_at)
  VALUES (p_campaign_id, p_user_id, v_founder_num, NOW())
  ON CONFLICT (campaign_id, user_id) DO NOTHING;

  UPDATE public.founder_campaigns
  SET claimed_slots = claimed_slots + 1
  WHERE id = p_campaign_id;

  RETURN v_founder_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Operational Cron Runs
CREATE TABLE IF NOT EXISTS public.cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb
);
ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cron runs readable by everyone" ON public.cron_runs FOR SELECT USING (true);

-- Rate limiting events
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_ident_created ON public.rate_limit_events (identifier, created_at DESC);
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only access for rate limit events" ON public.rate_limit_events USING (true);

-- Founder slots & atomic allocations
CREATE TABLE IF NOT EXISTS public.founder_slots (
  id SERIAL PRIMARY KEY,
  slot_number INTEGER UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('available', 'claimed')) DEFAULT 'available',
  claimed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.founder_slots (slot_number)
SELECT s FROM generate_series(1, 100) s
ON CONFLICT DO NOTHING;

-- Older claim_founder_slot atomic function (keeps compatibility with sprint 5/6)
CREATE OR REPLACE FUNCTION public.claim_founder_slot(user_uuid UUID)
RETURNS TABLE(ret_id INT, ret_slot_number INT) AS $$
DECLARE
  claimed_slot_id INT;
  claimed_slot_number INT;
BEGIN
  SELECT id, slot_number INTO claimed_slot_id, claimed_slot_number
  FROM public.founder_slots
  WHERE status = 'available'
  ORDER BY slot_number ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF claimed_slot_id IS NOT NULL THEN
    UPDATE public.founder_slots
    SET status = 'claimed',
        claimed_by = user_uuid,
        claimed_at = now(),
        updated_at = now()
    WHERE id = claimed_slot_id;

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

-- Billing Events
CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  amount NUMERIC,
  currency TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Billing events viewable by self" ON public.billing_events FOR SELECT USING (auth.uid() = user_id);

-- Signal Access Logs
CREATE TABLE IF NOT EXISTS public.signal_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_id UUID NOT NULL,
  accessed_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.signal_access_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signal access logs viewable by self" ON public.signal_access_logs FOR SELECT USING (auth.uid() = user_id);

-- General events
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events viewable by self" ON public.events FOR SELECT USING (auth.uid() = user_id);
