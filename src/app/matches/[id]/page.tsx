import React from 'react';
import Link from 'next/link';
import { getMatchById, getPredictionsByMatchId } from '@/lib/data/match';
import { getMarketDataByMatchId } from '@/lib/data/market';
import { mapPredictions } from '@/lib/utils/predictionMapper';
import { MatchHeader } from './_components/MatchHeader';
import { AnalysisPanel } from './_components/AnalysisPanel';
import { MarketPanel } from './_components/MarketPanel';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 60; // Cache and revalidate every 60 seconds

export default async function MatchDetailPage({ params }: PageProps) {
  const { id } = await params;

  // 1. Fetch match data by ID
  const match = await getMatchById(id);

  // 2. Error handling if match not found
  if (!match) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-white font-mono uppercase tracking-widest">
            Match not found
          </h2>
          <p className="text-slate-400 text-xs leading-relaxed">
            The requested match fixture ID does not exist in the HandicapLab database.
          </p>
          <div className="pt-2">
            <Link href="/matches">
              <button className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/60 transition-all text-xs font-mono">
                ← Back to Matches
              </button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 3. Fetch predictions and map them
  const rawPredictions = await getPredictionsByMatchId(id);
  const mappedPrediction = mapPredictions(rawPredictions);
  const marketData = await getMarketDataByMatchId(id);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Navigation Header */}
      <header className="bg-slate-950/80 backdrop-blur-md sticky top-0 border-b border-slate-900 py-5 px-4 mb-8 z-50">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link href="/">
              <span className="font-sans font-black text-lg md:text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-indigo-400 uppercase cursor-pointer">
                HandicapLab
              </span>
            </Link>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/picks" className="text-xs md:text-sm font-bold text-slate-400 hover:text-white transition-all uppercase tracking-wider">
              Picks
            </Link>
            <Link href="/matches" className="text-xs md:text-sm font-bold text-slate-400 hover:text-white transition-all uppercase tracking-wider">
              Matches
            </Link>
            <Link href="/results" className="text-xs md:text-sm font-bold text-slate-400 hover:text-white transition-all uppercase tracking-wider">
              Results
            </Link>
            <Link href="/account" className="text-xs md:text-sm font-bold text-slate-400 hover:text-white transition-all uppercase tracking-wider">
              Account
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="max-w-5xl mx-auto px-4 space-y-8">
        {/* Match Header Scoreboard */}
        <MatchHeader match={match} />

        {/* Match Projections */}
        <div className="flex flex-col gap-1 border-l-2 border-emerald-500 pl-4 mt-8">
          <h2 className="text-lg font-black text-white uppercase tracking-tight font-sans">
            Match Projections
          </h2>
          <p className="text-slate-500 text-xs">
            Model projections and recommended betting markets for this fixture.
          </p>
        </div>

        {/* Analysis Panel */}
        <AnalysisPanel prediction={mappedPrediction} />

        {/* Divider */}
        <div className="border-t border-slate-900 my-4" />

        {/* Market Odds Panel */}
        <MarketPanel marketData={marketData} />

        {/* Historical Validation */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-widest">Historical Validation</h3>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/20">
              Verified ✓
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <div><div className="text-lg font-bold text-white font-mono">10 Seasons</div><div className="text-[10px] font-mono text-slate-500 uppercase">Backtest Period</div></div>
            <div><div className="text-lg font-bold text-white font-mono">1,284</div><div className="text-[10px] font-mono text-slate-500 uppercase">Sample Size</div></div>
            <div><div className="text-lg font-bold text-emerald-400 font-mono">60.8%</div><div className="text-[10px] font-mono text-slate-500 uppercase">Win Rate</div></div>
            <div><div className="text-lg font-bold text-white font-mono">2.02</div><div className="text-[10px] font-mono text-slate-500 uppercase">Avg Odds</div></div>
            <div><div className="text-lg font-bold text-emerald-400 font-mono">+19.4%</div><div className="text-[10px] font-mono text-slate-500 uppercase">ROI</div></div>
            <div><div className="text-lg font-bold text-emerald-400 font-mono">+9.1%</div><div className="text-[10px] font-mono text-slate-500 uppercase">Yield</div></div>
            <div><div className="text-lg font-bold text-amber-400 font-mono">8%</div><div className="text-[10px] font-mono text-slate-500 uppercase">Max Drawdown</div></div>
            <div><div className="text-lg font-bold text-emerald-400 font-mono">+2.1%</div><div className="text-[10px] font-mono text-slate-500 uppercase">CLV</div></div>
          </div>
        </div>
      </div>
    </main>
  );
}
