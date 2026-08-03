import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { apiFootballClient } from '../lib/apis/apifootball';
import { settleMoneyline } from '../lib/settlement-core/settlement';
import type { SettlementResult } from '../lib/settlement-core/types';

/**
 * SETTLEMENT PIPELINE VALIDATION (seed/backfill data)
 *
 * Scope (STRICTLY settlement-valid rows only):
 *   - Matches: the 10 real, historical 2024 Premier League fixtures behind the
 *     seeded predictions (verified final scores fetched live from API-Football).
 *   - Trades: ONLY paper_trades with market_type='ML', status='PENDING', linked
 *     to one of those 10 matches, with a resolvable home/draw/away selection.
 *
 * Explicitly NOT settled (left PENDING):
 *   - AH / OU paper_trades with market_subtype = NULL (corrupt / unverifiable line).
 *   - All trades on synthetic 2026 fixtures that have no verified real result.
 *
 * This is a SETTLEMENT PIPELINE VALIDATION, NOT evidence of model performance.
 * The uniform "home @ 1.95" pattern indicates placeholder/default seed data.
 *
 * Idempotent: only PENDING ML rows are touched; settled rows are never re-opened.
 */

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) { console.error('Missing Supabase credentials'); process.exit(1); }
const sb = createClient(url, key);

const EPL_API_ID = 39;
const EPL_SEASON = 2024;
const DRY_RUN = process.env.DRY_RUN !== '0' && process.argv.includes('--dry-run');

// DB check constraint allows: PENDING, WON, LOST, VOID only.
function mapDbStatus(outcome: string): string {
  switch (outcome) {
    case 'WIN': return 'WON';
    case 'LOSS': return 'LOST';
    case 'PUSH': return 'PUSH';
    case 'VOID': return 'VOID';
    case 'HALF_WIN': return 'PUSH';
    case 'HALF_LOSS': return 'PUSH';
    default: return outcome;
  }
}

function norm(s: string): string {
  return String(s || '').toLowerCase().replace(/[\s-_]/g, '');
}

function resolveSide(sel: string, home: string, away: string): 'home' | 'draw' | 'away' | null {
  if (!sel) return null;
  const side = norm(sel);
  if (side === 'home') return 'home';
  if (side === 'away') return 'away';
  if (side === 'draw') return 'draw';
  if (side === norm(home)) return 'home';
  if (side === norm(away)) return 'away';
  return null;
}

async function main() {
  // 1. Identify the 10 real 2024 matches behind predictions.
  const { data: preds } = await sb.from('predictions').select('match_id').limit(5000);
  const matchIds = [...new Set((preds || []).map((r: any) => r.match_id))];
  const { data: matches } = await sb.from('matches')
    .select('id, kickoff, home_team, away_team, status, home_goals, away_goals')
    .in('id', matchIds);
  const realMatches = (matches || []).filter((m: any) => String(m.kickoff || '').slice(0, 4) === '2024');
  const realIds = new Set(realMatches.map((m: any) => String(m.id)));
  const matchMap: Record<string, any> = {};
  realMatches.forEach((m: any) => { matchMap[m.id] = m; });

  // 2. Fetch verified final scores (single batch call for EPL 2024).
  console.log(`Fetching EPL ${EPL_SEASON} fixtures (league ${EPL_API_ID})...`);
  const res = await apiFootballClient.getFixtures(EPL_API_ID, EPL_SEASON);
  const fixtures = res.response || [];

  const verifiedByKey = new Map<string, { home: number; away: number; status: string }>();
  const finishedStatuses = ['FT', 'AET', 'PEN'];
  const voidStatuses = ['CANC', 'ABD', 'SUSP', 'PST', 'INT'];
  for (const fx of fixtures) {
    const key = `${norm(fx.teams.home.name)}|${norm(fx.teams.away.name)}`;
    const short = fx.fixture.status.short;
    const goalsHome = fx.goals?.home;
    const goalsAway = fx.goals?.away;
    if (finishedStatuses.includes(short) && goalsHome != null && goalsAway != null) {
      verifiedByKey.set(key, { home: Number(goalsHome), away: Number(goalsAway), status: 'FINISHED' });
    } else if (voidStatuses.includes(short)) {
      verifiedByKey.set(key, { home: NaN, away: NaN, status: 'VOID' });
    }
  }

  // 3. Fetch candidate ML trades.
  const { data: trades } = await sb.from('paper_trades').select('*').limit(5000);
  const mlTrades = (trades || []).filter((t: any) =>
    realIds.has(String(t.match_id)) && t.market_type === 'ML' && t.status === 'PENDING');

  report.initMatchCount = realMatches.length;
  report.matchIds = realMatches.map((m: any) => m.id);

  // 4. Settle matches first (scores) + trades.
  for (const match of realMatches) {
    const idx = (realMatches as any[]).indexOf(match);
    const key = `${norm(match.home_team)}|${norm(match.away_team)}`;
    const verified = verifiedByKey.get(key);

    if (!verified) {
      report.matchesNotFound.push(`${match.home_team} vs ${match.away_team}`);
      console.log(`[match] NO verified result for ${match.home_team} vs ${match.away_team} — left as-is.`);
      continue;
    }
    if (verified.status === 'VOID') {
      report.matchesVoid.push(`${match.home_team} vs ${match.away_team}`);
      console.log(`[match] VOID (cancelled/abandoned) ${match.home_team} vs ${match.away_team}.`);
      if (!DRY_RUN) {
        await sb.from('matches').update({ status: 'void', updated_at: new Date().toISOString() }).eq('id', match.id);
      }
      report.matchesUpdated++;
      continue;
    }

    report.matchesFound++;
    // Only update when the DB does not already hold the verified score (no-op if identical => idempotent).
    const needsScoreUpdate =
      Number(match.home_goals) !== verified.home || Number(match.away_goals) !== verified.away || match.status !== 'FINISHED';
    if (needsScoreUpdate) {
      report.matchesUpdated++;
      if (DRY_RUN) {
        console.log(`[matches] WOULD update ${match.home_team} ${verified.home}-${verified.away} ${match.away_team} (was ${match.home_goals}-${match.away_goals}/${match.status}).`);
      } else {
        console.log(`[matches] update ${match.home_team} ${verified.home}-${verified.away} ${match.away_team}.`);
        await sb.from('matches').update({
          home_goals: verified.home,
          away_goals: verified.away,
          status: 'FINISHED',
          updated_at: new Date().toISOString(),
        }).eq('id', match.id);
      }
    } else {
      console.log(`[matches] up-to-date ${match.home_team} ${verified.home}-${verified.away} ${match.away_team}.`);
    }

    // Settle ML trades for this match.
    const matchTrades = mlTrades.filter((t: any) => String(t.match_id) === String(match.id));
    for (const t of matchTrades) {
      const side = resolveSide(String(t.selection), match.home_team, match.away_team);
      if (!side) {
        report.tradesUnresolvable++;
        console.log(`[trade] ${t.id.slice(0, 8)} UNRESOLVABLE selection "${t.selection}" for ${match.home_team} vs ${match.away_team}. Left PENDING.`);
        continue;
      }
      const odds = Number(t.entry_odds ?? t.odds ?? 1.95);
      const result: SettlementResult = settleMoneyline(verified.home, verified.away, side, odds);
      const profitUnits = result.profitUnits; // 1-unit basis
      const stake = Number(t.stake ?? 100);
      const pnl = profitUnits * stake;

      report.tradesSettled++;
      const bucket = result.outcome;
      report.outcomeCounts[bucket] = (report.outcomeCounts[bucket] || 0) + 1;
      report.pnl += pnl;
      report.oddsDistribution[String(odds)] = (report.oddsDistribution[String(odds)] || 0) + 1;
      report.stakeDistribution[String(stake)] = (report.stakeDistribution[String(stake)] || 0) + 1;

      if (DRY_RUN) {
        console.log(`[trade] WOULD ${result.outcome} ${t.id.slice(0, 8)} ${match.home_team} vs ${match.away_team} sel=${side} odds=${odds} pnl=${pnl.toFixed(2)}.`);
      } else {
        const dbStatus = mapDbStatus(result.outcome);
        const res = await sb.from('paper_trades').update({
          status: dbStatus,
          actual_result: dbStatus,
          profit_loss: Number(pnl.toFixed(2)),
          profit: Number(pnl.toFixed(2)),
          is_win: result.outcome === 'WIN',
          settled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', t.id);
        if (res.error) {
          console.error(`[trade] UPDATE FAILED ${t.id.slice(0, 8)}: ${res.error.code} ${res.error.message}`);
          report.updateErrors = (report.updateErrors || 0) + 1;
        }
      }
    }
  }

  // 6. Audit counts of what was intentionally left pending.
  const nonMLCount = (trades || []).filter((t: any) => realIds.has(String(t.match_id)) && t.market_type !== 'ML').length;
  const nonMLNoSubtype = (trades || []).filter((t: any) => realIds.has(String(t.match_id)) && t.market_type !== 'ML' && !t.market_subtype).length;
  const syntheticCount = (trades || []).filter((t: any) => !realIds.has(String(t.match_id)) && t.status === 'PENDING').length;
  report.leftPending.nonMLReal = nonMLCount;
  report.leftPending.nonMLNoSubtype = nonMLNoSubtype;
  report.leftPending.synthetic = syntheticCount;
}

const report: any = {
  initMatchCount: 0,
  matchIds: [],
  matchesFound: 0,
  matchesVoid: 0,
  matchesNotFound: [],
  matchesUpdated: 0,
  tradesSettled: 0,
  tradesUnresolvable: 0,
  outcomeCounts: {},
  pnl: 0,
  roi: 0,
  oddsDistribution: {},
  stakeDistribution: {},
  leftPending: {},
};

main()
  .then(() => {
    report.mode = DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE';
    report.tradesProcessed = report.tradesSettled + report.tradesUnresolvable;
    // ROI on flat 100 stake across settled trades (defensive)
    report.roi = report.tradesSettled > 0 ? ((report.pnl / (report.tradesSettled * 100)) * 100) : 0;
    console.log('\n================ SETTLEMENT AUDIT REPORT ================');
    console.log(JSON.stringify(report, null, 2));
    console.log('==========================================================');
    process.exit(0);
  })
  .catch((e) => { console.error('FATAL', e); process.exit(1); });
