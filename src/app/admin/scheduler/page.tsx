'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ProviderHealth {
  provider: string;
  isHealthy: boolean;
  dailyRemaining: number;
  monthlyRemaining: number;
  quotaPct: number;
  mode: string;
}

interface League {
  id: string; // the UUID
  league_id: number;
  league_name: string;
  league_priority: number;
  adaptive_priority: number;
  season_status: string;
}

interface DashboardData {
  providers: ProviderHealth[];
  leagues: {
    total: number;
    active: number;
    list: League[];
  };
  orchestrator: {
    job_id: string;
    duration_ms: number;
    outcome: string;
    timestamp: string;
  } | null;
  timestamp: string;
}

export default function SchedulerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/ops/scheduler/metrics');
        if (!res.ok) throw new Error('Failed to fetch metrics');
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'API error');
        setData(json.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
    const interval = setInterval(fetchData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-8 text-white">Loading scheduler metrics...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
  if (!data) return <div className="p-8 text-white">No data available</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <header className="flex justify-between items-center border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
              Intelligent Quota-Aware Scheduler
            </h1>
            <p className="text-gray-400 mt-1 text-sm">EPIC 56 • Auto-refreshing every 30s</p>
          </div>
          <div className="text-right text-xs text-gray-500">
            Last Updated: {new Date(data.timestamp).toLocaleTimeString()}
          </div>
        </header>

        {/* 1. Orchestrator Status */}
        <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
          <h2 className="text-lg font-semibold mb-4 text-gray-200">Orchestrator Pipeline Status</h2>
          {data.orchestrator ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                <div className="text-xs text-gray-400">Last Outcome</div>
                <div className={`text-xl font-bold mt-1 ${
                  data.orchestrator.outcome === 'success' ? 'text-green-400' : 
                  data.orchestrator.outcome === 'failure' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {data.orchestrator.outcome.toUpperCase()}
                </div>
              </div>
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                <div className="text-xs text-gray-400">Duration</div>
                <div className="text-xl font-bold mt-1 text-white">
                  {data.orchestrator.duration_ms} ms
                </div>
              </div>
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                <div className="text-xs text-gray-400">Last Run</div>
                <div className="text-xl font-bold mt-1 text-white">
                  {new Date(data.orchestrator.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 truncate">
                <div className="text-xs text-gray-400">Job ID</div>
                <div className="text-sm mt-1 text-gray-300 truncate" title={data.orchestrator.job_id}>
                  {data.orchestrator.job_id}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400">No orchestrator runs recorded yet.</div>
          )}
        </section>

        {/* 2. Quota & Providers */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-200">Provider Quota & Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.providers.map(p => (
              <div key={p.provider} className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-white capitalize">{p.provider}</h3>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    p.mode === 'NORMAL' ? 'bg-green-900/50 text-green-400 border border-green-800' :
                    p.mode === 'ECONOMY' ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-800' :
                    'bg-red-900/50 text-red-400 border border-red-800'
                  }`}>
                    {p.mode} MODE
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Daily Quota Usage</span>
                      <span className="font-mono text-gray-300">
                        {p.quotaPct.toFixed(1)}% Used
                      </span>
                    </div>
                    <div className="w-full bg-gray-900 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all duration-500 ${
                          p.quotaPct > 90 ? 'bg-red-500' : p.quotaPct > 75 ? 'bg-yellow-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, p.quotaPct)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                    <div>
                      <div className="text-xs text-gray-400">Daily Remaining</div>
                      <div className="text-lg font-bold text-white mt-1">
                        {p.dailyRemaining.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Monthly Remaining</div>
                      <div className="text-lg font-bold text-white mt-1">
                        {p.monthlyRemaining.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. League Registry */}
        <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-200">League Registry</h2>
            <div className="text-sm bg-blue-900/30 text-blue-400 px-3 py-1 rounded-full border border-blue-800">
              {data.leagues.active} Active / {data.leagues.total} Total
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700">
                <tr>
                  <th className="px-4 py-3">League ID</th>
                  <th className="px-4 py-3">League Name</th>
                  <th className="px-4 py-3 text-center">Priority Tier</th>
                  <th className="px-4 py-3 text-right">Adaptive Priority</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {data.leagues.list.map(league => (
                  <tr key={league.id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-400">{league.league_id}</td>
                    <td className="px-4 py-3 font-medium text-gray-200">{league.league_name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-gray-900 text-gray-300 px-2 py-1 rounded text-xs border border-gray-700">
                        Tier {league.league_priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-400">
                      {league.adaptive_priority?.toFixed(4) ?? '0.0000'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {league.season_status === 'active' ? (
                        <span className="text-green-400 text-xs px-2 py-1 bg-green-400/10 rounded-full border border-green-400/20">Active</span>
                      ) : (
                        <span className="text-gray-500 text-xs px-2 py-1 bg-gray-500/10 rounded-full border border-gray-500/20">{league.season_status.toUpperCase()}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
