import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase.server';
import { requireAdmin } from '../../../../lib/auth/admin';
import { insertAlert } from '../../../../lib/monitoring/alerts';

/**
 * Admin health monitoring endpoint.
 * Returns system status and data quality metrics.
 * Also emits alerts when thresholds are breached.
 */
export async function GET(request: Request) {
  try {
    // Admin auth
    await requireAdmin(request);

    const now = new Date();

    // 1️⃣ Database connectivity check
    const { error: dbErr } = await supabase.rpc('run_sql', { sql: 'SELECT 1;' });
    const dbOk = !dbErr;

    // 2️⃣ Odds ingestion freshness (assumes a table `odds_snapshots` with `created_at`)
    const { data: oddsData, error: oddsErr } = await supabase
      .from('odds_snapshots')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    const oddsOk = !!oddsData && !oddsErr;
    const lastOddsUpdate = oddsOk ? new Date(oddsData.created_at) : null;

    // 3️⃣ Settlement backlog (unsettled signals older than 24h)
    const { data: unsettled, error: unsettledErr } = await supabase
      .from('signals')
      .select('id')
      .is('settled_at', null)
      .gt('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
    const settlementBacklogCount = unsettled?.length ?? 0;
    const totalSignalsRes = await supabase.from('signals').select('id', { count: 'exact', head: true });
    const totalSignals = totalSignalsRes.count ?? 0;
    const settlementBacklogPct = totalSignals > 0 ? (settlementBacklogCount / totalSignals) * 100 : 0;

    // 4️⃣ CLV calculation failures (signals settled but clv_percentage NULL)
    const { data: clvFails, error: clvErr } = await supabase
      .from('signals')
      .select('id')
      .not('settled_at', 'is', null)
      .is('clv_percentage', null);
    const clvFailCount = clvFails?.length ?? 0;
    const clvFailPct = totalSignals > 0 ? (clvFailCount / totalSignals) * 100 : 0;

    // 5️⃣ Payment issues (payments not succeeded)
    const { data: badPayments, error: payErr } = await supabase
      .from('payments')
      .select('id')
      .neq('status', 'succeeded');
    const paymentIssueCount = badPayments?.length ?? 0;

    // 6️⃣ Signals today and validation quality
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const { data: todaySignals, error: todayErr } = await supabase
      .from('signals')
      .select('id, status, odds, reference_book')
      .gte('created_at', startOfDay);
    const signalsToday = todaySignals?.length ?? 0;
    const validSignals = todaySignals?.filter((s) => {
      const status = (s.status || '').toLowerCase();
      const oddsValid = s.odds !== null && s.odds !== undefined && Number(s.odds) > 0;
      const hasRef = s.reference_book && s.reference_book.trim().length > 0;
      return status !== 'rejected' && oddsValid && hasRef;
    }).length ?? 0;
    const validPct = signalsToday > 0 ? (validSignals / signalsToday) * 100 : 0;
    const missingOddsPct = signalsToday > 0 ? (todaySignals?.filter(s => s.odds === null || s.odds === undefined).length / signalsToday) * 100 : 0;

    // Data freshness checks
    const freshnessThresholdMs = 24 * 60 * 60 * 1000; // 1 day
    const dataFreshness = {
      last_signal_created: (await supabase.from('signals').select('created_at', { count: 'exact', head: true }).order('created_at', { ascending: false }).limit(1).single()).data?.created_at || null,
      last_odds_update: lastOddsUpdate?.toISOString() || null,
      last_settlement_run: (await supabase.from('settlement_runs').select('executed_at', { count: 'exact', head: true }).order('executed_at', { ascending: false }).limit(1).single()).data?.executed_at || null,
    };

    // Emit alerts based on thresholds
    if (clvFailPct > 5) {
      await insertAlert('clv_failure', 'warning', 'health_endpoint', `CLV calculation failure rate ${clvFailPct.toFixed(1)}% exceeds 5%`, { clvFailPct });
    }
    if (settlementBacklogPct > 10) {
      await insertAlert('settlement_backlog', 'warning', 'health_endpoint', `Settlement backlog ${settlementBacklogPct.toFixed(1)}% exceeds 10%`, { settlementBacklogPct });
    }
    if (missingOddsPct > 20) {
      await insertAlert('missing_odds', 'warning', 'health_endpoint', `Missing odds ${missingOddsPct.toFixed(1)}% exceeds 20%`, { missingOddsPct });
    }
    if (dataFreshness.last_signal_created && (now.getTime() - new Date(dataFreshness.last_signal_created).getTime()) > freshnessThresholdMs) {
      await insertAlert('stale_signals', 'info', 'health_endpoint', 'Signal creation appears stale (>24h)', { last_signal_created: dataFreshness.last_signal_created });
    }
    if (lastOddsUpdate && (now.getTime() - lastOddsUpdate.getTime()) > freshnessThresholdMs) {
      await insertAlert('stale_odds', 'info', 'health_endpoint', 'Odds ingestion appears stale (>24h)', { last_odds_update: lastOddsUpdate.toISOString() });
    }
    if (dataFreshness.last_settlement_run && (now.getTime() - new Date(dataFreshness.last_settlement_run).getTime()) > freshnessThresholdMs) {
      await insertAlert('stale_settlement', 'info', 'health_endpoint', 'Settlement run appears stale (>24h)', { last_settlement_run: dataFreshness.last_settlement_run });
    }

    const payload = {
      system: {
        database: dbOk,
        odds_ingestion: oddsOk,
        settlement_backlog_pct: Number(settlementBacklogPct.toFixed(2)),
        clv_failure_pct: Number(clvFailPct.toFixed(2)),
        payment_issues: paymentIssueCount,
      },
      data_quality: {
        signals_today: signalsToday,
        valid_pct: Number(validPct.toFixed(2)),
        missing_odds_pct: Number(missingOddsPct.toFixed(2)),
      },
      data_freshness: dataFreshness,
    };

    return NextResponse.json({ success: true, data: payload });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
