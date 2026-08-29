import React from 'react';
import Link from 'next/link';
import { getTerminalPredictions, getTerminalModels } from '@/lib/terminalData';
import { ResearchBanner } from '@/components/terminal/ResearchBanner';
import { PredictionCard } from '@/components/terminal/PredictionCard';
import { ArrowRight, BarChart3, Database, Shield, FileText } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const predictions = await getTerminalPredictions();
  const models = await getTerminalModels();

  const settled = predictions.filter((p) => p.settlement_status === 'SETTLED');
  const targetGate = 175;
  const gateProgress = Number(((settled.length / targetGate) * 100).toFixed(1));

  const totalProfit = settled.reduce((sum, p) => sum + (p.profit_loss || 0), 0);
  const realizedRoi = settled.length > 0 ? (totalProfit / settled.length) * 100 : 0;

  const clvValues = settled
    .map((p) => p.clv)
    .filter((c): c is number => c !== undefined && c !== null && !isNaN(c));
  const meanClv = clvValues.length > 0 ? clvValues.reduce((a, b) => a + b, 0) / clvValues.length : 0;

  const latestPredictions = predictions.slice(0, 10);

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E] font-sans text-[#F0FDF4]">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl pt-8 pb-16 flex-1">
        {/* Terminal Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-amber-400 mb-2">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                QUANTITATIVE RESEARCH TERMINAL &bull; LIVE FEED
              </div>
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight">
                HandicapLab
              </h1>
              <p className="text-sm text-[#9CA3AF] mt-1 max-w-2xl">
                Transparent sports analytics research terminal. Live out-of-sample model predictions, closing line value tracking, and empirical backtest audits.
              </p>
            </div>

            {/* Quick Links */}
            <div className="flex flex-wrap gap-2">
              <Link
                href="/predictions"
                className="px-3.5 py-2 rounded-lg bg-[#111827] border border-[#1F2937] hover:border-[#10B981] text-xs font-mono text-white hover:text-[#10B981] transition-all flex items-center gap-1.5"
              >
                <Database className="h-3.5 w-3.5" /> Predictions
              </Link>
              <Link
                href="/track-record"
                className="px-3.5 py-2 rounded-lg bg-[#111827] border border-[#1F2937] hover:border-[#10B981] text-xs font-mono text-white hover:text-[#10B981] transition-all flex items-center gap-1.5"
              >
                <BarChart3 className="h-3.5 w-3.5" /> Track Record
              </Link>
              <Link
                href="/models"
                className="px-3.5 py-2 rounded-lg bg-[#111827] border border-[#1F2937] hover:border-[#10B981] text-xs font-mono text-white hover:text-[#10B981] transition-all flex items-center gap-1.5"
              >
                <Shield className="h-3.5 w-3.5" /> Models
              </Link>
              <Link
                href="/methodology"
                className="px-3.5 py-2 rounded-lg bg-[#111827] border border-[#1F2937] hover:border-[#10B981] text-xs font-mono text-white hover:text-[#10B981] transition-all flex items-center gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" /> Methodology
              </Link>
            </div>
          </div>
        </div>

        {/* RESEARCH HONESTY BANNER (NON-DISMISSIBLE) */}
        <ResearchBanner />

        {/* LIVE METRICS ROW */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-6">
          <div className="bg-[#111827]/70 border border-[#1F2937] rounded-xl p-4">
            <span className="text-xs font-mono text-[#9CA3AF] uppercase">Total Predictions</span>
            <div className="text-2xl font-bold font-mono text-white mt-1">{predictions.length}</div>
            <span className="text-[11px] text-[#9CA3AF]">All logged shadow inferences</span>
          </div>

          <div className="bg-[#111827]/70 border border-[#1F2937] rounded-xl p-4">
            <span className="text-xs font-mono text-[#9CA3AF] uppercase">Validation Gate Progress</span>
            <div className="text-2xl font-bold font-mono text-amber-300 mt-1">
              {settled.length} <span className="text-xs text-[#9CA3AF] font-normal">/ {targetGate} target</span>
            </div>
            <div className="w-full bg-[#1F2937] h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-amber-400 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, gateProgress)}%` }}
              />
            </div>
          </div>

          <div className="bg-[#111827]/70 border border-[#1F2937] rounded-xl p-4">
            <span className="text-xs font-mono text-[#9CA3AF] uppercase">Realized Live ROI</span>
            <div
              className={`text-2xl font-bold font-mono mt-1 ${
                realizedRoi >= 0 ? 'text-[#10B981]' : 'text-red-400'
              }`}
            >
              {realizedRoi >= 0 ? `+${realizedRoi.toFixed(2)}%` : `${realizedRoi.toFixed(2)}%`}
            </div>
            <span className="text-[11px] text-[#9CA3AF]">Flat 1u staking out-of-sample</span>
          </div>

          <div className="bg-[#111827]/70 border border-[#1F2937] rounded-xl p-4">
            <span className="text-xs font-mono text-[#9CA3AF] uppercase">Mean Live CLV</span>
            <div
              className={`text-2xl font-bold font-mono mt-1 ${
                meanClv >= 0 ? 'text-[#10B981]' : 'text-neutral-400'
              }`}
            >
              {meanClv >= 0 ? `+${meanClv.toFixed(2)}%` : `${meanClv.toFixed(2)}%`}
            </div>
            <span className="text-[11px] text-[#9CA3AF]">Pinnacle closing price benchmark</span>
          </div>
        </div>

        {/* LATEST PREDICTIONS FEED */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Latest Model Inferences
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                Published out-of-sample predictions. Showing latest {latestPredictions.length} records.
              </p>
            </div>
            <Link
              href="/predictions"
              className="text-xs text-[#10B981] hover:text-[#10B981]/80 flex items-center gap-1 font-mono"
            >
              View Full Feed ({predictions.length}) <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {latestPredictions.length === 0 ? (
            <div className="bg-[#111827]/40 border border-[#1F2937] rounded-xl p-12 text-center text-[#9CA3AF]">
              <Database className="h-8 w-8 mx-auto mb-3 opacity-40 text-amber-400" />
              <p className="text-sm font-medium text-neutral-300">Awaiting live fixture predictions...</p>
              <p className="text-xs text-[#9CA3AF] mt-1 max-w-md mx-auto">
                No active prediction records currently in ledger. Predictions will appear once the automated shadow pipeline processes upcoming fixtures.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {latestPredictions.map((pred) => (
                <PredictionCard key={pred.id} prediction={pred} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
