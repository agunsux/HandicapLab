// CLI: real ML/AH/OU market-observation layer + coverage matrix.
// Builds data/golden/europe/market_odds.jsonl (+ manifest) from the frozen
// dataset's source files. Does NOT touch canonical_matches.jsonl / manifest.json.
// Location: src/historical/europe/oddsRun.ts

import { buildMarketOddsDataset } from './marketOdds';

function main() {
  const m = buildMarketOddsDataset();
  console.log('==========================================================');
  console.log('  HISTORICAL ML/AH/OU MARKET LAYER — europe-dataset-v1');
  console.log('==========================================================');
  console.log(`dataset_version:      ${m.dataset_version}`);
  console.log(`ingestion_version:    ${m.ingestion_version}`);
  console.log(`odds rows:            ${m.odds_row_count}`);
  console.log(`by market:            ML=${m.by_market.ML}  AH=${m.by_market.AH}  OU=${m.by_market.OU}`);
  console.log(`hash (sha256):        ${m.hash.slice(0, 24)}…`);
  console.log('');
  console.log('## MARKET COVERAGE MATRIX');
  console.log('| League | Matches | ML rows | ML cov% | AH rows | AH cov% | OU rows | OU cov% |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const l of m.by_league) {
    console.log(`| ${l.leagueId} | ${l.matches} | ${l.ml_rows} | ${l.ml_coverage_pct} | ${l.ah_rows} | ${l.ah_coverage_pct} | ${l.ou_rows} | ${l.ou_coverage_pct} |`);
  }
  console.log('');
  console.log('Output: data/golden/europe/market_odds.jsonl + market_odds_manifest.json');
}

main();
