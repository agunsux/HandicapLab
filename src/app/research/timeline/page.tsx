import React from 'react';
import Link from 'next/link';
import Navbar from '../../(marketing)/_components/Navbar';
import Footer from '../../(marketing)/_components/Footer';
import { Activity, ShieldCheck, ArrowLeft, GitCommit, CheckCircle2, Award, Cpu, LineChart, FileText, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Model Evolution Timeline | HandicapLab Research Institute',
  description: 'Visual step-by-step model evolution history from v1.0 Poisson to v3.0 Scientific Validation with rationale and metric impact.',
};

interface ModelStep {
  version: string;
  name: string;
  date: string;
  rationale: string;
  key_feature: string;
  metric_impact: string;
  paper_ref: string;
  status: string;
}

const evolutionSteps: ModelStep[] = [
  {
    version: 'v1.0',
    name: 'Poisson Baseline Model',
    date: 'Jan 2026',
    rationale: 'Establish baseline Independent Double Poisson goal expectation probabilities.',
    key_feature: 'Rolling 10-match home/away xG offensive & defensive parameters.',
    metric_impact: 'Brier Score: 0.2240 | Log Loss: 0.685',
    paper_ref: 'RP-001 Baseline Goal Modeling',
    status: 'DEPRECATED',
  },
  {
    version: 'v1.3',
    name: 'Dixon-Coles Dependence Engine',
    date: 'Mar 2026',
    rationale: 'Correct low-scoring goal dependence (0-0, 1-0, 0-1, 1-1) under-estimation.',
    key_feature: 'Bivariate dependence factor rho (-0.041) and time-decay weighting.',
    metric_impact: 'Brier Score: 0.2110 (5.8% imp) | ECE: 0.038',
    paper_ref: 'RP-004 Low-Score Covariance Correction',
    status: 'SUPERSEDED',
  },
  {
    version: 'v1.8',
    name: 'ELO & Travel Fatigue Integration',
    date: 'Apr 2026',
    rationale: 'Incorporate team momentum, FIFA window fatigue vectors, and venue rating deltas.',
    key_feature: 'Opponent-strength adjusted ELO ratings and travel distance decay.',
    metric_impact: 'Brier Score: 0.2045 (3.1% imp) | CLV: +2.4%',
    paper_ref: 'RP-008 Fatigue Vector Attenuation',
    status: 'SUPERSEDED',
  },
  {
    version: 'v2.2',
    name: 'Platt Scaling & Isotonic Calibration',
    date: 'Jun 2026',
    rationale: 'Transform raw model probabilities into calibrated empirical confidence intervals.',
    key_feature: 'Non-linear Platt scaling layer & cohort-specific derby calibration.',
    metric_impact: 'Brier Score: 0.1982 | ECE: 0.0145 (< 0.02 Target PASS)',
    paper_ref: 'RP-012 Probability Surface Calibration',
    status: 'ACTIVE PRODUCTION',
  },
  {
    version: 'v2.8',
    name: 'Market Intelligence & Pinnacle CLV',
    date: 'Jul 2026',
    rationale: 'Benchmark model implied odds against Pinnacle closing line price action.',
    key_feature: 'Closing Line Value (CLV) delta tracking & fractional Kelly staking.',
    metric_impact: 'CLV Alpha: +4.8% vs Pinnacle Closing Lines',
    paper_ref: 'RP-015 Market Efficiency Benchmarks',
    status: 'ACTIVE PRODUCTION',
  },
  {
    version: 'v3.0',
    name: 'Scientific Validation & Prediction DOI',
    date: 'Jul 2026 Milestone',
    rationale: 'HandicapLab v2 Milestone. Transition to Quantitative Research Institute.',
    key_feature: 'Immutable Prediction DOI (HLP-2026-EPL-000421), Trust Center, Hall of Mistakes.',
    metric_impact: '100% Verifiable | 100% Immutable Ledger | 0% Future Leakage',
    paper_ref: 'RP-020 Public Ledger Architecture',
    status: 'CURRENT MILESTONE',
  },
];

export default function ModelTimelinePage() {
  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-400 overflow-x-hidden antialiased">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/trust-center" className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-400 hover:text-emerald-400 mb-6 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Trust Center
        </Link>

        <div className="border-b border-zinc-800 pb-8">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-teal-400 uppercase tracking-widest bg-teal-500/10 px-3 py-1 rounded w-fit border border-teal-500/20">
            <Activity className="h-4 w-4" />
            Model Evolution Architecture
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mt-4 font-sans">
            Model Evolution History (v1.0 → v3.0)
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-3xl mt-3 leading-relaxed font-mono">
            Every model iteration is documented, benchmarked, and auditable. Track the progression of goal expectation engines, calibration curves, and market intelligence layers.
          </p>
        </div>

        {/* Visual Pipeline Stepper Diagram */}
        <div className="mt-10 bg-[#0d0e14] border border-zinc-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider mb-6 flex items-center gap-2">
            <Cpu className="h-4 w-4" /> Version Progression Pipeline
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center font-mono text-xs">
            {evolutionSteps.map((step, idx) => (
              <div key={step.version} className={`p-3 rounded-lg border flex flex-col justify-between ${
                step.status.includes('CURRENT')
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                  : step.status.includes('ACTIVE')
                    ? 'border-teal-500/30 bg-teal-500/5 text-teal-300'
                    : 'border-zinc-800 bg-[#12131b] text-zinc-400'
              }`}>
                <div>
                  <span className="text-[10px] text-zinc-500 block">{step.date}</span>
                  <span className="font-extrabold text-sm block mt-1">{step.version}</span>
                </div>
                <span className="text-[9px] font-bold mt-2 uppercase tracking-tight block">
                  {step.name.split(' ')[0]} {step.name.split(' ')[1] || ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Timeline Steps */}
        <div className="mt-10 space-y-6 font-mono text-xs">
          <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2 border-b border-zinc-800 pb-3">
            <FileText className="h-4 w-4 text-teal-400" /> Algorithmic Evolution Release Log
          </h2>

          {evolutionSteps.map((step) => (
            <div key={step.version} className={`bg-[#0d0e14] border rounded-xl p-6 space-y-4 shadow-lg ${
              step.status.includes('CURRENT') ? 'border-emerald-500/40' : 'border-zinc-800'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-extrabold text-white bg-zinc-900 border border-zinc-800 px-3 py-1 rounded">
                    {step.version}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 font-sans">{step.name}</h3>
                    <span className="text-[10px] text-zinc-500">Released: {step.date}</span>
                  </div>
                </div>

                <span className={`text-[10px] font-bold px-2.5 py-1 rounded border w-fit ${
                  step.status.includes('CURRENT')
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : step.status.includes('ACTIVE')
                      ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                      : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                }`}>
                  {step.status}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#12131b] p-3.5 rounded border border-zinc-800 space-y-1">
                  <span className="text-zinc-500 text-[10px] block uppercase">Rationale & Objective</span>
                  <p className="text-zinc-300 font-sans text-xs">{step.rationale}</p>
                </div>

                <div className="bg-[#12131b] p-3.5 rounded border border-zinc-800 space-y-1">
                  <span className="text-zinc-500 text-[10px] block uppercase">Core Feature Architecture</span>
                  <p className="text-zinc-300 font-sans text-xs">{step.key_feature}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-800 text-[11px]">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <LineChart className="h-3.5 w-3.5" />
                  <span>Metric Impact: {step.metric_impact}</span>
                </div>
                <span className="text-zinc-500 font-mono text-[10px]">
                  Reference Paper: <strong className="text-zinc-300">{step.paper_ref}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
