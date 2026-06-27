import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { sendTelegramMessage } from '@/lib/services/telegram';
import { runHealthCheck } from '@/lib/services/healthChecker';

export async function GET(request: Request) {
  return handleDailySummary(request);
}

export async function POST(request: Request) {
  return handleDailySummary(request);
}

async function handleDailySummary(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setUTCDate(now.getUTCDate() - 1);

    const yesterdayStart = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0, 0, 0));
    const yesterdayEnd = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59, 999));

    // 1. Query Signals Created Yesterday
    const { count: signalsYesterdayCount, error: signalsErr } = await supabase
      .from('signals')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterdayStart.toISOString())
      .lte('created_at', yesterdayEnd.toISOString());

    if (signalsErr) throw new Error(`Signals query failed: ${signalsErr.message}`);

    // 2. Query Signals Settled Yesterday
    const { data: settledYesterday, error: settledErr } = await supabase
      .from('signals')
      .select('*')
      .not('status', 'eq', 'pending')
      .not('status', 'eq', 'settling')
      .gte('settled_at', yesterdayStart.toISOString())
      .lte('settled_at', yesterdayEnd.toISOString());

    if (settledErr) throw new Error(`Settled signals query failed: ${settledErr.message}`);

    // 3. Compute Yesterday's Performance Metrics
    const settledCount = settledYesterday?.length || 0;
    let winRate = 0.0;
    let roi = 0.0;
    let clv = 0.0;

    if (settledCount > 0) {
      const wins = settledYesterday.filter(s => s.status === 'won').length;
      const halfWins = settledYesterday.filter(s => s.status === 'half_win').length;
      const losses = settledYesterday.filter(s => s.status === 'lost').length;
      const halfLosses = settledYesterday.filter(s => s.status === 'half_loss').length;
      const pushes = settledYesterday.filter(s => s.status === 'push' || s.status === 'void').length;

      const nonPushes = settledCount - pushes;
      if (nonPushes > 0) {
        winRate = Number((((wins + 0.5 * halfWins) / nonPushes) * 100).toFixed(2));
      }

      const totalProfitLoss = settledYesterday.reduce((sum, s) => sum + Number(s.profit_loss || 0.0), 0.0);
      roi = Number(((totalProfitLoss / settledCount) * 100).toFixed(2));

      const clvs = settledYesterday.map(s => Number(s.clv_percentage || 0.0));
      clv = Number((clvs.reduce((sum, val) => sum + val, 0.0) / settledCount).toFixed(2));
    }

    // 4. Query Paper Bankroll and Drawdown
    const { data: latestTrade, error: tradeErr } = await supabase
      .from('paper_trades')
      .select('bankroll_after, drawdown')
      .eq('status', 'settled')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tradeErr) throw new Error(`Trade query failed: ${tradeErr.message}`);

    const bankroll = latestTrade?.bankroll_after !== undefined ? Number(latestTrade.bankroll_after) : 1000.0;
    const drawdown = latestTrade?.drawdown !== undefined ? Number(latestTrade.drawdown) : 0.0;

    // 5. Query Data Quality Issues
    const { count: missingOdds, error: oddsErr } = await supabase
      .from('signals')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterdayStart.toISOString())
      .lte('created_at', yesterdayEnd.toISOString())
      .is('odds', null);

    if (oddsErr) throw new Error(`Missing odds query failed: ${oddsErr.message}`);

    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const { count: unsettledCount, error: unsettledErr } = await supabase
      .from('signals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('kickoff_utc', fortyEightHoursAgo.toISOString());

    if (unsettledErr) throw new Error(`Unsettled signals query failed: ${unsettledErr.message}`);

    // In-memory duplicates check for yesterday's signals
    const { data: allYesterdaySignals, error: dupesErr } = await supabase
      .from('signals')
      .select('match_id, market, handicap_line, selection')
      .gte('created_at', yesterdayStart.toISOString())
      .lte('created_at', yesterdayEnd.toISOString());

    if (dupesErr) throw new Error(`Yesterday signals for duplicates check query failed: ${dupesErr.message}`);

    const seen = new Set<string>();
    let duplicateCount = 0;
    for (const sig of allYesterdaySignals || []) {
      const key = `${sig.match_id}-${sig.market}-${sig.handicap_line}-${sig.selection}`;
      if (seen.has(key)) {
        duplicateCount++;
      } else {
        seen.add(key);
      }
    }

    // 6. Query System Health & Cron errors count
    const health = await runHealthCheck();
    const dbStatus = 'OK'; // succeeded querying above
    const apiStatus = health.status === 'healthy' || health.ingestionDetails.some(d => d.fixturesOk) ? 'OK' : 'DEGRADED';
    const cronStatus = health.failedCrons.length === 0 ? 'OK' : 'DEGRADED';

    const { count: cronErrorCount, error: cronRunErr } = await supabase
      .from('cron_runs')
      .select('*', { count: 'exact', head: true })
      .gte('start_time', yesterdayStart.toISOString())
      .not('errors', 'is', null);

    if (cronRunErr) throw new Error(`Cron error logs query failed: ${cronRunErr.message}`);

    // 7. Format and send Report to Telegram
    const reportText = `<b>HandicapLab Daily Report</b>

Signals yesterday:
${signalsYesterdayCount ?? 0}

Settled:
${settledCount}

Performance:
Win Rate: ${winRate.toFixed(2)}%
ROI: ${roi.toFixed(2)}%
CLV: ${clv.toFixed(2)}%

Bankroll [PAPER]:
$${bankroll.toFixed(2)}

Drawdown:
${drawdown.toFixed(2)}%

Data Quality:
Missing odds:
${missingOdds ?? 0}

Unsettled >48h:
${unsettledCount ?? 0}

Duplicate signals:
${duplicateCount}

System:
API: ${apiStatus}
Database: ${dbStatus}
Cron: ${cronStatus}

Errors:
${cronErrorCount ?? 0}`;

    await sendTelegramMessage(reportText);

    return NextResponse.json({ success: true, reportSent: true });
  } catch (error: any) {
    console.error('[Daily Operator Summary Cron Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
