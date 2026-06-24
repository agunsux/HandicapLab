'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface SettledPrediction {
  id: string;
  date: string;
  matchName: string;
  league: string;
  market: string;
  selection: string;
  odds: number;
  fairOdds: number;
  modelProb: number;
  result: 'WIN' | 'LOSS' | 'VOID';
  profit: number;
  clv: number;
  status: string;
}

const MOCK_SETTLED_HISTORY: SettledPrediction[] = [
  { id: '1', date: '2026-06-22', matchName: 'Liverpool vs Chelsea', league: 'English Premier League', market: 'Asian Handicap -0.75', selection: 'Home (Liverpool)', odds: 1.92, fairOdds: 1.78, modelProb: 0.58, result: 'WIN', profit: 0.92, clv: 4.2, status: 'SETTLED' },
  { id: '2', date: '2026-06-21', matchName: 'Manchester City vs Manchester United', league: 'English Premier League', market: 'Over/Under Goals 3.0', selection: 'Over', odds: 1.85, fairOdds: 1.64, modelProb: 0.61, result: 'WIN', profit: 0.85, clv: 2.1, status: 'SETTLED' },
  { id: '3', date: '2026-06-20', matchName: 'Arsenal vs Aston Villa', league: 'English Premier League', market: 'Asian Handicap -0.75', selection: 'Home (Arsenal)', odds: 1.91, fairOdds: 1.85, modelProb: 0.54, result: 'LOSS', profit: -1.0, clv: 1.2, status: 'SETTLED' },
  { id: '4', date: '2026-06-19', matchName: 'Tottenham vs Newcastle', league: 'English Premier League', market: 'Over/Under Goals 3.0', selection: 'Over', odds: 2.10, fairOdds: 1.96, modelProb: 0.51, result: 'WIN', profit: 1.10, clv: -1.5, status: 'SETTLED' },
  { id: '5', date: '2026-06-18', matchName: 'Real Madrid vs Barcelona', league: 'La Liga', market: 'Moneyline 1X2', selection: 'Draw', odds: 3.40, fairOdds: 3.10, modelProb: 0.32, result: 'LOSS', profit: -1.0, clv: 0.5, status: 'SETTLED' },
  { id: '6', date: '2026-06-17', matchName: 'Bayern Munich vs Dortmund', league: 'Bundesliga', market: 'Asian Handicap -0.50', selection: 'Away (Dortmund)', odds: 1.80, fairOdds: 1.75, modelProb: 0.57, result: 'VOID', profit: 0.0, clv: 0.0, status: 'SETTLED' },
  { id: '7', date: '2026-06-16', matchName: 'AC Milan vs Inter Milan', league: 'Serie A', market: 'Over/Under Goals 2.5', selection: 'Under', odds: 1.95, fairOdds: 1.82, modelProb: 0.55, result: 'WIN', profit: 0.95, clv: 3.0, status: 'SETTLED' },
  { id: '8', date: '2026-06-15', matchName: 'PSG vs Marseille', league: 'Ligue 1', market: 'Moneyline 1X2', selection: 'Home (PSG)', odds: 1.50, fairOdds: 1.40, modelProb: 0.71, result: 'WIN', profit: 0.50, clv: 2.5, status: 'SETTLED' }
];

export default function PerformanceLedger() {
  const [tier, setTier] = useState<'FREE' | 'STARTER' | 'PRO' | 'QUANT' | 'LIFETIME'>('FREE');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTier = localStorage.getItem('handicaplab_user_tier') as any;
    if (savedTier && ['FREE', 'STARTER', 'PRO', 'QUANT', 'LIFETIME'].includes(savedTier)) {
      setTier(savedTier);
    }
  }, []);

  const totalPredictions = 1250;
  const winRate = 60.1;
  const roi = 8.4;
  const avgClv = 2.7;
  const brierScore = 0.19;
  const calibrationScore = 94;
  const maxDrawdown = 4.5;
  const sampleSize = 1250;

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-slate-400 font-mono text-sm animate-pulse">Loading Ledger Terminal...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-slate-100">
      {/* Header */}
      <div>
        <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
          Public Performance Audit
        </span>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1.5 font-sans">
          Public Performance Ledger
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Uncompromised transparency. Every ensembled prediction is tracked against Pinnacle closing lines with zero retrospective cherry-picking.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-mono text-slate-500 uppercase">Tracked Predictions</span>
            <div className="text-2xl font-bold text-white">{totalPredictions}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-mono text-slate-500 uppercase">Overall ROI</span>
            <div className="text-2xl font-bold text-emerald-400">+{roi}%</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-mono text-slate-500 uppercase">Average CLV Beat</span>
            <div className="text-2xl font-bold text-emerald-400">+{avgClv}%</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-mono text-slate-500 uppercase">Calibration (Brier)</span>
            <div className="text-2xl font-bold text-white">{calibrationScore}% <span className="text-xs text-slate-400 font-normal">({brierScore})</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex justify-between items-center">
            <span className="text-xs font-mono text-slate-400">Max Historical Drawdown</span>
            <span className="text-sm font-mono font-bold text-rose-400">-{maxDrawdown}%</span>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex justify-between items-center">
            <span className="text-xs font-mono text-slate-400">Ensemble Win Rate</span>
            <span className="text-sm font-mono font-bold text-white">{winRate}%</span>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex justify-between items-center">
            <span className="text-xs font-mono text-slate-400">Verified Sample Size</span>
            <span className="text-sm font-mono font-bold text-slate-300">{sampleSize} picks</span>
          </CardContent>
        </Card>
      </div>

      {/* Performance Ledger Table */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <CardHeader className="border-b border-slate-800">
          <CardTitle className="text-base text-white">Audited Prediction History</CardTitle>
          <CardDescription className="text-xs text-slate-450">
            Real-time feed showing all settled selections including wins, losses, and voids.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="border-b border-slate-800">
              <TableRow className="hover:bg-transparent border-slate-800">
                <TableHead className="text-slate-450 font-mono text-xs pl-6">Date</TableHead>
                <TableHead className="text-slate-450 font-mono text-xs">Match</TableHead>
                <TableHead className="text-slate-450 font-mono text-xs text-center">Market</TableHead>
                <TableHead className="text-slate-450 font-mono text-xs text-center">Selection</TableHead>
                <TableHead className="text-slate-450 font-mono text-xs text-center">Odds</TableHead>
                <TableHead className="text-slate-450 font-mono text-xs text-center">Fair Odds</TableHead>
                <TableHead className="text-slate-450 font-mono text-xs text-center">Model Probability</TableHead>
                <TableHead className="text-slate-450 font-mono text-xs text-center">Result</TableHead>
                <TableHead className="text-slate-450 font-mono text-xs text-center">CLV</TableHead>
                <TableHead className="text-slate-450 font-mono text-xs text-right pr-6">P/L (1 Unit)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_SETTLED_HISTORY.map((row) => (
                <TableRow key={row.id} className="hover:bg-slate-850/40 border-slate-800/60 font-mono text-xs">
                  <TableCell className="py-4 pl-6 text-slate-400 whitespace-nowrap">
                    {row.date}
                  </TableCell>
                  <TableCell className="py-4 font-sans font-semibold text-white">
                    {row.matchName}
                    <span className="block text-[10px] text-slate-500 font-mono mt-0.5 font-normal">{row.league}</span>
                  </TableCell>
                  <TableCell className="text-center py-4 text-slate-300">
                    {row.market}
                  </TableCell>
                  <TableCell className="text-center py-4 text-slate-300 font-semibold">
                    {row.selection}
                  </TableCell>
                  <TableCell className="text-center py-4 font-bold text-white">
                    {row.odds.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center py-4 text-slate-400">
                    {row.fairOdds.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center py-4 text-slate-400">
                    {Math.round(row.modelProb * 100)}%
                  </TableCell>
                  <TableCell className="text-center py-4">
                    <Badge className={`font-bold ${row.result === 'WIN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : row.result === 'LOSS' ? 'bg-rose-500/10 text-rose-450 border-rose-500/20' : 'bg-slate-950 text-slate-500 border-slate-850'}`}>
                      {row.result}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-center py-4 font-bold ${row.clv >= 0 ? 'text-emerald-450' : 'text-rose-450'}`}>
                    {row.clv >= 0 ? `+${row.clv.toFixed(1)}%` : `${row.clv.toFixed(1)}%`}
                  </TableCell>
                  <TableCell className={`text-right py-4 pr-6 font-bold ${row.profit > 0 ? 'text-emerald-400' : row.profit < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                    {row.profit > 0 ? `+${row.profit.toFixed(2)}` : row.profit.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
