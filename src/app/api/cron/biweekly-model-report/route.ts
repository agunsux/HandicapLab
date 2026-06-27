import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { sendTelegramMessage } from '@/lib/services/telegram';
import { runHealthCheck } from '@/lib/services/healthChecker';

export async function GET(request: Request) {
  return handleBiweeklyReport(request);
}

export async function POST(request: Request) {
  return handleBiweeklyReport(request);
}

async function handleBiweeklyReport(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    const currentDay = now.getUTCDate();

    if (currentDay === 15) {
      // 1st of current month to 14th of current month
      startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 14, 23, 59, 59, 999));
    } else if (currentDay === 1) {
      // 15th of previous month to last day of previous month
      const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
      startDate = new Date(Date.UTC(prevMonth.getUTCFullYear(), prevMonth.getUTCMonth(), 15, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
    } else {
      // Fallback range: last 14 days
      startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      endDate = now;
    }

    const periodStr = `${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`;

    // 1. Query Signals Created in Period
    const { count: signalsCreatedCount, error: createdErr } = await supabase
      .from('signals')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (createdErr) throw new Error(`Signals created query failed: ${createdErr.message}`);

    // 2. Query Signals Settled in Period
    const { data: settledSignals, error: settledErr } = await supabase
      .from('signals')
      .select('*')
      .not('status', 'eq', 'pending')
      .not('status', 'eq', 'settling')
      .gte('settled_at', startDate.toISOString())
      .lte('settled_at', endDate.toISOString());

    if (settledErr) throw new Error(`Settled signals query failed: ${settledErr.message}`);

    // 3. Compute Stats
    const totalSettled = settledSignals?.length || 0;

    const marketStats: Record<string, { count: number; wins: number; halfWins: number; losses: number; halfLosses: number; pushes: number; profit: number; clvSum: number }> = {
      asian_handicap: { count: 0, wins: 0, halfWins: 0, losses: 0, halfLosses: 0, pushes: 0, profit: 0.0, clvSum: 0.0 },
      over_under: { count: 0, wins: 0, halfWins: 0, losses: 0, halfLosses: 0, pushes: 0, profit: 0.0, clvSum: 0.0 },
      moneyline: { count: 0, wins: 0, halfWins: 0, losses: 0, halfLosses: 0, pushes: 0, profit: 0.0, clvSum: 0.0 }
    };

    const confidenceBuckets: Record<string, { count: number; wins: number; halfWins: number; pushes: number }> = {
      high: { count: 0, wins: 0, halfWins: 0, pushes: 0 },
      medium: { count: 0, wins: 0, halfWins: 0, pushes: 0 },
      low: { count: 0, wins: 0, halfWins: 0, pushes: 0 }
    };

    const leagueStats: Record<string, { count: number; wins: number; halfWins: number; pushes: number; profit: number; clvSum: number }> = {};

    for (const sig of settledSignals || []) {
      const market = sig.market || 'moneyline';
      const status = sig.status;
      const profit = Number(sig.profit_loss || 0.0);
      const clv = Number(sig.clv_percentage || 0.0);
      const league = sig.league || 'Unknown League';

      // Market grouping
      if (marketStats[market]) {
        const ms = marketStats[market];
        ms.count++;
        ms.profit += profit;
        ms.clvSum += clv;
        if (status === 'won') ms.wins++;
        else if (status === 'half_win') ms.halfWins++;
        else if (status === 'lost') ms.losses++;
        else if (status === 'half_loss') ms.halfLosses++;
        else if (status === 'push' || status === 'void') ms.pushes++;
      }

      // Confidence bucketing
      const confVal = sig.confidence_score !== undefined && sig.confidence_score !== null
        ? Number(sig.confidence_score)
        : Number(sig.confidence || 0);

      let bucket = 'low';
      if (confVal >= 80) bucket = 'high';
      else if (confVal >= 70) bucket = 'medium';

      const cb = confidenceBuckets[bucket];
      cb.count++;
      if (status === 'won') cb.wins++;
      else if (status === 'half_win') cb.halfWins++;
      else if (status === 'push' || status === 'void') cb.pushes++;

      // League grouping
      if (!leagueStats[league]) {
        leagueStats[league] = { count: 0, wins: 0, halfWins: 0, pushes: 0, profit: 0.0, clvSum: 0.0 };
      }
      const ls = leagueStats[league];
      ls.count++;
      ls.profit += profit;
      ls.clvSum += clv;
      if (status === 'won') ls.wins++;
      else if (status === 'half_win') ls.halfWins++;
      else if (status === 'push' || status === 'void') ls.pushes++;
    }

    // 4. Get System Health
    const health = await runHealthCheck();

    // 5. Format Bi-weekly Report
    let reportText = `<b>HandicapLab Model Report</b>\n\n`;
    reportText += `Period: <b>${periodStr}</b>\n`;
    reportText += `Signals created: ${signalsCreatedCount ?? 0}\n`;
    reportText += `Signals settled: ${totalSettled}\n\n`;

    reportText += `<b>Performance by Market:</b>\n`;
    for (const [marketKey, m] of Object.entries(marketStats)) {
      const displayName = marketKey === 'asian_handicap' ? 'Asian Handicap' : marketKey === 'over_under' ? 'Over/Under' : 'Moneyline';
      if (m.count === 0) {
        reportText += `- ${displayName} (n=0): No data\n`;
      } else {
        const mRoi = (m.profit / m.count) * 100;
        const mClv = m.clvSum / m.count;
        const mNonPushes = m.count - m.pushes;
        const mWinRate = mNonPushes > 0 ? ((m.wins + 0.5 * m.halfWins) / mNonPushes) * 100 : 0.0;
        reportText += `- ${displayName} (n=${m.count}):\n  ROI: ${mRoi.toFixed(2)}%, CLV: ${mClv.toFixed(2)}%, Win Rate: ${mWinRate.toFixed(2)}% (W: ${m.wins}, L: ${m.losses + m.halfLosses}, V: ${m.pushes})\n`;
      }
    }
    reportText += `\n`;

    reportText += `<b>Confidence Bucket Accuracy:</b>\n`;
    for (const [bucketKey, cb] of Object.entries(confidenceBuckets)) {
      const displayBucket = bucketKey === 'high' ? 'High (>=80)' : bucketKey === 'medium' ? 'Medium (70-79)' : 'Low (<70)';
      if (cb.count === 0) {
        reportText += `- ${displayBucket} (n=0): No data\n`;
      } else {
        const cbNonPushes = cb.count - cb.pushes;
        const cbWinRate = cbNonPushes > 0 ? ((cb.wins + 0.5 * cb.halfWins) / cbNonPushes) * 100 : 0.0;
        reportText += `- ${displayBucket} (n=${cb.count}): ${cbWinRate.toFixed(2)}% Win Rate (${cb.wins + cb.halfWins}/${cb.count})\n`;
      }
    }
    reportText += `\n`;

    reportText += `<b>League Performance:</b>\n`;
    const leaguesList = Object.entries(leagueStats);
    if (leaguesList.length === 0) {
      reportText += `- No data\n`;
    } else {
      for (const [leagueName, ls] of leaguesList) {
        const lsRoi = (ls.profit / ls.count) * 100;
        const lsClv = ls.clvSum / ls.count;
        const lsNonPushes = ls.count - ls.pushes;
        const lsWinRate = lsNonPushes > 0 ? ((ls.wins + 0.5 * ls.halfWins) / lsNonPushes) * 100 : 0.0;
        reportText += `- ${leagueName} (n=${ls.count}): ROI: ${lsRoi.toFixed(2)}%, CLV: ${lsClv.toFixed(2)}%, Win Rate: ${lsWinRate.toFixed(2)}%\n`;
      }
    }
    reportText += `\n`;

    reportText += `<b>System Health:</b>\n`;
    reportText += `Status: ${health.status.toUpperCase()}\n`;
    if (health.failedCrons.length > 0) {
      reportText += `Failed Crons:\n`;
      for (const fc of health.failedCrons) {
        reportText += `- ${fc}\n`;
      }
    } else {
      reportText += `Failed Crons: None\n`;
    }

    await sendTelegramMessage(reportText);

    return NextResponse.json({ success: true, reportSent: true });
  } catch (error: any) {
    console.error('[Bi-weekly Model Report Cron Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
