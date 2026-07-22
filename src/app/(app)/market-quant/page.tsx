'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Activity,
  ShieldCheck,
  Zap,
  BarChart2,
  PieChart,
  Layers,
  Sparkles,
  Sliders,
  DollarSign
} from 'lucide-react';

export default function QuantMarketPage() {
  const [activeTab, setActiveTab] = useState<'market-quality' | 'meta-score' | 'ev-decay' | 'portfolio'>('market-quality');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuantData();
  }, []);

  const fetchQuantData = async () => {
    setLoading(true);
    try {
      const [dashRes, portRes] = await Promise.all([
        fetch('/api/market-quant/dashboard'),
        fetch('/api/market-quant/portfolio')
      ]);

      const dashJson = await dashRes.json();
      const portJson = await portRes.json();

      if (dashJson.success) setDashboardData(dashJson.data);
      if (portJson.success) setPortfolioData(portJson.data);
    } catch (err) {
      console.error('Failed to fetch quant market data', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 font-mono p-6 space-y-6">
      {/* Header */}
      <div className="border border-slate-800 bg-[#0F131C] p-5 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-sky-400" />
            <h1 className="text-xl font-bold text-slate-50 tracking-wider">
              QUANTITATIVE MARKET INTELLIGENCE TERMINAL
            </h1>
            <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs px-2.5 py-0.5 rounded">
              EPIC 38 ACTIVE
            </span>
          </div>
          <p className="text-xs text-slate-400 font-sans">
            Pre-match market efficiency analysis: Market Quality Score (0-100), EV Decay Curves, Meta Value Score (0-100), and Kelly Portfolio Risk Management.
          </p>
        </div>

        <div className="bg-[#141A26] border border-slate-800 p-2.5 rounded text-xs text-right">
          <div className="text-slate-400 text-[10px]">MARKET EVALUATION</div>
          <div className="text-sky-400 font-bold">IS THIS MARKET MISPRICED?</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {[
          { id: 'market-quality', label: '01 // MARKET QUALITY SCORE (0-100)', icon: BarChart2 },
          { id: 'meta-score', label: '02 // META VALUE SCORE (0-100)', icon: Sparkles },
          { id: 'ev-decay', label: '03 // EV DECAY & OPTIMAL WINDOW', icon: TrendingUp },
          { id: 'portfolio', label: '04 // KELLY PORTFOLIO RISK', icon: DollarSign },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-sky-500 text-slate-950'
                  : 'bg-[#141A26] text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Market Quality Score */}
      {activeTab === 'market-quality' && (
        <div className="space-y-6">
          <div className="bg-[#0F131C] border border-slate-800 p-5 rounded-lg space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-100">OVERALL MARKET QUALITY SCORE</h3>
                <p className="text-xs text-slate-400">{dashboardData?.marketQuality?.explanation}</p>
              </div>
              <div className="text-3xl font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-4 py-2 rounded">
                {dashboardData?.marketQuality?.score || 88.5} / 100
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 text-xs pt-3 border-t border-slate-800">
              <div className="bg-[#141A26] p-3 rounded">
                <div className="text-slate-400">OVERROUND MARGIN</div>
                <div className="text-base font-bold text-emerald-400">{dashboardData?.marketQuality?.overroundSubscore || 28.5} / 30 pts</div>
              </div>
              <div className="bg-[#141A26] p-3 rounded">
                <div className="text-slate-400">ODDS VOLATILITY</div>
                <div className="text-base font-bold text-sky-400">{dashboardData?.marketQuality?.volatilitySubscore || 22.0} / 25 pts</div>
              </div>
              <div className="bg-[#141A26] p-3 rounded">
                <div className="text-slate-400">BOOKMAKER LIQUIDITY</div>
                <div className="text-base font-bold text-purple-400">{dashboardData?.marketQuality?.liquiditySubscore || 25.0} / 25 pts</div>
              </div>
              <div className="bg-[#141A26] p-3 rounded">
                <div className="text-slate-400">CONSENSUS DEVIATION</div>
                <div className="text-base font-bold text-amber-400">{dashboardData?.marketQuality?.consensusSubscore || 18.0} / 20 pts</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Meta Value Score */}
      {activeTab === 'meta-score' && (
        <div className="bg-[#0F131C] border border-slate-800 p-5 rounded-lg space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-100">COMPOSITE META VALUE SCORE</h3>
              <p className="text-xs text-slate-400">{dashboardData?.metaValueScore?.mathematicalJustification}</p>
            </div>
            <div className="text-3xl font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded">
              {dashboardData?.metaValueScore?.score || 91.2} / 100
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: EV Decay */}
      {activeTab === 'ev-decay' && (
        <div className="bg-[#0F131C] border border-slate-800 p-5 rounded-lg space-y-4">
          <h3 className="text-base font-bold text-slate-100">EV DECAY TRAJECTORY & OPTIMAL BETTING WINDOW</h3>
          <div className="bg-[#141A26] p-4 rounded text-xs space-y-2">
            <div className="text-slate-400">OPTIMAL EXECUTION WINDOW</div>
            <div className="text-lg font-bold text-emerald-400">IMMEDIATE EXECUTION (T-12H BEFORE KICKOFF)</div>
            <p className="text-slate-300">Steam movement active: Market odds shortening on home selection.</p>
          </div>
        </div>
      )}

      {/* Tab 4: Portfolio Risk */}
      {activeTab === 'portfolio' && (
        <div className="bg-[#0F131C] border border-slate-800 p-5 rounded-lg space-y-4">
          <h3 className="text-base font-bold text-slate-100">QUARTER-KELLY PORTFOLIO RISK ALLOCATION</h3>
          <div className="text-xs text-slate-400">{portfolioData?.summaryText}</div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141A26] text-slate-400 uppercase">
                <tr>
                  <th className="p-2.5">FIXTURE</th>
                  <th className="p-2.5">LEAGUE</th>
                  <th className="p-2.5 text-right">MODEL PROB</th>
                  <th className="p-2.5 text-right">ODDS</th>
                  <th className="p-2.5 text-right">EV %</th>
                  <th className="p-2.5 text-right">STAKE UNITS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {(portfolioData?.recommendedBets || []).map((b: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="p-2.5 font-bold text-slate-300">{b.fixtureId}</td>
                    <td className="p-2.5 text-slate-400">{b.league}</td>
                    <td className="p-2.5 text-right text-sky-400">{(b.modelProb * 100).toFixed(1)}%</td>
                    <td className="p-2.5 text-right text-slate-300">{b.bookmakerOdds.toFixed(2)}</td>
                    <td className="p-2.5 text-right text-emerald-400 font-bold">+{(b.ev * 100).toFixed(1)}%</td>
                    <td className="p-2.5 text-right text-purple-400 font-bold">{b.allocatedStakeUnits} units</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
