-- Migration: Add settled_at column to signals table
-- Sequence number: 00000000000003

ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
