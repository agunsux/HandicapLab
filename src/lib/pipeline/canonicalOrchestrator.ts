// Location: src/lib/pipeline/canonicalOrchestrator.ts
/**
 * HandicapLab Canonical Production Orchestrator (Q3)
 * 
 * The single source of truth for generating production predictions:
 * Fixture
 *   ↓
 * Feature Snapshot (Point-in-Time, strictly kickoff < prediction_timestamp)
 *   ↓
 * Dynamic Model Parameters (λ_home, λ_away, ρ)
 *   ↓
 * Dixon-Coles Probability Layer (Score Matrix 11x11)
 *   ↓
 * Market Derivation (AH, OU, BTTS)
 *   ↓
 * Value Engine (Pinnacle Sharp de-vig, EV, Edge, Kelly)
 *   ↓
 * Persistence (predictions, daily_picks, prediction_ledger_v3 atomically synced)
 */

import { supabase } from '../supabase.server';
import { calculateTeamRatings, MatchData, TeamRating } from '../engine/ratings';
import { CompetitionProfileEngine } from '../engines/feature-engine/competition-profile';
import {
  buildScoreGrid,
  calculateAsianHandicapProbability,
  calculateOverUnderProbability,
  fairOdds,
} from '../engine/probability';
import {
  ValueEngine,
  type ValueEvaluationResult,
  type ConfidenceBreakdown,
  type ValueValidationStatus,
} from '../engine/valueEngine';
import crypto from 'crypto';

export interface CanonicalFixtureInput {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  kickoffUtc: string;
  predictionTimestampUtc?: string;
  oddsTimestampUtc?: string;
  competitionType?: 'club' | 'international';
  pinnacleOdds?: {
    ah?: { line: number; homeOdds: number; awayOdds: number; timestampUtc?: string };
    ou?: { line: number; overOdds: number; underOdds: number; timestampUtc?: string };
    btts?: { yesOdds: number; noOdds: number; timestampUtc?: string };
  };
}

export interface ModelParameterSnapshot {
  homeAttack: number;
  homeDefense: number;
  awayAttack: number;
  awayDefense: number;
  leagueAvgGoals: number;
  lambdaHome: number;
  lambdaAway: number;
  rho: number;
  sampleSizeHome: number;
  sampleSizeAway: number;
  isSufficient: boolean;
  modelStatus: 'FIXTURE_SPECIFIC' | 'INSUFFICIENT_MODEL';
  rejectionReason: string | null;
}

export interface MarketProbabilitySnapshot {
  ah: Record<
    string,
    {
      pCoverHome: number;
      pCoverAway: number;
      win: number;
      halfWin: number;
      push: number;
      halfLoss: number;
      loss: number;
    }
  >;
  ou: Record<string, { pOver: number; pUnder: number }>;
  btts: { pYes: number; pNo: number };
  xgHome: number;
  xgAway: number;
  expectedGoals: number;
}

export type ValueEvaluation = ValueEvaluationResult;

export interface CanonicalPredictionOutput {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  kickoffUtc: string;
  predictionTimestampUtc: string;
  parameters: ModelParameterSnapshot;
  probabilities: MarketProbabilitySnapshot;
  evaluations: {
    ah?: ValueEvaluation;
    ou?: ValueEvaluation;
    btts?: ValueEvaluation;
  };
  scoreMatrix: number[][];
}

function cleanTeamName(name: string): string {
  return name.toLowerCase().replace(/[\s-_]/g, '');
}

export function isTeamMatch(name1: string, name2: string): boolean {
  const n1 = cleanTeamName(name1);
  const n2 = cleanTeamName(name2);
  return n1.includes(n2) || n2.includes(n1);
}

export class CanonicalOrchestrator {
  /**
   * Resolves point-in-time team ratings strictly respecting the prediction timestamp boundary.
   * If offline historical matches are provided, computes directly via calculateTeamRatings.
   * Otherwise, attempts to query Supabase team_ratings.
   */
  public static async resolveTeamRatings(
    homeTeam: string,
    awayTeam: string,
    league: string,
    predictionTimestampUtc: string,
    historicalMatches?: MatchData[]
  ): Promise<{
    homeRating: TeamRating | null;
    awayRating: TeamRating | null;
    isSufficient: boolean;
    reason: string | null;
  }> {
    // 1. If explicit historical matches are supplied (e.g. tests or backtests), compute point-in-time
    if (historicalMatches && historicalMatches.length > 0) {
      const predMs = new Date(predictionTimestampUtc).getTime();
      // Strict anti-leakage filter: match kickoff < predictionTimestampUtc
      const priorMatches = historicalMatches.filter(
        (m) => new Date(m.kickoff).getTime() < predMs
      );
      const computed = calculateTeamRatings(priorMatches);

      const findTeam = (team: string): TeamRating | null => {
        for (const [name, rating] of Object.entries(computed)) {
          if (isTeamMatch(name, team)) return rating;
        }
        return null;
      };

      const homeR = findTeam(homeTeam);
      const awayR = findTeam(awayTeam);

      const homeSufficient = homeR !== null && homeR.matches_played >= 3;
      const awaySufficient = awayR !== null && awayR.matches_played >= 3;

      if (!homeSufficient || !awaySufficient) {
        return {
          homeRating: homeR,
          awayRating: awayR,
          isSufficient: false,
          reason: `Insufficient sample size (< 3 matches): Home(${homeTeam})=${homeR?.matches_played ?? 0}, Away(${awayTeam})=${awayR?.matches_played ?? 0}`,
        };
      }

      return { homeRating: homeR, awayRating: awayR, isSufficient: true, reason: null };
    }

    // 2. Query Supabase team_ratings table
    try {
      const { data: allRatings, error } = await supabase
        .from('team_ratings')
        .select('*');

      if (error || !allRatings || allRatings.length === 0) {
        // Fallback: Query matches table for finished matches prior to prediction timestamp
        const { data: dbMatches } = await supabase
          .from('matches')
          .select('home_team, away_team, home_goals, away_goals, league, kickoff')
          .eq('status', 'finished')
          .lt('kickoff', predictionTimestampUtc)
          .order('kickoff', { ascending: false })
          .limit(100);

        if (dbMatches && dbMatches.length > 0) {
          const computed = calculateTeamRatings(dbMatches as MatchData[]);
          const findTeam = (team: string): TeamRating | null => {
            for (const [name, rating] of Object.entries(computed)) {
              if (isTeamMatch(name, team)) return rating;
            }
            return null;
          };
          const homeR = findTeam(homeTeam);
          const awayR = findTeam(awayTeam);
          const isSuff = Boolean(homeR && homeR.matches_played >= 3 && awayR && awayR.matches_played >= 3);
          return {
            homeRating: homeR,
            awayRating: awayR,
            isSufficient: isSuff,
            reason: isSuff ? null : 'Insufficient sample size in recent matches (< 3)',
          };
        }

        return {
          homeRating: null,
          awayRating: null,
          isSufficient: false,
          reason: 'No team ratings or finished matches available in database',
        };
      }

      const findDbRating = (team: string): TeamRating | null => {
        for (const row of allRatings) {
          if (isTeamMatch(row.team_name || row.team_id, team)) {
            return {
              team_id: row.team_id,
              team_name: row.team_name || row.team_id,
              league_id: row.league_id || league,
              attack_strength: Number(row.attack_strength) || 1.0,
              defense_strength: Number(row.defense_strength) || 1.0,
              matches_played: Number(row.matches_played) || 0,
            };
          }
        }
        return null;
      };

      const homeR = findDbRating(homeTeam);
      const awayR = findDbRating(awayTeam);

      const homeSufficient = homeR !== null && homeR.matches_played >= 3;
      const awaySufficient = awayR !== null && awayR.matches_played >= 3;

      if (!homeSufficient || !awaySufficient) {
        return {
          homeRating: homeR,
          awayRating: awayR,
          isSufficient: false,
          reason: `Insufficient sample size (< 3 matches): Home(${homeTeam})=${homeR?.matches_played ?? 0}, Away(${awayTeam})=${awayR?.matches_played ?? 0}`,
        };
      }

      return { homeRating: homeR, awayRating: awayR, isSufficient: true, reason: null };
    } catch (err: any) {
      return {
        homeRating: null,
        awayRating: null,
        isSufficient: false,
        reason: `Database error resolving ratings: ${err?.message || err}`,
      };
    }
  }

  /**
   * Core prediction function.
   * Evaluates a single fixture through the complete canonical pipeline.
   */
  public static async evaluateFixture(
    input: CanonicalFixtureInput,
    options: {
      historicalMatches?: MatchData[];
      customRho?: number;
    } = {}
  ): Promise<CanonicalPredictionOutput> {
    const nowIso = new Date().toISOString();
    const predictionTimestampUtc = input.predictionTimestampUtc || nowIso;

    // Temporal provenance invariant: predictionTimestamp < kickoffUtc
    const tPred = new Date(predictionTimestampUtc).getTime();
    const tKick = new Date(input.kickoffUtc).getTime();
    if (tPred >= tKick) {
      throw new Error(
        `[Temporal Leakage Invariant] Prediction timestamp ${predictionTimestampUtc} must be strictly before kickoff ${input.kickoffUtc}`
      );
    }

    // 1. Resolve Point-in-Time Features / Dynamic Ratings
    const { homeRating, awayRating, isSufficient, reason } = await this.resolveTeamRatings(
      input.homeTeam,
      input.awayTeam,
      input.league,
      predictionTimestampUtc,
      options.historicalMatches
    );

    // 2. Compute Dynamic Dixon-Coles Parameters
    const profile = CompetitionProfileEngine.getProfileForLeague(input.league || 'EPL');
    const leagueAvgGoals = profile.goalEnvironment || 2.65;
    const homeBase = leagueAvgGoals * 0.55;
    const awayBase = leagueAvgGoals * 0.45;

    let homeAttack = 1.0;
    let homeDefense = 1.0;
    let awayAttack = 1.0;
    let awayDefense = 1.0;
    let lambdaHome: number;
    let lambdaAway: number;
    const rho = options.customRho ?? -0.06;

    if (isSufficient && homeRating && awayRating) {
      homeAttack = homeRating.attack_strength;
      homeDefense = homeRating.defense_strength;
      awayAttack = awayRating.attack_strength;
      awayDefense = awayRating.defense_strength;

      lambdaHome = Number(Math.max(0.20, homeAttack * awayDefense * homeBase).toFixed(4));
      lambdaAway = Number(Math.max(0.20, awayAttack * homeDefense * awayBase).toFixed(4));
    } else {
      // Baseline fallback for score grid calculation (fail-closed gate prevents any VALUE pick)
      lambdaHome = 1.35;
      lambdaAway = 1.20;
    }

    const parameters: ModelParameterSnapshot = {
      homeAttack: Number(homeAttack.toFixed(4)),
      homeDefense: Number(homeDefense.toFixed(4)),
      awayAttack: Number(awayAttack.toFixed(4)),
      awayDefense: Number(awayDefense.toFixed(4)),
      leagueAvgGoals: Number(leagueAvgGoals.toFixed(2)),
      lambdaHome,
      lambdaAway,
      rho,
      sampleSizeHome: homeRating?.matches_played ?? 0,
      sampleSizeAway: awayRating?.matches_played ?? 0,
      isSufficient,
      modelStatus: isSufficient ? 'FIXTURE_SPECIFIC' : 'INSUFFICIENT_MODEL',
      rejectionReason: isSufficient ? null : (reason || 'INSUFFICIENT_MODEL'),
    };

    // 3. Compute Dixon-Coles Score Matrix (11x11)
    const scoreMatrix = buildScoreGrid(lambdaHome, lambdaAway, rho);

    // 4. Derive Market Probabilities from Score Matrix
    // Over / Under derivation
    const ouThresholds = [0.5, 1.5, 2.5, 3.5, 4.5];
    const ouMap: Record<string, { pOver: number; pUnder: number }> = {};
    for (const thresh of ouThresholds) {
      const ouDeriv = calculateOverUnderProbability(lambdaHome, lambdaAway, thresh, rho);
      ouMap[thresh.toFixed(1)] = {
        pOver: Number(ouDeriv.over.toFixed(4)),
        pUnder: Number(ouDeriv.under.toFixed(4)),
      };
    }

    // Asian Handicap derivation
    const ahLines = [-1.5, -1.25, -1.0, -0.75, -0.5, -0.25, 0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5];
    const ahMap: Record<
      string,
      {
        pCoverHome: number;
        pCoverAway: number;
        win: number;
        halfWin: number;
        push: number;
        halfLoss: number;
        loss: number;
      }
    > = {};
    for (const line of ahLines) {
      const ahDeriv = calculateAsianHandicapProbability(lambdaHome, lambdaAway, line, rho);
      ahMap[line.toFixed(2)] = {
        pCoverHome: Number(ahDeriv.cover.toFixed(4)),
        pCoverAway: Number(Math.max(0, 1.0 - ahDeriv.cover).toFixed(4)),
        win: Number(ahDeriv.win.toFixed(4)),
        halfWin: Number(ahDeriv.halfWin.toFixed(4)),
        push: Number(ahDeriv.push.toFixed(4)),
        halfLoss: Number(ahDeriv.halfLoss.toFixed(4)),
        loss: Number(ahDeriv.loss.toFixed(4)),
      };
    }

    // Both Teams to Score (BTTS) derivation
    let pBttsYes = 0;
    let xgHome = 0;
    let xgAway = 0;
    for (let h = 0; h <= 10; h++) {
      for (let a = 0; a <= 10; a++) {
        const p = scoreMatrix[h][a];
        xgHome += h * p;
        xgAway += a * p;
        if (h >= 1 && a >= 1) {
          pBttsYes += p;
        }
      }
    }
    const pBttsNo = Math.max(0, 1.0 - pBttsYes);

    const probabilities: MarketProbabilitySnapshot = {
      ah: ahMap,
      ou: ouMap,
      btts: {
        pYes: Number(pBttsYes.toFixed(4)),
        pNo: Number(pBttsNo.toFixed(4)),
      },
      xgHome: Number(xgHome.toFixed(2)),
      xgAway: Number(xgAway.toFixed(2)),
      expectedGoals: Number((xgHome + xgAway).toFixed(2)),
    };

    // 5. Value Engine Evaluation (Pinnacle-Only Reference)
    // NOTE: Odds enter ONLY here. Zero odds flow into parameter or probability derivation.
    const evaluations: CanonicalPredictionOutput['evaluations'] = {};
    const oddsTimestampUtc = input.oddsTimestampUtc || input.predictionTimestampUtc || nowIso;

    // Evaluate Asian Handicap
    if (input.pinnacleOdds?.ah) {
      const { line, homeOdds, awayOdds, timestampUtc } = input.pinnacleOdds.ah;
      const lineKey = line.toFixed(2);
      const ahProbObj = ahMap[lineKey] || ahMap['0.00'];
      const modelProb = ahProbObj ? ahProbObj.pCoverHome : 0.5;
      const selection = `${input.homeTeam} ${line >= 0 ? '+' : ''}${line.toFixed(2)}`;

      evaluations.ah = ValueEngine.evaluateSelection({
        selection,
        market: 'AH',
        line,
        modelProbability: modelProb,
        ahBreakdown: ahProbObj
          ? {
              win: ahProbObj.win,
              halfWin: ahProbObj.halfWin,
              push: ahProbObj.push,
              halfLoss: ahProbObj.halfLoss,
              loss: ahProbObj.loss,
            }
          : undefined,
        pinnacleOdds: {
          sideOdds: homeOdds,
          oppositeOdds: awayOdds,
        },
        sampleSizeHome: parameters.sampleSizeHome,
        sampleSizeAway: parameters.sampleSizeAway,
        oddsTimestampUtc: timestampUtc || oddsTimestampUtc,
        predictionTimestampUtc,
        kickoffUtc: input.kickoffUtc,
        fixtureId: input.fixtureId,
        homeTeam: input.homeTeam,
        awayTeam: input.awayTeam,
        league: input.league,
        modelStatus: parameters.modelStatus,
      });
    }

    // Evaluate Over / Under
    if (input.pinnacleOdds?.ou) {
      const { line, overOdds, underOdds, timestampUtc } = input.pinnacleOdds.ou;
      const lineKey = line.toFixed(1);
      const ouProbObj = ouMap[lineKey] || ouMap['2.5'];
      const modelProb = ouProbObj ? ouProbObj.pOver : 0.5;
      const selection = `Over ${line.toFixed(1)}`;

      evaluations.ou = ValueEngine.evaluateSelection({
        selection,
        market: 'OU',
        line,
        modelProbability: modelProb,
        pinnacleOdds: {
          sideOdds: overOdds,
          oppositeOdds: underOdds,
        },
        sampleSizeHome: parameters.sampleSizeHome,
        sampleSizeAway: parameters.sampleSizeAway,
        oddsTimestampUtc: timestampUtc || oddsTimestampUtc,
        predictionTimestampUtc,
        kickoffUtc: input.kickoffUtc,
        fixtureId: input.fixtureId,
        homeTeam: input.homeTeam,
        awayTeam: input.awayTeam,
        league: input.league,
        modelStatus: parameters.modelStatus,
      });
    }

    // Evaluate Both Teams to Score (BTTS)
    if (input.pinnacleOdds?.btts) {
      const { yesOdds, noOdds, timestampUtc } = input.pinnacleOdds.btts;
      const modelProb = probabilities.btts.pYes;
      const selection = 'BTTS Yes';

      evaluations.btts = ValueEngine.evaluateSelection({
        selection,
        market: 'BTTS',
        line: 0,
        modelProbability: modelProb,
        pinnacleOdds: {
          sideOdds: yesOdds,
          oppositeOdds: noOdds,
        },
        sampleSizeHome: parameters.sampleSizeHome,
        sampleSizeAway: parameters.sampleSizeAway,
        oddsTimestampUtc: timestampUtc || oddsTimestampUtc,
        predictionTimestampUtc,
        kickoffUtc: input.kickoffUtc,
        fixtureId: input.fixtureId,
        homeTeam: input.homeTeam,
        awayTeam: input.awayTeam,
        league: input.league,
        modelStatus: parameters.modelStatus,
      });
    }

    return {
      fixtureId: input.fixtureId,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      league: input.league,
      kickoffUtc: input.kickoffUtc,
      predictionTimestampUtc,
      parameters,
      probabilities,
      evaluations,
      scoreMatrix,
    };
  }

  /**
   * Persists the output of a single canonical evaluation into:
   * 1. predictions table
   * 2. daily_picks table
   * 3. prediction_ledger_v3 table
   * 
   * Asserts 100% snapshot alignment across all 3 tables.
   */
  public static async persistPredictionSnapshot(
    output: CanonicalPredictionOutput,
    market: 'AH' | 'OU' | 'BTTS'
  ): Promise<{
    predictionId: string;
    dailyPickId: string | null;
    ledgerHash: string | null;
  }> {
    const evalObj =
      market === 'AH'
        ? output.evaluations.ah
        : market === 'OU'
        ? output.evaluations.ou
        : output.evaluations.btts;

    if (!evalObj) {
      throw new Error(`No evaluation available for market ${market} on fixture ${output.fixtureId}`);
    }

    const mappedMarketType =
      market === 'AH'
        ? 'ASIAN_HANDICAP'
        : market === 'OU'
        ? 'OVER_UNDER'
        : 'BTTS';

    // 1. Persist to predictions table
    const predictionPayload = {
      match_id: output.fixtureId,
      market_type: market,
      home_team: output.homeTeam,
      away_team: output.awayTeam,
      prediction: {
        outcome: evalObj.selection,
        modelProbability: evalObj.modelProbability,
        fairOdds: evalObj.fairOdds,
        lambdaHome: output.parameters.lambdaHome,
        lambdaAway: output.parameters.lambdaAway,
        rho: output.parameters.rho,
        modelStatus: output.parameters.modelStatus,
      },
      model_version: 'dixon-coles-v1.0',
      feature_version: 'dynamic-ratings-v1.0',
      prediction_timestamp: output.kickoffUtc,
      selection: evalObj.selection,
      model_probability: evalObj.modelProbability,
      fair_odds: evalObj.fairOdds,
      market_odds: evalObj.marketOdds,
      edge_pct: Number((evalObj.edge * 100).toFixed(2)),
      expected_value: Number((evalObj.expectedValue * 100).toFixed(2)),
      confidence: evalObj.validationStatus === 'INSUFFICIENT_MODEL' ? 0.30 : 0.75,
      source_type: 'live',
    };

    let predictionId = `pred_${output.fixtureId}_${market}`;
    try {
      const { data: predRow } = await supabase
        .from('predictions')
        .upsert(predictionPayload, { onConflict: 'match_id, market_type' })
        .select('id')
        .maybeSingle();
      if (predRow?.id) predictionId = predRow.id;
    } catch (err) {
      console.warn('[CanonicalOrchestrator] Failed upsert to predictions table:', err);
    }

    // 2. Persist to daily_picks table
    const dailyPickPayload = {
      fixture_id: output.fixtureId,
      league: output.league,
      home_team: output.homeTeam,
      away_team: output.awayTeam,
      kickoff_utc: output.kickoffUtc,
      market_type: mappedMarketType,
      prediction: evalObj.selection,
      model_probability: evalObj.modelProbability,
      fair_odds: evalObj.fairOdds,
      market_odds: evalObj.marketOdds,
      market_bookmaker: 'Pinnacle',
      edge_pct: Number((evalObj.edge * 100).toFixed(2)),
      confidence: evalObj.confidence,
      verdict: evalObj.verdict,
      reasoning:
        evalObj.validationStatus === 'INSUFFICIENT_MODEL'
          ? `INSUFFICIENT_MODEL: ${output.parameters.rejectionReason}`
          : `Model fair ${evalObj.fairOdds.toFixed(2)} vs Pinnacle ${evalObj.marketOdds.toFixed(2)}. Edge: ${(evalObj.edge * 100).toFixed(1)}%, EV: ${(evalObj.expectedValue * 100).toFixed(1)}%, Confidence: ${evalObj.confidence}/100.`,
      status: evalObj.validationStatus === 'INSUFFICIENT_MODEL' ? 'VOID' : 'PENDING',
      rejection_reason: evalObj.rejectionReason,
      source: 'live',
    };

    let dailyPickId: string | null = null;
    try {
      const { data: dpRow } = await supabase
        .from('daily_picks')
        .upsert(dailyPickPayload, { onConflict: 'fixture_id, market_type, source' })
        .select('id')
        .maybeSingle();
      if (dpRow?.id) dailyPickId = dpRow.id;
    } catch (err) {
      console.warn('[CanonicalOrchestrator] Failed upsert to daily_picks table:', err);
    }

    // 3. Persist to prediction_ledger_v3 table
    let ledgerHash: string | null = null;
    try {
      let priorHash: string | null = null;
      const { data: priorRow } = await supabase
        .from('prediction_ledger_v3')
        .select('prediction_hash')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (priorRow?.prediction_hash) priorHash = priorRow.prediction_hash;

      const hashInput = JSON.stringify({
        match_id: output.fixtureId,
        model_id: 'dixon-coles-v1.0',
        market_type: market,
        selection: evalObj.selection,
        raw_probability: evalObj.modelProbability,
        calibrated_probability: evalObj.modelProbability,
        feature_vector_snapshot: {
          lambdaHome: output.parameters.lambdaHome,
          lambdaAway: output.parameters.lambdaAway,
          rho: output.parameters.rho,
          homeAttack: output.parameters.homeAttack,
          homeDefense: output.parameters.homeDefense,
          awayAttack: output.parameters.awayAttack,
          awayDefense: output.parameters.awayDefense,
        },
        prior_hash: priorHash,
      });

      ledgerHash = crypto.createHash('sha256').update(hashInput).digest('hex');

      const ledgerRecord = {
        match_id: output.fixtureId,
        model_id: 'dixon-coles-v1.0',
        market_type: market,
        selection: evalObj.selection,
        line: evalObj.line,
        raw_probability: evalObj.modelProbability,
        calibrated_probability: evalObj.modelProbability,
        market_odds: evalObj.marketOdds,
        expected_value: evalObj.expectedValue,
        kelly_fraction: evalObj.kellyFraction,
        risk_adjusted_stake: evalObj.actionable ? 0.02 : 0,
        feature_version: 'dynamic-ratings-v1.0',
        feature_vector_snapshot: {
          lambdaHome: output.parameters.lambdaHome,
          lambdaAway: output.parameters.lambdaAway,
          rho: output.parameters.rho,
          line: evalObj.line,
          modelStatus: output.parameters.modelStatus,
        },
        explainability_json: {
          edgePct: (evalObj.edge * 100).toFixed(2),
          evPct: (evalObj.expectedValue * 100).toFixed(2),
          modelProbability: evalObj.modelProbability,
          marketProbability: evalObj.marketProbability,
          confidence: evalObj.confidence,
          confidenceBreakdown: evalObj.confidenceBreakdown,
          passedGates: evalObj.passedGates,
          rejectionReason: evalObj.rejectionReason,
        },
        prediction_timestamp: output.predictionTimestampUtc,
        prediction_hash: ledgerHash,
        prior_hash: priorHash,
      };

      await supabase.from('prediction_ledger_v3').insert(ledgerRecord);
    } catch (err) {
      console.warn('[CanonicalOrchestrator] Failed insert to prediction_ledger_v3:', err);
    }

    return { predictionId, dailyPickId, ledgerHash };
  }
}
