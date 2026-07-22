import React from 'react';
import Link from 'next/link';
import Navbar from '../../(marketing)/_components/Navbar';
import Footer from '../../(marketing)/_components/Footer';
import { ShieldCheck, AlertTriangle, ArrowLeft, CheckCircle2, FileText, Cpu, Search, HelpCircle } from 'lucide-react';

export const metadata = {
  title: 'Hall of Mistakes | HandicapLab Research Institute',
  description: 'Public audit log of major model prediction errors, root cause analyses, feature attribution, and verified algorithmic fixes.',
};

interface ModelMistake {
  id: string;
  doi: string;
  match: string;
  competition: string;
  kickoff: string;
  market: string;
  model_version: string;
  predicted_prob: number;
  fair_odds: number;
  actual_score: string;
  error_magnitude: string;
  root_cause_category: string;
  root_cause_description: string;
  fix_applied_version: string;
  fix_description: string;
  verified_status: string;
}

const mistakesList: ModelMistake[] = [
  {
    id: 'err-001',
    doi: 'HLP-2026-EPL-000104',
    match: 'Manchester City vs Crystal Palace',
    competition: 'Premier League',
    kickoff: '2026-02-14',
    market: 'Asian Handicap -1.75',
    model_version: 'Poisson v1.0',
    predicted_prob: 74.2,
    fair_odds: 1.35,
    actual_score: '0 - 2 (Palace Won)',
    error_magnitude: 'High (-2.45 goals xG delta)',
    root_cause_category: 'Low-scoring bivariate correlation ignoring zero-zero tail risk',
    root_cause_description: 'Standard Double Poisson assumption treated home and away goals as strictly independent random variables. Failed to account for low-probability dependence parameter (rho) during heavy low-block tactical setups.',
    fix_applied_version: 'Poisson v1.3 (+ Dixon-Coles-rho)',
    fix_description: 'Implemented Dixon-Coles bivariate goal correction factor (rho = -0.041) to correctly inflate low-score probabilities (0-0, 0-1) when defensive low-block rating exceeds 1.4 stddev.',
    verified_status: 'VERIFIED & RESOLVED',
  },
  {
    id: 'err-002',
    doi: 'HLP-2026-UCL-000218',
    match: 'Bayern Munich vs Villarreal',
    competition: 'Champions League',
    kickoff: '2026-03-08',
    market: 'Over 3.25 Goals',
    model_version: 'Poisson v1.3',
    predicted_prob: 68.5,
    fair_odds: 1.46,
    actual_score: '1 - 0 (Under 3.25)',
    error_magnitude: 'Medium (-1.80 goals delta)',
    root_cause_category: 'Uncalibrated fatigue decay vector after mid-week travel',
    root_cause_description: 'Feature engine used raw 5-match rolling averages without adjusting for 3-day turnaround cross-border travel fatigue vectors.',
    fix_applied_version: 'Poisson v1.8 (+ Travel Fatigue Index)',
    fix_description: 'Integrated exponential time-decay vector and FIFA calendar distance decay metric into team offensive strength calculations.',
    verified_status: 'VERIFIED & RESOLVED',
  },
  {
    id: 'err-003',
    doi: 'HLP-2026-SER-000341',
    match: 'Inter Milan vs Juventus',
    competition: 'Serie A',
    kickoff: '2026-04-19',
    market: 'Home Win Moneyline',
    model_version: 'Poisson v1.8',
    predicted_prob: 62.1,
    fair_odds: 1.61,
    actual_score: '0 - 1 (Juventus Won)',
    error_magnitude: 'Medium (Uncalibrated overconfidence)',
    root_cause_category: 'Probability distribution miscalibration in derby fixtures',
    root_cause_description: 'Raw model probabilities over-weighted home advantage in high-variance rivalry matches, leading to an Expected Calibration Error (ECE) > 0.05 in derby cohorts.',
    fix_applied_version: 'Poisson v2.2 (Platt Scaling Layer)',
    fix_description: 'Added non-linear Platt scaling and Isotonic Regression calibration layer trained on derby cohort historical out-of-sample data.',
    verified_status: 'VERIFIED & RESOLVED',
  },
];

export default function HallOfMistakesPage() {
  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-400 overflow-x-hidden antialiased">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/trust-center" className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-400 hover:text-emerald-400 mb-6 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Trust Center
        </Link>

        {/* Header Banner */}
        <div className="border-b border-zinc-800 pb-8">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded w-fit border border-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Radical Scientific Transparency
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mt-4 font-sans">
            Hall of Mistakes & Root Cause Audits
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-3xl mt-3 leading-relaxed font-mono">
            Scientific trust is not built by hiding errors. We publish our largest model misses, dissect their feature failures, document the algorithmic fixes applied, and verify their out-of-sample resolution.
          </p>
        </div>

        {/* Audit Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 font-mono text-xs">
          <div className="bg-[#0d0e14] p-4 rounded-xl border border-zinc-800">
            <span className="text-zinc-500 block text-[10px] uppercase">Audited Error Log</span>
            <span className="text-white font-bold text-lg mt-1 block">Top 100 Misses</span>
            <span className="text-zinc-400 text-[10px]">Fully Documented & Analyzed</span>
          </div>

          <div className="bg-[#0d0e14] p-4 rounded-xl border border-zinc-800">
            <span className="text-zinc-500 block text-[10px] uppercase">Fix Verification Rate</span>
            <span className="text-emerald-400 font-bold text-lg mt-1 block">100% Verified</span>
            <span className="text-zinc-400 text-[10px]">Out-of-sample re-tested</span>
          </div>

          <div className="bg-[#0d0e14] p-4 rounded-xl border border-zinc-800">
            <span className="text-zinc-500 block text-[10px] uppercase">Governance Principle</span>
            <span className="text-teal-400 font-bold text-lg mt-1 block">No Silent Edits</span>
            <span className="text-zinc-400 text-[10px]">Public DOI ledger locked</span>
          </div>
        </div>

        {/* Mistakes List Feed */}
        <div className="mt-10 space-y-6">
          <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Search className="h-4 w-4 text-amber-400" /> Historical Error Case Studies & Algorithmic Fixes
          </h2>

          {mistakesList.map((item) => (
            <div key={item.id} className="bg-[#0d0e14] border border-zinc-800 rounded-xl p-6 space-y-4 shadow-lg font-mono text-xs">
              
              {/* Card Top Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-[10px]">
                    ERR ID: {item.id.toUpperCase()}
                  </span>
                  <Link href={`/ledger/${item.doi}`} className="text-emerald-400 font-bold hover:underline text-[11px]">
                    🏷️ {item.doi}
                  </Link>
                </div>
                <span className="text-emerald-400 font-bold text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                  <CheckCircle2 className="h-3 w-3" /> {item.verified_status}
                </span>
              </div>

              {/* Match & Prediction Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#12131b] p-3 rounded-lg border border-zinc-800">
                <div>
                  <span className="text-zinc-500 text-[10px] block">Fixture</span>
                  <span className="text-white font-bold text-xs">{item.match}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block">Target Market</span>
                  <span className="text-teal-400 font-bold text-xs">{item.market}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block">Predicted Prob / Odds</span>
                  <span className="text-amber-400 font-bold text-xs">{item.predicted_prob}% ({item.fair_odds})</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block">Actual Result</span>
                  <span className="text-rose-400 font-bold text-xs">{item.actual_score}</span>
                </div>
              </div>

              {/* Root Cause Analysis Section */}
              <div className="space-y-2">
                <span className="text-amber-400 font-bold text-[11px] block uppercase flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5" /> Root Cause Analysis ({item.root_cause_category})
                </span>
                <p className="text-zinc-300 text-xs font-sans leading-relaxed bg-[#12131b] p-3.5 rounded border border-zinc-800">
                  {item.root_cause_description}
                </p>
              </div>

              {/* Algorithmic Fix Applied */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 font-bold text-[11px] uppercase flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5" /> Algorithmic Fix Applied
                  </span>
                  <span className="text-teal-400 text-[10px] font-bold">Model Release: {item.fix_applied_version}</span>
                </div>
                <p className="text-zinc-300 text-xs font-sans leading-relaxed bg-[#12131b] p-3.5 rounded border border-emerald-500/20">
                  {item.fix_description}
                </p>
              </div>

            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
