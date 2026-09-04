'use client';

import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, CheckCircle2, Filter, ArrowUpDown } from 'lucide-react';
import type { MarketDiscoveryItem } from '@/lib/services/marketIntelligenceService';

export function HistoricalMarketExplorer() {
  const [activeTab, setActiveTab] = useState<'AH' | 'OU' | 'BTTS'>('AH');
  const [sideFilter, setSideFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [items, setItems] = useState<MarketDiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(`/api/public/research/market-discovery?market=${activeTab}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        if (mounted) {
          setItems(data.rankings || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load market discovery:', err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeTab]);

  const filtered = items.filter((item) => {
    if (sideFilter !== 'all' && item.side !== sideFilter) return false;
    if (tierFilter !== 'all' && item.tier !== tierFilter) return false;
    return true;
  });

  return (
    <div className="p-6 rounded-2xl bg-[#111827] border border-[#1F2937] space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#0B0F0E] border border-[#1F2937] text-xs font-mono text-[#10B981] mb-2">
            <span>EPIC-66 RESEARCH ENGINE</span>
          </div>
          <h2 className="text-xl font-bold font-sans text-white">
            Historical Market Explorer
          </h2>
          <p className="text-xs text-[#9CA3AF] mt-0.5">
            Empirical line profitability, sample sizes, and closing line value (CLV) across tested football markets.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#0B0F0E] rounded-xl border border-[#1F2937] self-start sm:self-auto overflow-x-auto">
          <button
            onClick={() => { setActiveTab('AH'); setSideFilter('all'); }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              activeTab === 'AH'
                ? 'bg-[#10B981] text-black shadow-sm'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <Target className="h-3.5 w-3.5" />
            Asian Handicap
          </button>
          <button
            onClick={() => { setActiveTab('OU'); setSideFilter('all'); }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              activeTab === 'OU'
                ? 'bg-[#10B981] text-black shadow-sm'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Over / Under
          </button>
          <button
            onClick={() => { setActiveTab('BTTS'); setSideFilter('all'); }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              activeTab === 'BTTS'
                ? 'bg-[#10B981] text-black shadow-sm'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            BTTS
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-2 border-t border-[#1F2937] text-xs font-mono">
        <div className="flex flex-wrap items-center gap-3">
          {activeTab === 'AH' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[#9CA3AF]">Side:</span>
              <select
                value={sideFilter}
                onChange={(e) => setSideFilter(e.target.value)}
                className="px-2.5 py-1 rounded bg-[#0B0F0E] border border-[#1F2937] text-white focus:outline-none focus:border-[#10B981]"
              >
                <option value="all">All Sides</option>
                <option value="away">Away (+Underdogs)</option>
                <option value="home">Home</option>
              </select>
            </div>
          )}

          {activeTab === 'OU' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[#9CA3AF]">Side:</span>
              <select
                value={sideFilter}
                onChange={(e) => setSideFilter(e.target.value)}
                className="px-2.5 py-1 rounded bg-[#0B0F0E] border border-[#1F2937] text-white focus:outline-none focus:border-[#10B981]"
              >
                <option value="all">All Totals</option>
                <option value="over">Over</option>
                <option value="under">Under</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-[#9CA3AF]">Tier:</span>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="px-2.5 py-1 rounded bg-[#0B0F0E] border border-[#1F2937] text-white focus:outline-none focus:border-[#10B981]"
            >
              <option value="all">All Tiers</option>
              <option value="GOLD">GOLD (Statistically Validated)</option>
              <option value="GREEN">GREEN</option>
              <option value="YELLOW">YELLOW (N &lt; 250)</option>
              <option value="RED">RED (Negative Yield)</option>
            </select>
          </div>
        </div>

        <div className="text-[#6B7280]">
          Showing <span className="text-white font-bold">{filtered.length}</span> tested configurations
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-8 text-center text-xs font-mono text-[#9CA3AF] animate-pulse">
          Loading market discovery analytics...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-xs font-mono text-[#9CA3AF]">
          No configurations match the selected filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#1F2937]">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0B0F0E] text-[11px] text-[#9CA3AF] border-b border-[#1F2937]">
              <tr>
                <th className="py-3 px-4">Market Configuration</th>
                <th className="py-3 px-4">Side</th>
                <th className="py-3 px-4">Sample (Bets)</th>
                <th className="py-3 px-4">Hit Rate</th>
                <th className="py-3 px-4">Realized ROI</th>
                <th className="py-3 px-4">Max Drawdown</th>
                <th className="py-3 px-4">p-value</th>
                <th className="py-3 px-4">Mean CLV</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2937]/70 bg-[#111827]">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-[#1A2436]/60 transition-colors">
                  <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                    {r.identifier}
                  </td>
                  <td className="py-3 px-4 uppercase text-[#9CA3AF]">{r.side}</td>
                  <td className="py-3 px-4 text-neutral-300">{r.bets.toLocaleString()}</td>
                  <td className="py-3 px-4 text-neutral-300">{r.hitRatePct}%</td>
                  <td
                    className={`py-3 px-4 font-bold ${
                      r.roiPct > 0 ? 'text-[#10B981]' : 'text-red-400'
                    }`}
                  >
                    {r.roiPct > 0 ? `+${r.roiPct}%` : `${r.roiPct}%`}
                  </td>
                  <td className="py-3 px-4 text-neutral-400">{r.maxDrawdown}u</td>
                  <td className="py-3 px-4 text-neutral-400">{r.pValue.toFixed(4)}</td>
                  <td className="py-3 px-4 text-[#10B981] font-semibold">
                    {r.clvPct ? `+${r.clvPct}%` : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.tier === 'GOLD'
                          ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                          : r.tier === 'GREEN'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : r.tier === 'YELLOW'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-red-500/15 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {r.tier}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
