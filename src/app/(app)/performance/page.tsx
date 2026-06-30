'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface ValidationProgress {
  settledCount: number;
  ahCount: number;
  ouCount: number;
  mlCount: number;
  targetSufficient: boolean;
  averageClv: number;
  averageMarketTruthScore: number;
  lastUpdated: string;
}

interface SummaryData {
  totalBets: number;
  insufficientSample: boolean;
  roi: number;
  yield: number;
  hitRate: number;
  avgOdds: number;
  avgClv: number;
  beatClosingRate: number;
  maxDrawdown: number;
  sample_confidence_score?: number;
  sample_confidence_category?: string;
  validationProgress?: ValidationProgress;
  calibrationMap?: Record<string, { predictions: number; wins: number; losses: number; roi: number; brierScore: number }>;
  decayMap?: Record<string, { count: number; avgClv: number; roi: number }>;
}

interface ClvData {
  averageClv: number;
  distribution: {
    elite: number;
    positive: number;
    neutral: number;
    negative: number;
  };
  recentMovements: any[];
}

interface LeagueRow {
  league: string;
  bets: number;
  roi: number;
  clv: number;
  accuracy: number;
}

interface MarketRow {
  market: string;
  bets: number;
  roi: number;
  clv: number;
  accuracy: number;
  avgModelProb: number;
  avgClosingProb: number;
  trueEdge: number;
}

export default function PerformancePage() {
  const [cohort, setCohort] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'market' | 'league' | 'model'>('overview');
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [clvData, setClvData] = useState<ClvData | null>(null);
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<'FREE' | 'STARTER' | 'PRO' | 'QUANT'>('FREE');

  useEffect(() => {
    const savedTier = localStorage.getItem('handicaplab_user_tier') as any;
    if (savedTier && ['FREE', 'STARTER', 'PRO', 'QUANT'].includes(savedTier)) {
      setTier(savedTier);
    }
  }, []);

  const isLocked = tier === 'FREE' || tier === 'STARTER';

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [resSummary, resClv, resLeagues, resMarkets] = await Promise.all([
          fetch(`/api/performance/summary?cohort=${cohort}`),
          fetch('/api/performance/clv'),
          fetch('/api/performance/leagues'),
          fetch('/api/performance/markets')
        ]);

        const [dataSummary, dataClv, dataLeagues, dataMarkets] = await Promise.all([
          resSummary.json(),
          resClv.json(),
          resLeagues.json(),
          resMarkets.json()
        ]);

        if (dataSummary.success && dataClv.success && dataLeagues.success && dataMarkets.success) {
          setSummary(dataSummary);
          setClvData(dataClv);
          setLeagues(dataLeagues.breakdown || []);
          setMarkets(dataMarkets.breakdown || []);
        } else {
          setError('Failed to fetch performance telemetry');
        }
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred connecting to database');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [cohort]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500 mb-4"></div>
        <span className="text-slate-400 font-mono text-xs animate-pulse">Initializing Backtest Terminal...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[500px] bg-black">
        <div className="bg-rose-950/30 border border-rose-900 text-rose-450 p-6 rounded-lg text-center font-mono max-w-md">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 py-8 px-4 sm:px-6 lg:px-8 font-mono">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Terminal Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded uppercase font-bold tracking-widest">
                Verification Node: Ready
              </span>
              <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded uppercase font-bold tracking-widest">
                Tier: {tier}
              </span>
              {summary && (
                <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-widest border ${
                  summary.totalBets >= 500 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : summary.totalBets >= 100 
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-550'
                }`}>
                  Status: {
                    summary.totalBets >= 500 
                      ? 'Statistically meaningful' 
                      : summary.totalBets >= 100 
                        ? 'Early validation' 
                        : 'Collecting market evidence'
                  }
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white font-sans">
              Backtest & Calibration Terminal
            </h1>
            <p className="text-slate-400 text-xs mt-1 font-mono">
              Quantitative backtesting engine. Baseline market: Pinnacle. Edges validated on closing lines.
            </p>
          </div>

          {/* Filters & Tabs */}
          <div className="mt-4 md:mt-0 flex flex-wrap gap-3 items-center">
            {/* Cohort Dropdown */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded px-2.5 py-1">
              <span className="text-[10px] uppercase text-slate-500 font-bold">Cohort:</span>
              <select
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
                className="bg-transparent text-xs text-slate-350 font-bold uppercase focus:outline-none"
              >
                <option value="all">Overall</option>
                <option value="elite_europe">Elite Europe</option>
                <option value="europe_qualification">Europe Qual</option>
                <option value="latin_america">Latin America</option>
                <option value="asia">Asia</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Tab Selection */}
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded">
              {(['overview', 'market', 'league', 'model'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded text-xs uppercase tracking-wider transition ${
                  activeTab === tab ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'model' ? 'Model vs Market' : tab}
              </button>
            ))}
          </div>

</header>
        
        

        {/* Content Area with Paywall Overlay */}
        <div className="relative">
          <div className={`${isLocked && activeTab !== 'overview' ? 'blur-md pointer-events-none select-none' : ''} space-y-6`}>
            
            {/* Overview Tab */}
            {activeTab === 'overview' && summary && (
              <div className="space-y-6">
                {/* Validation Progress Widget */}
                {summary.validationProgress && (
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                          🎯 Validation Dataset Progress
                        </h3>
                        <p className="text-slate-400 text-xxs mt-0.5 uppercase tracking-wide">
                          Goal: Accumulate 100 settled signals for beta validation
                        </p>
                      </div>
                      <div className="text-[10px] text-slate-500 text-right">
                        Last Updated: {new Date(summary.validationProgress.lastUpdated).toLocaleTimeString()}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold font-mono">
                        <span className="text-slate-300">Total Settled Signals</span>
                        <span className="text-emerald-400">{summary.validationProgress.settledCount} / 100</span>
                      </div>
                      <div className="w-full bg-slate-950 h-3 rounded border border-slate-800 overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full rounded transition-all duration-500" 
                          style={{ width: `${Math.min(100, (summary.validationProgress.settledCount / 100) * 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Sub-targets & Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 pt-2 border-t border-slate-800/60 text-xs">
                      <div>
                        <span className="text-slate-500 block text-xxs uppercase tracking-wider mb-1">Asian Handicap</span>
                        <span className="font-bold text-slate-200">{summary.validationProgress.ahCount} / 40 settled</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xxs uppercase tracking-wider mb-1">Over / Under</span>
                        <span className="font-bold text-slate-200">{summary.validationProgress.ouCount} / 30 settled</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xxs uppercase tracking-wider mb-1">Moneyline</span>
                        <span className="font-bold text-slate-200">{summary.validationProgress.mlCount} / 30 settled</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xxs uppercase tracking-wider mb-1">Average CLV</span>
                        <span className={`font-bold ${summary.validationProgress.averageClv >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                          {summary.validationProgress.averageClv >= 0 ? '+' : ''}{summary.validationProgress.averageClv.toFixed(2)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xxs uppercase tracking-wider mb-1">Avg Market Truth Score</span>
                        <span className="font-bold text-blue-400">{summary.validationProgress.averageMarketTruthScore} / 100</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xxs uppercase tracking-wider mb-1">Confidence Score</span>
                        <span className="font-bold text-emerald-450">{summary.sample_confidence_score || '—'} ({summary.sample_confidence_category || 'insufficient data'})</span>
                      </div>
                    </div>
                  </div>
                )}

                {summary.insufficientSample && (
                  <div className="bg-amber-950/20 border border-amber-900 text-amber-400 p-4 rounded text-xs">
                    ⚠️ <strong>INSUFFICIENT SAMPLE RATE:</strong> Only {summary.totalBets} settled signals found for validation. A minimum sample size of <strong>100 settled signals</strong> is required to reach statistical significance.
                  </div>
                )}

                {/* Key Indicators Panel */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                  {[
                    { label: 'Total Bets', value: summary.totalBets, color: 'text-white' },
                    { label: 'Yield', value: `${summary.yield >= 0 ? '+' : ''}${summary.yield.toFixed(2)}%`, color: summary.yield >= 0 ? 'text-emerald-400' : 'text-rose-500' },
                    { label: 'ROI', value: `${summary.roi >= 0 ? '+' : ''}${summary.roi.toFixed(2)}%`, color: summary.roi >= 0 ? 'text-emerald-400' : 'text-rose-500' },
                    { label: 'Hit Rate', value: `${summary.hitRate.toFixed(1)}%`, color: 'text-slate-100' },
                    { label: 'Avg Odds', value: summary.avgOdds.toFixed(2), color: 'text-slate-100' },
                    { label: 'Avg CLV', value: `${summary.avgClv >= 0 ? '+' : ''}${summary.avgClv.toFixed(2)}%`, color: summary.avgClv >= 0 ? 'text-emerald-400' : 'text-rose-500' },
                    { label: 'Beat CLV %', value: `${summary.beatClosingRate.toFixed(1)}%`, color: 'text-emerald-450' },
                    { label: 'Max Drawdown', value: `${summary.maxDrawdown.toFixed(2)}%`, color: 'text-rose-450' }
                  ].map((card, idx) => (
                    <div key={idx} className="bg-slate-900 border border-slate-800 rounded p-4">
                      <span className="text-slate-500 text-[10px] uppercase block mb-1.5">{card.label}</span>
                      <span className={`text-lg font-bold font-mono ${card.color}`}>{card.value}</span>
                    </div>
                  ))}
                </div>

                {/* CLV Distribution Panel */}
                {clvData && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                          CLV Category Spread
                        </h3>
                        <div className="space-y-3">
                          {[
                            { label: 'Elite (>= 5%)', count: clvData.distribution.elite, pct: clvData.distribution.elite / (summary.totalBets || 1), color: 'bg-emerald-500' },
                            { label: 'Positive (0.5% - 5%)', count: clvData.distribution.positive, pct: clvData.distribution.positive / (summary.totalBets || 1), color: 'bg-emerald-400' },
                            { label: 'Neutral (-0.5% - 0.5%)', count: clvData.distribution.neutral, pct: clvData.distribution.neutral / (summary.totalBets || 1), color: 'bg-slate-500' },
                            { label: 'Negative (<= -0.5%)', count: clvData.distribution.negative, pct: clvData.distribution.negative / (summary.totalBets || 1), color: 'bg-rose-500' }
                          ].map((item, index) => (
                            <div key={index} className="text-xs">
                              <div className="flex justify-between mb-1 text-slate-400">
                                <span>{item.label}</span>
                                <span className="font-semibold text-slate-200">{item.count}</span>
                              </div>
                              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                                <div className={`${item.color} h-full`} style={{ width: `${item.pct * 100}%` }}></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-6">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                        Recent Closing Line Deviations
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left text-slate-400">
                          <thead className="border-b border-slate-800 text-[10px] uppercase text-slate-500">
                            <tr>
                              <th className="py-2">Match</th>
                              <th className="py-2 text-center">Market</th>
                              <th className="py-2 text-center">Opening</th>
                              <th className="py-2 text-center">Closing</th>
                              <th className="py-2 text-right">CLV</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clvData.recentMovements.slice(0, 5).map((row, idx) => (
                              <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-850/20">
                                <td className="py-2.5 font-semibold text-slate-200">{row.match}</td>
                                <td className="py-2.5 text-center uppercase">{row.market}</td>
                                <td className="py-2.5 text-center">{row.openingOdds ? row.openingOdds.toFixed(2) : '—'}</td>
                                <td className="py-2.5 text-center">{row.closingOdds ? row.closingOdds.toFixed(2) : '—'}</td>
                                <td className={`py-2.5 text-right font-bold ${row.clvPercentage >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                  {row.clvPercentage >= 0 ? '+' : ''}{row.clvPercentage.toFixed(2)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Confidence Calibration & Edge Decay Breakdowns */}
                {summary && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Confidence Calibration Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                        Confidence Calibration Curve
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left text-slate-400">
                          <thead className="border-b border-slate-800 text-[10px] uppercase text-slate-500">
                            <tr>
                              <th className="py-2">Confidence Bucket</th>
                              <th className="py-2 text-center">Signals</th>
                              <th className="py-2 text-center">Wins</th>
                              <th className="py-2 text-center">Losses</th>
                              <th className="py-2 text-center">ROI</th>
                              <th className="py-2 text-right">Brier Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summary.calibrationMap && Object.entries(summary.calibrationMap).map(([bucket, data]: any, idx) => (
                              <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-850/20">
                                <td className="py-2.5 font-semibold text-slate-200">{bucket}</td>
                                <td className="py-2.5 text-center">{data.predictions}</td>
                                <td className="py-2.5 text-center">{data.wins}</td>
                                <td className="py-2.5 text-center">{data.losses}</td>
                                <td className={`py-2.5 text-center font-semibold ${data.roi >= 0 ? 'text-emerald-450' : 'text-rose-500'}`}>
                                  {data.roi >= 0 ? '+' : ''}{data.roi.toFixed(1)}%
                                </td>
                                <td className="py-2.5 text-right font-mono">{data.brierScore.toFixed(4)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Edge Decay Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                        Odds Placement & Edge Decay Analysis
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left text-slate-400">
                          <thead className="border-b border-slate-800 text-[10px] uppercase text-slate-500">
                            <tr>
                              <th className="py-2">Time to Kickoff</th>
                              <th className="py-2 text-center">Signals</th>
                              <th className="py-2 text-center">Average CLV</th>
                              <th className="py-2 text-right">ROI</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summary.decayMap && Object.entries(summary.decayMap).map(([bucket, data]: any, idx) => (
                              <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-850/20">
                                <td className="py-2.5 font-semibold text-slate-200">{bucket}</td>
                                <td className="py-2.5 text-center">{data.count}</td>
                                <td className={`py-2.5 text-center font-semibold ${data.avgClv >= 0 ? 'text-emerald-450' : 'text-rose-500'}`}>
                                  {data.avgClv >= 0 ? '+' : ''}{data.avgClv.toFixed(2)}%
                                </td>
                                <td className={`py-2.5 text-right font-bold ${data.roi >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                  {data.roi >= 0 ? '+' : ''}{data.roi.toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Market Breakdown Tab */}
            {activeTab === 'market' && markets.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                  Market Suitability Breakdown
                </h3>
                <table className="w-full text-xs text-left text-slate-400">
                  <thead className="border-b border-slate-800 text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="py-3 pl-4">Market</th>
                      <th className="py-3 text-center">Bets</th>
                      <th className="py-3 text-center">Accuracy</th>
                      <th className="py-3 text-center">ROI / Yield</th>
                      <th className="py-3 text-right pr-4">Average CLV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {markets.map((m, idx) => (
                      <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-850/20">
                        <td className="py-3 pl-4 font-semibold text-slate-200">{m.market}</td>
                        <td className="py-3 text-center">{m.bets}</td>
                        <td className="py-3 text-center">{m.accuracy.toFixed(1)}%</td>
                        <td className={`py-3 text-center font-bold ${m.roi >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                          {m.roi >= 0 ? '+' : ''}{m.roi.toFixed(2)}%
                        </td>
                        <td className={`py-3 text-right pr-4 font-bold ${m.clv >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                          {m.clv >= 0 ? '+' : ''}{m.clv.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* League Breakdown Tab */}
            {activeTab === 'league' && leagues.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                  Leagues Ingestion & Edge Calibration
                </h3>
                <table className="w-full text-xs text-left text-slate-400">
                  <thead className="border-b border-slate-800 text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="py-3 pl-4">League</th>
                      <th className="py-3 text-center">Sample size</th>
                      <th className="py-3 text-center">Accuracy</th>
                      <th className="py-3 text-center">ROI</th>
                      <th className="py-3 text-right pr-4">Avg CLV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leagues.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-850/20">
                        <td className="py-3 pl-4 font-semibold text-slate-200">{row.league}</td>
                        <td className="py-3 text-center">{row.bets}</td>
                        <td className="py-3 text-center">{row.accuracy.toFixed(1)}%</td>
                        <td className={`py-3 text-center font-bold ${row.roi >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                          {row.roi >= 0 ? '+' : ''}{row.roi.toFixed(2)}%
                        </td>
                        <td className={`py-3 text-right pr-4 font-bold ${row.clv >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                          {row.clv >= 0 ? '+' : ''}{row.clv.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Model vs Market Tab */}
            {activeTab === 'model' && markets.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                  Expected vs Implied Market Calibration
                </h3>
                <table className="w-full text-xs text-left text-slate-400">
                  <thead className="border-b border-slate-800 text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="py-3 pl-4">Market</th>
                      <th className="py-3 text-center">Model Probability</th>
                      <th className="py-3 text-center">Market Implied</th>
                      <th className="py-3 text-right pr-4">True Edge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {markets.map((m, idx) => (
                      <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-850/20">
                        <td className="py-3 pl-4 font-semibold text-slate-200">{m.market}</td>
                        <td className="py-3 text-center font-mono">{m.avgModelProb.toFixed(1)}%</td>
                        <td className="py-3 text-center font-mono">{m.avgClosingProb.toFixed(1)}%</td>
                        <td className={`py-3 text-right pr-4 font-mono font-bold ${m.trueEdge >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                          {m.trueEdge >= 0 ? '+' : ''}{m.trueEdge.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>

          {/* Premium Overlay */}
          {isLocked && activeTab !== 'overview' && (
            <div className="absolute inset-0 z-20 flex flex-col justify-center items-center px-4 text-center bg-black/65 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl max-w-md shadow-2xl space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">Backtest Breakdown Locked</h3>
                  <p className="text-xs text-slate-400 leading-normal">
                    Available on Pro & Quant memberships. Upgrade to view market calibrations, true edge diagnostics, and comprehensive league audits.
                  </p>
                </div>
                <Link href="/pricing" className="block pt-2">
                  <button className="w-full py-2 bg-emerald-505 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded transition-colors">
                    Upgrade to Pro
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
