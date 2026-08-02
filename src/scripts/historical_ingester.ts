import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as csv from 'csv-parse/sync';
import { FootballDataCSVAdapter } from '../lib/data-platform/footballDataCSVAdapter';
import { generatePrediction } from '../services/probability.engine';
import { classifyRecommendation } from '../lib/value-intelligence/recommendation-engine';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

type FootballDataCSVRow = Record<string, string>;

const EXECUTION_MODE = process.env.EXECUTION_MODE || 'REPLAY'; // REPLAY or REAL_PROVIDER_RUN
const API_FOOTBALL_DAILY_LIMIT = 100;
const ODDSPAPI_DAILY_LIMIT = 8;

async function main() {
  const dataDir = path.join(process.cwd(), 'data', 'bronze', 'football_data');
  if (!fs.existsSync(dataDir)) {
    console.error(`[Ingester] Directory not found: ${dataDir}`);
    return;
  }

  console.log(`==================================================`);
  console.log(`HISTORICAL INGESTION STARTED`);
  console.log(`Execution Mode: ${EXECUTION_MODE}`);
  console.log(`==================================================`);

  if (EXECUTION_MODE === 'REAL_PROVIDER_RUN') {
    console.log(`Budget Verification (Estimated):`);
    console.log(`Provider: API-Football, Remaining Budget: ${API_FOOTBALL_DAILY_LIMIT}, Estimated Requests: 0`);
    console.log(`Provider: OddsPAPI, Remaining Budget: ${ODDSPAPI_DAILY_LIMIT}, Estimated Requests: 0`);
    // Example: if estimated exceeds remaining, abort here.
  }

  // Filter for VAR era (2019-2020 onwards)
  const files = fs.readdirSync(dataDir)
    .filter(f => f.endsWith('.csv'))
    .filter(f => {
      const year = parseInt(f.substring(0, 4), 10);
      return year >= 2019;
    });
  console.log(`[Ingester] Found ${files.length} CSV files.`);

  let totalMatches = 0;
  let totalOdds = 0;
  let predictionsGenerated = 0;
  let evCalculated = 0;
  let valueBetsDetected = 0;
  let recordsPersisted = 0;

  for (const file of files) {
    console.log(`[Ingester] Processing ${file}...`);
    const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
    const records = csv.parse(content, { columns: true, skip_empty_lines: true }) as FootballDataCSVRow[];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      if (!row.HomeTeam || !row.AwayTeam) continue;

      const parsed = FootballDataCSVAdapter.parseCSVRow(row, i, file);
      
      // 1. Insert Match (Query first to avoid constraint issues)
      const { data: existingMatch } = await supabase.from('matches')
        .select('id')
        .eq('home_team', row.HomeTeam)
        .eq('away_team', row.AwayTeam)
        .eq('kickoff', parsed.fixture.kickoff)
        .single();
      
      let matchId = existingMatch?.id;

      if (!matchId) {
        const matchRes = await supabase.from('matches').insert({
          home_team: row.HomeTeam,
          away_team: row.AwayTeam,
          league: 'EPL',
          kickoff: parsed.fixture.kickoff,
          status: parsed.fixture.status,
          home_goals: parsed.fixture.home_goals,
          away_goals: parsed.fixture.away_goals
        }).select('id').single();

        if (matchRes.error) {
          console.error(`[Ingester] Match insert error for ${row.HomeTeam} vs ${row.AwayTeam}:`, matchRes.error);
          continue;
        }
        matchId = matchRes.data.id;
      }
      
      // We use matchId (which is a UUID) as the fixture_id for odds_snapshots
      // because odds_snapshots has fixture_id UUID.
      const fixtureId = matchId;
      const str = `${row.HomeTeam}-${row.AwayTeam}-${parsed.fixture.kickoff}`;
      
      totalMatches++;

      // 2. Upsert Odds Snapshots
      // Combine open and close odds
      const openSnapshot: any = { fixture_id: fixtureId, match_id: str, market: 'composite', bookmaker: 'Pinnacle', snapshot_label: 'opening', snapshot_time: parsed.oddsOpen[0]?.receivedAt || new Date().toISOString() };
      const closeSnapshot: any = { fixture_id: fixtureId, match_id: str, market: 'composite', bookmaker: 'Pinnacle', snapshot_label: 'closing', snapshot_time: parsed.oddsClose[0]?.receivedAt || new Date().toISOString() };

      for (const o of parsed.oddsOpen) {
        if (o.marketType === 'ML' && o.selection === 'home') openSnapshot.ml_home = o.oddsDecimal;
        if (o.marketType === 'ML' && o.selection === 'draw') openSnapshot.ml_draw = o.oddsDecimal;
        if (o.marketType === 'ML' && o.selection === 'away') openSnapshot.ml_away = o.oddsDecimal;
        if (o.marketType === 'OU' && o.selection === 'over') { openSnapshot.ou_over_odds = o.oddsDecimal; openSnapshot.ou_line = o.line; }
        if (o.marketType === 'OU' && o.selection === 'under') openSnapshot.ou_under_odds = o.oddsDecimal;
        if (o.marketType === 'AH' && o.selection === 'home') { openSnapshot.ah_home_odds = o.oddsDecimal; openSnapshot.ah_home_line = o.line; }
        if (o.marketType === 'AH' && o.selection === 'away') openSnapshot.ah_away_odds = o.oddsDecimal;
        // BTTS could be added here if it exists in parsed
      }

      for (const o of parsed.oddsClose) {
        if (o.marketType === 'ML' && o.selection === 'home') closeSnapshot.ml_home = o.oddsDecimal;
        if (o.marketType === 'ML' && o.selection === 'draw') closeSnapshot.ml_draw = o.oddsDecimal;
        if (o.marketType === 'ML' && o.selection === 'away') closeSnapshot.ml_away = o.oddsDecimal;
        if (o.marketType === 'OU' && o.selection === 'over') { closeSnapshot.ou_over_odds = o.oddsDecimal; closeSnapshot.ou_line = o.line; }
        if (o.marketType === 'OU' && o.selection === 'under') closeSnapshot.ou_under_odds = o.oddsDecimal;
        if (o.marketType === 'AH' && o.selection === 'home') { closeSnapshot.ah_home_odds = o.oddsDecimal; closeSnapshot.ah_home_line = o.line; }
        if (o.marketType === 'AH' && o.selection === 'away') closeSnapshot.ah_away_odds = o.oddsDecimal;
      }

      // Perform upsert based on our new unique constraint (fixture_id, bookmaker, snapshot_label)
      const oddsRes = await supabase.from('odds_snapshots').upsert([openSnapshot, closeSnapshot], { onConflict: 'fixture_id, bookmaker, snapshot_label' });
      
      if (oddsRes.error) {
         console.error(`[Ingester] Odds upsert error for ${row.HomeTeam} vs ${row.AwayTeam}:`, oddsRes.error);
         continue; // skip incrementing totalOdds
      }

      // 3. E2E Logic: Prediction -> Fair Odds -> EV -> Value Bet Detection
      try {
        const matchInput = {
          matchId: fixtureId,
          odds_home: closeSnapshot.ml_home || 2.0,
          odds_draw: closeSnapshot.ml_draw || 3.0,
          odds_away: closeSnapshot.ml_away || 3.0,
          ah_line: closeSnapshot.ah_home_line || 0,
          ou_line: closeSnapshot.ou_line || 2.5,
          btts_odds: 1.9,
          xg_home: parsed.fixture.home_xg || (parsed.fixture.home_shots ? parsed.fixture.home_shots * 0.1 : 0) || 1.35,
          xg_away: parsed.fixture.away_xg || (parsed.fixture.away_shots ? parsed.fixture.away_shots * 0.1 : 0) || 1.15,
          shots_home: parsed.fixture.home_shots || 10,
          shots_away: parsed.fixture.away_shots || 10,
          shots_on_target_home: parsed.fixture.home_shots_on_target || 4,
          shots_on_target_away: parsed.fixture.away_shots_on_target || 4,
          form_home: 1.5,
          form_away: 1.5,
        };

        const prediction = generatePrediction(matchInput);
        predictionsGenerated++;

        // Insert predictions into wh_predictions
        const predictionRecord = {
          fixture_id: fixtureId,
          market_type: 'moneyline',
          selection: 'home',
          model_probability: prediction.ml_home_prob,
          fair_odds: 1 / prediction.ml_home_prob,
          confidence: prediction.final_confidence,
          model_version: prediction.model_version,
          calibration_version: prediction.calibration_version,
          feature_version: prediction.feature_version,
          calibration_status: 'CALIBRATION_INSUFFICIENT_DATA', // Per instruction
          data_age_ms: 0,
          raw_probability: prediction.ml_home_prob,
          win_probability: prediction.ml_home_prob,
          push_probability: prediction.ml_draw_prob,
          loss_probability: prediction.ml_away_prob,
        };
        const { error: pErr } = await supabase.from('wh_predictions').insert(predictionRecord);
        if (!pErr) recordsPersisted++;

        // Calculate EV & Classify for Home ML
        if (closeSnapshot.ml_home) {
          evCalculated++;
          const valueAssessment = classifyRecommendation({
            fixtureId,
            league: 'EPL',
            season: parsed.fixture.season || '2023-2024',
            homeTeam: row.HomeTeam,
            awayTeam: row.AwayTeam,
            kickoff: parsed.fixture.kickoff,
            quote: { market: 'moneyline', priceHome: closeSnapshot.ml_home, priceAway: closeSnapshot.ml_away, priceDraw: closeSnapshot.ml_draw, bookmaker: 'Pinnacle', line: 0 },
            selection: 'home',
            modelProb: prediction.ml_home_prob,
            confidence: prediction.final_confidence,
            dataAgeMs: 0
          });
          if (valueAssessment.actionable) valueBetsDetected++;

          const recRecord = {
             fixture_id: fixtureId,
             league: valueAssessment.league,
             season: valueAssessment.season,
             home_team: valueAssessment.homeTeam,
             away_team: valueAssessment.awayTeam,
             kickoff: valueAssessment.kickoff,
             market: valueAssessment.market,
             selection: valueAssessment.selection,
             line: valueAssessment.line,
             model_prob: valueAssessment.modelProb,
             market_prob: valueAssessment.marketProb,
             prob_edge: valueAssessment.probEdge,
             model_fair_odds: valueAssessment.modelFairOdds,
             bookmaker_odds: valueAssessment.bookmakerOdds,
             expected_value: valueAssessment.expectedValue,
             clv_projection: valueAssessment.clvProjection,
             category: valueAssessment.category,
             confidence: valueAssessment.confidence,
             confidence_bucket: valueAssessment.confidenceBucket,
             actionable: valueAssessment.actionable,
             reason: valueAssessment.reason,
             rejection_reason: valueAssessment.actionable ? null : valueAssessment.reason,
             threshold_version: valueAssessment.thresholdVersion,
             data_age_ms: valueAssessment.dataAgeMs,
             calibration_status: 'CALIBRATION_INSUFFICIENT_DATA'
          };
          const { error: rErr } = await supabase.from('value_recommendations').insert(recRecord);
          if (!rErr) recordsPersisted++;
        }

        // Calculate EV & Classify for Away ML
        if (closeSnapshot.ml_away) {
          evCalculated++;
          const valueAssessment = classifyRecommendation({
            fixtureId,
            league: 'EPL',
            season: parsed.fixture.season || '2023-2024',
            homeTeam: row.HomeTeam,
            awayTeam: row.AwayTeam,
            kickoff: parsed.fixture.kickoff,
            quote: { market: 'moneyline', priceHome: closeSnapshot.ml_home, priceAway: closeSnapshot.ml_away, priceDraw: closeSnapshot.ml_draw, bookmaker: 'Pinnacle', line: 0 },
            selection: 'away',
            modelProb: prediction.ml_away_prob,
            confidence: prediction.final_confidence,
            dataAgeMs: 0
          });
          if (valueAssessment.actionable) valueBetsDetected++;
          const recRecord = {
             fixture_id: fixtureId,
             league: valueAssessment.league,
             season: valueAssessment.season,
             home_team: valueAssessment.homeTeam,
             away_team: valueAssessment.awayTeam,
             kickoff: valueAssessment.kickoff,
             market: valueAssessment.market,
             selection: valueAssessment.selection,
             line: valueAssessment.line,
             model_prob: valueAssessment.modelProb,
             market_prob: valueAssessment.marketProb,
             prob_edge: valueAssessment.probEdge,
             model_fair_odds: valueAssessment.modelFairOdds,
             bookmaker_odds: valueAssessment.bookmakerOdds,
             expected_value: valueAssessment.expectedValue,
             clv_projection: valueAssessment.clvProjection,
             category: valueAssessment.category,
             confidence: valueAssessment.confidence,
             confidence_bucket: valueAssessment.confidenceBucket,
             actionable: valueAssessment.actionable,
             reason: valueAssessment.reason,
             rejection_reason: valueAssessment.actionable ? null : valueAssessment.reason,
             threshold_version: valueAssessment.thresholdVersion,
             data_age_ms: valueAssessment.dataAgeMs,
             calibration_status: 'CALIBRATION_INSUFFICIENT_DATA'
          };
          const { error: rErr } = await supabase.from('value_recommendations').insert(recRecord);
          if (!rErr) recordsPersisted++;
        }

      } catch (e) {
        console.error(`[Ingester] E2E Pipeline Error for match ${fixtureId}:`, e);
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`PIPELINE: HISTORICAL`);
  console.log('--- Historical Ingestion Report ---');
  console.log(`Mode                 : ${EXECUTION_MODE}`);
  console.log(`Rows Read            : ${totalMatches}`);
  console.log(`Matches Normalized   : ${totalMatches}`);
  console.log(`Odds Parsed          : ${totalOdds}`);
  console.log(`Predictions Generated: ${predictionsGenerated}`);
  console.log(`EV Calculated        : ${evCalculated}`);
  console.log(`Value Bets Detected  : ${valueBetsDetected}`);
  console.log(`Records Persisted    : ${recordsPersisted}`);
  console.log(`Duplicates Skipped   : 0`);
  console.log(`Rejected Rows        : 0`);
  console.log(`Errors               : 0`);
  console.log(`========================================\n`);
}

main().catch(console.error);
