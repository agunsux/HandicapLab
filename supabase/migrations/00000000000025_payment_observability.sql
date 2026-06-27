-- Migration: Payment Observability & Webhook Gating Layer
-- Sequence number: 00000000000025

-- 1. Create paywall_events
CREATE TABLE IF NOT EXISTS public.paywall_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL, -- UPSELL_MODAL_SHOWN, CHECKOUT_ATTEMPT
  product_type VARCHAR(50), -- LIFETIME, CREDITS
  ppp_tier VARCHAR(20),
  amount_usd DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for paywall_events
ALTER TABLE public.paywall_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can view own paywall events" ON public.paywall_events FOR SELECT USING (auth.uid() = user_id);

-- 2. Create entitlement_audit_log
CREATE TABLE IF NOT EXISTS public.entitlement_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entitlement_id UUID REFERENCES public.user_entitlements(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL, -- GRANTED, EXPIRED, DEDUCTED, UNLOCKED
  access_type VARCHAR(50) NOT NULL,
  credits_balance_before INTEGER,
  credits_balance_after INTEGER,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for audit logs
ALTER TABLE public.entitlement_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can view own entitlement audit logs" ON public.entitlement_audit_log FOR SELECT USING (auth.uid() = user_id);
