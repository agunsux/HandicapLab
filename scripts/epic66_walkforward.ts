import * as fs from 'fs';
import * as path from 'path';
import {
  settleAsianHandicap,
  settleAsianTotal,
  settleBtts,
  profitOfOutcome,
  type SettlementOutcome
} from '../src/historical/settlement/settlement';
import { computeLambdas, scoreMatrix, deriveMarkets, type PoissonParams, type LambdaInput } from '../src/historical/model/poisson';
import { studentTPValue } from './epic65_backtest_runner';

interface CanonicalMatch {
  canonicalId: string;
  leagueId: string;
  season: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  odds: {
    bookmakerSource?: string;
    ahLine?: number | null;
    ahHome?: number | null;
    ahAway?: number | null;
    ouLine?: number | null;
    over?: number | null;
    under?: number | null;
  };
}

interface TeamRollingState {
  matches: number;
  goalsFor: number;
  goalsAgainst: number;
  homeMatches: number;
  homeGoalsFor: number;
  homeGoalsAgainst: number;
  awayMatches: number;
  awayGoalsFor: number;
  awayGoalsAgainst: number;
  elo: number;
}

interface WalkForwardBet {
  canonicalId: string;
  leagueId: string;
  season: string;
  matchDate: string;
  market: 'AH' | 'OU' | 'BTTS';
  line: number;
  side: string;
  modelProb: number;
  fairOdds: number;
  marketOdds: number;
  edge: number;
  ev: number;
  clv: number;
  outcome: SettlementOutcome;
  profit: number;
  isOutOfSample: boolean; // Season 2 = true
}

export interface ModelComparisonResult {
  strategyName: string;
  market: 'AH' | 'OU' | 'BTTS';
  line: number;
  side: string;
  // Market-only baseline (no model filter)
  baselineBets: number;
  baselineRoiPct: number;
  // Model-qualified (EV > 0 & Edge > 0)
  inSampleBets: number;
  inSampleRoiPct: number;
  outOfSampleBets: number;
  outOfSampleRoiPct: number;
  totalModelBets: number;
  totalModelProfit: number;
  totalModelRoiPct: number;
  modelClvMeanPct: number;
  alphaVsMarketPct: number; // Model ROI - Baseline ROI
  tStat: number;
  pValue: number;
  tier: 'RED' | 'GREY' | 'YELLOW' | 'GREEN' | 'GOLD';
}

function getQuarterWeightedProb(pAhHome: Record<string, number>, line: number): number {
  const lineStr = line > 0 ? `+${line.toFixed(1)}` : line.toFixed(1);
  if (pAhHome[lineStr] !== undefined) return pAhHome[lineStr];

  const lower = Math.floor(line * 2) / 2;
  const upper = lower + 0.5;
  const lowStr = lower > 0 ? `+${lower.toFixed(1)}` : lower.toFixed(1);
  const upStr = upper > 0 ? `+${upper.toFixed(1)}` : upper.toFixed(1);

  const pLow = pAhHome[lowStr] ?? 0.5;
  const pUp = pAhHome[upStr] ?? 0.5;
  return (pLow + pUp) / 2;
}

export function runWalkForwardValidation() {
  console.log('===============================================================');
  console.log('EPIC 66 — Out-of-Sample Walk-Forward Modeling vs Market Baseline');
  console.log('===============================================================');

  const matchesPath = path.resolve('data/golden/epic65/canonical_matches.jsonl');
  if (!fs.existsSync(matchesPath)) throw new Error('Missing canonical_matches.jsonl');

  const allMatches: CanonicalMatch[] = fs
    .readFileSync(matchesPath, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  // Sort strictly chronologically
  const matches = allMatches.sort((a, b) => {
    const cmp = a.matchDate.localeCompare(b.matchDate);
    if (cmp !== 0) return cmp;
    return a.canonicalId.localeCompare(b.canonicalId);
  });

  console.log(`Loaded and sorted ${matches.length} matches chronologically.`);

  const teamStats = new Map<string, TeamRollingState>();
  const getStats = (leagueId: string, team: string): TeamRollingState => {
    const key = `${leagueId}|${team}`;
    if (!teamStats.has(key)) {
      teamStats.set(key, {
        matches: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        homeMatches: 0,
        homeGoalsFor: 0,
        homeGoalsAgainst: 0,
        awayMatches: 0,
        awayGoalsFor: 0,
        awayGoalsAgainst: 0,
        elo: 1500
      });
    }
    return teamStats.get(key)!;
  };

  const modelBets: WalkForwardBet[] = [];
  const baselineBetsMap = new Map<string, { bets: number; profit: number }>();

  const trackBaseline = (key: string, profit: number) => {
    const curr = baselineBetsMap.get(key) || { bets: 0, profit: 0 };
    curr.bets++;
    curr.profit += profit;
    baselineBetsMap.set(key, curr);
  };

  const leagueTotals: Record<string, { homeGoals: number; awayGoals: number; matches: number }> = {};
  for (const lg of ['ENG-PL', 'ESP-LALIGA', 'ITA-SERIEA', 'DEU-BUNDESLIGA', 'FRA-LIGUE1']) {
    leagueTotals[lg] = { homeGoals: 0, awayGoals: 0, matches: 0 };
  }

  // Walk-forward loop
  for (const m of matches) {
    const isOutOfSample = m.season === '2025-2026';
    const hStats = getStats(m.leagueId, m.homeTeam);
    const aStats = getStats(m.leagueId, m.awayTeam);
    const lgTot = leagueTotals[m.leagueId] || { homeGoals: 0, awayGoals: 0, matches: 0 };

    // Compute Poisson parameters strictly using history prior to this match
    const lgHomeAvg = lgTot.matches > 40 ? lgTot.homeGoals / lgTot.matches : 1.45;
    const lgAwayAvg = lgTot.matches > 40 ? lgTot.awayGoals / lgTot.matches : 1.15;

    const pHomeScored = hStats.homeMatches >= 5 ? hStats.homeGoalsFor / hStats.homeMatches : (hStats.matches >= 5 ? hStats.goalsFor / hStats.matches : lgHomeAvg);
    const pAwayConceded = aStats.awayMatches >= 5 ? aStats.awayGoalsAgainst / aStats.awayMatches : (aStats.matches >= 5 ? aStats.goalsAgainst / aStats.matches : lgHomeAvg);
    const pAwayScored = aStats.awayMatches >= 5 ? aStats.awayGoalsFor / aStats.awayMatches : (aStats.matches >= 5 ? aStats.goalsFor / aStats.matches : lgAwayAvg);
    const pHomeConceded = hStats.homeMatches >= 5 ? hStats.homeGoalsAgainst / hStats.homeMatches : (hStats.matches >= 5 ? hStats.goalsAgainst / hStats.matches : lgAwayAvg);

    const lambdaInput: LambdaInput = {
      homeAvgGoalsFor: pHomeScored,
      awayAvgGoalsAgainst: pAwayConceded,
      awayAvgGoalsFor: pAwayScored,
      homeAvgGoalsAgainst: pHomeConceded,
      leagueAvgGoals: (lgHomeAvg + lgAwayAvg) / 2,
      eloDelta: hStats.elo - aStats.elo
    };

    const poissonParams: PoissonParams = {
      leagueHomeAvg: lgHomeAvg,
      leagueAwayAvg: lgAwayAvg,
      homeAdv: 0.25,
      eloScale: 400,
      maxGoals: 10
    };

    const lambdas = computeLambdas(lambdaInput, poissonParams);
    const matrix = scoreMatrix(lambdas, 10);
    const marketProbs = deriveMarkets(matrix);

    // Warm-up filter: require at least 8 matches of prior experience for reliable ratings
    if (hStats.matches >= 8 && aStats.matches >= 8) {
      // ----------------------------------------------------------------------
      // 1. Asian Handicap Evaluation
      // ----------------------------------------------------------------------
      const line = m.odds.ahLine;
      const ahHomeOdds = m.odds.ahHome;
      const ahAwayOdds = m.odds.ahAway;

      if (line !== undefined && line !== null && ahHomeOdds && ahAwayOdds && ahHomeOdds > 1.01 && ahAwayOdds > 1.01) {
        // Track raw market baseline
        const homeOutcome = settleAsianHandicap('home', line, m.homeGoals, m.awayGoals);
        const homeProfit = profitOfOutcome(homeOutcome, ahHomeOdds, 1.0);
        trackBaseline(`AH_${line.toFixed(2)}_home`, homeProfit);

        const awayOutcome = settleAsianHandicap('away', line, m.homeGoals, m.awayGoals);
        const awayProfit = profitOfOutcome(awayOutcome, ahAwayOdds, 1.0);
        trackBaseline(`AH_${line.toFixed(2)}_away`, awayProfit);

        // Model predictions
        const pHomeCover = getQuarterWeightedProb(marketProbs.pAhHome, line);
        const pAwayCover = 1 - pHomeCover;

        const evHome = pHomeCover * (ahHomeOdds - 1) - (1 - pHomeCover);
        const evAway = pAwayCover * (ahAwayOdds - 1) - (1 - pAwayCover);

        // Home Edge Qualifier
        if (evHome > 0.02) {
          const fairOdds = 1 / Math.max(0.01, pHomeCover);
          const clv = (ahHomeOdds / fairOdds - 1) * 100;
          modelBets.push({
            canonicalId: m.canonicalId,
            leagueId: m.leagueId,
            season: m.season,
            matchDate: m.matchDate,
            market: 'AH',
            line,
            side: 'home',
            modelProb: pHomeCover,
            fairOdds,
            marketOdds: ahHomeOdds,
            edge: (pHomeCover - (1 / ahHomeOdds)) * 100,
            ev: evHome,
            clv,
            outcome: homeOutcome,
            profit: homeProfit,
            isOutOfSample
          });
        }

        // Away Edge Qualifier
        if (evAway > 0.02) {
          const fairOdds = 1 / Math.max(0.01, pAwayCover);
          const clv = (ahAwayOdds / fairOdds - 1) * 100;
          modelBets.push({
            canonicalId: m.canonicalId,
            leagueId: m.leagueId,
            season: m.season,
            matchDate: m.matchDate,
            market: 'AH',
            line,
            side: 'away',
            modelProb: pAwayCover,
            fairOdds,
            marketOdds: ahAwayOdds,
            edge: (pAwayCover - (1 / ahAwayOdds)) * 100,
            ev: evAway,
            clv,
            outcome: awayOutcome,
            profit: awayProfit,
            isOutOfSample
          });
        }
      }

      // ----------------------------------------------------------------------
      // 2. Over / Under Evaluation
      // ----------------------------------------------------------------------
      if (m.odds.over && m.odds.under) {
        const line = m.odds.ouLine || 2.5;
        const pOver = marketProbs.pOver['2.5'];
        const pUnder = marketProbs.pUnder['2.5'];

        const overOutcome = settleAsianTotal('over', line, m.homeGoals + m.awayGoals);
        const overProfit = profitOfOutcome(overOutcome, m.odds.over, 1.0);
        trackBaseline(`OU_${line.toFixed(2)}_over`, overProfit);

        const underOutcome = settleAsianTotal('under', line, m.homeGoals + m.awayGoals);
        const underProfit = profitOfOutcome(underOutcome, m.odds.under, 1.0);
        trackBaseline(`OU_${line.toFixed(2)}_under`, underProfit);

        const evOver = pOver * (m.odds.over - 1) - (1 - pOver);
        if (evOver > 0.02) {
          const fairOdds = 1 / Math.max(0.01, pOver);
          modelBets.push({
            canonicalId: m.canonicalId,
            leagueId: m.leagueId,
            season: m.season,
            matchDate: m.matchDate,
            market: 'OU',
            line,
            side: 'over',
            modelProb: pOver,
            fairOdds,
            marketOdds: m.odds.over,
            edge: (pOver - (1 / m.odds.over)) * 100,
            ev: evOver,
            clv: (m.odds.over / fairOdds - 1) * 100,
            outcome: overOutcome,
            profit: overProfit,
            isOutOfSample
          });
        }
      }
    }

    // Update rolling team statistics strictly AFTER match completion
    hStats.matches++;
    hStats.goalsFor += m.homeGoals;
    hStats.goalsAgainst += m.awayGoals;
    hStats.homeMatches++;
    hStats.homeGoalsFor += m.homeGoals;
    hStats.homeGoalsAgainst += m.awayGoals;

    aStats.matches++;
    aStats.goalsFor += m.awayGoals;
    aStats.goalsAgainst += m.homeGoals;
    aStats.awayMatches++;
    aStats.awayGoalsFor += m.awayGoals;
    aStats.awayGoalsAgainst += m.homeGoals;

    const eloExpHome = 1 / (1 + Math.pow(10, (aStats.elo - hStats.elo) / 400));
    const eloActualHome = m.homeGoals > m.awayGoals ? 1.0 : m.homeGoals === m.awayGoals ? 0.5 : 0.0;
    hStats.elo += 20 * (eloActualHome - eloExpHome);
    aStats.elo += 20 * (1 - eloActualHome - (1 - eloExpHome));

    if (leagueTotals[m.leagueId]) {
      leagueTotals[m.leagueId].matches++;
      leagueTotals[m.leagueId].homeGoals += m.homeGoals;
      leagueTotals[m.leagueId].awayGoals += m.awayGoals;
    }
  }

  console.log(`\nWalk-forward complete! Total model-qualified bets evaluated: ${modelBets.length}`);

  // Group model bets by strategy (market + line + side)
  const strategyMap = new Map<string, WalkForwardBet[]>();
  for (const b of modelBets) {
    const key = `${b.market}_${b.line.toFixed(2)}_${b.side}`;
    const curr = strategyMap.get(key) || [];
    curr.push(b);
    strategyMap.set(key, curr);
  }

  const comparisonResults: ModelComparisonResult[] = [];

  for (const [key, bets] of strategyMap.entries()) {
    const sample = bets[0];
    const baseline = baselineBetsMap.get(key) || { bets: 0, profit: 0 };
    const baselineRoi = baseline.bets > 0 ? (baseline.profit / baseline.bets) * 100 : 0;

    const inSample = bets.filter((b) => !b.isOutOfSample);
    const outOfSample = bets.filter((b) => b.isOutOfSample);

    const isProfit = inSample.reduce((s, b) => s + b.profit, 0);
    const oosProfit = outOfSample.reduce((s, b) => s + b.profit, 0);
    const totalProfit = bets.reduce((s, b) => s + b.profit, 0);

    const isRoi = inSample.length > 0 ? (isProfit / inSample.length) * 100 : 0;
    const oosRoi = outOfSample.length > 0 ? (oosProfit / outOfSample.length) * 100 : 0;
    const totalRoi = bets.length > 0 ? (totalProfit / bets.length) * 100 : 0;

    const clvMean = bets.reduce((s, b) => s + b.clv, 0) / bets.length;
    const alpha = totalRoi - baselineRoi;

    // t-statistic
    const mean = totalProfit / bets.length;
    let varSum = 0;
    for (const b of bets) varSum += Math.pow(b.profit - mean, 2);
    const se = Math.sqrt(varSum / bets.length / bets.length);
    const tStat = se > 0 ? mean / se : 0;
    const pVal = bets.length > 1 ? studentTPValue(tStat, bets.length - 1) : 1.0;

    let tier: 'RED' | 'GREY' | 'YELLOW' | 'GREEN' | 'GOLD' = 'GREY';
    if (totalRoi < 0 || oosRoi < 0) {
      tier = 'RED';
    } else if (totalRoi > 0 && oosRoi > 0 && bets.length >= 250 && pVal < 0.05 && clvMean > 0) {
      tier = bets.length >= 500 ? 'GOLD' : 'GREEN';
    } else if (totalRoi > 0) {
      tier = 'YELLOW';
    }

    comparisonResults.push({
      strategyName: `${sample.market} ${sample.line > 0 ? '+' : ''}${sample.line.toFixed(2)} ${sample.side.toUpperCase()}`,
      market: sample.market,
      line: sample.line,
      side: sample.side,
      baselineBets: baseline.bets,
      baselineRoiPct: Number(baselineRoi.toFixed(2)),
      inSampleBets: inSample.length,
      inSampleRoiPct: Number(isRoi.toFixed(2)),
      outOfSampleBets: outOfSample.length,
      outOfSampleRoiPct: Number(oosRoi.toFixed(2)),
      totalModelBets: bets.length,
      totalModelProfit: Number(totalProfit.toFixed(2)),
      totalModelRoiPct: Number(totalRoi.toFixed(2)),
      modelClvMeanPct: Number(clvMean.toFixed(2)),
      alphaVsMarketPct: Number(alpha.toFixed(2)),
      tStat: Number(tStat.toFixed(3)),
      pValue: Number(pVal.toFixed(4)),
      tier
    });
  }

  // Sort by Out-of-Sample ROI descending
  comparisonResults.sort((a, b) => b.outOfSampleRoiPct - a.outOfSampleRoiPct);

  // Save report
  const outJson = path.resolve('data/reports/epic66_walkforward_report.json');
  fs.writeFileSync(
    outJson,
    JSON.stringify({ version: 'epic66-v1.0', total_strategies: comparisonResults.length, strategies: comparisonResults }, null, 2),
    'utf-8'
  );

  console.log('\n=== TOP 8 OUT-OF-SAMPLE WALK-FORWARD STRATEGIES ===');
  console.table(
    comparisonResults.slice(0, 8).map((r) => ({
      Strategy: r.strategyName,
      'Base ROI': `${r.baselineRoiPct}%`,
      'IS Bets': r.inSampleBets,
      'IS ROI': `${r.inSampleRoiPct}%`,
      'OOS Bets': r.outOfSampleBets,
      'OOS ROI': `${r.outOfSampleRoiPct}%`,
      'Total ROI': `${r.totalModelRoiPct}%`,
      'Alpha vs Mkt': `${r.alphaVsMarketPct > 0 ? '+' : ''}${r.alphaVsMarketPct}%`,
      CLV: `${r.modelClvMeanPct}%`,
      Tier: r.tier
    }))
  );

  console.log(`\nWalk-forward report saved to ${outJson}\n`);
}

if (require.main === module) {
  runWalkForwardValidation();
}
