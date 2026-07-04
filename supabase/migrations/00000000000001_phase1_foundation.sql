-- Phase 1: Foundation Layer
-- Location: supabase/migrations/00000000000001_phase1_foundation.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create canonical profiles table (extends auth.users)
-- Integrates all user profiles and billing properties (billing_country, country, ppp_tier)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  subscription_type TEXT NOT NULL CHECK (subscription_type IN ('free', 'premium', 'lifetime')) DEFAULT 'free',
  credits_remaining INTEGER NOT NULL DEFAULT 10 CHECK (credits_remaining >= 0),
  expires_at TIMESTAMPTZ,
  country TEXT,
  billing_country TEXT,
  ppp_tier VARCHAR(20) DEFAULT 'TIER_1',
  geo_country VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile." ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile." ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Profiles are insertable by trigger/system" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- Create automatic profile creation on user signup trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, subscription_type, credits_remaining, expires_at, ppp_tier, geo_country)
  VALUES (new.id, 'free', 10, null, 'TIER_1', 'US');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferred_markets TEXT[] DEFAULT '{}',
  preferred_competitions TEXT[] DEFAULT '{}',
  minimum_confidence NUMERIC DEFAULT 0.0,
  minimum_edge NUMERIC DEFAULT 0.0,
  notification_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User preferences viewable by self" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User preferences updateable by self" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);

-- Create watchlists table
CREATE TABLE IF NOT EXISTS public.watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- 'team', 'competition', 'market'
  entity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_watchlist_entity UNIQUE (user_id, type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON public.watchlists(user_id);
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Watchlists viewable by owner" ON public.watchlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Watchlists insertable by owner" ON public.watchlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Watchlists deletable by owner" ON public.watchlists FOR DELETE USING (auth.uid() = user_id);

-- Minimal RBAC (Roles & Permissions)
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Roles readable by everyone" ON public.roles FOR SELECT USING (true);
CREATE POLICY "User roles viewable by self" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
