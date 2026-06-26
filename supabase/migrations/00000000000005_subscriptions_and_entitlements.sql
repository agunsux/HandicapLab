-- Migration: Create subscriptions and entitlements tables
-- Sequence number: 00000000000005

-- 1. Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status TEXT CHECK (status IN ('active', 'trialing', 'canceled', 'incomplete', 'past_due', 'unpaid')) NOT NULL DEFAULT 'trialing',
  tier TEXT CHECK (tier IN ('free', 'starter', 'pro', 'quant')) NOT NULL DEFAULT 'free',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create entitlements table
CREATE TABLE IF NOT EXISTS public.entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feature TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_feature UNIQUE (user_id, feature)
);

-- 3. Enable RLS on both tables
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for subscriptions (Ensures users cannot access others' data)
CREATE POLICY "Users can select their own subscription." ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription." ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscriptions." ON public.subscriptions
  USING (true);

-- 5. Create RLS Policies for entitlements (Ensures users cannot access others' data)
CREATE POLICY "Users can select their own entitlements." ON public.entitlements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own entitlements." ON public.entitlements
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all entitlements." ON public.entitlements
  USING (true);
