-- =============================================================================
-- MIGRATION 00000000000042: MASTER RESEARCH & PPP ARCHITECTURE
-- HandicapLab v2 Quantitative Research Institute & Shinerva Global PPP Platform
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. MODEL RELEASES & RESEARCH PROVENANCE REGISTRY
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_tag VARCHAR(32) NOT NULL UNIQUE, -- e.g. 'Poisson-v1.2-cal'
    git_commit_hash VARCHAR(40) NOT NULL,
    brier_score NUMERIC(6, 4) NOT NULL,
    ece_score NUMERIC(6, 4) NOT NULL,
    training_window_start TIMESTAMPTZ NOT NULL,
    training_window_end TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure Prediction DOI and Research Notes Columns in prediction_ledger
ALTER TABLE public.prediction_ledger
    ADD COLUMN IF NOT EXISTS doi_id VARCHAR(64) UNIQUE,
    ADD COLUMN IF NOT EXISTS ci_lower NUMERIC(5, 4),
    ADD COLUMN IF NOT EXISTS ci_upper NUMERIC(5, 4),
    ADD COLUMN IF NOT EXISTS fair_odds NUMERIC(8, 3),
    ADD COLUMN IF NOT EXISTS recommended_stake_kelly NUMERIC(5, 4),
    ADD COLUMN IF NOT EXISTS xg_home NUMERIC(4, 2),
    ADD COLUMN IF NOT EXISTS xg_away NUMERIC(4, 2),
    ADD COLUMN IF NOT EXISTS dixon_coles_rho NUMERIC(5, 4),
    ADD COLUMN IF NOT EXISTS elo_home_shift NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS elo_away_shift NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS home_advantage_index NUMERIC(4, 2),
    ADD COLUMN IF NOT EXISTS sha256_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS ecdsa_signature TEXT;

CREATE INDEX IF NOT EXISTS idx_prediction_ledger_doi ON public.prediction_ledger(doi_id);

-- -----------------------------------------------------------------------------
-- 2. SHINERVA PPP PRICING REGIONS & COUNTRY CONFIDENCE ENGINE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_regions (
    country_code VARCHAR(2) PRIMARY KEY, -- ISO 3166-1 alpha-2 (e.g., 'ID', 'US')
    country_name VARCHAR(64) NOT NULL,
    currency_code VARCHAR(3) NOT NULL, -- e.g., 'IDR', 'USD'
    ppp_discount_factor NUMERIC(4, 2) NOT NULL DEFAULT 1.00, -- e.g., 0.35 for 65% discount
    is_ppp_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Baseline PPP Pricing Regions
INSERT INTO public.pricing_regions (country_code, country_name, currency_code, ppp_discount_factor, is_ppp_enabled)
VALUES 
    ('US', 'United States', 'USD', 1.00, true),
    ('GB', 'United Kingdom', 'GBP', 1.00, true),
    ('ID', 'Indonesia', 'IDR', 0.35, true),
    ('IN', 'India', 'INR', 0.30, true),
    ('BR', 'Brazil', 'BRL', 0.40, true),
    ('NG', 'Nigeria', 'NGN', 0.25, true),
    ('SG', 'Singapore', 'SGD', 1.00, true)
ON CONFLICT (country_code) DO UPDATE 
SET ppp_discount_factor = EXCLUDED.ppp_discount_factor;

-- Country Confidence Audit Log
CREATE TABLE IF NOT EXISTS public.country_confidence_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    evaluated_country VARCHAR(2) REFERENCES public.pricing_regions(country_code),
    confidence_score INT NOT NULL, -- 0 to 100
    decision_tier VARCHAR(16) NOT NULL, -- 'HIGH_PPP', 'MEDIUM_CHALLENGE', 'LOW_GLOBAL'
    ip_address INET,
    ip_country VARCHAR(2),
    is_vpn_detected BOOLEAN DEFAULT false,
    is_datacenter_asn BOOLEAN DEFAULT false,
    card_bin_country VARCHAR(2),
    payment_issuer_country VARCHAR(2),
    browser_locale VARCHAR(16),
    timezone_name VARCHAR(64),
    signal_breakdown JSONB NOT NULL,
    evaluated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_confidence_audits_user ON public.country_confidence_audits(user_id);
CREATE INDEX IF NOT EXISTS idx_confidence_audits_score ON public.country_confidence_audits(confidence_score);

-- -----------------------------------------------------------------------------
-- 3. RLS & GOVERNANCE POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.country_confidence_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_regions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to pricing regions
CREATE POLICY "Public read pricing regions" ON public.pricing_regions
    FOR SELECT USING (true);

-- Allow authenticated user to read own country confidence audit
CREATE POLICY "Users read own confidence audit" ON public.country_confidence_audits
    FOR SELECT USING (auth.uid() = user_id);
