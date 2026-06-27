-- Migration: Non-Subscription Monetization & Gating Engine
-- Sequence number: 00000000000024

-- 1. Create user_profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ppp_tier VARCHAR(20) DEFAULT 'TIER_1', -- TIER_1 (Stripe standard), TIER_2 (Medium), TIER_3 (Low), TIER_4 (Very Low)
  geo_country VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can view own profile" ON public.user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "User can update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles are insertable by trigger/system" ON public.user_profiles FOR INSERT WITH CHECK (true);

-- 2. Create user_entitlements
CREATE TABLE IF NOT EXISTS public.user_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  access_type VARCHAR(50) NOT NULL, -- LIFETIME_PRO, CREDITS, TOURNAMENT_PASS
  credits_balance INTEGER DEFAULT 0,
  tournament_slug VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Enable RLS for entitlements
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can view own entitlements" ON public.user_entitlements FOR SELECT USING (auth.uid() = user_id);

-- 3. Create transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_usd DECIMAL(10, 2) NOT NULL,
  ppp_tier VARCHAR(20) NOT NULL,
  payment_gateway VARCHAR(50) NOT NULL, -- STRIPE, MIDTRANS
  gateway_session_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED
  idempotency_key VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);

-- 4. Create credit_deductions
CREATE TABLE IF NOT EXISTS public.credit_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 1,
  action_type VARCHAR(100) NOT NULL, -- UNLOCK_FORENSIC_MODAL, EXPORT_CSV, TOURNAMENT_ACCESS
  reference_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for credit deductions
ALTER TABLE public.credit_deductions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can view own deductions" ON public.credit_deductions FOR SELECT USING (auth.uid() = user_id);

-- 5. Create founders table
CREATE TABLE IF NOT EXISTS public.founders (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  founder_number INTEGER UNIQUE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for founders
ALTER TABLE public.founders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders are public" ON public.founders FOR SELECT USING (true);

-- 6. Create webhook_events table
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway VARCHAR(50) NOT NULL,
  event_id VARCHAR(255) UNIQUE NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for webhooks
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- 7. Create payment_status_history table
CREATE TABLE IF NOT EXISTS public.payment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  from_status VARCHAR(20) NOT NULL,
  to_status VARCHAR(20) NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for payment history
ALTER TABLE public.payment_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can view own payment history" ON public.payment_status_history FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.transactions 
    WHERE id = payment_status_history.transaction_id AND user_id = auth.uid()
  )
);
