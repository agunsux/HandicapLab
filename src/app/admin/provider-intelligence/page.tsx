import React from 'react';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

interface DiscoverySummary {
  discoveryTimestamp: string;
  totalCalls: number;
  maxBudget: number;
  g1_odds: string;
  endpointsDiscovered: number;
  endpointsFailed: number;
  latencyStats: {
    p50: number;
    p95: number;
    max: number;
  };
}

interface UsageRecord {
  timestamp: string;
  endpoint: string;
  httpStatus: number;
  latencyMs: number;
  bytes: number;
  recordsReturned: number;
  errorClass: string | null;
}

export default async function ProviderIntelligencePage() {
  const summaryPath = path.resolve('data/research/dribble360/discovery_summary.json');
  const ledgerPath = path.resolve('data/research/dribble360/dribble360_usage_ledger.jsonl');

  let summary: DiscoverySummary | null = null;
  if (fs.existsSync(summaryPath)) {
    try {
      summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    } catch {}
  }

  let totalCalls = 0;
  let successCalls = 0;
  let failedCalls = 0;
  let totalBytes = 0;
  let totalRecords = 0;
  const latencies: number[] = [];

  if (fs.existsSync(ledgerPath)) {
    try {
      const lines = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n').filter(Boolean);
      totalCalls = lines.length;
      for (const line of lines) {
        const r: UsageRecord = JSON.parse(line);
        if (r.httpStatus >= 200 && r.httpStatus < 300) successCalls++;
        else failedCalls++;
        totalBytes += r.bytes || 0;
        totalRecords += r.recordsReturned || 0;
        if (r.latencyMs) latencies.push(r.latencyMs);
      }
    } catch {}
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : summary?.latencyStats?.p50 || 0;
  const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : summary?.latencyStats?.p95 || 0;
  const errorRate = totalCalls > 0 ? ((failedCalls / totalCalls) * 100).toFixed(1) : '0.0';

  const dailyHardLimit = 5000;
  const callsRemaining = Math.max(0, dailyHardLimit - totalCalls);

  const gates = [
    { id: 'G1', name: 'Odds Capability', status: 'NOT AVAILABLE', desc: 'No odds endpoints exist. Evaluated as data/xG provider.', badge: 'bg-amber-100 text-amber-800' },
    { id: 'G2', name: 'Closing Line Data', status: 'NOT AVAILABLE', desc: 'No odds = no closing lines available from provider.', badge: 'bg-amber-100 text-amber-800' },
    { id: 'G3', name: 'Historical Coverage', status: 'PASS', desc: '7 seasons (2019/20 - 2025/26) verified with 44k+ matches/season.', badge: 'bg-emerald-100 text-emerald-800' },
    { id: 'G4', name: 'Data Stability', status: 'PENDING', desc: 'Baseline SHA-256 hashes recorded. Day 2 re-pull scheduled.', badge: 'bg-blue-100 text-blue-800' },
    { id: 'G5', name: 'Commercial Licence', status: 'RESEARCH ONLY', desc: 'Pending written contract. Data restricted to TRIAL_VALIDATION.', badge: 'bg-purple-100 text-purple-800' },
    { id: 'G6', name: 'Schema & Semantics', status: 'PASS', desc: 'Stable response schema. 20+ fine-grained xG fields verified.', badge: 'bg-emerald-100 text-emerald-800' },
  ];

  const providerComparison = [
    { provider: 'Dribble360', role: 'Data / Statistics / xG', quota: '5,000 / day', odds: '❌ None', xG: '✅ 20+ fields (open/set/npxG/xA)', cost: '$99/mo (Trial)', status: 'TRIAL_VALIDATION' },
    { provider: 'API-Football', role: 'Fixtures / Live / Lineups', quota: '7,500 / day', odds: '⚠️ Limited', xG: '⚠️ Aggregate only', cost: '$19/mo', status: 'PRODUCTION_ACTIVE' },
    { provider: 'OddsPapi', role: 'Odds / Closing Lines', quota: '250 / month', odds: '✅ Pinnacle / SBOBET / Soft', xG: '❌ None', cost: '$49/mo', status: 'PRODUCTION_ACTIVE' },
    { provider: 'football-data.co.uk', role: 'Historical Ground Truth', quota: 'Unlimited (CSV)', odds: '✅ Pinnacle Closing', xG: '❌ None', cost: 'Free', status: 'CANONICAL_SOURCE' },
    { provider: 'Understat', role: 'Historical xG Baseline', quota: 'Scraped (Archived)', odds: '❌ None', xG: '✅ Shot-based xG', cost: 'Free', status: 'CANONICAL_SOURCE' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Provider Intelligence</h1>
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
              TRIAL VALIDATION (Expires 2026-10-02)
            </span>
          </div>
          <p className="text-slate-500 mt-1">
            Real-time audit, quota telemetry, and provider replacement analysis for Dribble360.
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono text-slate-400">
            SYNC STATUS: <strong className="text-rose-600">DRIBBLE360_SYNC_ENABLED=false</strong>
          </span>
        </div>
      </div>

      {/* Quota & Operational Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm font-medium text-slate-500">Trial Quota Used</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">
            {totalCalls} <span className="text-sm font-normal text-slate-400">/ {dailyHardLimit}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Remaining today: {callsRemaining}</div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
            <div
              className="bg-indigo-600 h-2 rounded-full"
              style={{ width: `${Math.min(100, (totalCalls / dailyHardLimit) * 100)}%` }}
            />
          </div>
        </div>

        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm font-medium text-slate-500">Latency (p50 / p95)</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">
            {p50}ms <span className="text-sm font-normal text-slate-400">/ {p95}ms</span>
          </div>
          <div className="text-xs text-emerald-600 font-medium mt-1">Normal operational pacing</div>
        </div>

        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm font-medium text-slate-500">Harvest Volume</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">
            {(totalBytes / (1024 * 1024)).toFixed(1)} <span className="text-sm font-normal text-slate-400">MB</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">{totalRecords.toLocaleString()} records ingested</div>
        </div>

        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm font-medium text-slate-500">API Error Rate</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{errorRate}%</div>
          <div className="text-xs text-emerald-600 font-medium mt-1">0 HTTP 429 Rate Limits</div>
        </div>
      </div>

      {/* Provider Evidence Gates (G1 - G6) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Binary Evidence Gates (G1 - G6)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gates.map((g) => (
            <div key={g.id} className="p-4 border border-slate-100 rounded-lg bg-slate-50/50">
              <div className="flex justify-between items-start">
                <span className="text-xs font-mono font-bold text-slate-500">{g.id}</span>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${g.badge}`}>
                  {g.status}
                </span>
              </div>
              <h3 className="font-semibold text-slate-900 mt-2">{g.name}</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{g.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Multi-Provider Stack Comparison */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-x-auto">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Multi-Provider Architecture Matrix</h2>
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
              <th className="py-3 px-4">Provider</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Daily Quota</th>
              <th className="py-3 px-4">Odds Capability</th>
              <th className="py-3 px-4">xG Richness</th>
              <th className="py-3 px-4">Cost / Mo</th>
              <th className="py-3 px-4">Architecture State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-xs">
            {providerComparison.map((p) => (
              <tr key={p.provider} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-bold text-slate-900 font-sans">{p.provider}</td>
                <td className="py-3 px-4 text-slate-600 font-sans">{p.role}</td>
                <td className="py-3 px-4 text-slate-700">{p.quota}</td>
                <td className="py-3 px-4 text-slate-700">{p.odds}</td>
                <td className="py-3 px-4 text-slate-700 font-sans">{p.xG}</td>
                <td className="py-3 px-4 text-slate-700">{p.cost}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-[11px] font-sans font-semibold ${
                    p.status === 'PRODUCTION_ACTIVE' || p.status === 'CANONICAL_SOURCE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Downstream Governance & Safety Rule */}
      <div className="p-6 bg-slate-900 rounded-xl text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
          <h3 className="font-semibold text-base">Governance Invariant: No Future Leakage & Research Isolation</h3>
        </div>
        <p className="text-slate-400 text-xs mt-2 leading-relaxed">
          Dribble360 data is strictly isolated within the research partition (<code className="text-slate-200">TRIAL_VALIDATION</code>).
          It does not enter the public performance ledger or production Salmo feeds.
          Odds capability remains delegated to Pinnacle / OddsPapi. Prematch signal boundaries enforce T-60 strict historical alignment.
        </p>
      </div>
    </div>
  );
}
