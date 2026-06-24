'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface ClvRow {
  id: string;
  match: string;
  market: string;
  selection: string;
  entryOdds: number;
  closingOdds: number;
  beatMargin: number;
  status: string;
}

const MOCK_CLV_LEADERBOARD: ClvRow[] = [
  { id: '1', match: 'Liverpool vs Chelsea', market: 'Asian Handicap -0.25', selection: 'Home (Liverpool)', entryOdds: 1.95, closingOdds: 1.80, beatMargin: 8.3, status: 'BEATEN' },
  { id: '2', match: 'Manchester City vs Manchester United', market: 'Asian Handicap -1.25', selection: 'Home (Man City)', entryOdds: 1.85, closingOdds: 1.76, beatMargin: 5.1, status: 'BEATEN' },
  { id: '3', match: 'Real Madrid vs Atletico Madrid', league: 'La Liga', market: 'Over/Under Goals 2.5', selection: 'Over', entryOdds: 2.10, closingOdds: 2.02, beatMargin: 3.9, status: 'BEATEN' } as any,
  { id: '4', match: 'AC Milan vs Juventus', market: 'Moneyline 1X2', selection: 'Home (AC Milan)', entryOdds: 1.92, closingOdds: 1.86, beatMargin: 3.2, status: 'BEATEN' },
  { id: '5', match: 'Bayern Munich vs RB Leipzig', market: 'Asian Handicap -0.75', selection: 'Home (Bayern)', entryOdds: 1.75, closingOdds: 1.70, beatMargin: 2.9, status: 'BEATEN' }
];

export default function ClvPage() {
  const [tier, setTier] = useState<'FREE' | 'STARTER' | 'PRO' | 'QUANT' | 'LIFETIME'>('FREE');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTier = localStorage.getItem('handicaplab_user_tier') as any;
    if (savedTier && ['FREE', 'STARTER', 'PRO', 'QUANT', 'LIFETIME'].includes(savedTier)) {
      setTier(savedTier);
    }
  }, []);

  const isLocked = tier === 'FREE' || tier === 'STARTER';

  const avgClv = 3.2;
  const bestStreak = 14;
  const beatRate = 68;

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-slate-400 font-mono text-sm animate-pulse">Loading CLV Terminal...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-100 relative">
      {/* Header */}
      <div>
        <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
          Sharp Inefficiency Audit
        </span>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1.5 font-sans">
          Closing Line Value (CLV) Leaderboard
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Monitor closing line movements. Beating closing odds programmatically validates long-term mathematical edge over the market.
        </p>
      </div>

      {/* Content wrapper with conditional blur */}
      <div className={`space-y-6 ${isLocked ? 'blur-sm select-none pointer-events-none' : ''}`}>
        {/* KPI Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Average CLV Beat</span>
              <div className="text-2xl font-bold text-emerald-400">+{avgClv}%</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Best CLV Streak</span>
              <div className="text-2xl font-bold text-white">{bestStreak} <span className="text-xs text-slate-450 font-normal">consecutive picks</span></div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Closing Line Beat Rate</span>
              <div className="text-2xl font-bold text-emerald-450">{beatRate}% <span className="text-xs text-slate-450 font-normal">of last 100 picks</span></div>
            </CardContent>
          </Card>
        </div>

        {/* CLV table */}
        <Card className="bg-slate-900 border-slate-800 overflow-hidden">
          <CardHeader className="border-b border-slate-800">
            <CardTitle className="text-sm font-mono text-white">Recent Line Movements & Beat Margins</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="border-b border-slate-800">
                <TableRow className="hover:bg-transparent border-slate-800">
                  <TableHead className="text-slate-450 font-mono text-xs pl-6">Match</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs text-center">Market</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs text-center">Selection</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs text-center">Entry Odds</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs text-center">Closing Odds</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs text-center">Beat Margin</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs text-right pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_CLV_LEADERBOARD.map((row) => (
                  <TableRow key={row.id} className="hover:bg-slate-850/40 border-slate-800/60 font-mono text-xs">
                    <TableCell className="py-4 pl-6 font-sans font-semibold text-white">{row.match}</TableCell>
                    <TableCell className="text-center py-4 text-slate-400">{row.market}</TableCell>
                    <TableCell className="text-center py-4 text-slate-300 font-semibold">{row.selection}</TableCell>
                    <TableCell className="text-center py-4 text-slate-300">{row.entryOdds.toFixed(2)}</TableCell>
                    <TableCell className="text-center py-4 text-slate-350">{row.closingOdds.toFixed(2)}</TableCell>
                    <TableCell className="text-center py-4 font-bold text-emerald-450">+{row.beatMargin.toFixed(1)}%</TableCell>
                    <TableCell className="text-right py-4 pr-6">
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold">
                        {row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Paywall Overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-20 flex flex-col justify-center items-center px-4 text-center">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md shadow-2xl space-y-4 backdrop-blur-xl">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">CLV Analytics Leaderboard</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Available on Pro membership. Upgrade to view ensembled closing line discrepancies, beat streaks, and live Pinnacle price adjustments.
              </p>
            </div>
            <Link href="/pricing" className="block pt-2">
              <button className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors">
                Upgrade to Pro
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
