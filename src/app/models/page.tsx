import React from 'react';
import Link from 'next/link';
import { getTerminalModels } from '@/lib/terminalData';
import { ResearchBanner } from '@/components/terminal/ResearchBanner';
import { Cpu, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Model Registry & Calibration Tournament — HandicapLab',
  description: 'Audited model architectures, frozen parameters, and empirical calibration metrics from EPIC 56 tournament.',
};

export default async function ModelsPage() {
  const models = await getTerminalModels();

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E] font-sans text-[#F0FDF4]">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl pt-8 pb-16 flex-1">
        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-amber-400 mb-2">
            <Cpu className="h-3.5 w-3.5" />
            MATHEMATICAL MODEL REGISTRY
          </div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">
            Tournament Model Variants
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-1 max-w-2xl">
            Append-only model registry. All parameters, backtest metrics, and calibration scores are immutable and publicly audited.
          </p>
        </div>

        {/* HONESTY BANNER */}
        <ResearchBanner />

        {/* Models Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
          {models.map((model, idx) => {
            const isChampion = model.id === 'AH-dixoncoles-v1.0.0';

            return (
              <div
                key={model.id}
                className="bg-[#111827]/70 border border-[#1F2937] hover:border-[#374151] rounded-xl p-6 flex flex-col justify-between transition-all"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs text-[#9CA3AF]">
                      Scope: <strong className="text-white">{model.market_scope}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      {isChampion && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                          <CheckCircle2 className="h-3 w-3" /> CURRENTLY LIVE
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <ShieldAlert className="h-3 w-3" /> {model.validation_state}
                      </span>
                    </div>
                  </div>

                  {/* Title & Architecture */}
                  <h2 className="text-lg font-bold text-white font-mono mb-1">
                    {model.id}
                  </h2>
                  <p className="text-xs text-neutral-300 font-sans leading-relaxed mb-3">
                    {model.architecture_description}
                  </p>

                  <div className="bg-[#0B0F0E] p-3 rounded-lg border border-[#1F2937] mb-4 text-xs font-mono">
                    <span className="text-[#9CA3AF] text-[10px] uppercase block mb-1">Hypothesis</span>
                    <p className="text-neutral-200">{model.hypothesis}</p>
                  </div>

                  {/* Metrics Table */}
                  <div className="grid grid-cols-3 gap-2 bg-[#0B0F0E] p-3 rounded-lg border border-[#1F2937] text-xs font-mono mb-4">
                    <div>
                      <span className="text-[#9CA3AF] text-[10px] block">BACKTEST ROI</span>
                      <span className="text-sm font-bold text-red-400">
                        {model.backtest_realized_roi.toFixed(2)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[#9CA3AF] text-[10px] block">CLV MEAN</span>
                      <span className="text-sm font-bold text-white">
                        {model.backtest_clv_mean >= 0
                          ? `+${model.backtest_clv_mean.toFixed(4)}`
                          : model.backtest_clv_mean.toFixed(4)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#9CA3AF] text-[10px] block">CLV P-VAL</span>
                      <span className="text-sm font-bold text-neutral-300">
                        p={model.backtest_clv_pvalue.toFixed(3)}
                      </span>
                    </div>
                  </div>

                  {/* Frozen Parameters Snippet */}
                  <div className="text-[11px] font-mono text-[#9CA3AF] bg-[#1F2937]/40 p-2.5 rounded border border-[#1F2937]">
                    <span className="text-[#9CA3AF] uppercase block text-[10px] mb-1">Frozen Parameters (Immutable)</span>
                    <code>{JSON.stringify(model.frozen_parameters)}</code>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-[#1F2937] flex items-center justify-between">
                  <span className="text-xs font-mono text-[#9CA3AF]">
                    Tested: <strong>{model.backtest_n_bets.toLocaleString()}</strong> bets
                  </span>
                  <Link
                    href={`/models/${model.id}`}
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono"
                  >
                    View Model Audit <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
