'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type Opportunity = {
  id: string;
  match: string;
  league: string;
  time: string;
  market: string;
  selection: string;
  bookmaker: string;
  odds: string;
  fairOdds: string;
  edge: number;
  confidence: 'A+' | 'A' | 'B+' | 'B';
};

interface OpportunitiesTableProps {
  data: Opportunity[];
  onRowClick?: (opp: Opportunity) => void;
  previewMode?: boolean;
}

export function OpportunitiesTable({ data, onRowClick, previewMode = false }: OpportunitiesTableProps) {
  const getConfidenceColor = (grade: string) => {
    switch (grade) {
      case 'A+': return 'bg-primary/20 text-primary border-primary/30';
      case 'A': return 'bg-primary/10 text-primary border-primary/20';
      case 'B+': return 'bg-accent/20 text-accent-foreground border-accent/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border font-medium">
          <tr>
            <th className="px-4 py-3 sm:px-6">Match</th>
            <th className="px-4 py-3 sm:px-6">Market</th>
            <th className="px-4 py-3 sm:px-6 hidden md:table-cell">Bookmaker</th>
            <th className="px-4 py-3 sm:px-6 text-right">Odds</th>
            <th className="px-4 py-3 sm:px-6 text-right hidden sm:table-cell">Fair Odds</th>
            <th className="px-4 py-3 sm:px-6 text-right">Edge</th>
            <th className="px-4 py-3 sm:px-6 text-center">Confidence</th>
            <th className="px-4 py-3 sm:px-6 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((opp) => (
            <tr 
              key={opp.id} 
              className={`hover:bg-muted/30 transition-colors group ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={() => onRowClick && onRowClick(opp)}
            >
              <td className="px-4 py-4 sm:px-6 whitespace-nowrap">
                <div className="font-semibold text-foreground tracking-tight">{opp.match}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{opp.league} • {opp.time}</div>
              </td>
              <td className="px-4 py-4 sm:px-6 whitespace-nowrap">
                <div className="font-medium text-foreground">{opp.selection}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{opp.market}</div>
              </td>
              <td className="px-4 py-4 sm:px-6 whitespace-nowrap hidden md:table-cell">
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-background border border-border text-xs font-medium">
                  {opp.bookmaker}
                </div>
              </td>
              <td className="px-4 py-4 sm:px-6 whitespace-nowrap text-right font-mono font-medium text-foreground">
                {opp.odds}
              </td>
              <td className="px-4 py-4 sm:px-6 whitespace-nowrap text-right font-mono text-muted-foreground hidden sm:table-cell">
                {opp.fairOdds}
              </td>
              <td className="px-4 py-4 sm:px-6 whitespace-nowrap text-right font-mono font-semibold text-primary">
                {opp.edge > 0 ? '+' : ''}{opp.edge}%
              </td>
              <td className="px-4 py-4 sm:px-6 whitespace-nowrap text-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getConfidenceColor(opp.confidence)}`}>
                  {opp.confidence}
                </span>
              </td>
              <td className="px-4 py-4 sm:px-6 whitespace-nowrap text-right">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground group-hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                >
                  Analyze <ArrowRight className="ml-1.5 size-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
