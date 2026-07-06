-- Migration: public.league_agnostic_hardening
-- Location: supabase/migrations/00000000000027_league_agnostic_hardening.sql

-- 1. Create Countries Table
CREATE TABLE IF NOT EXISTS public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  code VARCHAR(10) UNIQUE,
  confederation VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Countries are viewable by everyone" ON public.countries FOR SELECT USING (true);

-- 2. Create Competitions Table
CREATE TABLE IF NOT EXISTS public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) UNIQUE NOT NULL,
  slug VARCHAR(150) UNIQUE NOT NULL,
  country_id UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  tier INTEGER DEFAULT 1,
  type VARCHAR(50) CHECK (type IN ('club', 'international')),
  external_api_id INTEGER UNIQUE, -- api-football league ID
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Competitions are viewable by everyone" ON public.competitions FOR SELECT USING (true);

-- 3. Create Seasons Table
CREATE TABLE IF NOT EXISTS public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL, -- e.g. '2024-2025'
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_competition_season UNIQUE (competition_id, name)
);
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seasons are viewable by everyone" ON public.seasons FOR SELECT USING (true);

-- 4. Create Bookmakers Table
CREATE TABLE IF NOT EXISTS public.bookmakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(50) CHECK (type IN ('sharp', 'soft', 'exchange')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.bookmakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bookmakers are viewable by everyone" ON public.bookmakers FOR SELECT USING (true);

-- 5. Standardize Matches Table with new foreign keys
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS competition_ref_id UUID REFERENCES public.competitions(id) ON DELETE SET NULL;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS season_ref_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL;

-- 6. Seed default lookup values
INSERT INTO public.countries (name, code, confederation) VALUES
  ('England', 'ENG', 'UEFA'),
  ('Spain', 'ESP', 'UEFA'),
  ('Germany', 'GER', 'UEFA'),
  ('France', 'FRA', 'UEFA'),
  ('Italy', 'ITA', 'UEFA'),
  ('World', 'WLD', 'FIFA'),
  ('Europe', 'EUR', 'UEFA')
ON CONFLICT (name) DO UPDATE SET code = EXCLUDED.code;

-- Seed default competitions (retrieving country references)
DO $$
DECLARE
  eng_id UUID;
  esp_id UUID;
  ger_id UUID;
  fra_id UUID;
  ita_id UUID;
  wld_id UUID;
  eur_id UUID;
BEGIN
  SELECT id INTO eng_id FROM public.countries WHERE name = 'England';
  SELECT id INTO esp_id FROM public.countries WHERE name = 'Spain';
  SELECT id INTO ger_id FROM public.countries WHERE name = 'Germany';
  SELECT id INTO fra_id FROM public.countries WHERE name = 'France';
  SELECT id INTO ita_id FROM public.countries WHERE name = 'Italy';
  SELECT id INTO wld_id FROM public.countries WHERE name = 'World';
  SELECT id INTO eur_id FROM public.countries WHERE name = 'Europe';

  INSERT INTO public.competitions (name, slug, country_id, tier, type, external_api_id) VALUES
    ('Premier League', 'premier-league', eng_id, 1, 'club', 39),
    ('La Liga', 'la-liga', esp_id, 1, 'club', 140),
    ('Bundesliga', 'bundesliga', ger_id, 1, 'club', 78),
    ('Serie A', 'serie-a', ita_id, 1, 'club', 135),
    ('Ligue 1', 'ligue-1', fra_id, 1, 'club', 61),
    ('FIFA World Cup', 'fifa-world-cup', wld_id, 1, 'international', 1),
    ('UEFA Champions League', 'uefa-champions-league', eur_id, 1, 'club', 2)
  ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug, external_api_id = EXCLUDED.external_api_id;
END $$;

-- Seed default bookmakers
INSERT INTO public.bookmakers (name, type) VALUES
  ('Pinnacle', 'sharp'),
  ('Bet365', 'soft'),
  ('SBOBET', 'sharp'),
  ('Betfair', 'exchange')
ON CONFLICT (name) DO UPDATE SET type = EXCLUDED.type;
