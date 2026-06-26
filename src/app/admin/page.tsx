import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase.server';
import { runHealthCheck } from '@/lib/services/healthChecker';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const adminSecret = cookieStore.get('admin_secret')?.value;
  const expectedSecret = process.env.ADMIN_SECRET || 'fallback_admin_secret_key';

  if (!adminSecret || adminSecret !== expectedSecret) {
    redirect('/admin/login');
  }

  // 1. Query general data health metrics
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { count: fixturesCount } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneDayAgo);

  const { count: oddsCount } = await supabase
    .from('odds_history')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', oneDayAgo);

  const { count: signalsCount } = await supabase
    .from('signals')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneDayAgo);

  const { count: pendingCount } = await supabase
    .from('signals')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { data: settledSignals } = await supabase
    .from('signals')
    .select('clv_percentage')
    .not('settled_at', 'is', null);

  const settledCount = settledSignals?.length || 0;
  const insufficientSample = settledCount < 50;

  let averageClv: number | null = null;
  if (!insufficientSample && settledSignals && settledSignals.length > 0) {
    let clvSum = 0;
    let clvCount = 0;
    for (const sig of settledSignals) {
      if (sig.clv_percentage !== null && sig.clv_percentage !== undefined) {
        clvSum += Number(sig.clv_percentage);
        clvCount++;
      }
    }
    averageClv = clvCount > 0 ? Number((clvSum / clvCount).toFixed(2)) : 0.0;
  }

  // 2. Query Cron execution logs server-side only
  const { data: logs } = await supabase
    .from('cron_runs')
    .select('*')
    .order('start_time', { ascending: false })
    .limit(30);

  // 3. Run the live health check
  const health = await runHealthCheck();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span className="bg-gradient-to-r from-indigo-500 to-emerald-500 text-transparent bg-clip-text">
                Quant Terminal
              </span>
              <span className="text-xs bg-slate-800 border border-slate-700 px-2.5 py-1 rounded font-mono text-slate-400">
                ADMIN
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Data pipelines, operational logs, and system metrics.
            </p>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl">
            <span className="text-xs text-slate-400 font-medium">Provider Status:</span>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${health.status === 'healthy' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
              <span className={`text-xs font-bold uppercase tracking-wider ${health.status === 'healthy' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {health.status}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Alerts */}
        {health.status !== 'healthy' && (
          <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-rose-400 text-sm flex items-center gap-2">
              ⚠️ Degraded System Performance Detected
            </h3>
            <div className="text-xs text-rose-300/80 space-y-2">
              {health.failedCrons.length > 0 && (
                <div>
                  <p className="font-semibold text-rose-300 mb-1">Failed Cron Runs:</p>
                  <ul className="list-disc pl-5 space-y-1 font-mono">
                    {health.failedCrons.map((fc, i) => (
                      <li key={i}>{fc}</li>
                    ))}
                  </ul>
                </div>
              )}
              {health.ingestionDetails.some(d => !d.fixturesOk || !d.oddsOk) && (
                <div>
                  <p className="font-semibold text-rose-300 mb-1">Ingestion Freshness Timeouts:</p>
                  <ul className="list-disc pl-5 space-y-1 font-mono">
                    {health.ingestionDetails.filter(d => !d.fixturesOk || !d.oddsOk).map((d, i) => (
                      <li key={i}>
                        {d.leagueName} ({d.category}): 
                        {!d.fixturesOk && ` Fixtures stale (${d.fixtureFreshnessHours ?? 'N/A'}h / limit ${d.thresholdHours}h)`}
                        {!d.oddsOk && ` Odds stale (${d.oddsFreshnessHours ?? 'N/A'}h / limit ${d.thresholdHours}h)`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dashboard Grid metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 transition hover:border-slate-700">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fixtures Ingested (24h)</p>
            <h2 className="text-3xl font-extrabold text-white mt-2 font-mono">{fixturesCount || 0}</h2>
            <p className="text-xxs text-slate-500 mt-1">Fixtures added/updated since yesterday</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 transition hover:border-slate-700">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Odds Recorded (24h)</p>
            <h2 className="text-3xl font-extrabold text-white mt-2 font-mono">{oddsCount || 0}</h2>
            <p className="text-xxs text-slate-500 mt-1">Odds snapshot data points captured</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 transition hover:border-slate-700">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Signals Generated (24h)</p>
            <h2 className="text-3xl font-extrabold text-white mt-2 font-mono">{signalsCount || 0}</h2>
            <p className="text-xxs text-slate-500 mt-1">Pending signals: {pendingCount || 0}</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 transition hover:border-slate-700 relative overflow-hidden">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Average CLV %</p>
            {insufficientSample ? (
              <div>
                <h2 className="text-xl font-bold text-amber-500 mt-3 flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  Gated
                </h2>
                <p className="text-xxs text-amber-400/80 mt-1">
                  Requires 50 settled signals ({settledCount}/50)
                </p>
              </div>
            ) : (
              <div>
                <h2 className="text-3xl font-extrabold text-emerald-400 mt-2 font-mono">
                  {averageClv !== null ? `${averageClv > 0 ? '+' : ''}${averageClv}%` : 'N/A'}
                </h2>
                <p className="text-xxs text-slate-500 mt-1">Based on {settledCount} settled matches</p>
              </div>
            )}
          </div>
          
        </div>

        {/* Detailed Ingestion Health list */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Competition Ingestion Freshness</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">League</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Threshold</th>
                  <th className="py-3 px-4">Last Fixture Ingest</th>
                  <th className="py-3 px-4">Last Odds Ingest</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300 font-mono">
                {health.ingestionDetails.map((det) => (
                  <tr key={det.leagueId} className="hover:bg-slate-900/20">
                    <td className="py-3.5 px-4 font-sans font-medium text-white">{det.leagueName}</td>
                    <td className="py-3.5 px-4 text-slate-400">{det.category}</td>
                    <td className="py-3.5 px-4 text-slate-400">{det.thresholdHours}h</td>
                    <td className="py-3.5 px-4">
                      {det.lastFixtureIngestedAt 
                        ? `${new Date(det.lastFixtureIngestedAt).toLocaleTimeString()} (${det.fixtureFreshnessHours}h ago)`
                        : 'Never'
                      }
                    </td>
                    <td className="py-3.5 px-4">
                      {det.lastOddsIngestedAt
                        ? `${new Date(det.lastOddsIngestedAt).toLocaleTimeString()} (${det.oddsFreshnessHours}h ago)`
                        : 'Never'
                      }
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xxs font-bold uppercase ${det.fixturesOk && det.oddsOk ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' : 'bg-rose-500/10 text-rose-400 border border-rose-500/10'}`}>
                        {det.fixturesOk && det.oddsOk ? 'Fresh' : 'Stale'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Server-Side logs table */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Pipeline Execution Logs (Server-Side)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Cron Name</th>
                  <th className="py-3 px-4">Start Time</th>
                  <th className="py-3 px-4">End Time</th>
                  <th className="py-3 px-4 text-center">Records</th>
                  <th className="py-3 px-4">Error Category</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300 font-mono">
                {logs && logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/20">
                      <td className="py-3.5 px-4 font-sans font-semibold text-white">{log.cron_name}</td>
                      <td className="py-3.5 px-4 text-slate-400">{new Date(log.start_time).toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {log.end_time ? new Date(log.end_time).toLocaleString() : 'Running...'}
                      </td>
                      <td className="py-3.5 px-4 text-center">{log.records_processed}</td>
                      <td className="py-3.5 px-4">
                        {log.errors ? (
                          <span className="text-rose-400 font-bold bg-rose-500/5 border border-rose-500/10 px-2 py-0.5 rounded text-xxs">
                            {log.errors}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xxs font-bold uppercase ${log.errors ? 'bg-rose-500/10 text-rose-400 border border-rose-500/10' : !log.end_time ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10 animate-pulse' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'}`}>
                          {log.errors ? 'Failed' : !log.end_time ? 'Running' : 'Success'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500 font-sans">
                      No pipeline logs found in the database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}
