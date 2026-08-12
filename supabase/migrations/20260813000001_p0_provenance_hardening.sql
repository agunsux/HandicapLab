-- Phase 1: Enums
DO $$ BEGIN
    CREATE TYPE source_type_enum AS ENUM ('PROVIDER', 'HISTORICAL', 'SYNTHETIC', 'MANUAL', 'UNKNOWN');
    CREATE TYPE data_status_enum AS ENUM ('ACTIVE', 'QUARANTINED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Phase 2: Add columns to core tables safely
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY['matches', 'predictions', 'prediction_ledger', 'odds', 'market_snapshots', 'match_results', 'paper_trades', 'clv']) 
    LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = t) THEN
            IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = t AND column_name = 'source_type') THEN
                EXECUTE format('ALTER TABLE %I ADD COLUMN source_type source_type_enum DEFAULT ''UNKNOWN'';', t);
            END IF;
            IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = t AND column_name = 'data_status') THEN
                EXECUTE format('ALTER TABLE %I ADD COLUMN data_status data_status_enum DEFAULT ''QUARANTINED'';', t);
            END IF;
        END IF;
    END LOOP;
END $$;

-- Phase 3: Explicitly quarantine synthetic data based on forensic evidence
UPDATE matches 
SET source_type = 'SYNTHETIC', data_status = 'QUARANTINED'
WHERE pipeline_mode = 'LIVE' AND var_era = false AND source_type = 'UNKNOWN';

-- Predictions linked to synthetic matches
UPDATE predictions p
SET source_type = 'SYNTHETIC', data_status = 'QUARANTINED'
FROM matches m
WHERE p.match_id = m.id::text AND m.source_type = 'SYNTHETIC' AND p.source_type = 'UNKNOWN';

-- Orphan predictions (the 1 prediction without a match)
UPDATE predictions 
SET source_type = 'SYNTHETIC', data_status = 'QUARANTINED' 
WHERE match_id IS NULL AND source_type = 'UNKNOWN';

-- Cascade to prediction_ledger
UPDATE prediction_ledger pl
SET source_type = 'SYNTHETIC', data_status = 'QUARANTINED'
FROM matches m
WHERE pl.match_id = m.id::text AND m.source_type = 'SYNTHETIC' AND pl.source_type = 'UNKNOWN';

-- Phase 4: Database-level Write Guards
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY['matches', 'predictions', 'prediction_ledger', 'odds', 'market_snapshots', 'match_results', 'paper_trades', 'clv']) 
    LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = t) THEN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE table_name = t AND constraint_name = format('check_%s_provenance', t)
            ) THEN
                EXECUTE format('
                    ALTER TABLE %I 
                    ADD CONSTRAINT check_%s_provenance 
                    CHECK (
                        (source_type IN (''PROVIDER'', ''HISTORICAL'', ''MANUAL'') AND data_status = ''ACTIVE'') OR
                        (source_type IN (''SYNTHETIC'', ''UNKNOWN'') AND data_status = ''QUARANTINED'')
                    );', t, t);
            END IF;
        END IF;
    END LOOP;
END $$;
