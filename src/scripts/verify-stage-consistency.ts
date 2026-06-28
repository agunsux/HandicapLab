// src/scripts/verify-stage-consistency.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { normalizeTournamentStage } from '@/lib/utils/stageNormalization';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Set of known canonical values after normalisation
const canonicalSet = new Set([
  'Group Stage',
  'Playoffs',
  'Round of 32',
  'Round of 16',
  'Quarter-finals',
  'Semi-finals',
  'Final',
]);

function isRegularSeason(stage: string | null | undefined): boolean {
  return !!stage && /^Regular Season - \d+$/.test(stage.trim());
}

async function main() {
  const batchSize = 5000;
  let from = 0;
  let totalRows = 0;
  let canonicalRows = 0;
  let needsUpdateRows = 0;
  let unknownRows = 0;
  let nullRows = 0;
  const mismatchMap: Record<string, { expected: string; count: number }> = {};

  while (true) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, tournament_stage')
      .range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      totalRows++;
      const raw = (row as any).tournament_stage as string | null;

      if (raw === null) {
        nullRows++;
        continue;
      }

      if (isRegularSeason(raw)) {
        canonicalRows++;
        continue;
      }

      const normalized = normalizeTournamentStage(raw);

      if (normalized === raw) {
        if (canonicalSet.has(raw)) {
          canonicalRows++;
        } else {
          unknownRows++;
        }
        continue;
      }

      // Normalisation would change the value – needs update
      needsUpdateRows++;
      if (!mismatchMap[raw]) {
        mismatchMap[raw] = { expected: normalized, count: 0 };
      }
      mismatchMap[raw].count++;
    }

    if (data.length < batchSize) break;
    from += batchSize;
  }

  console.log('=== Canonical compliance report ===');
  console.log(`Total rows scanned          : ${totalRows}`);
  console.log(`Canonical rows (already OK): ${canonicalRows}`);
  console.log(`Rows needing update        : ${needsUpdateRows}`);
  console.log(`Unknown / unmapped rows    : ${unknownRows}`);
  console.log(`NULL stage rows            : ${nullRows}`);

  if (needsUpdateRows > 0) {
    console.log('\n--- Rows requiring normalisation (original -> expected) ---');
    for (const [orig, info] of Object.entries(mismatchMap)) {
      console.log(`${orig} -> ${info.expected}\tcount: ${info.count}`);
    }
  }

  if (unknownRows > 0) {
    console.error('\n❌ Unknown stage values detected. Migration should not run until they are addressed.');
    process.exit(1);
  }

  console.log('\n✅ Verification completed successfully.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Verification script error:', e);
  process.exit(1);
});
