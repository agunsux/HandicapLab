-- Migration: Forensic Reports Engine Schema
-- Sequence number: 00000000000023

CREATE TABLE IF NOT EXISTS public.forensic_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly'
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  signals_analyzed INTEGER DEFAULT 0,
  bets_taken INTEGER DEFAULT 0,
  skips INTEGER DEFAULT 0,
  roi_units NUMERIC DEFAULT 0.0,
  avg_clv NUMERIC DEFAULT 0.0,
  sample_size INTEGER DEFAULT 0,
  forensic_score NUMERIC DEFAULT 0.0,
  generated_content JSONB DEFAULT '{}'::jsonb, -- Store draft contents for Twitter, Reddit, Telegram
  status VARCHAR(20) DEFAULT 'DRAFT', -- 'DRAFT', 'APPROVED', 'PUBLISHED'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.forensic_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Forensic reports are viewable by everyone" ON public.forensic_reports;
CREATE POLICY "Forensic reports are viewable by everyone" ON public.forensic_reports FOR SELECT USING (true);
