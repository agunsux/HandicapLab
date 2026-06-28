-- Create signal_performance_attribution table
CREATE TABLE IF NOT EXISTS public.signal_performance_attribution (
    signal_id UUID PRIMARY KEY REFERENCES public.signals(id) ON DELETE CASCADE,
    competition TEXT NOT NULL,
    market_type TEXT NOT NULL,
    confidence_bucket TEXT NOT NULL,
    odds_range TEXT NOT NULL,
    bookmaker TEXT NOT NULL,
    is_win BOOLEAN DEFAULT FALSE,
    is_loss BOOLEAN DEFAULT FALSE,
    roi NUMERIC DEFAULT 0.0,
    clv NUMERIC DEFAULT 0.0,
    edge NUMERIC DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create model_calibration_history table
CREATE TABLE IF NOT EXISTS public.model_calibration_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE,
    model_probability NUMERIC NOT NULL,
    actual_result NUMERIC NOT NULL, -- 1.0 = win, 0.0 = loss, 0.5 = push
    calibration_error NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extend leagues_cache table with quality_score
ALTER TABLE public.leagues_cache 
ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 75;
