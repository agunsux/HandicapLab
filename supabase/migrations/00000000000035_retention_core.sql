-- Migration: Create user_preferences, watchlists, and signal_events tables for Phase 33A Retention Core Layer
-- Sequence number: 00000000000035

-- 1. Create user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY,
  preferred_markets TEXT[] DEFAULT '{}',
  preferred_competitions TEXT[] DEFAULT '{}',
  minimum_confidence NUMERIC DEFAULT 0.0,
  minimum_edge NUMERIC DEFAULT 0.0,
  notification_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create watchlists table
CREATE TABLE IF NOT EXISTS public.watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'team', 'competition', 'market'
  entity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_watchlist_entity UNIQUE (user_id, type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON public.watchlists(user_id);

-- 3. Create signal_events table
CREATE TABLE IF NOT EXISTS public.signal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'NEW_SIGNAL', 'ODDS_MOVEMENT', 'EDGE_CHANGED', 'CONFIDENCE_CHANGED', 'SIGNAL_CLOSED'
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signal_events_signal_id ON public.signal_events(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_events_created_at ON public.signal_events(created_at);
