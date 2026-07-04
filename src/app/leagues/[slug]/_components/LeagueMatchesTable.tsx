'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { WatchlistButton } from '@/components/WatchlistButton';
import { MatchPrediction } from '@/lib/data/leagues';

interface LeagueMatchesTableProps {
  matches: MatchPrediction[];
}

export function LeagueMatchesTable({ matches }: LeagueMatchesTableProps) {
  const [tier, setTier] = useState<'FREE' | 'STARTER' | 'PRO' | 'QUANT' | 'LIFETIME'>('FREE');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const loadTier = () => {
      const savedTier = localStorage.getItem('handicaplab_user_tier') as any;
      if (savedTier && ['FREE', 'STARTER', 'PRO', 'QUANT', 'LIFETIME'].includes(savedTier)) {
        setTier(savedTier);
      }
    };
    loadTier();
    window.addEventListener('handicaplab_tier_changed', loadTier);
    window.addEventListener('storage', loadTier);
    return () => {
      window.removeEventListener('handicaplab_tier_changed', loadTier);
      window.removeEventListener('storage', loadTier);
    };
  }, []);

  const isPro = tier === 'PRO' || tier === 'QUANT' || tier === 'LIFETIME';

  if (!mounted) {
    return (
      <div className="flex items-center justify-center p-12 border border-slate-800 bg-slate-900/40 rounded-xl">
        <span className="text-xs font-mono text-slate-500 animate-pulse">Initializing Quantitative Data Feed...</span>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-12 border border-slate-800 bg-slate-900/20 rounded-xl font-mono text-xs text-slate-500">
        No fixtures available
      </div>
    );
  }

  return (
    <div className="border border-slate-800 bg-slate-900 rounded-xl overflow-hidden relative">
      <Table>
        <TableHeader className="bg-slate-950/80 border-b border-slate-800">
          <TableRow className="hover:bg-transparent border-slate-800">
            <TableHead className="text-slate-400 font-mono text-xs w-[80px] text-center">Watch</TableHead>
            <TableHead className="text-slate-400 font-mono text-xs">Match & Kickoff</TableHead>
            <TableHead className="text-slate-400 font-mono text-xs text-center">Asian Handicap Line</TableHead>
            <TableHead className="text-slate-400 font-mono text-xs text-center">Model Edge</TableHead>
            <TableHead className="text-slate-400 font-mono text-xs text-center">O/U Line</TableHead>
            <TableHead className="text-slate-400 font-mono text-xs text-center">Expected Goals (xG)</TableHead>
            <TableHead className="text-slate-400 font-mono text-xs text-right pr-6">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matches.map((match, index) => {
            const isGated = index >= 3 && !isPro;

            return (
              <TableRow
                key={match.matchId}
                className={`border-slate-800/80 transition-colors relative ${
                  isGated ? 'select-none pointer-events-none' : 'hover:bg-slate-850/35'
                }`}
              >
                {/* Watchlist Star */}
                <TableCell className="py-4 text-center">
                  <div className={isGated ? 'blur-[3px] opacity-30' : ''}>
                    <WatchlistButton matchId={match.matchId} />
                  </div>
                </TableCell>

                {/* Match Details */}
                <TableCell className="py-4">
                  <div className={`flex flex-col ${isGated ? 'blur-[3px] opacity-30' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">
                        {match.homeTeamName} vs {match.awayTeamName}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5" suppressHydrationWarning>
                      {new Date(match.kickoffTime).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(match.kickoffTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </TableCell>

                {/* AH Line */}
                <TableCell className="text-center font-mono py-4">
                  <span className={`text-xs font-semibold text-slate-200 ${isGated ? 'blur-[4px] opacity-20' : ''}`}>
                    {match.handicapLine > 0 ? `+${match.handicapLine}` : match.handicapLine}
                  </span>
                </TableCell>

                {/* Model Edge */}
                <TableCell className="text-center font-mono py-4">
                  {isGated ? (
                    <span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850 opacity-40">
                      🔒 Locked
                    </span>
                  ) : (
                    <Badge
                      className={`font-bold ${
                        match.handicapEdgePercent > 5
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      +{match.handicapEdgePercent.toFixed(1)}%
                    </Badge>
                  )}
                </TableCell>

                {/* Over Under Line */}
                <TableCell className="text-center font-mono py-4">
                  <span className={`text-xs text-slate-400 ${isGated ? 'blur-[4px] opacity-20' : ''}`}>
                    Over {match.totalLine}
                  </span>
                </TableCell>

                {/* Home/Draw/Away Probabilities */}
                <TableCell className="text-center py-4 font-mono text-xs">
                  {isGated ? (
                    <div className="flex items-center justify-center gap-1 opacity-25 blur-[4px]">
                      <span>33%</span>•<span>33%</span>•<span>33%</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="bg-slate-950 px-1.5 py-0.5 rounded text-slate-300 border border-slate-850">
                        {Math.round(match.homeProbability * 100)}%
                      </span>
                      <span className="text-slate-700">•</span>
                      <span className="bg-slate-950 px-1.5 py-0.5 rounded text-slate-400 border border-slate-850">
                        {Math.round(match.drawProbability * 100)}%
                      </span>
                      <span className="text-slate-700">•</span>
                      <span className="bg-slate-950 px-1.5 py-0.5 rounded text-slate-300 border border-slate-850">
                        {Math.round(match.awayProbability * 100)}%
                      </span>
                    </div>
                  )}
                </TableCell>

                {/* Action button */}
                <TableCell className="text-right py-4 pr-6">
                  {isGated ? (
                    <div className="h-7 w-12 bg-slate-800 rounded opacity-20 blur-[2px]" />
                  ) : (
                    <Link href="/scanner" className="pointer-events-auto">
                      <button className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 font-mono text-xs transition-colors">
                        Scanner
                      </button>
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Overlay Banner for Gated Matches */}
      {matches.length > 3 && !isPro && (
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent flex flex-col justify-end items-center pb-6 px-4 text-center z-10 pointer-events-auto">
          <div className="bg-slate-900/95 border border-slate-800 p-4 rounded-xl max-w-md shadow-2xl backdrop-blur-md space-y-2">
            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center justify-center gap-2">
              <span>🔒</span> Pro Tier Paywall
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              You are viewing 3 free matches. Access ensembled goal models, handicap edges, and Kelly stakes for the remaining {matches.length - 3} matches.
            </p>
            <Link href="/pricing" className="inline-block mt-2">
              <button className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors">
                Upgrade to Pro
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
