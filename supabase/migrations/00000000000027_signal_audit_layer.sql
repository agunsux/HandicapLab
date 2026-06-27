-- Migration: Signal Audit Layer & Observability Integration
-- Sequence number: 00000000000027

-- 1. Ensure required columns exist on signals table (non-destructive)
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS opening_line NUMERIC;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS closing_line NUMERIC;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS opening_odds NUMERIC;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS closing_odds NUMERIC;

-- 2. Alter odds_history to support signal association and metadata
ALTER TABLE public.odds_history ADD COLUMN IF NOT EXISTS signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE;
ALTER TABLE public.odds_history ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'pinnacle';
ALTER TABLE public.odds_history ADD COLUMN IF NOT EXISTS line NUMERIC;
ALTER TABLE public.odds_history ADD COLUMN IF NOT EXISTS odds NUMERIC;

-- 3. Create indexes on odds_history for fast performance and lookups
CREATE INDEX IF NOT EXISTS idx_odds_history_recorded_at ON public.odds_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_odds_history_signal_id ON public.odds_history(signal_id);

-- 4. Create signal_audit_events table
CREATE TABLE IF NOT EXISTS public.signal_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast audit queries
CREATE INDEX IF NOT EXISTS idx_signal_audit_events_signal_id ON public.signal_audit_events(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_audit_events_created_at ON public.signal_audit_events(created_at);

-- 5. Define trigger to prevent updates and deletions on signal_audit_events
CREATE OR REPLACE FUNCTION public.prevent_audit_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit history is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_audit_update_delete
BEFORE UPDATE OR DELETE ON public.signal_audit_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_update_delete();
