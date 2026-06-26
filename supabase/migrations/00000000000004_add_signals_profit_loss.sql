-- Migration: Add profit_loss column to signals table
-- Sequence number: 00000000000004

ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS profit_loss NUMERIC;
