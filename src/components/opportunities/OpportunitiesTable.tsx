'use client';

import React, { useState } from 'react';
import { ArrowRight, AlertTriangle, CheckCircle2, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OpportunityDetailPanel } from './OpportunityDetailPanel';

export type Opportunity = {
  id: string;
  match: string;
  league: string;
  time: string;
  market: string;
  selection: string;
  line: string;
  modelProb: number;
  marketOdds: number;
  fairOdds: number;
  edge: number;
  ev: number;
  signal: 'VALUE' | 'WATCH' | 'PASS';
  isStale?: boolean;
};

interface OpportunitiesTableProps {
  data: Opportunity[];
  previewMode?: boolean;
}

export function OpportunitiesTable({ data, previewMode = false }: OpportunitiesTableProps) {
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);

  const getSignalConfig = (signal: string) => {
    switch (signal) {
      case 'VALUE': return { color: 'text-[#75B58B]', bg: 'bg-[#75B58B]/10', icon: CheckCircle2 };
      case 'WATCH': return { color: 'text-[#C89B61]', bg: 'bg-[#C89B61]/10', icon: AlertTriangle };
      case 'PASS': default: return { color: 'text-muted-foreground', bg: 'bg-muted/30', icon: MinusCircle };
    }
  };

  return (
    <>
    <div className="w-full overflow-x-auto border-y sm:border sm:rounded-md border-border bg-card">
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead className="text-[10px] sm:text-xs text-muted-foreground uppercase bg-muted/40 border-b border-border font-mono tracking-wider">
          <tr>
            <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold">Match</th>
            <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold">Market</th>
            <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold text-right">Line</th>
            <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold text-right hidden sm:table-cell">Model Prob</th>
            <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold text-right">Mkt Odds</th>
            <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold text-right hidden sm:table-cell">Fair Odds</th>
            <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold text-right hidden md:table-cell">Edge</th>
            <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold text-right">EV</th>
            <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold text-center">Signal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50 font-mono text-sm">
          {data.map((opp) => {
            const signalConfig = getSignalConfig(opp.signal);
            const SignalIcon = signalConfig.icon;
            
            return (
              <tr 
                key={opp.id} 
                className={cn(
                  "hover:bg-muted/20 transition-colors group cursor-pointer",
                  opp.isStale ? "opacity-60 grayscale" : ""
                )}
                onClick={() => setSelectedOpp(opp)}
              >
                <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="font-sans font-medium text-foreground">{opp.match}</div>
                  <div className="font-sans text-xs text-muted-foreground mt-0.5">{opp.league} • {opp.time}</div>
                </td>
                <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="text-foreground">{opp.selection}</div>
                  <div className="font-sans text-xs text-muted-foreground mt-0.5">{opp.market}</div>
                </td>
                <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-right text-foreground">
                  {opp.line}
                </td>
                <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-right text-muted-foreground hidden sm:table-cell">
                  {(opp.modelProb * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-right text-foreground">
                  {opp.marketOdds.toFixed(2)}
                </td>
                <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-right text-muted-foreground hidden sm:table-cell">
                  {opp.fairOdds.toFixed(2)}
                </td>
                <td className={cn(
                  "px-3 py-2.5 sm:px-4 sm:py-3 text-right hidden md:table-cell",
                  opp.edge > 0 ? "text-[#75B58B]" : "text-muted-foreground"
                )}>
                  {opp.edge > 0 ? '+' : ''}{opp.edge.toFixed(1)}%
                </td>
                <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-right font-semibold text-foreground">
                  {opp.ev.toFixed(2)}%
                </td>
                <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-center">
                  <div className={cn(
                    "inline-flex items-center justify-center px-2 py-1 rounded text-xs font-sans font-bold",
                    signalConfig.bg,
                    signalConfig.color
                  )}>
                    <SignalIcon className="w-3.5 h-3.5 mr-1" />
                    {opp.isStale ? 'STALE' : opp.signal}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    
    <OpportunityDetailPanel 
      opportunity={selectedOpp} 
      isOpen={!!selectedOpp} 
      onClose={() => setSelectedOpp(null)} 
    />
    </>
  );
}
