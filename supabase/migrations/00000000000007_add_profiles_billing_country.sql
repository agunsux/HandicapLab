-- Migration: Add country columns to profiles table
-- Sequence number: 00000000000007

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_country TEXT;
