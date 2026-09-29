import { loadEnvConfig } from '@next/env';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Force load .env.local with override so [SENSITIVE] placeholders don't mask real keys
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
loadEnvConfig(process.cwd());

import { AhLivePipelineService } from '../src/lib/pipeline/ahLivePipelineService';

async function main() {
  console.log('============================================================');
  console.log('EXECUTING ASIAN HANDICAP LIVE PRODUCTION PIPELINE');
  console.log('THREE-PROVIDER STACK: API-Football + Dribble360 + OddsPAPI');
  console.log('============================================================');

  const result = await AhLivePipelineService.executePipeline({ maxOddsFixturesToProbe: 12 });

  console.log('\n==================================================');
  console.log('ASIAN HANDICAP LIVE PIPELINE — EXECUTIVE SUMMARY');
  console.log('==================================================');
  console.log(`PIPELINE STATUS:        ${result.pipelineStatus}`);
  console.log(`API-FOOTBALL:           ${result.providers.apiFootball.auth}`);
  console.log(`DRIBBLE:                ${result.providers.dribble.auth}`);
  console.log(`ODDSPAPI:               ${result.providers.oddsPapi.auth}`);
  console.log(`REAL FIXTURES:          ${result.counts.fixturesDiscovered}`);
  console.log(`CANONICAL FIXTURES:     ${result.counts.fixturesCanonicalized}`);
  console.log(`AH ODDS:                ${result.counts.ahOddsTotal}`);
  console.log(`PINNACLE AH:            ${result.counts.pinnacleAhTotal}`);
  console.log(`SBOBET AH:              ${result.counts.sbobetAhTotal}`);
  console.log(`PREDICTIONS GENERATED:  ${result.counts.predictionsGenerated}`);
  console.log(`VALUE BETS:             ${result.counts.valueBets}`);
  console.log(`HIGH CONFIDENCE:        ${result.counts.highConfidence}`);
  console.log(`MEDIUM:                 ${result.counts.medium}`);
  console.log(`LOW:                    ${result.counts.low}`);
  console.log(`DATA UNAVAILABLE:       ${result.counts.dataUnavailable}`);
  console.log(`SALMO SYNC:             ${result.salmoSync.status}`);

  console.log('\n==================================================');
  console.log('TOP AH PREDICTIONS (REAL DATA ONLY)');
  console.log('==================================================');
  if (result.topPredictions.length === 0) {
    console.log('No positive-EV predictions found that exceed the value threshold for this batch.');
  } else {
    result.topPredictions.forEach((p, idx) => {
      console.log(`\n#${idx + 1}`);
      console.log(`League:            ${p.competition}`);
      console.log(`Kickoff:           ${p.kickoffUtc}`);
      console.log(`Fixture:           ${p.match}`);
      console.log(`AH line:           ${p.line > 0 ? '+' + p.line : p.line}`);
      console.log(`Side:              ${p.selection}`);
      console.log(`Pinnacle odds:     ${p.odds.toFixed(3)} (${p.bookmaker})`);
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
  console.log('UPCOMING 7 DAYS BREAKDOWN');
  console.log('==================================================');
  console.log(`Total 7-Day AH Predictions: ${result.counts.upcoming7dPredictions}`);
  console.log(`Value Bets:                 ${result.counts.valueBets}`);
  console.log(`No Value:                   ${result.counts.noValue}`);
  console.log(`Data Unavailable:           ${result.counts.dataUnavailable}`);
}

main().catch(console.error);
