// READ-ONLY HISTORICAL EMPIRICAL ANALYSIS: AH 0 @ 1.50-1.80
// Location: scripts/scratch/ah-zero-odds-range-study.ts

import * as fs from 'fs';
import * as path from 'path';

interface CanonicalMatch {
  canonicalId: string;
  leagueId: string;
  season: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  result: string;
  odds?: {
    ahLine?: number;
    ahHome?: number;
    ahAway?: number;
    bookmakerSource?: string;
    [key: string]: any;
  };
}

interface BetRecord {
  canonicalId: string;
  season: string;
  matchDate: string;
  fixture: string;
  side: 'home' | 'away';
  odds: number;
  homeGoals: number;
  awayGoals: number;
  outcome: 'FULL_WIN' | 'PUSH' | 'FULL_LOSS';
  profit: number;
}

interface MetricSummary {
  name: string;
  totalBets: number;
  wins: number;
  pushes: number;
  losses: number;
  winRate: number; // Wins / Total
  pushRate: number;
  lossRate: number;
  nonPushWinRate: number; // Wins / (Wins + Losses)
  totalProfit: number;
  roi: number;
  avgOdds: number;
  impliedBreakEvenWinRate: number; // 1 / avgOdds
  edgeVsBreakEven: number; // (Wins / Total) - (1 / avgOdds)
}

function computeMetrics(bets: BetRecord[], name: string): MetricSummary {
  const totalBets = bets.length;
  if (totalBets === 0) {
    return {
      name,
      totalBets: 0,
      wins: 0,
      pushes: 0,
      losses: 0,
      winRate: 0,
      pushRate: 0,
      lossRate: 0,
      nonPushWinRate: 0,
      totalProfit: 0,
      roi: 0,
      avgOdds: 0,
      impliedBreakEvenWinRate: 0,
      edgeVsBreakEven: 0,
    };
  }

  let wins = 0;
  let pushes = 0;
  let losses = 0;
  let totalProfit = 0;
  let oddsSum = 0;

  for (const b of bets) {
    if (b.outcome === 'FULL_WIN') wins++;
    else if (b.outcome === 'PUSH') pushes++;
    else if (b.outcome === 'FULL_LOSS') losses++;

    totalProfit += b.profit;
    oddsSum += b.odds;
  }

  const winRate = Number(((wins / totalBets) * 100).toFixed(2));
  const pushRate = Number(((pushes / totalBets) * 100).toFixed(2));
  const lossRate = Number(((losses / totalBets) * 100).toFixed(2));
  const nonPushDecided = wins + losses;
  const nonPushWinRate = nonPushDecided > 0 ? Number(((wins / nonPushDecided) * 100).toFixed(2)) : 0;
  const avgOdds = Number((oddsSum / totalBets).toFixed(3));
  const roi = Number(((totalProfit / totalBets) * 100).toFixed(2));
  const impliedBreakEvenWinRate = avgOdds > 0 ? Number(((1 / avgOdds) * 100).toFixed(2)) : 0;
  const edgeVsBreakEven = Number((winRate - impliedBreakEvenWinRate).toFixed(2));

  return {
    name,
    totalBets,
    wins,
    pushes,
    losses,
    winRate,
    pushRate,
    lossRate,
    nonPushWinRate,
    totalProfit: Number(totalProfit.toFixed(2)),
    roi,
    avgOdds,
    impliedBreakEvenWinRate,
    edgeVsBreakEven,
  };
}

function runStudy() {
  const filePath = path.resolve(process.cwd(), 'data', 'golden', 'europe', 'canonical_matches.jsonl');
  const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');

  const targetSeasons = ['2023-2024', '2024-2025', '2025-2026'];
  const allQualifyingBets: BetRecord[] = [];

  let scannedTargetMatches = 0;
  let matchesWithAh0 = 0;

  for (const line of lines) {
    if (!line) continue;
    const m: CanonicalMatch = JSON.parse(line);

    if (!targetSeasons.includes(m.season) || m.leagueId !== 'ENG-PL') {
      continue;
    }
    scannedTargetMatches++;

    const o = m.odds;
    if (!o || typeof o.ahLine !== 'number') {
      continue;
    }

    // Check if AH line is 0 (Draw No Bet)
    if (Math.abs(o.ahLine) < 0.001) {
      matchesWithAh0++;

      const hOdds = typeof o.ahHome === 'number' ? o.ahHome : undefined;
      const aOdds = typeof o.ahAway === 'number' ? o.ahAway : undefined;

      // Home Side evaluation
      if (hOdds !== undefined && hOdds >= 1.50 && hOdds <= 1.80) {
        let outcome: 'FULL_WIN' | 'PUSH' | 'FULL_LOSS';
        let profit = 0;

        if (m.homeGoals > m.awayGoals) {
          outcome = 'FULL_WIN';
          profit = hOdds - 1.0;
        } else if (m.homeGoals === m.awayGoals) {
          outcome = 'PUSH';
          profit = 0;
        } else {
          outcome = 'FULL_LOSS';
          profit = -1.0;
        }

        allQualifyingBets.push({
          canonicalId: m.canonicalId,
          season: m.season,
          matchDate: m.matchDate,
          fixture: `${m.homeTeam} vs ${m.awayTeam} (${m.homeGoals}-${m.awayGoals})`,
          side: 'home',
          odds: hOdds,
          homeGoals: m.homeGoals,
          awayGoals: m.awayGoals,
          outcome,
          profit,
        });
      }

      // Away Side evaluation
      if (aOdds !== undefined && aOdds >= 1.50 && aOdds <= 1.80) {
        let outcome: 'FULL_WIN' | 'PUSH' | 'FULL_LOSS';
        let profit = 0;

        if (m.awayGoals > m.homeGoals) {
          outcome = 'FULL_WIN';
          profit = aOdds - 1.0;
        } else if (m.awayGoals === m.homeGoals) {
          outcome = 'PUSH';
          profit = 0;
        } else {
          outcome = 'FULL_LOSS';
          profit = -1.0;
        }

        allQualifyingBets.push({
          canonicalId: m.canonicalId,
          season: m.season,
          matchDate: m.matchDate,
          fixture: `${m.homeTeam} vs ${m.awayTeam} (${m.homeGoals}-${m.awayGoals})`,
          side: 'away',
          odds: aOdds,
          homeGoals: m.homeGoals,
          awayGoals: m.awayGoals,
          outcome,
          profit,
        });
      }
    }
  }

  // Segment by Season
  const s2324 = allQualifyingBets.filter((b) => b.season === '2023-2024');
  const s2425 = allQualifyingBets.filter((b) => b.season === '2024-2025');
  const s2526 = allQualifyingBets.filter((b) => b.season === '2025-2026');

  // Segment by Odds Buckets
  const b150_159 = allQualifyingBets.filter((b) => b.odds >= 1.50 && b.odds < 1.60);
  const b160_169 = allQualifyingBets.filter((b) => b.odds >= 1.60 && b.odds < 1.70);
  const b170_180 = allQualifyingBets.filter((b) => b.odds >= 1.70 && b.odds <= 1.80);

  const overall = computeMetrics(allQualifyingBets, 'AGGREGATE (3 SEASONS: 2023-2026)');
  const m2324 = computeMetrics(s2324, '2023-2024');
  const m2425 = computeMetrics(s2425, '2024-2025');
  const m2526 = computeMetrics(s2526, '2025-2026');

  const m150 = computeMetrics(b150_159, '1.50 - 1.59');
  const m160 = computeMetrics(b160_169, '1.60 - 1.69');
  const m170 = computeMetrics(b170_180, '1.70 - 1.80');

  console.log('================================================================');
  console.log('EMPIRICAL HISTORICAL STUDY: AH line 0 @ Odds 1.50 - 1.80');
  console.log('================================================================\n');

  console.log('DATASET COVERAGE:');
  console.log(`Total 3-Season Matches Scanned: ${scannedTargetMatches}`);
  console.log(`Matches with ahLine === 0:     ${matchesWithAh0}`);
  console.log(`Total Qualifying Bets Found:   ${allQualifyingBets.length}`);

  console.log('\n--- ALL QUALIFYING BET RECORDS DETAIL ---');
  allQualifyingBets.forEach((b, idx) => {
    console.log(`[${idx + 1}] ${b.matchDate} | ${b.season} | ${b.fixture} | Side: ${b.side.toUpperCase().padEnd(4)} @ ${b.odds.toFixed(2)} | Outcome: ${b.outcome.padEnd(9)} | P/L: ${b.profit >= 0 ? '+' : ''}${b.profit.toFixed(2)}u`);
  });

  console.log('\n================================================================');
  console.log('1. OVERALL AGGREGATE SUMMARY');
  console.log('================================================================');
  printTable([overall]);

  console.log('\n================================================================');
  console.log('2. SEASON-BY-SEASON BREAKDOWN');
  console.log('================================================================');
  printTable([m2324, m2425, m2526]);

  console.log('\n================================================================');
  console.log('3. ODDS BUCKET BREAKDOWN');
  console.log('================================================================');
  printTable([m150, m160, m170]);

  // Verdict calculation
  let verdict = 'INSUFFICIENT SAMPLE';
  if (allQualifyingBets.length >= 100) {
    if (overall.roi > 2.0) verdict = 'HISTORICALLY PROFITABLE';
    else if (overall.roi < -2.0) verdict = 'HISTORICALLY UNPROFITABLE';
    else verdict = 'NEAR BREAK-EVEN';
  } else if (allQualifyingBets.length >= 30) {
    if (overall.roi > 3.0) verdict = 'HISTORICALLY PROFITABLE (LOW SAMPLE)';
    else if (overall.roi < -3.0) verdict = 'HISTORICALLY UNPROFITABLE (LOW SAMPLE)';
    else verdict = 'NEAR BREAK-EVEN (LOW SAMPLE)';
  } else {
    verdict = 'INSUFFICIENT SAMPLE';
  }

  console.log('\n================================================================');
  console.log(`FINAL VERDICT: ${verdict}`);
  console.log('================================================================\n');
}

function printTable(metrics: MetricSummary[]) {
  console.log('Name'.padEnd(32) + 'Bets'.padEnd(6) + 'W'.padEnd(5) + 'P'.padEnd(5) + 'L'.padEnd(5) + 'WinRate%'.padEnd(10) + 'Push%'.padEnd(8) + 'Loss%'.padEnd(8) + 'AvgOdds'.padEnd(9) + 'Profit'.padEnd(10) + 'ROI%'.padEnd(9) + 'BreakEven%'.padEnd(12) + 'Diff%');
  console.log('-'.repeat(128));
  for (const m of metrics) {
    console.log(
      m.name.padEnd(32) +
      String(m.totalBets).padEnd(6) +
      String(m.wins).padEnd(5) +
      String(m.pushes).padEnd(5) +
      String(m.losses).padEnd(5) +
      (m.winRate + '%').padEnd(10) +
      (m.pushRate + '%').padEnd(8) +
      (m.lossRate + '%').padEnd(8) +
      m.avgOdds.toFixed(2).padEnd(9) +
      (m.totalProfit >= 0 ? '+' : '') + m.totalProfit.toFixed(2).padEnd(9) +
      (m.roi >= 0 ? '+' : '') + (m.roi + '%').padEnd(9) +
      (m.impliedBreakEvenWinRate + '%').padEnd(12) +
      (m.edgeVsBreakEven >= 0 ? '+' : '') + m.edgeVsBreakEven + '%'
    );
  }
}

runStudy();
