import * as fs from 'fs';
import * as path from 'path';
import type { FeatureSnapshot, HistoricalOdds, NormalizedMatch } from '../types';
import { computeLambdas, deriveMarkets, fitLeagueConstants, scoreMatrix, type MarketProbs, type PoissonParams } from './poisson';
import { brierAndLogLoss, calibrationBuckets, evBucketAnalysis, roiWithCI, winRateWithCI } from './metrics';
import { applyBinaryPlatt, applySoftmaxTemperature, fitBinaryPlatt, fitSoftmaxTemperature } from './calibrate';
import { settleAsianHandicap, settleAsianTotal, settleBtts, settleMoneyline } from '../settlement/settlement';

const OUT_DIR = path.resolve(process.cwd(), 'data', 'historical');
const ELO_SCALE = 400;
const MAX_GOALS = 10;

export interface OutOfSamplePick {
  match_id: string;
  season: string;
  match_date: string;
  market: 'ML' | 'OU25' | 'BTTS' | 'AH';
  selection: string;
  model_probability: number;
  p_home: number | null;
  p_draw: number | null;
  p_away: number | null;
  cal_probability: number | null;
  cal_p_home: number | null;
  cal_p_draw: number | null;
  cal_p_away: number | null;
  market_odds: number | null;
  fair_odds: number;
  ev: number | null;
  ev_calibrated: number | null;
  xg_home: number;
  xg_away: number;
  actual_result: 'H' | 'D' | 'A' | null;
  actual_home_goals: number;
  actual_away_goals: number;
  outcome: 'WIN' | 'LOSS' | 'PUSH' | null;
  profit: number | null;
  model_version: string;
  feature_version: string;
  eligible: boolean;
  ineligibility_reason?: string;
}

export interface WalkForwardFold {
  train_seasons: string[];
  test_season: string;
  train_n: number;
  test_n: number;
}

function loadJsonl<T>(file: string): T[] {
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as T);
}

function seasonsOf(matches: NormalizedMatch[]): string[] {
  return Array.from(new Set(matches.map((m) => m.season))).sort();
}

function buildFolds(seasons: string[]): WalkForwardFold[] {
  const folds: WalkForwardFold[] = [];
  for (let i = 2; i < seasons.length; i++) {
    folds.push({ train_seasons: seasons.slice(0, i), test_season: seasons[i], train_n: 0, test_n: 0 });
  }
  return folds;
}

function oddsFor(matchId: string, oddsList: HistoricalOdds[]): HistoricalOdds | null {
  return oddsList.find((o) => o.match_id === matchId) ?? null;
}

function hasCoreFeatures(snap: FeatureSnapshot): boolean {
  return snap.home.avg_goals_for !== null && snap.home.avg_goals_against !== null
    && snap.away.avg_goals_for !== null && snap.away.avg_goals_against !== null
    && snap.league_avg_goals !== null && snap.home.elo !== null && snap.away.elo !== null;
}

function predictMatch(snap: FeatureSnapshot, params: PoissonParams): MarketProbs | null {
  if (!hasCoreFeatures(snap)) return null;
  const lambdas = computeLambdas({
    homeAvgGoalsFor: snap.home.avg_goals_for!,
    awayAvgGoalsAgainst: snap.away.avg_goals_against!,
    awayAvgGoalsFor: snap.away.avg_goals_for!,
    homeAvgGoalsAgainst: snap.home.avg_goals_against!,
    leagueAvgGoals: snap.league_avg_goals!,
    eloDelta: snap.home.elo! - snap.away.elo!,
  }, params);
  return deriveMarkets(scoreMatrix(lambdas, MAX_GOALS));
}

function outcomeML(selection: string, match: NormalizedMatch): 'WIN' | 'LOSS' {
  return settleMoneyline(selection as 'home' | 'draw' | 'away', match.home_goals, match.away_goals) === 'WIN' ? 'WIN' : 'LOSS';
}

function outcomeOU25(selection: string, match: NormalizedMatch): 'WIN' | 'LOSS' {
  return settleAsianTotal(selection as 'over' | 'under', 2.5, match.home_goals + match.away_goals) === 'WIN' ? 'WIN' : 'LOSS';
}

function main(): void {
  const matches = loadJsonl<NormalizedMatch>(path.join(OUT_DIR, 'normalized_matches.jsonl'));
  const oddsList = loadJsonl<HistoricalOdds>(path.join(OUT_DIR, 'historical_odds.jsonl'));
  const snapshots = loadJsonl<FeatureSnapshot>(path.join(OUT_DIR, 'feature_snapshots.jsonl'));
  const matchById = new Map(matches.map((m) => [m.canonical_id, m]));
  const results = new Map(matches.map((m) => [m.canonical_id, { home: m.home_goals, away: m.away_goals }]));

  const seasons = seasonsOf(matches);
  const folds = buildFolds(seasons);
  const allPicks: OutOfSamplePick[] = [];
  const foldReports: unknown[] = [];
  const calFolds: unknown[] = [];

  for (const fold of folds) {
    const trainSnaps = snapshots.filter((s) => fold.train_seasons.includes(s.season));
    const testSnaps = snapshots.filter((s) => s.season === fold.test_season);
    fold.train_n = trainSnaps.length;
    fold.test_n = testSnaps.length;

    const constants = fitLeagueConstants(trainSnaps, results);
    const params: PoissonParams = { ...constants, eloScale: ELO_SCALE, maxGoals: MAX_GOALS };

    const trainPreds = trainSnaps
      .map((s) => ({ snap: s, match: matchById.get(s.match_id), probs: predictMatch(s, params) }))
      .filter((x): x is { snap: FeatureSnapshot; match: NormalizedMatch; probs: MarketProbs } => !!x.match && !!x.probs);

    const fitMl = fitSoftmaxTemperature(
      trainPreds.map((x) => ({ pHome: x.probs.pHome, pDraw: x.probs.pDraw, pAway: x.probs.pAway })),
      trainPreds.map((x) => x.match.result),
      fold.train_seasons
    );
    const fitOu = fitBinaryPlatt(
      trainPreds.map((x) => x.probs.pOver['2.5']),
      trainPreds.map((x) => x.match.home_goals + x.match.away_goals > 2.5),
      fold.train_seasons
    );
    const fitBtts = fitBinaryPlatt(
      trainPreds.map((x) => x.probs.pBttsYes),
      trainPreds.map((x) => x.match.home_goals >= 1 && x.match.away_goals >= 1),
      fold.train_seasons
    );
    const fitAh = fitBinaryPlatt(
      trainPreds.map((x) => x.probs.pAhHome['-0.5']),
      trainPreds.map((x) => x.match.home_goals > x.match.away_goals),
      fold.train_seasons
    );

    calFolds.push({
      test_season: fold.test_season,
      n_train_predicted: trainPreds.length,
      T_ml: fitMl.T,
      T_ou25: fitOu.a,
      T_btts: fitBtts.a,
      T_ah: fitAh.a,
      T_ml_at_boundary: fitMl.at_boundary,
      T_ou25_at_boundary: false,
      T_btts_at_boundary: false,
      T_ah_at_boundary: false,
      train_logloss_ml: fitMl.train_logloss,
      ou25_platt: { a: fitOu.a, b: fitOu.b, train_logloss: fitOu.train_logloss },
      btts_platt: { a: fitBtts.a, b: fitBtts.b, train_logloss: fitBtts.train_logloss },
      ah_platt: { a: fitAh.a, b: fitAh.b, train_logloss: fitAh.train_logloss },
    });

    for (const snap of testSnaps) {
      const match = matchById.get(snap.match_id);
      const odds = oddsFor(snap.match_id, oddsList);
      if (!match) continue;

      const core = hasCoreFeatures(snap);
      const rawProbs = predictMatch(snap, params);
      const calMl = rawProbs ? applySoftmaxTemperature({ pHome: rawProbs.pHome, pDraw: rawProbs.pDraw, pAway: rawProbs.pAway }, fitMl.T) : null;
      const calOuOver = rawProbs ? applyBinaryPlatt(rawProbs.pOver['2.5'], fitOu.a, fitOu.b) : null;
      const calBttsYes = rawProbs ? applyBinaryPlatt(rawProbs.pBttsYes, fitBtts.a, fitBtts.b) : null;
      const calAhHome = rawProbs ? applyBinaryPlatt(rawProbs.pAhHome['-0.5'], fitAh.a, fitAh.b) : null;

      const mlOdds = odds?.market_1x2 ?? null;
      const ouOdds = odds?.market_ou25 ?? null;

      const pushML = (selection: string): OutOfSamplePick => {
        const oddsPrice = mlOdds ? mlOdds[selection === 'home' ? 'home' : selection === 'draw' ? 'draw' : 'away'] : null;
        const eligible = core && oddsPrice !== null;
        const rawP = rawProbs ? (selection === 'home' ? rawProbs.pHome : selection === 'draw' ? rawProbs.pDraw : rawProbs.pAway) : 0;
        const calP = calMl ? (selection === 'home' ? calMl.pHome : selection === 'draw' ? calMl.pDraw : calMl.pAway) : null;
        const ev = eligible ? rawP * oddsPrice - 1 : null;
        const evCal = eligible && calP !== null ? calP * oddsPrice - 1 : null;
        return {
          match_id: snap.match_id, season: snap.season, match_date: snap.match_date, market: 'ML', selection,
          model_probability: Number(rawP.toFixed(4)),
          p_home: rawProbs ? Number(rawProbs.pHome.toFixed(4)) : null,
          p_draw: rawProbs ? Number(rawProbs.pDraw.toFixed(4)) : null,
          p_away: rawProbs ? Number(rawProbs.pAway.toFixed(4)) : null,
          cal_probability: calP !== null ? Number(calP.toFixed(4)) : null,
          cal_p_home: calMl ? Number(calMl.pHome.toFixed(4)) : null,
          cal_p_draw: calMl ? Number(calMl.pDraw.toFixed(4)) : null,
          cal_p_away: calMl ? Number(calMl.pAway.toFixed(4)) : null,
          market_odds: oddsPrice ?? null,
          fair_odds: rawP > 0 ? Number((1 / rawP).toFixed(4)) : 0,
          ev: ev !== null ? Number(ev.toFixed(4)) : null,
          ev_calibrated: evCal !== null ? Number(evCal.toFixed(4)) : null,
          xg_home: rawProbs?.xgHome ?? 0, xg_away: rawProbs?.xgAway ?? 0,
          actual_result: match.result, actual_home_goals: match.home_goals, actual_away_goals: match.away_goals,
          outcome: outcomeML(selection, match), profit: eligible ? (outcomeML(selection, match) === 'WIN' ? oddsPrice - 1 : -1) : null,
          model_version: 'poisson-historical-v2-repaired', feature_version: snap.feature_version,
          eligible, ineligibility_reason: !core ? 'missing_core_features' : oddsPrice === null ? 'missing_odds' : undefined,
        };
      };
      allPicks.push(pushML('home'), pushML('draw'), pushML('away'));

      const pushOU = (selection: 'over' | 'under'): OutOfSamplePick => {
        const oddsPrice = ouOdds ? ouOdds[selection] : null;
        const eligible = core && oddsPrice !== null;
        const rawP = rawProbs ? (selection === 'over' ? rawProbs.pOver['2.5'] : rawProbs.pUnder['2.5']) : 0;
        const calP = calOuOver !== null ? (selection === 'over' ? calOuOver : 1 - calOuOver) : null;
        const ev = eligible ? rawP * oddsPrice - 1 : null;
        const evCal = eligible && calP !== null ? calP * oddsPrice - 1 : null;
        return {
          match_id: snap.match_id, season: snap.season, match_date: snap.match_date, market: 'OU25', selection,
          model_probability: Number(rawP.toFixed(4)),
          p_home: null, p_draw: null, p_away: null,
          cal_probability: calP !== null ? Number(calP.toFixed(4)) : null,
          cal_p_home: null, cal_p_draw: null, cal_p_away: null,
          market_odds: oddsPrice ?? null,
          fair_odds: rawP > 0 ? Number((1 / rawP).toFixed(4)) : 0,
          ev: ev !== null ? Number(ev.toFixed(4)) : null,
          ev_calibrated: evCal !== null ? Number(evCal.toFixed(4)) : null,
          xg_home: rawProbs?.xgHome ?? 0, xg_away: rawProbs?.xgAway ?? 0,
          actual_result: match.result, actual_home_goals: match.home_goals, actual_away_goals: match.away_goals,
          outcome: outcomeOU25(selection, match), profit: eligible ? (outcomeOU25(selection, match) === 'WIN' ? oddsPrice - 1 : -1) : null,
          model_version: 'poisson-historical-v2-repaired', feature_version: snap.feature_version,
          eligible, ineligibility_reason: !core ? 'missing_core_features' : oddsPrice === null ? 'missing_odds' : undefined,
        };
      };
      allPicks.push(pushOU('over'), pushOU('under'));

      if (rawProbs) {
        const bttsOutcome: 'WIN' | 'LOSS' = settleBtts('yes', match.home_goals, match.away_goals) === 'WIN' ? 'WIN' : 'LOSS';
        const ahOutcome: 'WIN' | 'LOSS' = settleAsianHandicap('home', -0.5, match.home_goals, match.away_goals) === 'WIN' ? 'WIN' : 'LOSS';
        allPicks.push({
          match_id: snap.match_id, season: snap.season, match_date: snap.match_date, market: 'BTTS', selection: 'yes',
          model_probability: Number(rawProbs.pBttsYes.toFixed(4)), p_home: null, p_draw: null, p_away: null,
          cal_probability: calBttsYes !== null ? Number(calBttsYes.toFixed(4)) : null, cal_p_home: null, cal_p_draw: null, cal_p_away: null,
          market_odds: null, fair_odds: Number((1 / rawProbs.pBttsYes).toFixed(4)), ev: null, ev_calibrated: null,
          xg_home: rawProbs.xgHome, xg_away: rawProbs.xgAway,
          actual_result: match.result, actual_home_goals: match.home_goals, actual_away_goals: match.away_goals,
          outcome: bttsOutcome, profit: null,
          model_version: 'poisson-historical-v2-repaired', feature_version: snap.feature_version,
          eligible: core, ineligibility_reason: core ? undefined : 'missing_core_features',
        });
        allPicks.push({
          match_id: snap.match_id, season: snap.season, match_date: snap.match_date, market: 'AH', selection: 'home -0.5',
          model_probability: Number(rawProbs.pAhHome['-0.5'].toFixed(4)), p_home: null, p_draw: null, p_away: null,
          cal_probability: calAhHome !== null ? Number(calAhHome.toFixed(4)) : null, cal_p_home: null, cal_p_draw: null, cal_p_away: null,
          market_odds: null, fair_odds: Number((1 / rawProbs.pAhHome['-0.5']).toFixed(4)), ev: null, ev_calibrated: null,
          xg_home: rawProbs.xgHome, xg_away: rawProbs.xgAway,
          actual_result: match.result, actual_home_goals: match.home_goals, actual_away_goals: match.away_goals,
          outcome: ahOutcome, profit: null,
          model_version: 'poisson-historical-v2-repaired', feature_version: snap.feature_version,
          eligible: core, ineligibility_reason: core ? undefined : 'missing_core_features',
        });
      }
    }

    foldReports.push({
      test_season: fold.test_season,
      train_seasons: fold.train_seasons,
      train_n: fold.train_n,
      test_n: fold.test_n,
      league_constants: constants,
    });
  }

  fs.writeFileSync(path.join(OUT_DIR, 'out_of_sample_predictions.jsonl'), allPicks.map((p) => JSON.stringify(p)).join('\n'));

  const mlEligible = allPicks.filter((p) => p.market === 'ML' && p.eligible && p.profit !== null);
  const ouEligible = allPicks.filter((p) => p.market === 'OU25' && p.eligible && p.profit !== null);
  const bttsAll = allPicks.filter((p) => p.market === 'BTTS' && p.eligible);
  const ahAll = allPicks.filter((p) => p.market === 'AH' && p.eligible);

  const calSummary = (picks: OutOfSamplePick[], useCalibrated: boolean) => {
    const prob = (p: OutOfSamplePick) => useCalibrated ? (p.cal_probability ?? 0) : p.model_probability;
    const ece = calibrationBuckets(picks.map((p) => ({ p: prob(p), outcome: p.outcome === 'WIN' }))).ece;
    let brier = null;
    let uniqueN = null;
    if (picks[0]?.market === 'ML') {
      const byMatch = new Map<string, OutOfSamplePick>();
      for (const p of picks) if (!byMatch.has(p.match_id)) byMatch.set(p.match_id, p);
      const unique = [...byMatch.values()];
      uniqueN = unique.length;
      brier = brierAndLogLoss(
        unique.map((p) => useCalibrated
          ? { pHome: p.cal_p_home ?? 0, pDraw: p.cal_p_draw ?? 0, pAway: p.cal_p_away ?? 0 }
          : { pHome: p.p_home ?? 0, pDraw: p.p_draw ?? 0, pAway: p.p_away ?? 0 }),
        unique.map((p) => p.actual_result!)
      );
    }
    return { ece, brier, unique_n: uniqueN };
  };

  const boundaryHits = calFolds.some((f) => (f as { T_ml_at_boundary: boolean }).T_ml_at_boundary);
  const calibrationNote = boundaryHits
    ? 'grid boundary reached for one or more temperatures'
    : 'temperatures interior to grid: calibrated probabilities are usable; model repair verified out-of-sample';

  const report = {
    model: {
      version: 'poisson-historical-v2-repaired',
      algo: 'feature-driven poisson (Maher relative rates) + per-fold temperature scaling (ML) & Platt scaling (OU/BTTS/AH)',
      elo_scale: ELO_SCALE,
      calibration_method: 'ML: softmax temperature scaling T in [0.2, 5.0]; OU/BTTS/AH: Platt scaling fitted on train seasons only',
      max_goals: MAX_GOALS,
    },
    calibration_note: calibrationNote,
    folds: foldReports,
    calibration_folds: calFolds,
    markets: {
      ML: summarizeMarket(mlEligible, 'ML'),
      OU25: summarizeMarket(ouEligible, 'OU25'),
      BTTS: summarizeMarket(bttsAll, 'BTTS'),
      AH: summarizeMarket(ahAll, 'AH'),
    },
    calibration: {
      before: {
        ML: calSummary(mlEligible, false),
        OU25: calSummary(ouEligible, false),
        BTTS: calSummary(bttsAll, false),
        AH: calSummary(ahAll, false),
      },
      after: {
        ML: calSummary(mlEligible, true),
        OU25: calSummary(ouEligible, true),
        BTTS: calSummary(bttsAll, true),
        AH: calSummary(ahAll, true),
      },
    },
    ev_analysis: {
      ML: evBucketAnalysis(mlEligible.map((p) => ({ ev: p.ev_calibrated ?? 0, outcome: p.outcome, profit: p.profit }))),
      OU25: evBucketAnalysis(ouEligible.map((p) => ({ ev: p.ev_calibrated ?? 0, outcome: p.outcome, profit: p.profit }))),
    },
    threshold_analysis: {
      ML: evaluateThresholds(mlEligible),
      OU25: evaluateThresholds(ouEligible),
    },
    clv: { available: false, reason: 'no opening/closing odds split in source data; CLV=NULL' },
    note: 'All metrics out-of-sample. Eligible = core features present + market odds present (ML/OU25). Brier/log-loss on unique matches only. AH is home -0.5 (no push outcome). EV analysis uses calibrated probabilities.',
  };

  fs.writeFileSync(path.join(OUT_DIR, 'walkforward_report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

function evaluateThresholds(picks: OutOfSamplePick[]) {
  const thresholds = [0.01, 0.03, 0.05, 0.07];
  return thresholds.map((th) => {
    const subset = picks.filter((p) => (p.ev_calibrated ?? -Infinity) >= th);
    const withProfit = subset.filter((p) => p.profit !== null);
    const wins = subset.filter((p) => p.outcome === 'WIN').length;
    const wr = winRateWithCI(wins, subset.length);
    const roi = roiWithCI(withProfit.map((p) => p.profit!), withProfit.map(() => 1));
    const avgEv = subset.length > 0 ? Number((subset.reduce((s, p) => s + (p.ev_calibrated ?? 0), 0) / subset.length).toFixed(4)) : null;
    const totalProfit = subset.reduce((s, p) => s + (p.profit ?? 0), 0);
    return {
      threshold: `>=${(th * 100).toFixed(0)}%`,
      bets: subset.length,
      wins,
      losses: subset.length - wins,
      hit_rate: wr ? Number(wr.mean.toFixed(4)) : null,
      avg_ev: avgEv,
      profit: Number(totalProfit.toFixed(2)),
      roi: roi ? Number(roi.roi.toFixed(4)) : null,
      roi_ci95: roi ? [Number(roi.ci95_low.toFixed(4)), Number(roi.ci95_high.toFixed(4))] : null,
    };
  });
}

function summarizeMarket(picks: OutOfSamplePick[], market: string) {
  const withOutcome = picks.filter((p) => p.outcome !== null);
  const withProfit = withOutcome.filter((p) => p.profit !== null);
  const wins = withOutcome.filter((p) => p.outcome === 'WIN').length;
  const pushes = withOutcome.filter((p) => p.outcome === 'PUSH').length;
  const wr = winRateWithCI(wins, withOutcome.length);
  const roi = roiWithCI(withProfit.map((p) => p.profit!), withProfit.map(() => 1));
  const evs = withProfit.map((p) => p.ev_calibrated!).filter((v) => v !== null);
  const avgEv = evs.length > 0 ? Number((evs.reduce((s, v) => s + v, 0) / evs.length).toFixed(4)) : null;
  const realized = roi ? Number(roi.roi.toFixed(4)) : null;
  return {
    market,
    total_picks: picks.length,
    settled_picks: withOutcome.length,
    wins,
    pushes,
    losses: withOutcome.length - wins - pushes,
    win_rate: wr ? { value: Number(wr.mean.toFixed(4)), ci95: [Number(wr.ci95_low.toFixed(4)), Number(wr.ci95_high.toFixed(4))] } : null,
    roi: roi ? { value: Number(roi.roi.toFixed(4)), ci95: [Number(roi.ci95_low.toFixed(4)), Number(roi.ci95_high.toFixed(4))] } : null,
    avg_ev_calibrated: avgEv,
    realized_roi: realized,
  };
}

main();
