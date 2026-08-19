// Walk-forward backtest engine over the verified Gold Layer.
// Methodology (mirrors python_engine/engine/backtester.py):
//   1. Group matches by league, sort chronologically
//   2. Skip first N matches per league (minimum training data)
//   3. Expanding window: train ONLY on matches before the current match
//   4. Retrain every K matches (checkpoint)
//   5. Evaluate ML/AH/OU with Pinnacle opening odds (entry) + Pinnacle
//      closing odds (CLV reference) — NO look-ahead: entry odds are pre-match.
//   6. ONE pick per match (highest edge), flat 1-unit stake
//   7. Settle against actual result, compute metrics
//
// This engine is PURE: it receives database rows and returns computed
// statistics. No fabricated values, no random numbers, no hardcoding.

import { HOMEPAGE_INTELLIGENCE } from '../constants';
import { DixonColesFitter } from '../model/dixonColes';
import type { DCTrainingMatch } from '../model/dixonColes';
import {
  settleMoneyline,
  settleAsianHandicap,
  settleOverUnder,
} from './settlement';
import {
  computeSummary,
  computeMarketSummary,
  computeLeagueSummary,
  computeSeasonSummary,
  computeCalibration,
} from './metrics';
import type {
  BacktestBet,
  BacktestRunResult,
  GoldMatch,
  GoldOdds,
  MarketOddsPair,
} from './types';

const SKIP_FIRST_N = HOMEPAGE_INTELLIGENCE.skipFirstN;
const RETRAIN_EVERY = HOMEPAGE_INTELLIGENCE.retrainEvery;
const MIN_EDGE_PCT = HOMEPAGE_INTELLIGENCE.minEdgePct;
const MIN_CONFIDENCE = HOMEPAGE_INTELLIGENCE.minConfidence;

function formBonus(leagueSize: number): number {
  if (leagueSize > 200) return 12;
  if (leagueSize > 100) return 8;
  return 4;
}

function sampleBonus(trainingSize: number): number {
  if (trainingSize > 300) return 8;
  if (trainingSize > 150) return 5;
  return 2;
}

function computeConfidence(edgePct: number, leagueSize: number, trainingSize: number): number {
  const raw = 50 + edgePct * 5 + formBonus(leagueSize) + sampleBonus(trainingSize);
  return Math.min(95, Math.round(raw * 10) / 10);
}

interface OddsRow {
  market: 'ML' | 'AH' | 'OU';
  observation: 'opening' | 'closing';
  bookmaker: string;
  line: number | null;
  homeOdds: number | null;
  drawOdds: number | null;
  awayOdds: number | null;
  overOdds: number | null;
  underOdds: number | null;
}

interface EvaluatedPick {
  market: 'ML' | 'AH' | 'OU';
  selection: 'home' | 'draw' | 'away' | 'over' | 'under';
  line: number | null;
  modelProb: number;
  entryOdds: number;
  closingOdds: number | null;
  edgePct: number;
  evPct: number;
  confidence: number;
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function normalizeMatchInput(m: any): GoldMatch {
  const homeGoals = m.home_goals ?? m.homeGoals ?? m.homeScore ?? 0;
  const awayGoals = m.away_goals ?? m.awayGoals ?? m.awayScore ?? 0;
  return {
    canonical_id: m.canonical_id || m.canonicalId || m.id || '',
    league_id: m.league_id || m.leagueId || m.competition || m.league || 'default',
    cluster: m.cluster || 'A',
    season: m.season || '',
    match_date: m.match_date || m.matchDate || m.kickoff || '',
    home_team: m.home_team || m.homeTeam || '',
    away_team: m.away_team || m.awayTeam || '',
    home_goals: homeGoals,
    away_goals: awayGoals,
    result: m.result || (homeGoals > awayGoals ? 'H' : (homeGoals < awayGoals ? 'A' : 'D')),
    total_goals: homeGoals + awayGoals,
    home_win: m.home_win ?? m.homeWin ?? (homeGoals > awayGoals),
    draw: m.draw ?? (homeGoals === awayGoals),
    away_win: m.away_win ?? m.awayWin ?? (homeGoals < awayGoals),
    btts: m.btts ?? (homeGoals > 0 && awayGoals > 0),
    over25: m.over25 ?? (homeGoals + awayGoals > 2.5),
    under25: m.under25 ?? (homeGoals + awayGoals < 2.5),
  };
}

function normalizeOddsInput(o: any): GoldOdds {
  let homeOdds = o.home_odds ?? o.homeOdds ?? null;
  let drawOdds = o.draw_odds ?? o.drawOdds ?? null;
  let awayOdds = o.away_odds ?? o.awayOdds ?? null;
  let overOdds = o.over_odds ?? o.overOdds ?? null;
  let underOdds = o.under_odds ?? o.underOdds ?? null;

  if (o.odds !== undefined && o.selection) {
    const sel = String(o.selection).toUpperCase();
    if (sel === 'HOME' || sel === 'H') homeOdds = o.odds;
    else if (sel === 'DRAW' || sel === 'D') drawOdds = o.odds;
    else if (sel === 'AWAY' || sel === 'A') awayOdds = o.odds;
    else if (sel === 'OVER' || sel === 'O') overOdds = o.odds;
    else if (sel === 'UNDER' || sel === 'U') underOdds = o.odds;
  }

  return {
    odds_id: o.odds_id || o.oddsId || o.id || '',
    canonical_id: o.canonical_id || o.canonicalId || o.matchId || o.match_id || '',
    market: o.market === 'MONEYLINE' ? '1X2' : (o.market || '1X2'),
    observation: o.observation || 'CLOSING',
    bookmaker_source: o.bookmaker_source || o.bookmakerSource || o.bookmaker || 'pinnacle',
    line: o.line ?? null,
    home_odds: homeOdds,
    draw_odds: drawOdds,
    away_odds: awayOdds,
    over_odds: overOdds,
    under_odds: underOdds,
  };
}

export function runWalkForwardBacktest(
  rawMatches: GoldMatch[],
  rawOdds: GoldOdds[],
  datasetHash: string | null = null
): BacktestRunResult {
  const matches = (rawMatches || []).map(normalizeMatchInput);
  const odds = (rawOdds || []).map(normalizeOddsInput);
  const startWall = Date.now();
  const allBets: BacktestBet[] = [];
  const allPredictions: { pHome: number; pBtts: number }[] = [];

  // Group + sort matches by league chronologically.
  const byLeague = new Map<string, GoldMatch[]>();
  for (const m of matches) {
    if (!m.league_id) continue;
    if (!byLeague.has(m.league_id)) byLeague.set(m.league_id, []);
    byLeague.get(m.league_id)!.push(m);
  }
  for (const list of byLeague.values()) {
    list.sort((a, b) => (a.match_date || '').localeCompare(b.match_date || ''));
  }

  // Index odds by canonical_id.
  const oddsByMatch = new Map<string, OddsRow[]>();
  for (const o of odds) {
    if (!o.canonical_id) continue;
    if (!oddsByMatch.has(o.canonical_id)) oddsByMatch.set(o.canonical_id, []);
    oddsByMatch.get(o.canonical_id)!.push({
      market: o.market,
      observation: o.observation,
      bookmaker: o.bookmaker_source,
      line: o.line,
      homeOdds: o.home_odds,
      drawOdds: o.draw_odds,
      awayOdds: o.away_odds,
      overOdds: o.over_odds,
      underOdds: o.under_odds,
    });
  }

  // Resolve per-match market odds: entry = Pinnacle opening (pre-match, no
  // leakage), CLV reference = Pinnacle closing.
  function getMarketOdds(canonicalId: string): Map<'ML' | 'AH' | 'OU', MarketOddsPair> {
    const rows = oddsByMatch.get(canonicalId) ?? [];
    const out = new Map<'ML' | 'AH' | 'OU', MarketOddsPair>();

    for (const market of ['ML', 'AH', 'OU'] as const) {
      const marketRows = rows.filter((r) => r.market === market);

      const openingRows = marketRows.filter((r) => r.observation === 'opening');
      const closingRows = marketRows.filter((r) => r.observation === 'closing');

      const openingPin = openingRows.find((r) => r.bookmaker === 'pinnacle');
      const openingB365 = openingRows.find((r) => r.bookmaker === 'bet365');
      const opening = openingPin ?? openingB365;

      const closingPin = closingRows.find((r) => r.bookmaker === 'pinnacle');

      const line = (opening?.line ?? closingPin?.line ?? null);
      out.set(market, {
        market,
        line,
        opening: {
          home: opening?.homeOdds ?? undefined,
          draw: opening?.drawOdds ?? undefined,
          away: opening?.awayOdds ?? undefined,
          over: opening?.overOdds ?? undefined,
          under: opening?.underOdds ?? undefined,
        },
        closing: {
          home: closingPin?.homeOdds ?? undefined,
          draw: closingPin?.drawOdds ?? undefined,
          away: closingPin?.awayOdds ?? undefined,
          over: closingPin?.overOdds ?? undefined,
          under: closingPin?.underOdds ?? undefined,
        },
      });
    }
    return out;
  }

  // Walk forward per league.
  for (const [leagueId, leagueMatches] of byLeague) {
    if (leagueMatches.length < HOMEPAGE_INTELLIGENCE.minLeagueMatches) continue;

    let model: DixonColesFitter | null = null;

    for (let i = SKIP_FIRST_N; i < leagueMatches.length; i++) {
      const match = leagueMatches[i];

      // Retrain checkpoint — expanding window (only matches BEFORE i).
      const shouldRetrain = (i - SKIP_FIRST_N) % RETRAIN_EVERY === 0 || model === null;
      if (shouldRetrain) {
        const training = leagueMatches.slice(0, i).map<DCTrainingMatch>((m) => ({
          homeTeam: m.home_team,
          awayTeam: m.away_team,
          homeGoals: m.home_goals,
          awayGoals: m.away_goals,
          date: m.match_date,
        }));
        model = new DixonColesFitter(
          HOMEPAGE_INTELLIGENCE.dcRhoInit,
          HOMEPAGE_INTELLIGENCE.dcXi,
          HOMEPAGE_INTELLIGENCE.maxGoals
        );
        model.fit(training);
      }

      if (!model) continue;

      const prediction = model.predict(match.home_team, match.away_team);
      allPredictions.push({ pHome: prediction.pHome, pBtts: prediction.pBtts });

      const oddsMap = getMarketOdds(match.canonical_id);
      const candidates: EvaluatedPick[] = [];

      // ML
      const ml = oddsMap.get('ML');
      if (ml) {
        evaluate('ML', 'home', null, prediction.pHome, ml.opening.home, ml.closing.home, candidates, leagueMatches.length, i);
        evaluate('ML', 'draw', null, prediction.pDraw, ml.opening.draw, ml.closing.draw, candidates, leagueMatches.length, i);
        evaluate('ML', 'away', null, prediction.pAway, ml.opening.away, ml.closing.away, candidates, leagueMatches.length, i);
      }

      // OU 2.5
      const ou = oddsMap.get('OU');
      if (ou) {
        evaluate('OU', 'over', 2.5, prediction.pOver25, ou.opening.over, ou.closing.over, candidates, leagueMatches.length, i);
        evaluate('OU', 'under', 2.5, prediction.pUnder25, ou.opening.under, ou.closing.under, candidates, leagueMatches.length, i);
      }

      // AH — use the actual line from the odds row; fall back to -0.5
      const ah = oddsMap.get('AH');
      if (ah) {
        const line = ah.line ?? -0.5;
        const key = String(line);
        const ahProb = prediction.ahProbs[key];
        if (ahProb) {
          evaluate('AH', 'home', line, ahProb.home, ah.opening.home, ah.closing.home, candidates, leagueMatches.length, i);
          evaluate('AH', 'away', line, ahProb.away, ah.opening.away, ah.closing.away, candidates, leagueMatches.length, i);
        }
      }

      if (candidates.length === 0) continue;

      // ONE pick per match — highest edge.
      candidates.sort((a, b) => b.edgePct - a.edgePct);
      const best = candidates[0];

      // Settle.
      let outcome: BacktestBet['outcome'];
      let profitUnits: number;
      if (best.market === 'ML') {
        const r = settleMoneyline(match.home_goals, match.away_goals, best.selection as 'home' | 'draw' | 'away', best.entryOdds);
        outcome = r.outcome;
        profitUnits = r.profitUnits;
      } else if (best.market === 'AH') {
        const r = settleAsianHandicap(match.home_goals, match.away_goals, best.line ?? -0.5, best.selection as 'home' | 'away', best.entryOdds);
        outcome = r.outcome;
        profitUnits = r.profitUnits;
      } else {
        const r = settleOverUnder(match.home_goals, match.away_goals, best.line ?? 2.5, best.selection as 'over' | 'under', best.entryOdds);
        outcome = r.outcome;
        profitUnits = r.profitUnits;
      }

      allBets.push({
        matchDate: match.match_date,
        leagueId,
        season: match.season,
        market: best.market,
        selection: best.selection,
        line: best.line,
        entryOdds: best.entryOdds,
        closingOdds: best.closingOdds,
        modelProb: best.modelProb,
        edgePct: best.edgePct,
        evPct: best.evPct,
        confidence: best.confidence,
        outcome,
        profitUnits,
        cumulativeProfit: 0,
      });
    }
  }

  // Sort bets chronologically + compute cumulative P&L.
  allBets.sort((a, b) => a.matchDate.localeCompare(b.matchDate));
  let cumulative = 0;
  for (const bet of allBets) {
    cumulative += bet.profitUnits;
    bet.cumulativeProfit = Number(cumulative.toFixed(4));
  }

  const summary = computeSummary(
    allBets.map((b) => ({
      matchDate: b.matchDate,
      leagueId: b.leagueId,
      market: b.market,
      selection: b.selection,
      line: b.line,
      entryOdds: b.entryOdds,
      closingOdds: b.closingOdds,
      modelProb: b.modelProb,
      edgePct: b.edgePct,
      evPct: b.evPct,
      confidence: b.confidence,
      result: { outcome: b.outcome, profitUnits: b.profitUnits },
      cumulativeProfit: b.cumulativeProfit,
    })),
    matches.length,
    HOMEPAGE_INTELLIGENCE.stakeUnits
  );

  const marketSummaries = computeMarketSummary(
    allBets.map((b) => ({
      matchDate: b.matchDate,
      leagueId: b.leagueId,
      market: b.market,
      selection: b.selection,
      line: b.line,
      entryOdds: b.entryOdds,
      closingOdds: b.closingOdds,
      modelProb: b.modelProb,
      edgePct: b.edgePct,
      evPct: b.evPct,
      confidence: b.confidence,
      result: { outcome: b.outcome, profitUnits: b.profitUnits },
      cumulativeProfit: b.cumulativeProfit,
    }))
  );

  const leagueSummaries = computeLeagueSummary(
    allBets.map((b) => ({
      matchDate: b.matchDate,
      leagueId: b.leagueId,
      market: b.market,
      selection: b.selection,
      line: b.line,
      entryOdds: b.entryOdds,
      closingOdds: b.closingOdds,
      modelProb: b.modelProb,
      edgePct: b.edgePct,
      evPct: b.evPct,
      confidence: b.confidence,
      result: { outcome: b.outcome, profitUnits: b.profitUnits },
      cumulativeProfit: b.cumulativeProfit,
    }))
  );

  const seasonSummaries = computeSeasonSummary(
    allBets.map((b) => ({
      matchDate: b.matchDate,
      leagueId: b.leagueId,
      market: b.market,
      selection: b.selection,
      line: b.line,
      entryOdds: b.entryOdds,
      closingOdds: b.closingOdds,
      modelProb: b.modelProb,
      edgePct: b.edgePct,
      evPct: b.evPct,
      confidence: b.confidence,
      result: { outcome: b.outcome, profitUnits: b.profitUnits },
      cumulativeProfit: b.cumulativeProfit,
    }))
  );

  const calibration = computeCalibration(
    allBets.map((b) => ({
      matchDate: b.matchDate,
      leagueId: b.leagueId,
      market: b.market,
      selection: b.selection,
      line: b.line,
      entryOdds: b.entryOdds,
      closingOdds: b.closingOdds,
      modelProb: b.modelProb,
      edgePct: b.edgePct,
      evPct: b.evPct,
      confidence: b.confidence,
      result: { outcome: b.outcome, profitUnits: b.profitUnits },
      cumulativeProfit: b.cumulativeProfit,
    }))
  );

  // Distribution sanity (mirror python metrics.distribution_sanity_check).
  const homeProbs = allPredictions.map((p) => p.pHome);
  const overProbs = allPredictions.map((p) => p.pBtts);
  const sortedHome = [...homeProbs].sort((a, b) => a - b);
  const p5 = percentile(sortedHome, 0.05);
  const p95 = percentile(sortedHome, 0.95);
  const meanBtts = overProbs.length > 0 ? overProbs.reduce((a, b) => a + b, 0) / overProbs.length : 0;
  const fracAbove75 = homeProbs.length > 0 ? homeProbs.filter((p) => p > 0.75).length / homeProbs.length : 0;
  const check1 = p5 >= 0.35 && p95 <= 0.65;
  const check2 = meanBtts >= 0.4 && meanBtts <= 0.7;
  const check3 = fracAbove75 < 0.2;
  const distributionSanity = {
    check1: { pass: check1, p5: Number(p5.toFixed(4)), p95: Number(p95.toFixed(4)) },
    check2: { pass: check2, meanBtts: Number(meanBtts.toFixed(4)) },
    check3: { pass: check3, fracAbove75: Number(fracAbove75.toFixed(4)) },
    overall: check1 && check2 && check3,
  };

  // Window bounds from data.
  const allDates = [...new Set(matches.map((m) => m.match_date))].sort();
  const windowStart = allDates[0] ?? '';
  const windowEnd = allDates[allDates.length - 1] ?? '';

  console.log(`[BacktestEngine] ${allBets.length} bets from ${matches.length} matches in ${Date.now() - startWall}ms`);

  return {
    status: 'COMPLETE',
    datasetVersion: HOMEPAGE_INTELLIGENCE.datasetVersion,
    datasetHash,
    modelVersion: HOMEPAGE_INTELLIGENCE.modelVersion,
    backtestVersion: HOMEPAGE_INTELLIGENCE.backtestVersion,
    windowStart,
    windowEnd,
    methodology: 'walk-forward-expanding-window',
    matchesTested: summary.matchesTested,
    totalBets: summary.totalBets,
    winRate: summary.winRate,
    profitUnits: summary.profitUnits,
    roiPct: summary.roiPct,
    avgEvPct: summary.avgEvPct,
    avgClvPct: summary.avgClvPct,
    brierScore: summary.brierScore,
    logLoss: summary.logLoss,
    maxDrawdown: summary.maxDrawdown,
    avgOdds: summary.avgOdds,
    stakeUnits: summary.stakeUnits,
    ci95Low: summary.ci95Low,
    ci95High: summary.ci95High,
    markets: marketSummaries.map((m) => ({
      market: m.market,
      totalBets: m.totalBets,
      winRate: m.winRate,
      profitUnits: m.profitUnits,
      roiPct: m.roiPct,
      avgClvPct: m.avgClvPct,
      brierScore: m.brierScore,
      avgEdgePct: m.avgEdgePct,
      avgEvPct: m.avgEvPct,
    })),
    leagues: leagueSummaries,
    seasons: seasonSummaries,
    calibration,
    distributionSanity,
  };
}

function evaluate(
  market: 'ML' | 'AH' | 'OU',
  selection: 'home' | 'draw' | 'away' | 'over' | 'under',
  line: number | null,
  modelProb: number,
  entryOdds: number | undefined,
  closingOdds: number | undefined,
  candidates: EvaluatedPick[],
  leagueSize: number,
  trainingSize: number
): void {
  if (entryOdds === undefined || entryOdds <= 1.0 || modelProb <= 0) return;

  const fairOdds = 1 / modelProb;
  const edgePct = ((entryOdds / fairOdds) - 1) * 100;
  if (edgePct < MIN_EDGE_PCT) return;

  const confidence = computeConfidence(edgePct, leagueSize, trainingSize);
  if (confidence < MIN_CONFIDENCE) return;

  const evPct = (modelProb * entryOdds - 1) * 100;

  candidates.push({
    market,
    selection,
    line,
    modelProb,
    entryOdds,
    closingOdds: closingOdds ?? null,
    edgePct: Number(edgePct.toFixed(2)),
    evPct: Number(evPct.toFixed(2)),
    confidence,
  });
}