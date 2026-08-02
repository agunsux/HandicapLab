ALTER TABLE public.daily_picks ALTER COLUMN fixture_id TYPE UUID USING gen_random_uuid();
