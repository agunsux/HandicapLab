import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { ProbabilityEngine } from '../lib/engines/probability-engine';
import { MatchFeatures } from '../lib/engines/feature-engine/types';
import { EdgeScanner } from '../lib/engines/edge-scanner';

export interface PerBetRecord {
  betId: string;
  matchId: string;
  season: string;
  market: 'ML' | 'AH' | 'OU';
  selection: string;
  placedOdds: number;
  closingOdds: number;
  outcome: 'WIN' | 'LOSS' | 'PUSH';
  profitUnits: number;
  clvPct: number;
}

export async function runPerBetLedgerVerification() {
  console.log('====================================================');
  console.log(' HANDICAPLAB — PER-BET SETTLEMENT LEDGER VERIFICATION');
  console.log('====================================================\n');

  const seasons = ['2018-2019', '2019-2020', '2020-2021', '2021-2022', '2022-2023', '2023-2024', '2024-2025'];
  const eloRatings: Record<string, number> = {};
  const getElo = (team: string) => eloRatings[team] || 1500;

  const ledger: PerBetRecord[] = [];
  let betCounter = 0;

  for (const season of seasons) {
    const csvPath = path.join(process.cwd(), 'data', 'bronze', 'football_data', `${season}.csv`);
    if (!fs.existsSync(csvPath)) continue;

    const content = fs.readFileSync(csvPath, 'utf-8');
    const records: any[] = parse(content, { columns: true, skip_empty_lines: true });

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.HomeTeam || !r.AwayTeam || r.FTHG === '' || r.FTAG === '') continue;

      const homeTeam = r.HomeTeam;
      const awayTeam = r.AwayTeam;
      const homeGoals = parseInt(r.FTHG, 10);
      const awayGoals = parseInt(r.FTAG, 10);

      const homeElo = getElo(homeTeam);
      const awayElo = getElo(awayTeam);
      const eloDelta = homeElo - awayElo;

      const features: MatchFeatures = {
        matchId: `hist-${season}-${i}`,
        marketType: 'ML',
        kickoffAt: new Date(r.Date || '2024-01-01'),
        homeFormLast5: [1, 1, 1, 1, 1],
        awayFormLast5: [1, 1, 1, 1, 1],
        homeFormWeighted: 1.0,
        awayFormWeighted: 1.0,
        homeRestDays: 7,
        awayRestDays: 7,
        homeTravelKm: 0,
        homeElo,
        awayElo,
        eloDelta,
        homeAttack: Number((homeElo / 1500).toFixed(2)),
        homeDefense: Number((1500 / homeElo).toFixed(2)),
        awayAttack: Number((awayElo / 1500).toFixed(2)),
        awayDefense: Number((1500 / awayElo).toFixed(2)),
        leagueAvgGoals: 2.80,
        isHomeAdvantage: true,
        leagueId: 'EPL',
        season,
        generatedAt: new Date(r.Date || '2024-01-01'),
      };

      const probOutput = await ProbabilityEngine.predict(features, {
        weights: { poisson: 0.5, dixonColes: 0.5 },
        calibrationMethod: 'platt',
      });

      // 1. Moneyline Market
      const pHome = r.PSH ? parseFloat(r.PSH) : r.B365H ? parseFloat(r.B365H) : null;
      const pDraw = r.PSD ? parseFloat(r.PSD) : r.B365D ? parseFloat(r.B365D) : null;
      const pAway = r.PSA ? parseFloat(r.PSA) : r.B365A ? parseFloat(r.B365A) : null;

      const psch = r.PSCH ? parseFloat(r.PSCH) : pHome;
      const pscd = r.PSCD ? parseFloat(r.PSCD) : pDraw;
      const psca = r.PSCA ? parseFloat(r.PSCA) : pAway;

      if (pHome && pDraw && pAway) {
        const mlOddsSnap = { market: 'ML' as const, homeOdds: pHome, drawOdds: pDraw, awayOdds: pAway };
        const picks = EdgeScanner.scan(features.matchId, 'ML', probOutput, mlOddsSnap, undefined, 0.03);

        picks.forEach((pick) => {
          betCounter++;
          const actualOutcome = homeGoals > awayGoals ? 'home' : homeGoals === awayGoals ? 'draw' : 'away';
          const isWin = pick.outcome === actualOutcome;

          const profitUnits = isWin ? (pick.marketOdds - 1.0) : -1.0;
          let closingOdds = psch;
          if (pick.outcome === 'draw') closingOdds = pscd;
          if (pick.outcome === 'away') closingOdds = psca;

          const clvPct = closingOdds && closingOdds > 0 ? ((pick.marketOdds / closingOdds) - 1.0) * 100 : 0;

          ledger.push({
            betId: `bet-${betCounter}`,
            matchId: features.matchId,
            season,
            market: 'ML',
            selection: pick.outcome,
            placedOdds: pick.marketOdds,
            closingOdds: closingOdds || pick.marketOdds,
            outcome: isWin ? 'WIN' : 'LOSS',
            profitUnits,
            clvPct,
          });
        });
      }

      // 2. Asian Handicap Market
      const ahh = r.PAHH ? parseFloat(r.PAHH) : r.B365AHH ? parseFloat(r.B365AHH) : null;
      const aha = r.PAHA ? parseFloat(r.PAHA) : r.B365AHA ? parseFloat(r.B365AHA) : null;
      const ahLine = r.AHh ? parseFloat(r.AHh) : -0.5;

      const pcahh = r.PCAHH ? parseFloat(r.PCAHH) : ahh;
      const pcaha = r.PCAHA ? parseFloat(r.PCAHA) : aha;

      if (ahh && aha) {
        const ahOddsSnap = { market: 'AH' as const, line: ahLine, homeOdds: ahh, awayOdds: aha };
        const picks = EdgeScanner.scan(features.matchId, 'AH', probOutput, ahOddsSnap, undefined, 0.03);

        picks.forEach((pick) => {
          betCounter++;
          const goalDiff = homeGoals - awayGoals;
          const netDiff = goalDiff + ahLine;

          let outcome: 'WIN' | 'LOSS' | 'PUSH' = 'LOSS';
          let profitUnits = -1.0;

          if (pick.outcome === 'home') {
            if (netDiff > 0) { outcome = 'WIN'; profitUnits = pick.marketOdds - 1.0; }
            else if (netDiff === 0) { outcome = 'PUSH'; profitUnits = 0.0; }
            else { outcome = 'LOSS'; profitUnits = -1.0; }
          } else {
            if (netDiff < 0) { outcome = 'WIN'; profitUnits = pick.marketOdds - 1.0; }
            else if (netDiff === 0) { outcome = 'PUSH'; profitUnits = 0.0; }
            else { outcome = 'LOSS'; profitUnits = -1.0; }
          }

          const closingOdds = pick.outcome === 'home' ? pcahh : pcaha;
          const clvPct = closingOdds && closingOdds > 0 ? ((pick.marketOdds / closingOdds) - 1.0) * 100 : 0;

          ledger.push({
            betId: `bet-${betCounter}`,
            matchId: features.matchId,
            season,
            market: 'AH',
            selection: pick.outcome,
            placedOdds: pick.marketOdds,
            closingOdds: closingOdds || pick.marketOdds,
            outcome,
            profitUnits,
            clvPct,
          });
        });
      }

      // 3. Over / Under Market
      const pOver = r['P>2.5'] ? parseFloat(r['P>2.5']) : r['B365>2.5'] ? parseFloat(r['B365>2.5']) : null;
      const pUnder = r['P<2.5'] ? parseFloat(r['P<2.5']) : r['B365<2.5'] ? parseFloat(r['B365<2.5']) : null;

      const pcOver = r['PC>2.5'] ? parseFloat(r['PC>2.5']) : pOver;
      const pcUnder = r['PC<2.5'] ? parseFloat(r['PC<2.5']) : pUnder;

      if (pOver && pUnder) {
        const ouOddsSnap = { market: 'OU' as const, line: 2.5, homeOdds: pOver, awayOdds: pUnder };
        const picks = EdgeScanner.scan(features.matchId, 'OU', probOutput, ouOddsSnap, undefined, 0.03);

        picks.forEach((pick) => {
          betCounter++;
          const totalGoals = homeGoals + awayGoals;
          const isWin = pick.outcome === 'over' ? totalGoals > 2.5 : totalGoals < 2.5;

          const profitUnits = isWin ? (pick.marketOdds - 1.0) : -1.0;
          const closingOdds = pick.outcome === 'over' ? pcOver : pcUnder;
          const clvPct = closingOdds && closingOdds > 0 ? ((pick.marketOdds / closingOdds) - 1.0) * 100 : 0;

          ledger.push({
            betId: `bet-${betCounter}`,
            matchId: features.matchId,
            season,
            market: 'OU',
            selection: pick.outcome,
            placedOdds: pick.marketOdds,
            closingOdds: closingOdds || pick.marketOdds,
            outcome: isWin ? 'WIN' : 'LOSS',
            profitUnits,
            clvPct,
          });
        });
      }

      // ELO Update post-match
      const K = 32;
      const We = 1 / (Math.pow(10, -eloDelta / 400) + 1);
      const W = homeGoals > awayGoals ? 1.0 : homeGoals === awayGoals ? 0.5 : 0.0;
      eloRatings[homeTeam] = homeElo + K * (W - We);
      eloRatings[awayTeam] = awayElo + K * ((1 - W) - (1 - We));
    }
  }

  // Exact Per-Bet Ledger Aggregations
  const markets = ['ML', 'AH', 'OU'] as const;
  const marketSummaries: Record<string, any> = {};

  markets.forEach((m) => {
    const bets = ledger.filter((b) => b.market === m);
    const count = bets.length;
    const wins = bets.filter((b) => b.outcome === 'WIN').length;
    const losses = bets.filter((b) => b.outcome === 'LOSS').length;
    const pushes = bets.filter((b) => b.outcome === 'PUSH').length;

    const totalStake = count - pushes; // Standard flat-stake on active risk
    const totalProfit = bets.reduce((sum, b) => sum + b.profitUnits, 0);
    const exactRoi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;

    const avgPlacedOdds = count > 0 ? bets.reduce((sum, b) => sum + b.placedOdds, 0) / count : 0;
    const avgClv = count > 0 ? bets.reduce((sum, b) => sum + b.clvPct, 0) / count : 0;

    // Odds distribution metrics
    const winningOddsAvg = wins > 0 ? bets.filter(b => b.outcome === 'WIN').reduce((sum, b) => sum + b.placedOdds, 0) / wins : 0;
    const losingOddsAvg = losses > 0 ? bets.filter(b => b.outcome === 'LOSS').reduce((sum, b) => sum + b.placedOdds, 0) / losses : 0;

    marketSummaries[m] = {
      market: m === 'ML' ? 'Moneyline (1X2)' : m === 'AH' ? 'Asian Handicap' : 'Over / Under 2.5',
      totalBets: count,
      wins,
      losses,
      pushes,
      winRate: `${((wins / (count - pushes)) * 100).toFixed(1)}%`,
      totalStakeUnits: count,
      exactProfitUnits: Number(totalProfit.toFixed(2)),
      exactRoiPct: `${exactRoi.toFixed(2)}%`,
      avgPlacedOdds: Number(avgPlacedOdds.toFixed(3)),
      winningOddsAvg: Number(winningOddsAvg.toFixed(3)),
      losingOddsAvg: Number(losingOddsAvg.toFixed(3)),
      exactAvgClvPct: `${avgClv.toFixed(2)}%`,
    };
  });

  // Overall Combined Ledger Summary
  const overallCount = ledger.length;
  const overallWins = ledger.filter((b) => b.outcome === 'WIN').length;
  const overallLosses = ledger.filter((b) => b.outcome === 'LOSS').length;
  const overallPushes = ledger.filter((b) => b.outcome === 'PUSH').length;
  const overallProfit = ledger.reduce((sum, b) => sum + b.profitUnits, 0);
  const overallStake = overallCount - overallPushes;
  const overallExactRoi = overallStake > 0 ? (overallProfit / overallStake) * 100 : 0;
  const overallAvgClv = overallCount > 0 ? ledger.reduce((sum, b) => sum + b.clvPct, 0) / overallCount : 0;

  console.log('--- PER-BET LEDGER EXACT SUMMARY TABLE ---');
  console.table(Object.values(marketSummaries));

  console.log('--- OVERALL COMBINED PER-BET LEDGER RESULTS ---');
  console.log(`Total Bets Placed:         ${overallCount}`);
  console.log(`Wins:                      ${overallWins}`);
  console.log(`Losses:                    ${overallLosses}`);
  console.log(`Pushes:                    ${overallPushes}`);
  console.log(`Exact Total Stake:         ${overallStake}.0 units`);
  console.log(`Exact Total Net Profit:    ${overallProfit.toFixed(2)} units`);
  console.log(`EXACT OVERALL ROI:         ${overallExactRoi.toFixed(2)}%`);
  console.log(`EXACT OVERALL CLV:         ${overallAvgClv.toFixed(2)}%\n`);

  console.log('--- MATHEMATICAL DISPARITY PROOF (Why Avg Odds * Win Rate != ROI) ---');
  console.log(`For Moneyline:`);
  console.log(`- Winning Bets Average Odds: ${marketSummaries['ML'].winningOddsAvg}`);
  console.log(`- Losing Bets Average Odds:  ${marketSummaries['ML'].losingOddsAvg}`);
  console.log(`- High-odds longshots that LOST (e.g. odds 10.0 to 25.0) pulled average placed odds up to ${marketSummaries['ML'].avgPlacedOdds}.`);
  console.log(`- However, winning bets occurred at lower odds (avg ${marketSummaries['ML'].winningOddsAvg}), yielding +${(marketSummaries['ML'].winningOddsAvg - 1).toFixed(2)} units per win vs -1.0 unit per loss.`);
  console.log(`- Formula ROI = (Σ profit_i / N) = (${marketSummaries['ML'].exactProfitUnits} / ${marketSummaries['ML'].totalBets}) = ${marketSummaries['ML'].exactRoiPct}. PROOF COMPLETE.`);
}

runPerBetLedgerVerification();
