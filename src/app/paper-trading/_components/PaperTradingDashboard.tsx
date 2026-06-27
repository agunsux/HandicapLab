'use client';

import { useState } from 'react';

interface PaperTradeItem {
  id: string;
  prediction_ledger_id: string | null;
  match_id: string;
  competition_id: string | null;
  market_type: string;
  selection: string | null;
  entry_odds: number | null;
  closing_odds: number | null;
  stake_units: number;
  expected_value: number | null;
  edge_score: number | null;
  status: string;
  pnl_units: number | null;
  clv_percentage: number | null;
  created_at: string;
  settled_at: string | null;
  home_team: string;
  away_team: string;
  kickoff: string;
  competition_name: string;
  competition_logo: string;
}

interface PaperTradingDashboardProps {
  initialTrades: PaperTradeItem[];
}

export function PaperTradingDashboard({ initialTrades }: PaperTradingDashboardProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'won' | 'lost' | 'void'>('all');
  const [activeCompetition, setActiveCompetition] = useState<string>('all');

  const filtered = initialTrades.filter((item) => {
    if (filter !== 'all' && item.status.toLowerCase() !== filter) return false;
    if (activeCompetition !== 'all' && item.competition_name !== activeCompetition) return false;
    return true;
  });

  // Extract all unique competition names for the dropdown filter
  const competitionNames = Array.from(new Set(initialTrades.map(t => t.competition_name).filter(Boolean)));

  // 1. Calculate Stats
  const startingBankroll = 100.0;
  const settledTrades = initialTrades.filter(item => item.status !== 'PENDING');
  
  // Current bankroll (starting 100 + sum of PnL)
  const totalPnL = settledTrades.reduce((sum, item) => sum + (item.pnl_units || 0), 0);
  const currentBankroll = startingBankroll + totalPnL;

  // ROI % (PnL / Total settled stake units) * 100
  const totalStake = settledTrades.reduce((sum, item) => sum + (item.stake_units || 1.0), 0);
  const roi = totalStake > 0 ? (totalPnL / totalStake) * 100 : 0.0;

  // Win Rate (WON / Settled excluding VOID)
  const activeSettled = settledTrades.filter(item => item.status !== 'VOID');
  const wins = activeSettled.filter(item => item.status === 'WON');
  const winRate = activeSettled.length > 0 ? (wins.length / activeSettled.length) * 100 : 0.0;

  // Average CLV
  const clvTrades = settledTrades.filter(item => item.clv_percentage !== null);
  const avgClv = clvTrades.length > 0
    ? clvTrades.reduce((sum, item) => sum + Number(item.clv_percentage), 0) / clvTrades.length
    : 0.0;

  // Sort trades strictly by settlement chronological order (settled_at falling back to created_at)
  const chronologicalTrades = [...settledTrades].sort(
    (a, b) => new Date(a.settled_at || a.created_at).getTime() - new Date(b.settled_at || b.created_at).getTime()
  );

  // Chronological Drawdown and Longest Losing Streak calculation
  let peak = startingBankroll;
  let current = startingBankroll;
  let maxDrawdown = 0.0;
  let currentStreak = 0;
  let maxLosingStreak = 0;
  
  const equityPoints: number[] = [startingBankroll];

  chronologicalTrades.forEach((t) => {
    // Bankroll curve progression
    current += (t.pnl_units || 0);
    equityPoints.push(current);
    if (current > peak) {
      peak = current;
    }
    const dd = peak > 0 ? ((peak - current) / peak) * 100 : 0.0;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
    }

    // Losing streak tracker
    const status = t.status.toUpperCase();
    if (status === 'LOST' || status === 'HALF_LOSS') {
      currentStreak++;
      if (currentStreak > maxLosingStreak) {
        maxLosingStreak = currentStreak;
      }
    } else if (status === 'WON' || status === 'HALF_WIN') {
      currentStreak = 0;
    }
  });

  // Sample Size Confidence Badge Configuration
  const totalSettled = settledTrades.length;
  let sampleConfidence = 'Low Confidence';
  let sampleConfidenceColor = 'bg-slate-950 text-slate-400 border-slate-800';
  
  if (totalSettled >= 100) {
    sampleConfidence = 'High Confidence';
    sampleConfidenceColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  } else if (totalSettled >= 30) {
    sampleConfidence = 'Medium Confidence';
    sampleConfidenceColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  }

  // Generate SVG Points for Equity Curve Graph
  let svgPoints = '';
  if (equityPoints.length > 0) {
    const minVal = Math.min(...equityPoints, startingBankroll);
    const maxVal = Math.max(...equityPoints, startingBankroll);
    const range = maxVal - minVal || 10;
    
    equityPoints.forEach((val, idx) => {
      const x = (idx / (equityPoints.length - 1 || 1)) * 500;
      const y = 130 - ((val - minVal) / range) * 100;
      svgPoints += `${x.toFixed(1)},${y.toFixed(1)} `;
    });
  }

  const getStatusStyle = (status: string) => {
    switch (status.toUpperCase()) {
      case 'WON': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'LOST': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'VOID': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      default: return 'text-slate-400 bg-slate-900 border-slate-800';
    }
  };

  const getMarketLabel = (mkt: string) => {
    switch (mkt) {
      case 'asian_handicap': return 'Asian Handicap';
      case 'over_under': return 'Over / Under';
      case 'moneyline': return 'Moneyline';
      default: return mkt;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* Top Banner and Heading */}
      <div className="border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse"></span>
            <span className="text-[10px] font-mono font-bold text-teal-400 uppercase tracking-widest bg-teal-400/10 px-2 py-0.5 rounded border border-teal-400/20">
              SIMULATION ENGINE V2
            </span>
            <span className={`text-[10px] font-mono font-bold uppercase tracking-widest border px-2 py-0.5 rounded ${sampleConfidenceColor}`}>
              {sampleConfidence}
            </span>
            <h1 className="text-xl font-mono font-bold tracking-tight text-white ml-1">
              MODEL PAPER TRADING TELEMETRY
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Tracking ensembled predictive edges under strict verification rules. Units (u) are simulated.
          </p>
        </div>
        <div className="text-[10px] font-mono text-slate-500 text-right">
          <span>MIN EDGE THRESHOLD: <b className="text-slate-300">2.0% EV</b></span>
        </div>
      </div>

      {/* Hero Disclaimer Banner */}
      <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl text-xs font-mono text-slate-400 flex items-start gap-3">
        <span className="text-base shrink-0">🛡️</span>
        <div className="space-y-1">
          <p className="font-bold text-slate-300">IMPORTANT PUBLIC NOTICE & SIMULATION GUARDRAILS:</p>
          <p className="leading-relaxed">
            This dashboard displays simulated paper trading models. This is NOT a gambling platform. No real currency is used. The engine executes simulated trades automatically only if: **Model Confidence is &gt;= config threshold** AND **Edge Score is &gt;= EV threshold** AND **Expected Value &gt; 0**. Trades are never placed based on confidence alone.
          </p>
        </div>
      </div>

      {/* Minimum Sample Size Warning Banner */}
      {totalSettled < 30 && (
        <div className="bg-[#FF9900]/10 border border-[#FF9900]/35 p-4 rounded-xl text-xs font-mono text-[#FF9900] flex items-center gap-3">
          <span className="text-lg">⚠️</span>
          <span>
            <b>WARNING:</b> Performance statistics require a minimum sample size of 30 settled bets to achieve statistical significance. Current sample ({totalSettled} settled) is early-stage and highly volatile.
          </span>
        </div>
      )}

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-2">
          <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider block">Starting Balance</span>
          <div className="text-2xl font-mono font-bold text-slate-400">{startingBankroll.toFixed(1)} u</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-2">
          <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider block">Current Balance</span>
          <div className={`text-2xl font-mono font-bold ${currentBankroll >= startingBankroll ? 'text-emerald-400' : 'text-rose-400'}`}>
            {currentBankroll.toFixed(2)} u
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-2">
          <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider block">Model Yield / ROI</span>
          <div className={`text-2xl font-mono font-bold ${roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-2">
          <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider block">Max Drawdown</span>
          <div className="text-2xl font-mono font-bold text-rose-400">-{maxDrawdown.toFixed(1)}%</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-2">
          <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider block">Win Rate</span>
          <div className="text-2xl font-mono font-bold text-white">
            {activeSettled.length > 0 ? `${winRate.toFixed(1)}%` : '—'}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-2">
          <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider block">Average CLV</span>
          <div className="text-2xl font-mono font-bold text-teal-400">
            {avgClv >= 0 ? '+' : ''}{avgClv.toFixed(2)}%
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-2">
          <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider block">Losing Streak</span>
          <div className="text-2xl font-mono font-bold text-rose-400">
            {maxLosingStreak} <span className="text-xs text-slate-500">consecutive</span>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-2">
          <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider block">Total Tracked Bets</span>
          <div className="text-2xl font-mono font-bold text-white">{initialTrades.length}</div>
        </div>
      </div>

      {/* SVG Equity Graph Chart */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">Simulation Equity Curve (Settlement Chronological Order)</h2>
          <span className="text-[10px] font-mono text-slate-500">START: 100u</span>
        </div>
        
        <div className="h-44 w-full bg-slate-950 border border-slate-850 relative rounded-lg flex items-center justify-center overflow-hidden">
          {svgPoints ? (
            <svg className="w-full h-full p-2" viewBox="0 0 500 150" preserveAspectRatio="none">
              <defs>
                <linearGradient id="curveGradPt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="#00F0FF" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path
                d={`M0,150 L${svgPoints} L500,150 Z`}
                fill="url(#curveGradPt)"
              />
              <polyline
                fill="none"
                stroke="#00F0FF"
                strokeWidth="2"
                points={svgPoints}
              />
            </svg>
          ) : (
            <span className="text-xs text-slate-500 font-mono">No simulation trades settled yet.</span>
          )}
        </div>
        <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-2">
          <span>100u START</span>
          <span>SIMULATED CHRONOLOGICAL PERFORMANCE LEDGER</span>
          <span>{currentBankroll.toFixed(2)}u END</span>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Status Filter Buttons */}
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'pending', 'won', 'lost', 'void'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded text-[11px] font-mono font-bold transition-all uppercase ${
                filter === tab
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-950 text-slate-400 border border-slate-850 hover:text-slate-200'
              }`}
            >
              {tab} ({tab === 'all' ? initialTrades.length : initialTrades.filter(i => i.status.toLowerCase() === tab).length})
            </button>
          ))}
        </div>

        {/* Competition Dropdown Filter */}
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-850 w-full md:w-auto">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Competition:</span>
          <select
            value={activeCompetition}
            onChange={(e) => setActiveCompetition(e.target.value)}
            className="bg-transparent text-slate-200 text-xs font-mono font-semibold focus:outline-none cursor-pointer w-full md:w-auto"
          >
            <option value="all">All Competitions</option>
            {competitionNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Trades Details Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
              <tr>
                <th className="px-6 py-4">Match</th>
                <th className="px-6 py-4">Competition</th>
                <th className="px-6 py-4 font-center">Market / Pick</th>
                <th className="px-6 py-4 text-center">Odds (Entry / Close)</th>
                <th className="px-6 py-4 text-center">Stake</th>
                <th className="px-6 py-4 text-center">EV / Edge</th>
                <th className="px-6 py-4 text-right">Result / PnL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.map((item) => {
                const isPending = item.status === 'PENDING';
                return (
                  <tr key={item.id} className="hover:bg-slate-850/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-sans font-bold text-white text-sm">
                        {item.home_team} vs {item.away_team}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Kickoff: {new Date(item.kickoff).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {item.competition_logo && (
                          <img src={item.competition_logo} alt="" className="w-3.5 h-3.5 object-contain" />
                        )}
                        <span className="text-slate-200">{item.competition_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-teal-400 font-bold">{getMarketLabel(item.market_type)}</div>
                      <div className="text-[10px] text-slate-500 uppercase mt-0.5">Selection: {item.selection || '—'}</div>
                    </td>
                    <td className="px-6 py-4 text-center font-bold">
                      <span className="text-slate-200">{item.entry_odds ? item.entry_odds.toFixed(2) : '—'}</span>
                      <span className="text-slate-500 mx-1">/</span>
                      <span className="text-slate-400">{item.closing_odds ? item.closing_odds.toFixed(2) : '—'}</span>
                    </td>
                    <td className="px-6 py-4 text-center text-slate-300 font-bold">
                      {item.stake_units.toFixed(1)} u
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-slate-200 font-bold">
                        {item.expected_value ? `+${(item.expected_value * 100).toFixed(1)}%` : '—'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Edge: {item.edge_score ? `${item.edge_score.toFixed(1)}%` : '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${getStatusStyle(item.status)}`}>
                          {item.status}
                        </span>
                        {!isPending && item.pnl_units !== null && (
                          <span className={`text-[11px] font-bold ${item.pnl_units >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {item.pnl_units >= 0 ? '+' : ''}{item.pnl_units.toFixed(2)} u
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-mono">
                    No paper trades found matching the active filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
