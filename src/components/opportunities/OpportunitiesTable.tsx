'use client';

import React, { useState } from 'react';
import { ArrowRight, AlertTriangle, CheckCircle2, MinusCircle, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OpportunityDetailPanel } from './OpportunityDetailPanel';
import Link from 'next/link';

export type BaseOpportunity = {
  id: string;
  match: string;
  league: string;
  time: string;
  market: string;
  isStale?: boolean;
};

export type FreeOpportunity = BaseOpportunity & {
  locked: true;
};

export type PremiumOpportunity = BaseOpportunity & {
  locked: false;
  selection: string;
  line: string;
  modelProb: number;
  marketOdds: number;
  fairOdds: number;
  edge: number;
  ev: number;
  signal: 'VALUE' | 'WATCH' | 'PASS';
};

export type Opportunity = FreeOpportunity | PremiumOpportunity;

interface OpportunitiesTableProps {
  data: Opportunity[];
  previewMode?: boolean;
}

export function OpportunitiesTable({ data, previewMode = false }: OpportunitiesTableProps) {
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);

  const getSignalConfig = (signal: string) => {
    switch (signal) {
      case 'VALUE': return { color: 'text-signal-high', bg: 'bg-signal-high-bg border-signal-high', icon: CheckCircle2 };
      case 'WATCH': return { color: 'text-signal-medium', bg: 'bg-signal-medium-bg border-signal-medium', icon: AlertTriangle };
      case 'PASS': default: return { color: 'text-muted-foreground', bg: 'bg-muted/30 border-border', icon: MinusCircle };
    }
  };

  return (
    <>
    <div className="w-full overflow-x-auto border-y sm:border sm:rounded-md border-border bg-card shadow-elevation-1">
      <table className="w-full text-xs text-left whitespace-nowrap relative">
        <thead className="text-[10px] text-muted-foreground uppercase bg-muted border-b border-border font-mono tracking-widest">
          <tr>
            <th className="px-3 py-2 font-semibold">Match</th>
            <th className="px-3 py-2 font-semibold">Market</th>
            <th className="px-3 py-2 font-semibold text-right">Line</th>
            <th className="px-3 py-2 font-semibold text-right hidden sm:table-cell">Model</th>
            <th className="px-3 py-2 font-semibold text-right">Mkt Odds</th>
            <th className="px-3 py-2 font-semibold text-right hidden sm:table-cell">Fair</th>
            <th className="px-3 py-2 font-semibold text-right hidden md:table-cell">Edge</th>
            <th className="px-3 py-2 font-semibold text-right">EV</th>
            <th className="px-3 py-2 font-semibold text-center">Signal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border font-mono text-[11px] sm:text-xs">
          {data.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-12 text-center text-muted-foreground font-mono text-xs">
                No active value opportunities found. Market scanning active across whitelisted leagues.
              </td>
            </tr>
          ) : (
            data.map((opp) => {
              if (opp.locked) {
                return (
                  <tr 
                    key={opp.id} 
                    className={cn(
                      "hover:bg-muted/50 transition-colors group cursor-not-allowed opacity-60",
                      opp.isStale ? "opacity-30 grayscale" : ""
                    )}
                  >
                    <td className="px-3 py-2 sm:py-2.5">
                      <div className="font-sans font-medium text-foreground tracking-tight">{opp.match}</div>
                      <div className="font-sans text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{opp.league} &middot; {opp.time}</div>
                    </td>
                    <td className="px-3 py-2 sm:py-2.5">
                      <div className="text-foreground font-medium blur-[4px] select-none">Locked Selection</div>
                      <div className="font-sans text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{opp.market}</div>
                    </td>
                    <td className="px-3 py-2 sm:py-2.5 text-right text-foreground">
                      <span className="text-muted-foreground blur-[4px] select-none">-1.5</span>
                    </td>
                    <td className="px-3 py-2 sm:py-2.5 text-right text-muted-foreground hidden sm:table-cell">
                      <span className="blur-[4px] select-none">50.0%</span>
                    </td>
                    <td className="px-3 py-2 sm:py-2.5 text-right font-medium text-foreground">
                      <span className="blur-[4px] select-none">1.95</span>
                    </td>
                    <td className="px-3 py-2 sm:py-2.5 text-right text-muted-foreground hidden sm:table-cell">
                      <span className="blur-[4px] select-none">1.80</span>
                    </td>
                    <td className="px-3 py-2 sm:py-2.5 text-right hidden md:table-cell font-medium text-foreground">
                      <span className="blur-[4px] select-none">+5.0%</span>
                    </td>
                    <td className="px-3 py-2 sm:py-2.5 text-right font-bold text-signal-high">
                      <span className="blur-[4px] select-none">3.50%</span>
                    </td>
                    <td className="px-3 py-2 sm:py-2.5 text-center">
                      <div className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-sans font-bold tracking-widest border uppercase bg-muted/30 border-border text-muted-foreground blur-[2px] select-none">
                        LOCKED
                      </div>
                    </td>
                  </tr>
                );
              }

            const signalConfig = getSignalConfig(opp.signal);
            return (
              <tr 
                key={opp.id} 
                className={cn(
                  "hover:bg-muted/50 transition-colors group cursor-pointer",
                  opp.isStale ? "opacity-50 grayscale" : ""
                )}
                onClick={() => setSelectedOpp(opp)}
              >
                <td className="px-3 py-2 sm:py-2.5">
                  <div className="font-sans font-medium text-foreground tracking-tight">{opp.match}</div>
                  <div className="font-sans text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{opp.league} &middot; {opp.time}</div>
                </td>
                <td className="px-3 py-2 sm:py-2.5">
                  <div className="text-foreground font-medium">{opp.selection}</div>
                  <div className="font-sans text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{opp.market}</div>
                </td>
                <td className="px-3 py-2 sm:py-2.5 text-right text-foreground">
                  {opp.line !== '-' ? opp.line : <span className="text-muted-foreground">-</span>}
                </td>
                <td className="px-3 py-2 sm:py-2.5 text-right text-muted-foreground hidden sm:table-cell">
                  {(opp.modelProb * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2 sm:py-2.5 text-right font-medium text-foreground">
                  {opp.marketOdds.toFixed(2)}
                </td>
                <td className="px-3 py-2 sm:py-2.5 text-right text-muted-foreground hidden sm:table-cell">
                  {opp.fairOdds.toFixed(2)}
                </td>
                <td className={cn(
                  "px-3 py-2 sm:py-2.5 text-right hidden md:table-cell font-medium",
                  opp.edge > 0 ? "text-foreground" : "text-muted-foreground"
                )}>
                  {opp.edge > 0 ? '+' : ''}{opp.edge.toFixed(1)}%
                </td>
                <td className={cn(
                  "px-3 py-2 sm:py-2.5 text-right font-bold",
                  opp.ev >= 3.0 ? "text-signal-high" : opp.ev >= 1.0 ? "text-signal-medium" : "text-foreground"
                )}>
                  {opp.ev.toFixed(2)}%
                </td>
                <td className="px-3 py-2 sm:py-2.5 text-center">
                  <div className={cn(
                    "inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-sans font-bold tracking-widest border uppercase",
                    opp.signal === 'VALUE' && 'signal-high',
                    opp.signal === 'WATCH' && 'signal-medium static',
                    signalConfig.color,
                    opp.signal === 'PASS' && signalConfig.bg
                  )}>
                    {opp.isStale ? 'STALE' : opp.signal === 'VALUE' ? 'HIGH' : opp.signal === 'WATCH' ? 'MEDIUM' : opp.signal}
                  </div>
                </td>
              </tr>
            );
          }))}
        </tbody>
      </table>
      
      {/* Upgrade Overlay for Locked Rows */}
      {data.some(opp => opp.locked) && (
        <div className="absolute inset-x-0 bottom-0 top-[200px] sm:top-[250px] flex items-center justify-center bg-gradient-to-t from-background/90 via-background/60 to-transparent pointer-events-none z-10">
          <div className="pointer-events-auto bg-card/95 border border-border rounded-xl p-6 shadow-elevation-2 max-w-md mx-auto text-center backdrop-blur-sm relative z-20">
            <div className="w-12 h-12 bg-terracotta/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-terracotta" />
            </div>
            <h3 className="text-xl font-display font-bold tracking-tight mb-2">Unlock Full Access</h3>
            <p className="text-sm text-muted-foreground mb-6">
              You've reached your daily limit for free signals. Upgrade to Pro to see all positive EV opportunities.
            </p>
            <Link href="/pricing" className="inline-flex h-10 items-center justify-center rounded-md bg-terracotta px-6 text-sm font-medium text-white shadow transition-colors hover:bg-terracotta-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/20">
              Get Pro Access
            </Link>
          </div>
        </div>
      )}
    </div>
    
    <OpportunityDetailPanel 
      opportunity={selectedOpp?.locked === false ? selectedOpp : null} 
      isOpen={!!selectedOpp && selectedOpp.locked === false} 
      onClose={() => setSelectedOpp(null)} 
    />
    </>
  );
}
