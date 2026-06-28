// src/scripts/migrate-stage-normalization.ts
/**
 * One‑time migration that normalises the `tournament_stage` column of the `matches`
 * table using the shared `normalizeTournamentStage` utility. Includes a safe
 * backup, idempotence, and rollback on verification failure.
 *
 * NOTE: Uses individual Supabase client calls (insert/update) instead of a
 * raw‑SQL RPC, because no execute_sql function exists in this instance.
 * The backup table must be pre‑created via the Supabase SQL Editor (see below).
 * Strategy and normalization logic are unchanged.
 *
 * Pre‑requisite – run once in Supabase SQL Editor:
 *   CREATE TABLE IF NOT EXISTS matches_stage_backup (
 *     id UUID PRIMARY KEY,
 *     original_stage TEXT NOT NULL,
 *     normalized_stage TEXT NOT NULL,
 *     migrated_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { normalizeTournamentStage } from '@/lib/utils/stageNormalization';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/** Probes for the backup table and its metadata columns; exits with DDL instructions if incorrect. */
async function ensureBackupTable(): Promise<void> {
  const { error } = await supabase
    .from('matches_stage_backup')
    .select('id, backup_reason, backed_up_at')
    .limit(1);

  if (error) {
    console.error('❌ Backup table does not exist or has incorrect columns. Run the following in the Supabase SQL Editor first:\n');
    console.error(`DROP TABLE IF EXISTS matches_stage_backup;

CREATE TABLE matches_stage_backup (LIKE matches INCLUDING ALL);

ALTER TABLE matches_stage_backup ADD COLUMN IF NOT EXISTS backup_reason TEXT;

ALTER TABLE matches_stage_backup ADD COLUMN IF NOT EXISTS backed_up_at TIMESTAMPTZ DEFAULT now();`);
    process.exit(1);
  }

  console.log('✅ Backup table confirmed with required metadata columns.');
}

async function main() {
  console.log('🔎 Ensuring backup table exists…');
  await ensureBackupTable();

  console.log('🔎 Scanning matches table…');
  // Fetch all non‑NULL stage rows (batched to avoid row limits)
  const batchSize = 5000;
  let from = 0;
  const allRows: { id: string; tournament_stage: string }[] = [];
  while (true) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, tournament_stage')
      .not('tournament_stage', 'is', null)
      .range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...(data as { id: string; tournament_stage: string }[]));
    if (data.length < batchSize) break;
    from += batchSize;
  }

  const total = allRows.length;
  console.log(`Total rows scanned: ${total}`);

  const updates: { id: string; oldStage: string; newStage: string }[] = [];
  for (const row of allRows) {
    const oldStage = row.tournament_stage;
    const newStage = normalizeTournamentStage(oldStage);
    if (newStage !== oldStage) {
      updates.push({ id: row.id, oldStage, newStage });
    }
  }

  console.log(`Rows needing update: ${updates.length}`);
  if (updates.length === 0) {
    console.log('✅ No changes required – migration is already idempotent.');
    return;
  }

  // Group by original stage for diagnostic output
  const groups = updates.reduce((acc, cur) => {
    acc[cur.oldStage] = (acc[cur.oldStage] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('Affected rows by previous stage:', groups);

  // Step 1: Fetch full rows of matches to back up
  console.log('🔎 Fetching full match records for backup…');
  const idsToBackup = updates.map(u => u.id);
  const { data: fullMatches, error: fetchErr } = await supabase
    .from('matches')
    .select('*')
    .in('id', idsToBackup);
  
  if (fetchErr) throw fetchErr;
  if (!fullMatches || fullMatches.length === 0) {
    throw new Error('Could not retrieve full records for matches needing update');
  }

  // Step 2: Insert backup rows (ON CONFLICT DO NOTHING = idempotent)
  console.log('💾 Writing full-row backup snapshots…');
  const backupPayload = fullMatches.map(match => ({
    ...match,
    backup_reason: 'stage_normalization',
    backed_up_at: new Date().toISOString(),
  }));
  const { error: backupErr } = await supabase
    .from('matches_stage_backup')
    .upsert(backupPayload, { onConflict: 'id', ignoreDuplicates: true });
  if (backupErr) throw backupErr;
  console.log(`Backup rows written: ${backupPayload.length}`);

  // Step 2: Update matches table
  console.log('🚀 Updating matches…');
  for (const u of updates) {
    const { error: updateErr } = await supabase
      .from('matches')
      .update({ tournament_stage: u.newStage })
      .eq('id', u.id);
    if (updateErr) {
      // Attempt rollback of already‑written rows then abort
      console.error(`❌ Update failed for row ${u.id}. Rolling back…`);
      for (const done of updates) {
        if (done === u) break;
        await supabase
          .from('matches')
          .update({ tournament_stage: done.oldStage })
          .eq('id', done.id);
      }
      throw updateErr;
    }
  }

  // ---------- Verification ----------
  console.log('🔍 Verifying via normalizeTournamentStage on every non‑NULL row…');
  let from2 = 0;
  let stillBad = 0;
  const badRows: { id: string; current: string; expected: string }[] = [];

  while (true) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, tournament_stage')
      .not('tournament_stage', 'is', null)
      .range(from2, from2 + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data as { id: string; tournament_stage: string }[]) {
      const normalized = normalizeTournamentStage(row.tournament_stage);
      const isRegularSeason = /^Regular Season - \d+$/.test(row.tournament_stage.trim());
      if (!isRegularSeason && normalized !== row.tournament_stage) {
        stillBad++;
        badRows.push({ id: row.id, current: row.tournament_stage, expected: normalized });
      }
    }

    if (data.length < batchSize) break;
    from2 += batchSize;
  }

  if (stillBad > 0) {
    console.error(`❌ Verification failed – ${stillBad} non‑canonical rows remain:`);
    console.table(badRows);
    // Rollback via backup table
    console.error('Rolling back all updated rows…');
    for (const u of updates) {
      await supabase
        .from('matches')
        .update({ tournament_stage: u.oldStage })
        .eq('id', u.id);
    }
    console.error('Rollback completed.');
    process.exit(1);
  }

  console.log('✅ Migration successful – all stages are now canonical.');
  console.log(`Rows updated  : ${updates.length}`);
  console.log(`Backup table  : matches_stage_backup (${updates.length} rows)`);
}

main().catch(err => {
  console.error('Migration script error:', err);
  process.exit(1);
});
