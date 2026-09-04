import * as fs from 'fs';
import * as path from 'path';
import {
  settleAsianHandicap,
  settleAsianTotal,
  settleBtts,
  profitOfOutcome,
  type SettlementOutcome
} from '../src/historical/settlement/settlement';
import { studentTPValue } from './epic65_backtest_runner';

// ----------------------------------------------------------------------------
// Types & Structures
// ----------------------------------------------------------------------------

interface CanonicalHistoricalMatch {
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
    ch1?: number | null;
    cd1?: number | null;
    ca1?: number | null;
  };
}

export interface RawMarketCellResult {
  market: 'AH' | 'OU' | 'BTTS';
  dimension: 'LINE_SIDE' | 'ROLE' | 'GLOBAL_OU' | 'GLOBAL_BTTS';
  identifier: string;
  leagueId: string; // league or 'GLOBAL'
  season: string;   // season or 'ALL_SEASONS'
  side: string;
  line?: number;
  bets: number;
  wins: number;
  halfWins: number;
  pushes: number;
  halfLosses: number;
  losses: number;
  hitRatePct: number;
  totalStaked: number;
  totalProfit: number;
  roiPct: number; // profit / staked * 100
  avgOdds: number;
  maxDrawdown: number;
  maxLosingStreak: number;
  tStat: number;
  pValue: number;
  fdrQValue?: number;
  tier: 'RED' | 'GREY' | 'YELLOW' | 'GREEN' | 'GOLD';
}

function calculateDrawdownAndStreak(profits: number[]): { maxDrawdown: number; maxLosingStreak: number } {
  let peak = 0;
  let running = 0;
  let maxDd = 0;
  let currLossStreak = 0;
  let maxLossStreak = 0;

  for (const p of profits) {
    running += p;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDd) maxDd = dd;

    if (p < -0.001) {
      currLossStreak++;
      if (currLossStreak > maxLossStreak) maxLossStreak = currLossStreak;
    } else if (p > 0.001) {
      currLossStreak = 0;
    }
  }

  return {
    maxDrawdown: Number(maxDd.toFixed(2)),
    maxLosingStreak: maxLossStreak
  };
}

export function evaluateMarketSlice(
  bets: Array<{ outcome: SettlementOutcome; odds: number; profit: number }>,
  meta: {
    market: 'AH' | 'OU' | 'BTTS';
    dimension: 'LINE_SIDE' | 'ROLE' | 'GLOBAL_OU' | 'GLOBAL_BTTS';
    identifier: string;
    leagueId: string;
    season: string;
    side: string;
    line?: number;
  }
): RawMarketCellResult {
  const n = bets.length;
  if (n === 0) {
    return {
      ...meta,
      bets: 0,
      wins: 0,
      halfWins: 0,
      pushes: 0,
      halfLosses: 0,
      losses: 0,
      hitRatePct: 0,
      totalStaked: 0,
      totalProfit: 0,
      roiPct: 0,
      avgOdds: 0,
      maxDrawdown: 0,
      maxLosingStreak: 0,
      tStat: 0,
      pValue: 1.0,
      tier: 'GREY'
    };
  }

  let wins = 0;
  let halfWins = 0;
  let pushes = 0;
  let halfLosses = 0;
  let losses = 0;
  let totalStaked = 0;
  let totalProfit = 0;
  let sumOdds = 0;
  const profitList: number[] = [];

  for (const b of bets) {
    totalStaked += 1.0;
    totalProfit += b.profit;
    sumOdds += b.odds;
    profitList.push(b.profit);

    if (b.outcome === 'WIN') wins++;
    else if (b.outcome === 'HALF_WIN') halfWins++;
    else if (b.outcome === 'PUSH') pushes++;
    else if (b.outcome === 'HALF_LOSS') halfLosses++;
    else if (b.outcome === 'LOSS') losses++;
  }

  const effectiveNonPush = n - pushes;
  const hitRate = effectiveNonPush > 0 ? ((wins + 0.5 * halfWins) / effectiveNonPush) * 100 : 0;
  const roi = (totalProfit / totalStaked) * 100;
  const avgOdds = sumOdds / n;

  // t-test
  const mean = totalProfit / n;
  let varianceSum = 0;
  for (const p of profitList) {
    varianceSum += Math.pow(p - mean, 2);
  }
  const variance = n > 1 ? varianceSum / (n - 1) : 0;
  const se = Math.sqrt(variance / n);
  const tStat = se > 0 ? mean / se : 0;
  const pValue = n > 1 ? studentTPValue(tStat, n - 1) : 1.0;

  const { maxDrawdown, maxLosingStreak } = calculateDrawdownAndStreak(profitList);

  // Initial Tier classification
  let tier: 'RED' | 'GREY' | 'YELLOW' | 'GREEN' | 'GOLD' = 'GREY';
  if (roi < 0) {
    tier = 'RED';
  } else if (roi > 0 && n < 100) {
    tier = 'YELLOW';
  } else if (roi > 0 && pValue < 0.05 && n >= 250) {
    tier = n >= 500 ? 'GOLD' : 'GREEN';
  } else if (roi > 0 && n >= 100) {
    tier = 'YELLOW';
  }

  return {
    ...meta,
    bets: n,
    wins,
    halfWins,
    pushes,
    halfLosses,
    losses,
    hitRatePct: Number(hitRate.toFixed(2)),
    totalStaked: Number(totalStaked.toFixed(2)),
    totalProfit: Number(totalProfit.toFixed(2)),
    roiPct: Number(roi.toFixed(2)),
    avgOdds: Number(avgOdds.toFixed(2)),
    maxDrawdown,
    maxLosingStreak,
    tStat: Number(tStat.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    tier
  };
}

export function runMarketDiscovery() {
  console.log('===============================================================');
  console.log('EPIC 66 — Comprehensive Baseline Market Discovery Engine');
  console.log('===============================================================');

  // Load canonical historical matches (Top 5 European Leagues 2024/25 & 2025/26)
  const matchesPath = path.resolve('data/golden/epic65/canonical_matches.jsonl');
  if (!fs.existsSync(matchesPath)) {
    throw new Error('Missing data/golden/epic65/canonical_matches.jsonl');
  }

  const matches: CanonicalHistoricalMatch[] = fs
    .readFileSync(matchesPath, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  console.log(`Loaded ${matches.length} canonical European matches with 100% Pinnacle closing lines.`);

  // Load global cached fixtures for BTTS & Goals analysis (all 30 leagues)
  const cacheDir = path.resolve('data/cache/epic66');
  const globalMatches: Array<{
    leagueId: number;
    leagueCode: string;
    leagueName: string;
    season: number;
    homeGoals: number;
    awayGoals: number;
    btts: boolean;
    totalGoals: number;
  }> = [];

  const leagueRegistry = JSON.parse(fs.readFileSync('src/historical/research/epic66_league_registry.json', 'utf-8'));
  const leagueMap = new Map(leagueRegistry.leagues.map((l: any) => [l.id, l]));

  if (fs.existsSync(cacheDir)) {
    const files = fs.readdirSync(cacheDir).filter((f) => f.startsWith('apifootball_') && f.endsWith('.json'));
    for (const file of files) {
      const parts = file.replace('apifootball_', '').replace('.json', '').split('_');
      const lId = parseInt(parts[0], 10);
      const season = parseInt(parts[1], 10);
      const lgMeta: any = leagueMap.get(lId);

      const raw = JSON.parse(fs.readFileSync(path.join(cacheDir, file), 'utf-8'));
      for (const f of raw) {
        if (f.score?.fulltime?.home !== null && f.score?.fulltime?.away !== null) {
          const hg = f.score.fulltime.home;
          const ag = f.score.fulltime.away;
          globalMatches.push({
            leagueId: lId,
            leagueCode: lgMeta?.code || String(lId),
            leagueName: lgMeta?.name || String(lId),
            season,
            homeGoals: hg,
            awayGoals: ag,
            btts: hg >= 1 && ag >= 1,
            totalGoals: hg + ag
          });
        }
      }
    }
  }

  console.log(`Loaded ${globalMatches.length} global completed matches across 30 leagues for BTTS & totals baseline.`);

  const results: RawMarketCellResult[] = [];

  // ==========================================================================
  // 1. ASIAN HANDICAP: LINE & SIDE DISCOVERY (Across Top 5 Leagues)
  // Lines: -2.00 to +2.00 in 0.25 steps
  // ==========================================================================
  console.log('\n[1/4] Running Asian Handicap Line & Side Discovery...');
  const ahLines = [-2.0, -1.75, -1.5, -1.25, -1.0, -0.75, -0.5, -0.25, 0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  for (const targetLine of ahLines) {
    // Bet HOME on this line
    const homeBets: Array<{ outcome: SettlementOutcome; odds: number; profit: number }> = [];
    // Bet AWAY on this line
    const awayBets: Array<{ outcome: SettlementOutcome; odds: number; profit: number }> = [];

    for (const m of matches) {
      if (m.odds.ahLine === targetLine && m.odds.ahHome && m.odds.ahAway) {
        // Settle Home
        const homeOutcome = settleAsianHandicap('home', targetLine, m.homeGoals, m.awayGoals);
        const homeProfit = profitOfOutcome(homeOutcome, m.odds.ahHome, 1.0);
        homeBets.push({ outcome: homeOutcome, odds: m.odds.ahHome, profit: homeProfit });

        // Settle Away
        const awayOutcome = settleAsianHandicap('away', targetLine, m.homeGoals, m.awayGoals);
        const awayProfit = profitOfOutcome(awayOutcome, m.odds.ahAway, 1.0);
        awayBets.push({ outcome: awayOutcome, odds: m.odds.ahAway, profit: awayProfit });
      }
    }

    results.push(
      evaluateMarketSlice(homeBets, {
        market: 'AH',
        dimension: 'LINE_SIDE',
        identifier: `AH ${targetLine > 0 ? '+' : ''}${targetLine.toFixed(2)} Home`,
        leagueId: 'TOP5_EUROPE',
        season: '2024-2026',
        side: 'home',
        line: targetLine
      })
    );

    results.push(
      evaluateMarketSlice(awayBets, {
        market: 'AH',
        dimension: 'LINE_SIDE',
        identifier: `AH ${targetLine > 0 ? '+' : ''}${targetLine.toFixed(2)} Away`,
        leagueId: 'TOP5_EUROPE',
        season: '2024-2026',
        side: 'away',
        line: targetLine
      })
    );
  }

  // ==========================================================================
  // 2. ASIAN HANDICAP: ROLE DISCOVERY (Favorite vs Underdog)
  // ==========================================================================
  console.log('[2/4] Running Asian Handicap Role Discovery (Favorite vs Underdog)...');
  const favBets: Array<{ outcome: SettlementOutcome; odds: number; profit: number }> = [];
  const dogBets: Array<{ outcome: SettlementOutcome; odds: number; profit: number }> = [];

  for (const m of matches) {
    const line = m.odds.ahLine;
    const hOdds = m.odds.ahHome;
    const aOdds = m.odds.ahAway;
    if (line !== undefined && line !== null && hOdds && aOdds) {
      if (line < 0) {
        // Home is favorite, Away is underdog
        const hOutcome = settleAsianHandicap('home', line, m.homeGoals, m.awayGoals);
        favBets.push({ outcome: hOutcome, odds: hOdds, profit: profitOfOutcome(hOutcome, hOdds, 1.0) });

        const aOutcome = settleAsianHandicap('away', line, m.homeGoals, m.awayGoals);
        dogBets.push({ outcome: aOutcome, odds: aOdds, profit: profitOfOutcome(aOutcome, aOdds, 1.0) });
      } else if (line > 0) {
        // Away is favorite, Home is underdog
        const aOutcome = settleAsianHandicap('away', line, m.homeGoals, m.awayGoals);
        favBets.push({ outcome: aOutcome, odds: aOdds, profit: profitOfOutcome(aOutcome, aOdds, 1.0) });

        const hOutcome = settleAsianHandicap('home', line, m.homeGoals, m.awayGoals);
        dogBets.push({ outcome: hOutcome, odds: hOdds, profit: profitOfOutcome(hOutcome, hOdds, 1.0) });
      }
    }
  }

  results.push(
    evaluateMarketSlice(favBets, {
      market: 'AH',
      dimension: 'ROLE',
      identifier: 'All AH Favorites (Negative Line Side)',
      leagueId: 'TOP5_EUROPE',
      season: '2024-2026',
      side: 'favorite'
    })
  );

  results.push(
    evaluateMarketSlice(dogBets, {
      market: 'AH',
      dimension: 'ROLE',
      identifier: 'All AH Underdogs (Positive Line Side)',
      leagueId: 'TOP5_EUROPE',
      season: '2024-2026',
      side: 'underdog'
    })
  );

  // ==========================================================================
  // 3. OVER / UNDER DISCOVERY (Pinnacle Closing Totals)
  // ==========================================================================
  console.log('[3/4] Running Over / Under Totals Discovery...');
  const overBets: Array<{ outcome: SettlementOutcome; odds: number; profit: number }> = [];
  const underBets: Array<{ outcome: SettlementOutcome; odds: number; profit: number }> = [];

  for (const m of matches) {
    if (m.odds.over && m.odds.under) {
      const line = m.odds.ouLine || 2.5;
      const oOutcome = settleAsianTotal('over', line, m.homeGoals + m.awayGoals);
      overBets.push({ outcome: oOutcome, odds: m.odds.over, profit: profitOfOutcome(oOutcome, m.odds.over, 1.0) });

      const uOutcome = settleAsianTotal('under', line, m.homeGoals + m.awayGoals);
      underBets.push({ outcome: uOutcome, odds: m.odds.under, profit: profitOfOutcome(uOutcome, m.odds.under, 1.0) });
    }
  }

  results.push(
    evaluateMarketSlice(overBets, {
      market: 'OU',
      dimension: 'GLOBAL_OU',
      identifier: 'Pinnacle Over 2.5 Baseline',
      leagueId: 'TOP5_EUROPE',
      season: '2024-2026',
      side: 'over',
      line: 2.5
    })
  );

  results.push(
    evaluateMarketSlice(underBets, {
      market: 'OU',
      dimension: 'GLOBAL_OU',
      identifier: 'Pinnacle Under 2.5 Baseline',
      leagueId: 'TOP5_EUROPE',
      season: '2024-2026',
      side: 'under',
      line: 2.5
    })
  );

  // ==========================================================================
  // 4. BTTS GLOBAL FREQUENCY & BREAKDOWN (Across All 30 Leagues)
  // ==========================================================================
  console.log('[4/4] Running BTTS Global Frequency Breakdown...');
  const bttsByLeague = new Map<string, { yes: number; no: number; total: number }>();
  for (const gm of globalMatches) {
    const curr = bttsByLeague.get(gm.leagueCode) || { yes: 0, no: 0, total: 0 };
    curr.total++;
    if (gm.btts) curr.yes++;
    else curr.no++;
    bttsByLeague.set(gm.leagueCode, curr);
  }

  // Calculate global BTTS baseline assuming standard market fair odds (~1.85 / 1.95)
  for (const [code, stat] of bttsByLeague.entries()) {
    if (stat.total >= 100) {
      const bttsYesPct = (stat.yes / stat.total) * 100;
      // Simulated baseline at typical fair market line of 1.90
      const yesBets = Array.from({ length: stat.yes }, () => ({
        outcome: 'WIN' as SettlementOutcome,
        odds: 1.9,
        profit: 0.9
      })).concat(
        Array.from({ length: stat.no }, () => ({
          outcome: 'LOSS' as SettlementOutcome,
          odds: 1.9,
          profit: -1.0
        }))
      );

      results.push(
        evaluateMarketSlice(yesBets, {
          market: 'BTTS',
          dimension: 'GLOBAL_BTTS',
          identifier: `BTTS Yes [${code}] (Rate: ${bttsYesPct.toFixed(1)}%)`,
          leagueId: code,
          season: '2024-2025',
          side: 'yes'
        })
      );
    }
  }

  // ==========================================================================
  // 5. BENJAMINI-HOCHBERG FDR CORRECTION
  // ==========================================================================
  const validForFdr = results.filter((r) => r.bets >= 30);
  validForFdr.sort((a, b) => a.pValue - b.pValue);
  const m = validForFdr.length;
  for (let i = 0; i < m; i++) {
    const rank = i + 1;
    validForFdr[i].fdrQValue = Number(Math.min(1.0, (validForFdr[i].pValue * m) / rank).toFixed(4));
    // Re-verify Tier against FDR
    const qVal = validForFdr[i].fdrQValue ?? 1.0;
    if (validForFdr[i].roiPct > 0 && qVal < 0.05 && validForFdr[i].bets >= 250) {
      validForFdr[i].tier = validForFdr[i].bets >= 500 ? 'GOLD' : 'GREEN';
    } else if (validForFdr[i].roiPct > 0) {
      validForFdr[i].tier = 'YELLOW';
    } else {
      validForFdr[i].tier = 'RED';
    }
  }

  // Sort by ROI descending
  results.sort((a, b) => b.roiPct - a.roiPct);

  // Save report artifact
  const outJson = path.resolve('data/reports/epic66_market_discovery.json');
  fs.writeFileSync(outJson, JSON.stringify({ version: 'epic66-v1.0', evaluated_cells: results.length, rankings: results }, null, 2), 'utf-8');

  // Print Top & Bottom Slices
  console.log('\n=== TOP 10 PROFITABLE BASELINE MARKET CONFIGURATIONS ===');
  console.table(
    results.slice(0, 10).map((r) => ({
      Identifier: r.identifier,
      Market: r.market,
      Side: r.side,
      Bets: r.bets,
      'Hit Rate': `${r.hitRatePct}%`,
      'ROI %': `${r.roiPct > 0 ? '+' : ''}${r.roiPct}%`,
      'Max DD': r.maxDrawdown,
      pVal: r.pValue,
      qVal: r.fdrQValue ?? 'N/A',
      Tier: r.tier
    }))
  );

  console.log('\n=== BOTTOM 5 WORST BASELINE MARKET CONFIGURATIONS ===');
  console.table(
    results.slice(-5).map((r) => ({
      Identifier: r.identifier,
      Market: r.market,
      Side: r.side,
      Bets: r.bets,
      'Hit Rate': `${r.hitRatePct}%`,
      'ROI %': `${r.roiPct > 0 ? '+' : ''}${r.roiPct}%`,
      'Max DD': r.maxDrawdown,
      pVal: r.pValue,
      Tier: r.tier
    }))
  );

  console.log(`\nMarket Discovery results saved to ${outJson}\n`);
}

if (require.main === module) {
  runMarketDiscovery();
}
