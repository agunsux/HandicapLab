// PURE HISTORICAL PROFITABILITY STUDY — READ ONLY
// Location: scripts/scratch/ah-1to175-empirical-study.ts
// Scope: AH -1.00 to -1.75 vs +1.00 to +1.75 on Premier League 2023-2026

import * as fs from 'fs';
import * as path from 'path';
import { settleAsianHandicap, SettlementDetail } from '../../src/lib/research/ah-solo/ahSettlementEngine';
import { SettlementOutcome, AhSide } from '../../src/lib/research/ah-solo/ahTypes';

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

interface BetObservation {
  canonicalId: string;
  season: string;
  matchDate: string;
  fixture: string;
  team: string;
  side: AhSide;
  line: number; // e.g. -1.25 or +1.25
  odds: number;
  homeGoals: number;
  awayGoals: number;
  settlement: SettlementDetail;
}

interface LineStats {
  line: number;
  lineStr: string;
  bets: number;
  fullWins: number;
  halfWins: number;
  pushes: number;
  halfLosses: number;
  fullLosses: number;
  winRate: number; // (fullWins + 0.5 * halfWins) / bets or (fullWins + halfWins) / bets? We report standard & effective
  effectiveWinRate: number;
  totalProfit: number;
  roi: number;
  avgOdds: number;
  impliedBreakEven: number;
}

function computeLineStats(bets: BetObservation[], line: number): LineStats {
  const lineStr = (line > 0 ? '+' : '') + line.toFixed(2);
  const n = bets.length;
  if (n === 0) {
    return {
      line,
      lineStr,
      bets: 0,
      fullWins: 0,
      halfWins: 0,
      pushes: 0,
      halfLosses: 0,
      fullLosses: 0,
      winRate: 0,
      effectiveWinRate: 0,
      totalProfit: 0,
      roi: 0,
      avgOdds: 0,
      impliedBreakEven: 0,
    };
  }

  let fullWins = 0;
  let halfWins = 0;
  let pushes = 0;
  let halfLosses = 0;
  let fullLosses = 0;
  let totalProfit = 0;
  let oddsSum = 0;

  for (const b of bets) {
    const out = b.settlement.outcome;
    if (out === 'FULL_WIN') fullWins++;
    else if (out === 'HALF_WIN') halfWins++;
    else if (out === 'PUSH') pushes++;
    else if (out === 'HALF_LOSS') halfLosses++;
    else if (out === 'FULL_LOSS') fullLosses++;

    totalProfit += b.settlement.profit;
    oddsSum += b.odds;
  }

  const rawWinRate = Number((((fullWins + halfWins) / n) * 100).toFixed(2));
  const effectiveWinRate = Number((((fullWins + 0.5 * halfWins) / n) * 100).toFixed(2));
  const roi = Number(((totalProfit / n) * 100).toFixed(2));
  const avgOdds = Number((oddsSum / n).toFixed(3));
  const impliedBreakEven = avgOdds > 0 ? Number(((1 / avgOdds) * 100).toFixed(2)) : 0;

  return {
    line,
    lineStr,
    bets: n,
    fullWins,
    halfWins,
    pushes,
    halfLosses,
    fullLosses,
    winRate: rawWinRate,
    effectiveWinRate,
    totalProfit: Number(totalProfit.toFixed(2)),
    roi,
    avgOdds,
    impliedBreakEven,
  };
}

function runStudy() {
  const filePath = path.resolve(process.cwd(), 'data', 'golden', 'europe', 'canonical_matches.jsonl');
  const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');

  const targetSeasons = ['2023-2024', '2024-2025', '2025-2026'];
  const targetLines = [-1.75, -1.50, -1.25, -1.00, 1.00, 1.25, 1.50, 1.75];

  const primaryFilteredBets: BetObservation[] = [];
  const unrestrictedBets: BetObservation[] = [];

  let totalMatchesScanned = 0;

  for (const line of lines) {
    if (!line) continue;
    const m: CanonicalMatch = JSON.parse(line);

    if (!targetSeasons.includes(m.season) || m.leagueId !== 'ENG-PL') {
      continue;
    }
    totalMatchesScanned++;

    const o = m.odds;
    if (!o || typeof o.ahLine !== 'number') continue;
    if (m.homeGoals < 0 || m.awayGoals < 0 || isNaN(m.homeGoals) || isNaN(m.awayGoals)) continue;

    // Home line is o.ahLine, Away line is -o.ahLine
    const homeLine = Math.round(o.ahLine * 100) / 100;
    const awayLine = Math.round(-o.ahLine * 100) / 100;

    const hOdds = typeof o.ahHome === 'number' && o.ahHome > 1.0 ? o.ahHome : undefined;
    const aOdds = typeof o.ahAway === 'number' && o.ahAway > 1.0 ? o.ahAway : undefined;

    // 1. Evaluate Home Side
    if (hOdds !== undefined && targetLines.some((tl) => Math.abs(tl - homeLine) < 0.001)) {
      const matchedLine = targetLines.find((tl) => Math.abs(tl - homeLine) < 0.001)!;
      const s = settleAsianHandicap('home', matchedLine, m.homeGoals, m.awayGoals, hOdds, 1.0);

      const obs: BetObservation = {
        canonicalId: m.canonicalId,
        season: m.season,
        matchDate: m.matchDate,
        fixture: `${m.homeTeam} vs ${m.awayTeam}`,
        team: m.homeTeam,
        side: 'home',
        line: matchedLine,
        odds: hOdds,
        homeGoals: m.homeGoals,
        awayGoals: m.awayGoals,
        settlement: s,
      };

      unrestrictedBets.push(obs);
      if (hOdds >= 1.50 && hOdds <= 1.80) {
        primaryFilteredBets.push(obs);
      }
    }

    // 2. Evaluate Away Side
    if (aOdds !== undefined && targetLines.some((tl) => Math.abs(tl - awayLine) < 0.001)) {
      const matchedLine = targetLines.find((tl) => Math.abs(tl - awayLine) < 0.001)!;
      const s = settleAsianHandicap('away', matchedLine, m.homeGoals, m.awayGoals, aOdds, 1.0);

      const obs: BetObservation = {
        canonicalId: m.canonicalId,
        season: m.season,
        matchDate: m.matchDate,
        fixture: `${m.homeTeam} vs ${m.awayTeam}`,
        team: m.awayTeam,
        side: 'away',
        line: matchedLine,
        odds: aOdds,
        homeGoals: m.homeGoals,
        awayGoals: m.awayGoals,
        settlement: s,
      };

      unrestrictedBets.push(obs);
      if (aOdds >= 1.50 && aOdds <= 1.80) {
        primaryFilteredBets.push(obs);
      }
    }
  }

  console.log('========================================================');
  console.log('HANDICAPLAB AH -1 TO -1.75 EMPIRICAL STUDY');
  console.log('========================================================\n');
  console.log(`DATASET: Premier League (ENG-PL) across 3 seasons (2023-2024, 2024-2025, 2025-2026)`);
  console.log(`Total Matches: ${totalMatchesScanned}`);
  console.log(`Qualifying Observations (Odds 1.50 - 1.80): ${primaryFilteredBets.length}`);
  console.log(`Total Observations (Unrestricted Odds):    ${unrestrictedBets.length}\n`);

  // Compute Primary Stats
  const primaryStats: LineStats[] = targetLines.map((line) =>
    computeLineStats(
      primaryFilteredBets.filter((b) => Math.abs(b.line - line) < 0.001),
      line
    )
  );

  console.log('--------------------------------------------------------------------------------------------------------------------------------');
  console.log('PRIMARY TABLE (Odds 1.50–1.80 Filter)');
  console.log('--------------------------------------------------------------------------------------------------------------------------------');
  printFullTable(primaryStats);

  // Favorite vs Underdog Direct Comparison
  console.log('\n--------------------------------------------------------------------------------------------------------------------------------');
  console.log('FAVORITE VS UNDERDOG COMPARISON (Odds 1.50–1.80 Filter)');
  console.log('--------------------------------------------------------------------------------------------------------------------------------');
  console.log('Fav Line'.padEnd(10) + 'Fav Bets'.padEnd(10) + 'Fav W/HW/P/HL/L'.padEnd(18) + 'Fav Profit'.padEnd(12) + 'Fav ROI%'.padEnd(12) + 'Dog Line'.padEnd(10) + 'Dog Bets'.padEnd(10) + 'Dog W/HW/P/HL/L'.padEnd(18) + 'Dog Profit'.padEnd(12) + 'Dog ROI%');
  console.log('-'.repeat(128));

  const pairs = [
    { fav: -1.00, dog: 1.00 },
    { fav: -1.25, dog: 1.25 },
    { fav: -1.50, dog: 1.50 },
    { fav: -1.75, dog: 1.75 },
  ];

  for (const p of pairs) {
    const fStat = primaryStats.find((s) => Math.abs(s.line - p.fav) < 0.001)!;
    const dStat = primaryStats.find((s) => Math.abs(s.line - p.dog) < 0.001)!;

    const fDist = `${fStat.fullWins}/${fStat.halfWins}/${fStat.pushes}/${fStat.halfLosses}/${fStat.fullLosses}`;
    const dDist = `${dStat.fullWins}/${dStat.halfWins}/${dStat.pushes}/${dStat.halfLosses}/${dStat.fullLosses}`;

    console.log(
      fStat.lineStr.padEnd(10) +
      String(fStat.bets).padEnd(10) +
      fDist.padEnd(18) +
      ((fStat.totalProfit >= 0 ? '+' : '') + fStat.totalProfit.toFixed(2) + 'u').padEnd(12) +
      ((fStat.roi >= 0 ? '+' : '') + fStat.roi.toFixed(2) + '%').padEnd(12) +
      dStat.lineStr.padEnd(10) +
      String(dStat.bets).padEnd(10) +
      dDist.padEnd(18) +
      ((dStat.totalProfit >= 0 ? '+' : '') + dStat.totalProfit.toFixed(2) + 'u').padEnd(12) +
      ((dStat.roi >= 0 ? '+' : '') + dStat.roi.toFixed(2) + '%')
    );
  }

  // Season Breakdown
  console.log('\n--------------------------------------------------------------------------------------------------------------------------------');
  console.log('SEASON-BY-SEASON BREAKDOWN (Odds 1.50–1.80 Filter)');
  console.log('--------------------------------------------------------------------------------------------------------------------------------');
  for (const season of targetSeasons) {
    console.log(`\n>>> SEASON: ${season}`);
    const sBets = primaryFilteredBets.filter((b) => b.season === season);
    const sStats = targetLines.map((line) =>
      computeLineStats(
        sBets.filter((b) => Math.abs(b.line - line) < 0.001),
        line
      )
    );
    printFullTable(sStats);
  }

  // Odds Buckets Breakdown
  console.log('\n--------------------------------------------------------------------------------------------------------------------------------');
  console.log('ODDS BUCKETS BREAKDOWN');
  console.log('--------------------------------------------------------------------------------------------------------------------------------');
  const buckets = [
    { label: '1.50–1.59', min: 1.50, max: 1.5999 },
    { label: '1.60–1.69', min: 1.60, max: 1.6999 },
    { label: '1.70–1.80', min: 1.70, max: 1.8000 },
  ];

  for (const b of buckets) {
    console.log(`\n>>> BUCKET: ${b.label}`);
    const bBets = primaryFilteredBets.filter((bet) => bet.odds >= b.min && bet.odds <= b.max);
    const bStats = targetLines.map((line) =>
      computeLineStats(
        bBets.filter((bet) => Math.abs(bet.line - line) < 0.001),
        line
      )
    );
    printFullTable(bStats);
  }

  // Secondary Unrestricted Odds Table
  console.log('\n--------------------------------------------------------------------------------------------------------------------------------');
  console.log('SECONDARY UNRESTRICTED ODDS TABLE (ALL PRICES)');
  console.log('--------------------------------------------------------------------------------------------------------------------------------');
  const unrestrictedStats = targetLines.map((line) =>
    computeLineStats(
      unrestrictedBets.filter((b) => Math.abs(b.line - line) < 0.001),
      line
    )
  );
  printFullTable(unrestrictedStats);

  // Complete Audit Log of Primary Filtered Bets
  console.log('\n--------------------------------------------------------------------------------------------------------------------------------');
  console.log(`RAW AUDIT LOG FOR PRIMARY FILTERED BETS (Total ${primaryFilteredBets.length} Bets)`);
  console.log('--------------------------------------------------------------------------------------------------------------------------------');
  primaryFilteredBets.forEach((b, idx) => {
    const signLine = (b.line > 0 ? '+' : '') + b.line.toFixed(2);
    console.log(
      `[${String(idx + 1).padStart(3)}] ${b.matchDate} | ${b.season} | ${b.fixture.padEnd(35)} (${b.homeGoals}-${b.awayGoals}) | ${b.team.padEnd(20)} (${b.side.toUpperCase()}) | Line: ${signLine.padEnd(6)} @ ${b.odds.toFixed(2)} | Outcome: ${b.settlement.outcome.padEnd(9)} | P/L: ${(b.settlement.profit >= 0 ? '+' : '') + b.settlement.profit.toFixed(2)}u`
    );
  });
}

function printFullTable(stats: LineStats[]) {
  console.log(
    'Line'.padEnd(8) +
    'Bets'.padEnd(6) +
    'Full W'.padEnd(8) +
    'Half W'.padEnd(8) +
    'Push'.padEnd(6) +
    'Half L'.padEnd(8) +
    'Full L'.padEnd(8) +
    'WinRate%'.padEnd(10) +
    'EffWin%'.padEnd(9) +
    'AvgOdds'.padEnd(9) +
    'Profit'.padEnd(10) +
    'ROI%'.padEnd(9) +
    'Sample Status'
  );
  console.log('-'.repeat(128));

  for (const s of stats) {
    let sampleStatus = 'BETTER SAMPLE';
    if (s.bets < 30) sampleStatus = 'LOW SAMPLE';
    else if (s.bets < 100) sampleStatus = 'LIMITED SAMPLE';

    console.log(
      s.lineStr.padEnd(8) +
      String(s.bets).padEnd(6) +
      String(s.fullWins).padEnd(8) +
      String(s.halfWins).padEnd(8) +
      String(s.pushes).padEnd(6) +
      String(s.halfLosses).padEnd(8) +
      String(s.fullLosses).padEnd(8) +
      (s.winRate + '%').padEnd(10) +
      (s.effectiveWinRate + '%').padEnd(9) +
      s.avgOdds.toFixed(2).padEnd(9) +
      ((s.totalProfit >= 0 ? '+' : '') + s.totalProfit.toFixed(2) + 'u').padEnd(10) +
      ((s.roi >= 0 ? '+' : '') + s.roi + '%').padEnd(9) +
      sampleStatus
    );
  }
}

runStudy();
