// ============================================================================
// SALMO RESCUE PIPELINE — PREDICTION GENERATOR
// Namespace: src/lib/pipeline/rescue/predictionGenerator.ts
// Generates AH, OU, and BTTS predictions for an eligible fixture.
// ============================================================================

import crypto from 'crypto';
import { RescuePredictionRecord, RescueOddsSnapshot } from './types';
import { ProcessedRescueFixture } from './fixtureIngestion';
import { RescueMathEngine } from './mathEngine';
import { ConfidenceGateSystem } from '../confidenceGate';

export class RescuePredictionGenerator {
  public static readonly MODEL_VERSION = 'poisson_v1_rescue' as const;

  public static generateCompositeKey(
    fixtureId: number,
    market: 'AH' | 'OU' | 'BTTS',
    line: number | null,
    selection: string,
    runId: string
  ): string {
    const raw = `${fixtureId}:${market}:${line ?? 'null'}:${selection}:${this.MODEL_VERSION}:${runId}`;
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  public static generatePredictionsForFixture(
    fixture: ProcessedRescueFixture,
    batchOdds: any | null,
    allowOdds: boolean,
    runId: string,
    executedAt: string
  ): { predictions: RescuePredictionRecord[]; oddsFound: number; picksFound: number } {
    const predictions: RescuePredictionRecord[] = [];
    let oddsFound = 0;
    let picksFound = 0;

    const grid = RescueMathEngine.buildScoreGrid(fixture.lambdaHome, fixture.lambdaAway);

    // 1. ASIAN HANDICAP LINE LADDER [-1.5 .. +1.5]
    for (const line of RescueMathEngine.SUPPORTED_AH_LINES) {
      for (const side of ['HOME', 'AWAY'] as const) {
        const evalResult = RescueMathEngine.evaluateAsianHandicap(grid, line, side);
        const selection = `${side} ${line >= 0 ? `+${line}` : line}`;

        let marketOdds: number | null = null;
        let oddsSnapshot: RescueOddsSnapshot | null = null;
        let marketStatus: RescuePredictionRecord['market_status'] = allowOdds
          ? 'NO_MARKET_ODDS'
          : 'QUOTA_CRITICAL';

        if (batchOdds && batchOdds.bookmakerOdds) {
          const pinOdds = batchOdds.bookmakerOdds.pinnacle;
          const sbobetOdds = batchOdds.bookmakerOdds.sbobet;
          const chosenBookmaker = pinOdds ? 'pinnacle' : sbobetOdds ? 'sbobet' : null;
          const bmOdds = chosenBookmaker === 'pinnacle' ? pinOdds : sbobetOdds;

          if (bmOdds && bmOdds.markets) {
            const ahMarket = bmOdds.markets.find((m: any) => m.name?.includes('Handicap'));
            const outcome = ahMarket?.outcomes?.find((o: any) => Math.abs(Number(o.line) - line) < 1e-4);
            if (outcome && outcome.price > 1.0) {
              marketOdds = outcome.price;
              marketStatus = 'AVAILABLE';
              oddsFound++;
              oddsSnapshot = {
                snapshot_id: crypto.randomUUID(),
                fixture_id: fixture.fixtureId,
                bookmaker: chosenBookmaker!,
                market: 'AH',
                line,
                odds: outcome.price,
                timestamp: executedAt,
                source: 'oddspapi',
              };
            }
          }
        }

        const edgePct = marketOdds ? Number(((evalResult.pEffectiveWin - 1 / marketOdds) * 100).toFixed(2)) : null;
        const ev = marketOdds
          ? RescueMathEngine.calculateEv(
              evalResult.pFullWin,
              evalResult.pHalfWin,
              evalResult.pHalfLoss,
              evalResult.pFullLoss,
              marketOdds
            )
          : null;

        const gateResult = ConfidenceGateSystem.evaluate({
          canonicalMatchId: String(fixture.fixtureId),
          fixtureId: String(fixture.fixtureId),
          match: fixture.match,
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          competition: fixture.competition,
          kickoffUtc: fixture.kickoffUtc,
          market: 'AH',
          selection,
          line,
          odds: marketOdds,
          modelProbability: evalResult.pEffectiveWin,
          calibratedProbability: evalResult.pEffectiveWin,
          predictionTimestampUtc: executedAt,
          oddsTimestampUtc: executedAt,
          modelVersion: this.MODEL_VERSION,
          sampleSizeHome: fixture.sampleSizeHome,
          sampleSizeAway: fixture.sampleSizeAway,
          modelValidated: true,
        });

        const isPick = gateResult.qualified && gateResult.isHighConfidence;
        if (isPick) picksFound++;

        predictions.push({
          id: this.generateCompositeKey(fixture.fixtureId, 'AH', line, side, runId),
          run_id: runId,
          model_version: this.MODEL_VERSION,
          fixture_id: fixture.fixtureId,
          match: fixture.match,
          home_team: fixture.homeTeam,
          away_team: fixture.awayTeam,
          competition: fixture.competition,
          competition_id: fixture.competitionId,
          kickoff_utc: fixture.kickoffUtc,
          market: 'AH',
          line,
          line_type: evalResult.lineType,
          selection,
          model_probability: evalResult.pEffectiveWin,
          calibrated_probability: evalResult.pEffectiveWin,
          fair_odds: evalResult.fairOdds,
          market_odds: marketOdds,
          market_status: marketStatus,
          edge_pct: edgePct,
          expected_value: ev,
          confidence_tier: gateResult.confidenceTier,
          confidence_score: gateResult.confidenceScore,
          is_pick: isPick,
          odds_snapshot: oddsSnapshot,
          settlement: { status: 'PENDING' },
          data_quality_flags: fixture.dataQualityFlags,
          created_at: executedAt,
        });
      }
    }

    // 2. GOALS OVER/UNDER LINE LADDER [1.0 .. 4.0]
    for (const line of RescueMathEngine.SUPPORTED_OU_LINES) {
      for (const selectionType of ['OVER', 'UNDER'] as const) {
        const evalResult = RescueMathEngine.evaluateOverUnder(grid, line, selectionType);
        const selection = `${selectionType} ${line}`;

        let marketOdds: number | null = null;
        let oddsSnapshot: RescueOddsSnapshot | null = null;
        let marketStatus: RescuePredictionRecord['market_status'] = allowOdds
          ? 'NO_MARKET_ODDS'
          : 'QUOTA_CRITICAL';

        if (batchOdds && batchOdds.bookmakerOdds) {
          const pinOdds = batchOdds.bookmakerOdds.pinnacle;
          const sbobetOdds = batchOdds.bookmakerOdds.sbobet;
          const chosenBookmaker = pinOdds ? 'pinnacle' : sbobetOdds ? 'sbobet' : null;
          const bmOdds = chosenBookmaker === 'pinnacle' ? pinOdds : sbobetOdds;

          if (bmOdds && bmOdds.markets) {
            const ouMarket = bmOdds.markets.find((m: any) => m.name?.includes('Total') || m.name?.includes('Over/Under'));
            const outcome = ouMarket?.outcomes?.find(
              (o: any) =>
                Math.abs(Number(o.line) - line) < 1e-4 &&
                o.name?.toUpperCase().includes(selectionType)
            );
            if (outcome && outcome.price > 1.0) {
              marketOdds = outcome.price;
              marketStatus = 'AVAILABLE';
              oddsFound++;
              oddsSnapshot = {
                snapshot_id: crypto.randomUUID(),
                fixture_id: fixture.fixtureId,
                bookmaker: chosenBookmaker!,
                market: 'OU',
                line,
                odds: outcome.price,
                timestamp: executedAt,
                source: 'oddspapi',
              };
            }
          }
        }

        const edgePct = marketOdds ? Number(((evalResult.pEffectiveWin - 1 / marketOdds) * 100).toFixed(2)) : null;
        const ev = marketOdds
          ? RescueMathEngine.calculateEv(
              evalResult.pFullWin,
              evalResult.pHalfWin,
              evalResult.pHalfLoss,
              evalResult.pFullLoss,
              marketOdds
            )
          : null;

        const gateResult = ConfidenceGateSystem.evaluate({
          canonicalMatchId: String(fixture.fixtureId),
          fixtureId: String(fixture.fixtureId),
          match: fixture.match,
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          competition: fixture.competition,
          kickoffUtc: fixture.kickoffUtc,
          market: 'OU',
          selection,
          line,
          odds: marketOdds,
          modelProbability: evalResult.pEffectiveWin,
          calibratedProbability: evalResult.pEffectiveWin,
          predictionTimestampUtc: executedAt,
          oddsTimestampUtc: executedAt,
          modelVersion: this.MODEL_VERSION,
          sampleSizeHome: fixture.sampleSizeHome,
          sampleSizeAway: fixture.sampleSizeAway,
          modelValidated: true,
        });

        const isPick = gateResult.qualified && gateResult.isHighConfidence;
        if (isPick) picksFound++;

        predictions.push({
          id: this.generateCompositeKey(fixture.fixtureId, 'OU', line, selectionType, runId),
          run_id: runId,
          model_version: this.MODEL_VERSION,
          fixture_id: fixture.fixtureId,
          match: fixture.match,
          home_team: fixture.homeTeam,
          away_team: fixture.awayTeam,
          competition: fixture.competition,
          competition_id: fixture.competitionId,
          kickoff_utc: fixture.kickoffUtc,
          market: 'OU',
          line,
          line_type: evalResult.lineType,
          selection,
          model_probability: evalResult.pEffectiveWin,
          calibrated_probability: evalResult.pEffectiveWin,
          fair_odds: evalResult.fairOdds,
          market_odds: marketOdds,
          market_status: marketStatus,
          edge_pct: edgePct,
          expected_value: ev,
          confidence_tier: gateResult.confidenceTier,
          confidence_score: gateResult.confidenceScore,
          is_pick: isPick,
          odds_snapshot: oddsSnapshot,
          settlement: { status: 'PENDING' },
          data_quality_flags: fixture.dataQualityFlags,
          created_at: executedAt,
        });
      }
    }

    // 3. BTTS (STRICTLY RESEARCH_ONLY)
    const bttsEval = RescueMathEngine.evaluateBtts(grid);
    for (const item of [bttsEval.yes, bttsEval.no]) {
      predictions.push({
        id: this.generateCompositeKey(fixture.fixtureId, 'BTTS', null, item.selection, runId),
        run_id: runId,
        model_version: this.MODEL_VERSION,
        fixture_id: fixture.fixtureId,
        match: fixture.match,
        home_team: fixture.homeTeam,
        away_team: fixture.awayTeam,
        competition: fixture.competition,
        competition_id: fixture.competitionId,
        kickoff_utc: fixture.kickoffUtc,
        market: 'BTTS',
        line: null,
        selection: item.selection,
        model_probability: item.modelProbability,
        calibrated_probability: item.modelProbability,
        fair_odds: item.fairOdds,
        market_odds: null,
        market_status: 'RESEARCH_ONLY',
        edge_pct: null,
        expected_value: null,
        confidence_tier: 'PASS',
        confidence_score: 50,
        is_pick: false,
        odds_snapshot: null,
        settlement: { status: 'PENDING' },
        data_quality_flags: fixture.dataQualityFlags,
        created_at: executedAt,
      });
    }

    return { predictions, oddsFound, picksFound };
  }
}
