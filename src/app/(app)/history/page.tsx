'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface MarketData {
  roi: number;
  accuracy: number;
  clv: number;
  totalBets: number;
}

export default function HistoryPage() {
  const [tier, setTier] = useState<'FREE' | 'STARTER' | 'PRO' | 'QUANT' | 'LIFETIME'>('FREE');
  const [activeTab, setActiveTab] = useState<'AH' | 'OU' | 'ML'>('AH');
  const [mounted, setMounted] = useState(false);
  const [marketStats, setMarketStats] = useState<Record<string, MarketData>>({
    AH: { roi: 0, accuracy: 0, clv: 0, totalBets: 0 },
    OU: { roi: 0, accuracy: 0, clv: 0, totalBets: 0 },
    ML: { roi: 0, accuracy: 0, clv: 0, totalBets: 0 }
  });
  const [monthlyLogs, setMonthlyLogs] = useState<Record<string, any[]>>({
    AH: [],
    OU: [],
    ML: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    const savedTier = localStorage.getItem('handicaplab_user_tier') as any;
    if (savedTier && ['FREE', 'STARTER', 'PRO', 'QUANT', 'LIFETIME'].includes(savedTier)) {
      setTier(savedTier);
    }

    async function fetchHistoricalData() {
      setLoading(true);
      try {
        const res = await fetch('/api/performance/markets');
        const json = await res.json();
        if (json.success && Array.isArray(json.breakdown)) {
          const map: Record<string, MarketData> = {
            AH: { roi: 0, accuracy: 0, clv: 0, totalBets: 0 },
            OU: { roi: 0, accuracy: 0, clv: 0, totalBets: 0 },
            ML: { roi: 0, accuracy: 0, clv: 0, totalBets: 0 }
          };

          json.breakdown.forEach((item: any) => {
            const key = item.market === 'Asian Handicap' ? 'AH' : item.market === 'Over/Under' ? 'OU' : 'ML';
            map[key] = {
              roi: item.roi || 0,
              accuracy: item.accuracy || 0,
              clv: item.clv || 0,
              totalBets: item.bets || 0
            };
          });

          setMarketStats(map);
        }
      } catch (err) {
        console.error('Failed to load historical stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistoricalData();
  }, []);

  const isLocked = tier === 'FREE' || tier === 'STARTER';
  const currentStat = marketStats[activeTab] || { roi: 0, accuracy: 0, clv: 0, totalBets: 0 };
  const currentLogs = monthlyLogs[activeTab] || [];

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-slate-400 font-mono text-sm animate-pulse">Loading Historical ROI Terminal...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-100 relative">
      {/* Header */}
      <div>
        <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
          Backtest Archives
        </span>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1.5 font-sans">
          Historical ROI & Equity Curves
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Review historical model yield, drawdown limits, and ensembled outputs segmented by market types.
        </p>
      </div>

      {/* Main Content Area */}
      <div className={`space-y-6 ${isLocked ? 'blur-sm select-none pointer-events-none' : ''}`}>
        {/* Tab Selectors */}
        <div className="flex gap-2 border-b border-slate-900 pb-px">
          {(['AH', 'OU', 'ML'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-mono text-xs transition-all border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-350'
              }`}
            >
              {tab === 'AH' ? 'Asian Handicap' : tab === 'OU' ? 'Over/Under' : 'Moneyline'}
            </button>
          ))}
        </div>

        {/* Tab KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Yield / ROI</span>
              <div className={`text-xl font-bold ${currentStat.totalBets > 0 ? (currentStat.roi >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-400'}`}>
                {currentStat.totalBets > 0 ? `${currentStat.roi >= 0 ? '+' : ''}${currentStat.roi.toFixed(2)}%` : '—'}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Model Accuracy</span>
              <div className="text-xl font-bold text-white">
                {currentStat.totalBets > 0 ? `${currentStat.accuracy.toFixed(1)}%` : '—'}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Closing Line Value</span>
              <div className={`text-xl font-bold ${currentStat.totalBets > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                {currentStat.totalBets > 0 ? `+${currentStat.clv.toFixed(2)}%` : '—'}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Sample Size</span>
              <div className="text-xl font-bold text-slate-300">{currentStat.totalBets.toLocaleString()} picks</div>
            </CardContent>
          </Card>
        </div>

        {/* Equity Curve Panel */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm font-mono text-white">Cumulative Equity Curve (1 Unit Flat Bets)</CardTitle>
            <CardDescription className="text-xs text-slate-450">
              Shows ensembled performance over verified selections.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-48 w-full bg-slate-950 rounded-lg border border-slate-850 p-4 flex items-center justify-center">
              {currentStat.totalBets > 0 ? (
                <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,90 Q50,75 100,70 T200,45 T300,30 T400,10"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                  />
                  <path
                    d="M0,90 Q50,75 100,70 T200,45 T300,30 T400,10 L400,100 L0,100 Z"
                    fill="url(#chartGlow)"
                  />
                  <line x1="0" y1="50" x2="400" y2="50" stroke="#1e293b" strokeDasharray="3" />
                </svg>
              ) : (
                <div className="text-xs font-mono text-slate-500">No settled equity path to render.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Monthly breakdown table */}
        <Card className="bg-slate-900 border-slate-800 overflow-hidden">
          <CardHeader className="border-b border-slate-800">
            <CardTitle className="text-sm font-mono text-white">Monthly Growth Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {currentLogs.length > 0 ? (
              <Table>
                <TableHeader className="border-b border-slate-800">
                  <TableRow className="hover:bg-transparent border-slate-800">
                    <TableHead className="text-slate-450 font-mono text-xs pl-6">Month</TableHead>
                    <TableHead className="text-slate-450 font-mono text-xs text-center">Bets Audited</TableHead>
                    <TableHead className="text-slate-450 font-mono text-xs text-center">Yield % (ROI)</TableHead>
                    <TableHead className="text-slate-450 font-mono text-xs text-right pr-6">Win Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentLogs.map((row) => (
                    <TableRow key={row.month} className="hover:bg-slate-850/40 border-slate-800/60 font-mono text-xs">
                      <TableCell className="py-4 pl-6 text-slate-300 font-semibold">{row.month}</TableCell>
                      <TableCell className="text-center py-4 text-slate-400">{row.bets}</TableCell>
                      <TableCell className="text-center py-4 text-emerald-450 font-bold">+{row.roi}%</TableCell>
                      <TableCell className="text-right py-4 pr-6 text-slate-300 font-semibold">{row.winRate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center font-mono text-xs text-slate-500">
                No monthly breakdown records available yet.
              </div>
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
              <h3 className="text-lg font-bold text-white">Historical ROI Analytics</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Available on Pro membership. Upgrade to view ensembled equity curve distributions, monthly breakdowns, and segment filters.
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
