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
  openingOdds: number;
  closingOdds: number;
  clvPercentage: number;
  category: string;
}

export default function ClvPage() {
  const [tier, setTier] = useState<'FREE' | 'STARTER' | 'PRO' | 'QUANT' | 'LIFETIME'>('FREE');
  const [mounted, setMounted] = useState(false);
  const [clvRows, setClvRows] = useState<ClvRow[]>([]);
  const [avgClv, setAvgClv] = useState<number>(0);
  const [beatRate, setBeatRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    const savedTier = localStorage.getItem('handicaplab_user_tier') as any;
    if (savedTier && ['FREE', 'STARTER', 'PRO', 'QUANT', 'LIFETIME'].includes(savedTier)) {
      setTier(savedTier);
    }

    async function loadCLV() {
      try {
        setLoading(true);
        const res = await fetch('/api/performance/clv');
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setClvRows(json.recentMovements || []);
            setAvgClv(json.averageClv || 0);
            const total = (json.distribution?.positive || 0) + (json.distribution?.elite || 0) + (json.distribution?.neutral || 0) + (json.distribution?.negative || 0);
            const beaten = (json.distribution?.positive || 0) + (json.distribution?.elite || 0);
            setBeatRate(total > 0 ? Number(((beaten / total) * 100).toFixed(1)) : 0);
          }
        }
      } catch (err) {
        console.error('Failed to load CLV metrics:', err);
      } finally {
        setLoading(false);
      }
    }

    loadCLV();
  }, []);

  const isLocked = tier === 'FREE' || tier === 'STARTER';

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
              <div className="text-2xl font-bold text-emerald-400">
                {avgClv > 0 ? `+${avgClv.toFixed(2)}%` : `${avgClv.toFixed(2)}%`}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Tracked CLV Records</span>
              <div className="text-2xl font-bold text-white">
                {clvRows.length} <span className="text-xs text-slate-400 font-normal">persisted entries</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Closing Line Beat Rate</span>
              <div className="text-2xl font-bold text-emerald-400">
                {beatRate}% <span className="text-xs text-slate-400 font-normal">positive movements</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CLV table */}
        <Card className="bg-slate-900 border-slate-800 overflow-hidden">
          <CardHeader className="border-b border-slate-800">
            <CardTitle className="text-sm font-mono text-white">Recent Line Movements &amp; Beat Margins</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {clvRows.length === 0 ? (
              <div className="py-12 text-center text-slate-500 font-mono text-xs space-y-2">
                <p>No settled CLV records currently available in live database.</p>
                <p className="text-[10px] text-slate-600">Records accumulate as pre-match predictions meet post-kickoff closing line captures.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="border-b border-slate-800">
                  <TableRow className="hover:bg-transparent border-slate-800">
                    <TableHead className="text-slate-400 font-mono text-xs pl-6">Match</TableHead>
                    <TableHead className="text-slate-400 font-mono text-xs text-center">Market</TableHead>
                    <TableHead className="text-slate-400 font-mono text-xs text-center">Selection</TableHead>
                    <TableHead className="text-slate-400 font-mono text-xs text-center">Entry Odds</TableHead>
                    <TableHead className="text-slate-400 font-mono text-xs text-center">Closing Odds</TableHead>
                    <TableHead className="text-slate-400 font-mono text-xs text-center">Beat Margin</TableHead>
                    <TableHead className="text-slate-400 font-mono text-xs text-right pr-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clvRows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-slate-800/40 border-slate-800/60 font-mono text-xs">
                      <TableCell className="py-4 pl-6 font-sans font-semibold text-white">{row.match}</TableCell>
                      <TableCell className="text-center py-4 text-slate-400">{row.market}</TableCell>
                      <TableCell className="text-center py-4 text-slate-300 font-semibold">{row.selection}</TableCell>
                      <TableCell className="text-center py-4 text-slate-300">{row.openingOdds ? row.openingOdds.toFixed(2) : '-'}</TableCell>
                      <TableCell className="text-center py-4 text-slate-400">{row.closingOdds ? row.closingOdds.toFixed(2) : '-'}</TableCell>
                      <TableCell className="text-center py-4 font-bold text-emerald-400">
                        {row.clvPercentage > 0 ? `+${row.clvPercentage.toFixed(1)}%` : `${row.clvPercentage.toFixed(1)}%`}
                      </TableCell>
                      <TableCell className="text-right py-4 pr-6">
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold">
                          {row.category}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
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
