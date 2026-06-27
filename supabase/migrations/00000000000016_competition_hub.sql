-- Competition Hub Schema Migrations
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS competition_type VARCHAR(50) DEFAULT 'league';
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS format VARCHAR(50) DEFAULT 'round_robin';
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS region VARCHAR(100);
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;

-- Future model calibration fields
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS home_advantage NUMERIC;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS season_xg NUMERIC;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS form_weight NUMERIC;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS rotation_risk NUMERIC;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS two_leg_factor NUMERIC;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS aggregate_score NUMERIC;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS neutral_venue BOOLEAN DEFAULT FALSE;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS knockout_pressure NUMERIC;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS fatigue_factor NUMERIC;
