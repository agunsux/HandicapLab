import { loadEnvConfig } from '@next/env';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Force load .env.local with override so placeholder envs don't mask real keys
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
loadEnvConfig(process.cwd());

import { BttsLivePipelineService } from '../src/lib/pipeline/bttsLivePipelineService';

async function main() {
  console.log('============================================================');
  console.log('EXECUTING BTTS LIVE PRODUCTION PIPELINE');
  console.log('THREE-PROVIDER STACK: API-Football + Dribble360 + OddsPAPI');
  console.log('============================================================');

  const result = await BttsLivePipelineService.executePipeline({ maxOddsFixturesToProbe: 12 });

  console.log('\n==================================================');
  console.log('BTTS LIVE PIPELINE — EXECUTIVE SUMMARY');
  console.log('==================================================');
  console.log(`PIPELINE STATUS:        ${result.pipelineStatus}`);
  console.log(`API-FOOTBALL:           ${result.providers.apiFootball.auth}`);
  console.log(`DRIBBLE:                ${result.providers.dribble.auth}`);
  console.log(`ODDSPAPI:               ${result.providers.oddsPapi.auth}`);
  console.log(`REAL FIXTURES:          ${result.counts.fixturesDiscovered}`);
  console.log(`CANONICAL FIXTURES:     ${result.counts.fixturesCanonicalized}`);
  console.log(`PROBED FIXTURES:        ${result.counts.fixturesMatchedOdds}`);
  console.log(`BTTS ODDS:              ${result.counts.bttsOddsTotal}`);
  console.log(`PINNACLE BTTS:          ${result.counts.pinnacleBttsTotal}`);
  console.log(`SBOBET BTTS:            ${result.counts.sbobetBttsTotal}`);
  console.log(`PREDICTIONS GENERATED:  ${result.counts.predictionsGenerated}`);
  console.log(`VALUE BETS:             ${result.counts.valueBets}`);
  console.log(`HIGH CONFIDENCE:        ${result.counts.highConfidence}`);
  console.log(`MEDIUM:                 ${result.counts.medium}`);
  console.log(`LOW:                    ${result.counts.low}`);
  console.log(`NO VALUE:               ${result.counts.noValue}`);
  console.log(`DATA UNAVAILABLE:       ${result.counts.dataUnavailable}`);
  console.log(`SALMO SYNC:             ${result.salmoSync.status} (${result.salmoSync.syncedCount} synced)`);

  console.log('\n==================================================');
  console.log('TOP BTTS PREDICTIONS (REAL DATA ONLY)');
  console.log('==================================================');
  if (result.topPredictions.length === 0) {
    console.log('No positive-EV BTTS predictions found exceeding value threshold for this batch.');
  } else {
    result.topPredictions.forEach((p, idx) => {
      console.log(`\n#${idx + 1}`);
      console.log(`League:            ${p.competition}`);
      console.log(`Kickoff:           ${p.kickoffUtc}`);
      console.log(`Fixture:           ${p.match}`);
      console.log(`Market:            BTTS (${p.selection})`);
      console.log(`Odds:              ${p.odds.toFixed(3)} (${p.bookmaker})`);
      console.log(`Model probability: ${(p.modelProbability * 100).toFixed(1)}%`);
      console.log(`Fair odds:         ${p.fairOdds.toFixed(3)}`);
      console.log(`Edge:              ${(p.edge * 100).toFixed(1)}%`);
      console.log(`EV:                ${(p.ev * 100).toFixed(1)}%`);
      console.log(`Confidence:        ${p.confidence}`);
      console.log(`Data timestamp:    ${p.provenance.predictionCreatedAt}`);
      console.log(`CLV:               ${p.clvStatus}`);
    });
  }

  console.log('\n==================================================');
  console.log('COUNT RECONCILIATION AUDIT');
  console.log('==================================================');
  const sumCount = result.counts.valueBets + result.counts.noValue + result.counts.dataUnavailable;
  console.log(`Total Generated:        ${result.counts.predictionsGenerated}`);
  console.log(`Sum of Categories:      ${sumCount} (${result.counts.valueBets} + ${result.counts.noValue} + ${result.counts.dataUnavailable})`);
  console.log(`Reconciliation Match:   ${result.counts.predictionsGenerated === sumCount ? 'PASS' : 'FAIL'}`);
  console.log(`Today (T+0):            ${result.counts.todayPredictions}`);
  console.log(`Upcoming 7D (T+1..T+7): ${result.counts.upcoming7dPredictions}`);
}

main().catch(console.error);
