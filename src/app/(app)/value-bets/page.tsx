'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  Zap,
  BarChart2,
  Filter,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Search,
  ChevronDown,
  Layers,
  FileText
} from 'lucide-react';

export default function ValueBetsPage() {
  const [loading, setLoading] = useState(true);
  const [bets, setBets] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedBet, setSelectedBet] = useState<any | null>(null);

  useEffect(() => {
    fetchValueBets();
  }, []);

  const fetchValueBets = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/value-intelligence/bets');
      const json = await res.json();
      if (json.success) {
        setBets(json.data);
      }
    } catch (err) {
      console.error('Failed to load value bets', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredBets = categoryFilter === 'ALL'
    ? bets
    : bets.filter(b => b.category === categoryFilter);

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 font-mono p-6 space-y-6">
      {/* Header Banner */}
      <div className="border border-slate-800 bg-[#0F131C] p-5 rounded-lg space-y-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-emerald-400" />
              <h1 className="text-xl font-bold text-slate-50 tracking-wider">
                VALUE BETTING INTELLIGENCE TERMINAL
              </h1>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-0.5 rounded">
                EPIC 36 ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans mt-1">
              Identifying mispriced football betting markets with positive Expected Value (+EV), Closing Line Value (CLV), and historical evidence proof.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#141A26] border border-slate-800 p-2.5 rounded text-xs text-right">
              <div className="text-slate-400 text-[10px]">PARADIGM INVARIANT</div>
              <div className="text-emerald-400 font-bold">EXPECTED VALUE &gt; WIN RATE</div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3 overflow-x-auto">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-xs text-slate-400 uppercase font-bold mr-2">CATEGORIES:</span>
          {['ALL', 'STRONG_VALUE', 'VALUE', 'WATCHLIST'].map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                categoryFilter === cat
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-[#141A26] text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-500">{filteredBets.length} Opportunities Identified</span>
      </div>

      {/* Value Bets Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBets.map((bet, i) => (
          <div
            key={i}
            className="border border-slate-800 bg-[#0F131C] rounded-lg p-5 space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              {/* Card Top: Category Badge & League */}
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400">{bet.league}</span>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                  bet.category === 'STRONG_VALUE'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                }`}>
                  {bet.category.replace('_', ' ')}
                </span>
              </div>

              {/* Match Header */}
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {bet.homeTeam} vs {bet.awayTeam}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Kickoff: {new Date(bet.kickoff).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Recommended Market & Selection */}
              <div className="bg-[#141A26] border border-slate-800/80 p-3 rounded space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">RECOMMENDED BET:</span>
                  <span className="font-bold text-emerald-400 uppercase">
                    {bet.market.toUpperCase()} {bet.line !== 0 ? bet.line : ''} ({bet.selection.toUpperCase()})
                  </span>
                </div>

                {/* Fair Odds vs Bookmaker Odds Side-by-Side */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60 text-center">
                  <div className="bg-[#0A0D14] p-2 rounded">
                    <div className="text-[10px] text-slate-500">MODEL FAIR ODDS</div>
                    <div className="text-sm font-bold text-sky-400">{bet.modelFairOdds.toFixed(2)}</div>
                    <div className="text-[9px] text-slate-400">{(bet.modelProb * 100).toFixed(1)}% Fair Prob</div>
                  </div>
                  <div className="bg-[#0A0D14] p-2 rounded">
                    <div className="text-[10px] text-slate-500">BOOKMAKER ODDS</div>
                    <div className="text-sm font-bold text-emerald-400">{bet.bookmakerOdds.toFixed(2)}</div>
                    <div className="text-[9px] text-slate-400">{(bet.marketProb * 100).toFixed(1)}% Implied</div>
                  </div>
                </div>
              </div>

              {/* Metric Callouts: EV & Edge */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2 border border-slate-800/60 bg-[#141A26] rounded">
                  <div className="text-[10px] text-slate-400 uppercase">Expected Value (EV)</div>
                  <div className="text-base font-bold text-emerald-400">+{(bet.expectedValue * 100).toFixed(1)}%</div>
                </div>
                <div className="p-2 border border-slate-800/60 bg-[#141A26] rounded">
                  <div className="text-[10px] text-slate-400 uppercase">Probability Edge</div>
                  <div className="text-base font-bold text-sky-400">+{(bet.probEdge * 100).toFixed(1)}%</div>
                </div>
              </div>

              {/* Historical Evidence Box */}
              <div className="p-2.5 bg-[#141A26]/80 border border-slate-800 rounded text-[11px] text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-[10px] uppercase">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  EMPIRICAL HISTORICAL PROOF
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {bet.evidence?.summaryText}
                </p>
              </div>
            </div>

            {/* Bottom Button */}
            <button
              onClick={() => setSelectedBet(bet)}
              className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 py-2 rounded font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Info className="h-3.5 w-3.5 text-emerald-400" />
              INSPECT 5-QUESTION EXPLANATION
            </button>
          </div>
        ))}
      </div>

      {/* EXPLAINABILITY MODAL */}
      {selectedBet && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F131C] border border-slate-800 rounded-lg max-w-2xl w-full p-6 space-y-5 text-xs font-mono max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Sparkles className="h-4 w-4" />
                MATHEMATICAL VALUE EXPLAINABILITY AUDIT
              </div>
              <button onClick={() => setSelectedBet(null)} className="text-slate-400 hover:text-slate-200 font-bold">✕</button>
            </div>

            <div className="space-y-4">
              <div className="bg-[#141A26] p-3 rounded space-y-1">
                <div className="text-base font-bold text-slate-100">{selectedBet.homeTeam} vs {selectedBet.awayTeam}</div>
                <div className="text-slate-400 text-[11px]">{selectedBet.league} | Recommended: {selectedBet.market.toUpperCase()} ({selectedBet.selection.toUpperCase()})</div>
              </div>

              {/* 5 Questions */}
              <div className="space-y-3">
                <div className="border border-slate-800 p-3 rounded bg-[#141A26]">
                  <h4 className="font-bold text-emerald-400 uppercase text-[11px] mb-1">1. Why This Bet?</h4>
                  <p className="text-slate-300 text-[11px]">{selectedBet.explanation?.whyThisBet?.explanation}</p>
                </div>

                <div className="border border-slate-800 p-3 rounded bg-[#141A26]">
                  <h4 className="font-bold text-sky-400 uppercase text-[11px] mb-1">2. Why Now? (Odds Trajectory)</h4>
                  <p className="text-slate-300 text-[11px]">{selectedBet.explanation?.whyNow?.explanation}</p>
                </div>

                <div className="border border-slate-800 p-3 rounded bg-[#141A26]">
                  <h4 className="font-bold text-amber-400 uppercase text-[11px] mb-1">3. Key Statistical Drivers</h4>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11px]">
                    {selectedBet.explanation?.whatVariablesInfluencedIt?.primaryDrivers.map((d: any, idx: number) => (
                      <li key={idx}><strong>{d.factor}</strong> ({d.impact}): {d.detail}</li>
                    ))}
                  </ul>
                </div>

                <div className="border border-slate-800 p-3 rounded bg-[#141A26]">
                  <h4 className="font-bold text-indigo-400 uppercase text-[11px] mb-1">4. How Much Edge Exists?</h4>
                  <p className="text-slate-300 text-[11px]">{selectedBet.explanation?.howMuchEdgeExists?.explanation}</p>
                </div>

                <div className="border border-slate-800 p-3 rounded bg-[#141A26]">
                  <h4 className="font-bold text-purple-400 uppercase text-[11px] mb-1">5. Empirical Historical Evidence</h4>
                  <p className="text-slate-300 text-[11px]">{selectedBet.explanation?.whatHappenedHistorically?.explanation}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button onClick={() => setSelectedBet(null)} className="bg-slate-800 hover:bg-slate-700 px-4 py-1.5 rounded text-slate-200">
                CLOSE AUDIT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
