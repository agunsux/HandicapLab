import React from 'react';
import { Target, ShieldCheck, Database, FileWarning } from 'lucide-react';
import { loadAhResearchViewModel } from '@/lib/research/ah-yield/ahViewModel';
import { AhResearchDashboard } from './AhResearchDashboard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Asian Handicap Yield Research — HandicapLab',
  description:
    'Realized Asian Handicap yield, ROI, settlement-aware fair odds and expected value computed from real historical odds and results.',
};

export default async function AhYieldResearchPage() {
  const view = loadAhResearchViewModel();

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E] text-[#F0FDF4]">
      <div className="border-b border-[#1F2937] bg-[#0E1413] pt-28 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-[#10B981] mb-3">
            <Target className="h-3.5 w-3.5" />
            ASIAN HANDICAP &bull; YIELD ENGINE
          </div>
          <h1 className="text-3xl sm:text-5xl font-display font-black text-white tracking-tight">
            AH Yield Research
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-2 max-w-3xl leading-relaxed">
            For every Asian Handicap line and side: realized P&amp;L and yield from actual historical market odds,
            settlement-aware model probability, fair odds and expected value — with sample-size protection and
            walk-forward validation. No synthetic odds, no fabricated performance.
          </p>
          {view && (
            <div className="flex flex-wrap items-center gap-3 mt-6 text-xs font-mono">
              <span className="px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1F2937] text-neutral-300">
                Engine: <strong className="text-white">{view.engineVersion}</strong>
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1F2937] text-neutral-300">
                Generated: <strong className="text-white">{view.generatedAt.slice(0, 19).replace('T', ' ')} UTC</strong>
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1F2937] text-neutral-300">
                Headline cohort: <strong className="text-[#10B981]">{view.headlineCohortKey}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12 w-full">
        {!view && (
          <div className="p-6 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 font-mono text-sm space-y-2">
            <div className="flex items-center gap-2 text-base font-bold">
              <FileWarning className="h-5 w-5" />
              DATA NOT AVAILABLE
            </div>
            <p>
              The AH yield report artifact has not been generated. No numbers are shown because none exist.
              Generate it from the frozen real dataset with:
            </p>
            <code className="block px-3 py-2 rounded bg-[#0B0F0E] border border-amber-500/30 text-amber-200">
              npm run ah:yield
            </code>
          </div>
        )}

        {view && (
          <>
            <div className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937] flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-[#10B981] mt-0.5 shrink-0" />
              <div className="text-xs font-mono text-[#9CA3AF] leading-relaxed">
                <p className="text-white font-bold mb-1">Methodology in one paragraph</p>
                <p>{view.methodology.yield} {view.methodology.probability}</p>
                <p className="mt-1">{view.methodology.fairOdds} {view.methodology.ev}</p>
              </div>
            </div>

            <AhResearchDashboard view={view} />

            <div className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937] flex items-start gap-3">
              <Database className="h-5 w-5 text-[#10B981] mt-0.5 shrink-0" />
              <div className="text-xs font-mono text-[#9CA3AF] leading-relaxed">
                Every aggregate on this page is traceable to individual bet observations through the engine
                (<code>src/lib/research/ah-yield/</code>), the validation runner
                (<code>scripts/ah-yield-validation.ts</code>) and the JSON artifact at
                <code> data/verification/AH_YIELD_ENGINE_REPORT.json</code>. Regression suite:
                <code> npm run test:ah-yield</code>.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
