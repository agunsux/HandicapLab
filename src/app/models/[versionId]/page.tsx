import React from 'react';
import Link from 'next/link';
import { getTerminalModels, getTerminalPredictions } from '@/lib/terminalData';
import { ResearchBanner } from '@/components/terminal/ResearchBanner';
import { PredictionCard } from '@/components/terminal/PredictionCard';
import { ArrowLeft, Cpu, ShieldAlert, CheckCircle2, Lock } from 'lucide-react';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ versionId: string }>;
}

export default async function ModelDetailPage({ params }: PageProps) {
  const { versionId } = await params;
  const decodedId = decodeURIComponent(versionId);

  const models = await getTerminalModels();
  const model = models.find((m) => m.id === decodedId || m.id === versionId);

  if (!model) {
    notFound();
  }

  const allPredictions = await getTerminalPredictions();
  const modelPredictions = allPredictions.filter((p) => p.model_version === model.id);
  const isChampion = model.id === 'AH-dixoncoles-v1.0.0';

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E] font-sans text-[#F0FDF4]">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl pt-8 pb-16 flex-1">
        <Link
          href="/models"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-[#9CA3AF] hover:text-white mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Model Registry
        </Link>

        {/* Model Header Card */}
        <div className="bg-[#111827]/80 border border-[#1F2937] rounded-xl p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span className="text-xs font-mono text-[#9CA3AF]">
              Market Scope: <strong className="text-white">{model.market_scope}</strong>
            </span>
            <div className="flex items-center gap-2">
              {isChampion && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-mono font-medium bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                  <CheckCircle2 className="h-3.5 w-3.5" /> LIVE CHAMPION
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-mono font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <ShieldAlert className="h-3.5 w-3.5" /> {model.validation_state}
              </span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white font-mono mb-2">
            {model.id}
          </h1>
          <p className="text-sm text-neutral-300 leading-relaxed max-w-3xl">
            {model.architecture_description}
          </p>

          <div className="bg-[#0B0F0E] p-4 rounded-lg border border-[#1F2937] mt-4 text-xs font-mono">
            <span className="text-[#9CA3AF] text-[10px] uppercase block mb-1">Scientific Hypothesis</span>
            <p className="text-neutral-200">{model.hypothesis}</p>
          </div>
        </div>

        {/* HONESTY BANNER */}
        <ResearchBanner />

        {/* Backtest Metrics Deep-Dive */}
        <div className="bg-[#111827]/60 border border-[#1F2937] rounded-xl p-6 my-6">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2 font-mono">
            <Cpu className="h-4 w-4 text-amber-400" /> Historical Calibration Tournament Results (EPIC 56)
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono mb-6">
            <div className="bg-[#0B0F0E] p-3 rounded-lg border border-[#1F2937]">
              <span className="text-[#9CA3AF] text-[10px] block">REALIZED ROI</span>
              <span className="text-lg font-bold text-red-400">{model.backtest_realized_roi.toFixed(2)}%</span>
            </div>
            <div className="bg-[#0B0F0E] p-3 rounded-lg border border-[#1F2937]">
              <span className="text-[#9CA3AF] text-[10px] block">CLV MEAN</span>
              <span className="text-lg font-bold text-white">
                {model.backtest_clv_mean >= 0 ? `+${model.backtest_clv_mean.toFixed(4)}` : model.backtest_clv_mean.toFixed(4)}
              </span>
            </div>
            <div className="bg-[#0B0F0E] p-3 rounded-lg border border-[#1F2937]">
              <span className="text-[#9CA3AF] text-[10px] block">CLV P-VALUE</span>
              <span className="text-lg font-bold text-neutral-300">p={model.backtest_clv_pvalue.toFixed(3)}</span>
            </div>
            <div className="bg-[#0B0F0E] p-3 rounded-lg border border-[#1F2937]">
              <span className="text-[#9CA3AF] text-[10px] block">SAMPLE SIZE</span>
              <span className="text-lg font-bold text-white">{model.backtest_n_bets.toLocaleString()} bets</span>
            </div>
          </div>

          {/* Frozen Parameters */}
          <div className="border-t border-[#1F2937] pt-4">
            <div className="flex items-center gap-2 text-xs font-mono text-[#9CA3AF] mb-2">
              <Lock className="h-3.5 w-3.5 text-amber-400" />
              <span>FROZEN PARAMETERS (IMMUTABLE DATABASE RECORD)</span>
            </div>
            <pre className="bg-[#0B0F0E] p-4 rounded-lg border border-[#1F2937] text-xs font-mono text-neutral-300 overflow-x-auto">
              {JSON.stringify(model.frozen_parameters, null, 2)}
            </pre>
          </div>
        </div>

        {/* Generated Predictions by this Model */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-white mb-2">
            Live Predictions Generated by {model.id}
          </h2>
          <p className="text-xs text-[#9CA3AF] mb-4">
            Audited out-of-sample predictions registered for this model version.
          </p>

          {modelPredictions.length === 0 ? (
            <div className="bg-[#111827]/40 border border-[#1F2937] rounded-xl p-10 text-center text-xs text-[#9CA3AF]">
              No predictions currently in ledger for this model variant.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {modelPredictions.map((pred) => (
                <PredictionCard key={pred.id} prediction={pred} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
