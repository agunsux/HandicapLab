-- Create shadow_predictions table
CREATE TABLE IF NOT EXISTS public.shadow_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  competition TEXT NOT NULL,
  market_type TEXT NOT NULL,
  predicted_pick TEXT NOT NULL,
  predicted_probability NUMERIC NOT NULL,
  predicted_edge NUMERIC NOT NULL,
  odds_at_prediction NUMERIC NOT NULL,
  clv NUMERIC,
  result_status TEXT DEFAULT 'pending', -- 'won', 'lost', 'void', 'pending'
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for speedy queries by fixture and status
CREATE INDEX IF NOT EXISTS idx_shadow_predictions_fixture_id ON public.shadow_predictions(fixture_id);
CREATE INDEX IF NOT EXISTS idx_shadow_predictions_competition ON public.shadow_predictions(competition);
CREATE INDEX IF NOT EXISTS idx_shadow_predictions_result_status ON public.shadow_predictions(result_status);
