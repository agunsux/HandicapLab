-- Migration: Add provider payment identifiers to subscriptions table
-- Sequence number: 00000000000006

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider_customer_id TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT;
