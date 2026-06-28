// src/scripts/pre_migration_stage_audit.ts
/**
 * Pre‑migration validation: audit coverage of `tournament_stage` values in the
 * production `matches` table.
 *
 * The script fetches all `tournament_stage` values (up to a sensible limit) and
 * prints a grouped count ordered alphabetically.
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Fetch in batches to avoid hitting row limits.
  const batchSize = 5000;
  let from = 0;
  let allStages: string[] = [];
  while (true) {
    const { data, error } = await supabase
      .from('matches')
      .select('tournament_stage')
      .range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allStages.push(...data.map((row: any) => row.tournament_stage ?? 'NULL'));
    if (data.length < batchSize) break; // last batch
    from += batchSize;
  }

  const counts: Record<string, number> = {};
  for (const stage of allStages) {
    counts[stage] = (counts[stage] || 0) + 1;
  }

  const ordered = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  console.log('Stage coverage audit:');
  for (const [stage, cnt] of ordered) {
    console.log(`${stage}\t${cnt}`);
  }
}

main().catch(err => {
  console.error('Audit script error:', err);
  process.exit(1);
});
