// SALMO research CLI — build the football-data.co.uk market metadata table.
// Location: scripts/research/football-data-market-meta.ts
//
// RESEARCH-ONLY. Reads the frozen gold odds layer read-only and writes enriched
// artifacts into the isolated research namespace (data/research/football_data/).
//
//   npx tsx scripts/research/football-data-market-meta.ts [--eligible-only]

import { buildResearchMarketMeta } from '../../src/research/football-data/marketMeta';
import { RESEARCH_ROOT, repoRelative } from '../../src/research/football-data/researchPaths';

async function main(): Promise<void> {
  const eligibleOnly = process.argv.includes('--eligible-only');

  console.log('=== SALMO research: football-data.co.uk market metadata ===');
  console.log(`research root : ${repoRelative(RESEARCH_ROOT)}`);
  console.log(`mode          : ${eligibleOnly ? 'CLV-eligible rows only' : 'full audit trail'}`);
  console.log('');

  const started = Date.now();
  const { records, summary } = await buildResearchMarketMeta({
    write: true,
    includeIneligible: !eligibleOnly,
  });
  const elapsed = ((Date.now() - started) / 1000).toFixed(2);

  console.log(`rows emitted        : ${records.length}`);
  console.log(`CLV-eligible rows   : ${summary.clv_eligible_rows}`);
  console.log(`vetoed rows         : ${summary.vetoed_rows}`);
  console.log(`elapsed             : ${elapsed}s`);
  console.log('');

  console.log('veto reasons:');
  for (const v of summary.vetoReasons) console.log(`  ${v.reason.padEnd(28)} ${String(v.rows).padStart(8)}`);
  console.log('');

  console.log('market / snapshot breakdown:');
  console.log(`  ${'market'.padEnd(6)} ${'snapshot'.padEnd(9)} ${'rows'.padStart(8)} ${'eligible'.padStart(9)} ${'margin'.padStart(8)}`);
  for (const m of summary.byMarket) {
    const margin = m.meanOverround === null ? '-' : `${(m.meanOverround * 100).toFixed(3)}%`;
    console.log(
      `  ${m.market.padEnd(6)} ${m.snapshot.padEnd(9)} ${String(m.rows).padStart(8)} ${String(m.clv_eligible).padStart(9)} ${margin.padStart(8)}`
    );
  }
  console.log('');

  console.log('line-type breakdown:');
  for (const l of summary.byLineType) console.log(`  ${l.lineType.padEnd(12)} ${String(l.rows).padStart(8)}`);
  console.log('');

  console.log(`artifacts: ${repoRelative(RESEARCH_ROOT)}\\MARKET_METADATA.jsonl`);
  console.log(`           ${repoRelative(RESEARCH_ROOT)}\\MARKET_METADATA_SUMMARY.json`);
}

main().catch((err) => {
  console.error('[research:fd:meta] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
