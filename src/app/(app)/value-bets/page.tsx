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
    <div className="min-h-screen bg-background text-foreground font-mono p-6 space-y-6">
      {/* Header Banner */}
      <div className="border border-border bg-card p-5 rounded-lg space-y-2 shadow-elevation-1">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-terracotta" />
              <h1 className="text-xl font-bold text-foreground tracking-wider">
                VALUE BETTING INTELLIGENCE TERMINAL
              </h1>
              <span className="bg-muted text-muted-foreground border border-border text-xs px-2.5 py-0.5 rounded font-sans font-medium">
                EPIC 56 ACTIVE
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-sans mt-1">
              Identifying mispriced football betting markets with positive Expected Value (+EV), Closing Line Value (CLV), and historical evidence proof.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-background border border-border p-2.5 rounded text-xs text-right">
              <div className="text-muted-foreground text-[10px]">PARADIGM INVARIANT</div>
              <div className="text-foreground font-bold">EXPECTED VALUE &gt; WIN RATE</div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center justify-between gap-4 border-b border-border pb-3 overflow-x-auto">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground uppercase font-bold mr-2">CATEGORIES:</span>
          {['ALL', 'STRONG_VALUE', 'VALUE', 'WATCHLIST'].map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                categoryFilter === cat
                  ? 'bg-muted text-foreground'
                  : 'bg-background text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>

        <span className="text-xs text-muted-foreground">{filteredBets.length} Opportunities Identified</span>
      </div>

      {/* Value Bets Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBets.map((bet, i) => (
          <div
            key={i}
            className="border border-border bg-card rounded-lg p-5 space-y-4 transition-all flex flex-col justify-between shadow-elevation-1"
          >
            <div className="space-y-3">
              {/* Card Top: Category Badge & League */}
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground">{bet.league}</span>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-sans tracking-widest uppercase ${
                  bet.category === 'STRONG_VALUE'
                    ? 'signal-high static'
                    : bet.category === 'WATCHLIST'
                    ? 'signal-medium static'
                    : 'bg-muted text-foreground border border-border'
                }`}>
                  {bet.category === 'STRONG_VALUE' ? 'HIGH' : bet.category === 'WATCHLIST' ? 'MEDIUM' : bet.category.replace('_', ' ')}
                </span>
              </div>

              {/* Match Header */}
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {bet.homeTeam} vs {bet.awayTeam}
                </h3>
                <p className="text-[11px] text-muted-foreground font-sans">
                  Kickoff: {new Date(bet.kickoff).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Recommended Market & Selection */}
              <div className="bg-background border border-border p-3 rounded space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">RECOMMENDED BET:</span>
                  <span className="font-bold text-foreground uppercase">
                    {bet.market.toUpperCase()} {bet.line !== 0 ? bet.line : ''} ({bet.selection.toUpperCase()})
                  </span>
                </div>

                {/* Fair Odds vs Bookmaker Odds Side-by-Side */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border text-center">
                  <div className="bg-muted/30 p-2 rounded">
                    <div className="text-[10px] text-muted-foreground">MODEL FAIR ODDS</div>
                    <div className="text-sm font-bold text-foreground">{bet.modelFairOdds.toFixed(2)}</div>
                    <div className="text-[9px] text-muted-foreground font-sans">{(bet.modelProb * 100).toFixed(1)}% Fair Prob</div>
                  </div>
                  <div className="bg-muted/30 p-2 rounded">
                    <div className="text-[10px] text-muted-foreground">BOOKMAKER ODDS</div>
                    <div className="text-sm font-bold text-foreground">{bet.bookmakerOdds.toFixed(2)}</div>
                    <div className="text-[9px] text-muted-foreground font-sans">{(bet.marketProb * 100).toFixed(1)}% Implied</div>
                  </div>
                </div>
              </div>

              {/* Metric Callouts: EV & Edge */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2 border border-border bg-background rounded">
                  <div className="text-[10px] text-muted-foreground uppercase">Expected Value (EV)</div>
                  <div className="text-base font-bold text-signal-high-strong">+{Number(bet.expectedValue * 100).toFixed(1)}%</div>
                </div>
                <div className="p-2 border border-border bg-background rounded">
                  <div className="text-[10px] text-muted-foreground uppercase">Probability Edge</div>
                  <div className="text-base font-bold text-foreground">+{Number(bet.probEdge * 100).toFixed(1)}%</div>
                </div>
              </div>

              {/* Historical Evidence Box */}
              <div className="p-2.5 bg-muted/30 border border-border rounded text-[11px] text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-foreground text-[10px] uppercase font-sans tracking-wide">
                  <ShieldCheck className="h-3.5 w-3.5 text-terracotta" />
                  EMPIRICAL HISTORICAL PROOF
                </div>
                <p className="text-[10px] font-sans leading-relaxed">
                  {bet.evidence?.summaryText}
                </p>
              </div>
            </div>

            {/* Bottom Button */}
            <button
              onClick={() => setSelectedBet(bet)}
              className="w-full mt-4 bg-muted hover:bg-muted/80 text-xs text-foreground py-2 rounded font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Info className="h-3.5 w-3.5 text-terracotta" />
              INSPECT 5-QUESTION EXPLANATION
            </button>
          </div>
        ))}
      </div>

      {/* EXPLAINABILITY MODAL */}
      {selectedBet && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-2xl w-full p-6 space-y-5 text-xs font-mono max-h-[90vh] overflow-y-auto shadow-elevation-3">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div className="flex items-center gap-2 text-foreground font-bold uppercase tracking-wide font-sans">
                <Sparkles className="h-4 w-4 text-terracotta" />
                MATHEMATICAL VALUE EXPLAINABILITY AUDIT
              </div>
              <button onClick={() => setSelectedBet(null)} className="text-muted-foreground hover:text-foreground font-bold">?</button>
            </div>

            <div className="space-y-4">
              <div className="bg-background p-3 rounded space-y-1 border border-border">
                <div className="text-base font-bold text-foreground">{selectedBet.homeTeam} vs {selectedBet.awayTeam}</div>
                <div className="text-muted-foreground text-[11px] font-sans">{selectedBet.league} | Recommended: {selectedBet.market.toUpperCase()} ({selectedBet.selection.toUpperCase()})</div>
              </div>

              {/* 5 Questions */}
              <div className="space-y-3 font-sans">
                <div className="border border-border p-3 rounded bg-background">
                  <h4 className="font-bold text-foreground uppercase text-[11px] tracking-wide mb-1">1. Why This Bet?</h4>
                  <p className="text-muted-foreground text-[12px] leading-relaxed">{selectedBet.explanation?.whyThisBet?.explanation}</p>
                </div>

                <div className="border border-border p-3 rounded bg-background">
                  <h4 className="font-bold text-foreground uppercase text-[11px] tracking-wide mb-1">2. Why Now? (Odds Trajectory)</h4>
                  <p className="text-muted-foreground text-[12px] leading-relaxed">{selectedBet.explanation?.whyNow?.explanation}</p>
                </div>

                <div className="border border-border p-3 rounded bg-background">
                  <h4 className="font-bold text-foreground uppercase text-[11px] tracking-wide mb-1">3. Key Statistical Drivers</h4>
                  <ul className="list-disc pl-4 space-y-1 text-muted-foreground text-[12px] leading-relaxed">
                    {selectedBet.explanation?.whatVariablesInfluencedIt?.primaryDrivers.map((d: any, idx: number) => (
                      <li key={idx}><strong>{d.factor}</strong> ({d.impact}): {d.detail}</li>
                    ))}
                  </ul>
                </div>

                <div className="border border-border p-3 rounded bg-background">
                  <h4 className="font-bold text-foreground uppercase text-[11px] tracking-wide mb-1">4. How Much Edge Exists?</h4>
                  <p className="text-muted-foreground text-[12px] leading-relaxed">{selectedBet.explanation?.howMuchEdgeExists?.explanation}</p>
                </div>

                <div className="border border-border p-3 rounded bg-background">
                  <h4 className="font-bold text-foreground uppercase text-[11px] tracking-wide mb-1">5. Empirical Historical Evidence</h4>
                  <p className="text-muted-foreground text-[12px] leading-relaxed">{selectedBet.explanation?.whatHappenedHistorically?.explanation}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button onClick={() => setSelectedBet(null)} className="bg-muted hover:bg-muted-foreground text-foreground px-4 py-1.5 rounded font-sans font-medium transition-colors">
                CLOSE AUDIT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
