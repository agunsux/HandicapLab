import React from 'react';
import Link from 'next/link';
import { ResearchBanner } from '@/components/terminal/ResearchBanner';
import { FileText, Cpu, Calculator, ShieldCheck, AlertTriangle, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Methodology & Scientific Rigor — HandicapLab',
  description: 'Mathematical foundations: Dixon-Coles goal expectation, Expected Value (EV), Closing Line Value (CLV), and research governance.',
};

export default function MethodologyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E] font-sans text-[#F0FDF4]">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl pt-8 pb-16 flex-1">
        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-amber-400 mb-2">
            <FileText className="h-3.5 w-3.5" />
            SCIENTIFIC METHODOLOGY &amp; RESEARCH GOVERNANCE
          </div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">
            Research Foundations
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            HandicapLab operates as an empirical sports analytics research terminal. We reject black-box betting tipster models in favor of rigorous statistical evaluation.
          </p>
        </div>

        {/* HONESTY BANNER */}
        <ResearchBanner />

        {/* Sections */}
        <div className="space-y-8 mt-8 text-neutral-300 text-sm leading-relaxed">
          {/* Section 1: Dixon-Coles Model */}
          <section className="bg-[#111827]/60 border border-[#1F2937] rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Cpu className="h-5 w-5 text-amber-400" />
              1. The Dixon-Coles Bivariate Poisson Model
            </h2>
            <p className="mb-3">
              Standard Poisson models assume independence between home and away goals scored. However, empirical football research (Dixon &amp; Coles, 1997) shows low scores (0-0, 1-0, 0-1, 1-1) exhibit significant interdependence.
            </p>
            <p className="mb-3">
              Our model applies a bivariate correction factor &rho; (rho) to adjust probability density for low-scoring scorelines:
            </p>
            <div className="bg-[#0B0F0E] p-4 rounded-lg border border-[#1F2937] font-mono text-xs text-amber-200 my-3">
              &tau;(x, y) = 1 - &lambda;&mu;&rho; (for 0-0), 1 + &mu;&rho; (for 1-0), 1 + &lambda;&rho; (for 0-1), 1 - &rho; (for 1-1)
            </div>
            <p>
              In our EPIC 56 calibration tournament, &rho; was fitted per out-of-sample walk-forward fold, locking champion parameter &rho; = -0.05.
            </p>
          </section>

          {/* Section 2: Expected Value & Closing Line Value */}
          <section className="bg-[#111827]/60 border border-[#1F2937] rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-[#10B981]" />
              2. Expected Value (EV), CLV &amp; Brier Score
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-white text-sm mb-1">Expected Value (EV)</h3>
                <p>
                  EV computes the mathematical return per unit staked across all settlement states (Full Win, Half Win, Push, Half Loss, Full Loss). An edge exists only when model fair probability exceeds devigged market probability.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-white text-sm mb-1">Closing Line Value (CLV)</h3>
                <p>
                  Closing Line Value measures whether taken odds exceed the final closing price at kickoff, using Pinnacle as the ground-truth benchmark. Beating the closing line is the gold standard for statistical edge in liquid markets.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-white text-sm mb-1">Brier Calibration Score</h3>
                <p>
                  We measure probabilistic accuracy using the Brier score, penalizing overconfidence and rewarding well-calibrated probabilities.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: What NOT_VALIDATED Means */}
          <section className="bg-[#111827]/60 border border-[#1F2937] rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              3. What &quot;NOT VALIDATED&quot; Means
            </h2>
            <p className="mb-3">
              In our historical backtest spanning 2015-2026 across European leagues (7,225 matches), the champion Dixon-Coles model achieved:
            </p>
            <ul className="list-disc list-inside space-y-1.5 font-mono text-xs text-neutral-200 bg-[#0B0F0E] p-4 rounded-lg border border-[#1F2937] my-3">
              <li>Realized ROI: <strong>-2.30%</strong> (flat unit staking)</li>
              <li>Mean CLV: <strong>-0.0311%</strong> (not statistically significant, p=0.555)</li>
              <li>Status: <strong>RESEARCH_ONLY / NOT_VALIDATED</strong></li>
            </ul>
            <p>
              Because the model does not beat the bookmaker margin after vig, we publish all inferences openly for scientific research and live track-record compilation, without claiming betting profitability.
            </p>
          </section>

          {/* Section 4: Data Governance & Provenance */}
          <section id="governance" className="bg-[#111827]/60 border border-[#1F2937] rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              4. Data Governance, Provenance &amp; Free-First Architecture
            </h2>
            <p className="mb-4">
              HandicapLab enforces an uncompromising <strong>Zero-Synthetic Data Invariant</strong>. We separate all analytical assets into three verifiable data classes:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs mb-4">
              <div className="bg-[#0B0F0E] p-3.5 rounded-lg border border-[#1F2937]">
                <span className="text-emerald-400 font-bold block mb-1">Class A: Match Facts</span>
                <p className="text-neutral-300 text-[11px] leading-relaxed">
                  Final scorelines (FTHG, FTAG), kickoff dates, and team identities sourced from API-Football and Football-Data.co.uk. Absolute ground truth.
                </p>
              </div>
              <div className="bg-[#0B0F0E] p-3.5 rounded-lg border border-[#1F2937]">
                <span className="text-purple-400 font-bold block mb-1">Class B: Derived Outcomes</span>
                <p className="text-neutral-300 text-[11px] leading-relaxed">
                  Deterministic outcome resolution: Over/Under 2.5 (FTHG + FTAG) and BTTS (FTHG &gt; 0 &amp;&amp; FTAG &gt; 0). Evaluates probability calibration directly against pitch facts without synthetic odds.
                </p>
              </div>
              <div className="bg-[#0B0F0E] p-3.5 rounded-lg border border-[#1F2937]">
                <span className="text-blue-400 font-bold block mb-1">Class C: Market Prices</span>
                <p className="text-neutral-300 text-[11px] leading-relaxed">
                  Historical closing odds (Pinnacle PCAHH / PC&gt;2.5 from Football-Data.co.uk) and live market feeds (OddsPAPI v4). Used strictly for CLV benchmarking and EV calculation.
                </p>
              </div>
            </div>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              <strong>Honest Research Disclosure:</strong> In historical backtests, Asian Handicap lines and Over/Under 2.5 lines have full Pinnacle closing price coverage. Both Teams to Score (BTTS) and alternate totals are evaluated on Class B match-fact distributions for statistical calibration; live BTTS signals activate only when real bookmaker prices meet our minimum edge threshold.
            </p>
          </section>

          {/* Section 5: Responsible Gambling Disclaimer */}
          <section className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 text-amber-200">
            <h2 className="text-base font-bold text-amber-300 mb-2 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
              Responsible Gambling Notice
            </h2>
            <p className="text-xs leading-relaxed">
              This is a research project. Nothing here constitutes betting advice. Past performance does not guarantee future results. All content is for informational and educational purposes only. Gamble responsibly and only where legal.
            </p>
          </section>

          {/* Link to Model Registry */}
          <div className="pt-4 flex items-center justify-between border-t border-[#1F2937]">
            <span className="text-xs font-mono text-[#9CA3AF]">
              Explore tested model variants and parameters:
            </span>
            <Link
              href="/models"
              className="text-xs font-mono text-[#10B981] hover:text-[#10B981]/80 flex items-center gap-1.5 font-bold"
            >
              Model Registry <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
