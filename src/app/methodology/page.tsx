'use client';

import React from 'react';
import Link from 'next/link';

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-black text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Navigation Header */}
        <header className="mb-10 border-b border-slate-900 pb-8">
          <div className="flex items-center gap-3 mb-2 text-xs font-semibold uppercase tracking-wider text-blue-500">
            <Link href="/signals" className="hover:text-blue-400">Signals Feed</Link>
            <span>/</span>
            <span className="text-slate-400">Model Methodology</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white">
            Model Architecture & Methodology
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            A comprehensive, transparent review of how HandicapLab processes data, tracks market movements, and identifies statistical discrepancies.
          </p>
        </header>

        {/* Core Methodology Content */}
        <div className="space-y-10 text-slate-300 leading-relaxed text-sm">
          
          {/* Section 1: Data Ingestion & Sources */}
          <section className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider">
              1. Real-Time Data Ingestion
            </h2>
            <p className="mb-4">
              HandicapLab leverages high-frequency API connections to collect global football statistics and bookmaker market updates. Our pipeline ingests data across the following core areas:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-450">
              <li><strong>Match Context</strong>: Full historical results, dynamic ELO ratings, league rankings, and kickoff details.</li>
              <li><strong>Market Consensus Odds</strong>: Multi-provider market quotes gathered from key bookmakers at exact, timestamped snapshots.</li>
              <li><strong>Closing Odds & Limits</strong>: Closing lines captured precisely at match kickoff to calculate Closing Line Value (CLV).</li>
            </ul>
          </section>

          {/* Section 2: Market Focus & Selection */}
          <section className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider">
              2. Core Football Markets
            </h2>
            <p className="mb-4">
              We focus strictly on the most liquid football markets. This maximizes entry opportunities while ensuring that the model recommendations are achievable in practice:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-slate-950 border border-slate-850 p-4 rounded">
                <span className="text-blue-500 font-bold block mb-2">Asian Handicap</span>
                <p className="text-xs text-slate-400">
                  Leveling the field by assigning positive or negative goal spreads, eliminating draw possibilities or providing fractional refunds.
                </p>
              </div>
              <div className="bg-slate-950 border border-slate-850 p-4 rounded">
                <span className="text-blue-500 font-bold block mb-2">Over / Under</span>
                <p className="text-xs text-slate-400">
                  Predicting whether the combined goal score of both teams will be above or below a specific fractional goal threshold.
                </p>
              </div>
              <div className="bg-slate-950 border border-slate-850 p-4 rounded">
                <span className="text-blue-500 font-bold block mb-2">Moneyline (1X2)</span>
                <p className="text-xs text-slate-400">
                  Standard match result forecasting: Home Win, Draw, or Away Win based on statistical probability models.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: CLV & Edge Tracking */}
          <section className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider">
              3. Edge Calculation & CLV
            </h2>
            <p className="mb-4">
              A key component of our model is the estimation of the probability edge. An edge is identified when our model's calculated fair probability indicates that the bookmaker's offered odds are statistically mispriced:
            </p>
            <div className="bg-slate-950 border border-slate-850 p-4 rounded mb-4 font-mono text-xs text-slate-400">
              Edge % = (Model Probability * Market Odds) - 1
            </div>
            <p className="mb-4">
              <strong>Closing Line Value (CLV)</strong> is our primary metric for verifying model quality. CLV measures the change in odds from the moment a signal is created to the kickoff closing line:
            </p>
            <p className="text-slate-450">
              Consistently beating the closing line is the single most reliable indicator of long-run profitability in sports modeling. If the closing odds are lower than our entry odds, we have captured positive CLV.
            </p>
          </section>

          {/* Section 4: Confidence & Settlement */}
          <section className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider">
              4. Signal Confidence & Settlement
            </h2>
            <p className="mb-4">
              Every generated signal goes through a strict verification lifecycle:
            </p>
            <ul className="list-decimal pl-5 space-y-2 mb-4 text-slate-450">
              <li><strong>SIGNAL_CREATED</strong>: Inital model probability edge detected above threshold.</li>
              <li><strong>ODDS_CAPTURED / LINE_MOVED</strong>: High-frequency logging of price fluctuations.</li>
              <li><strong>SIGNAL_LOCKED</strong>: Automated protection locks the signal once kickoff begins to prevent late entries.</li>
              <li><strong>SIGNAL_SETTLED</strong>: Settlement engine resolves outcomes and calculates returns using verified Match Results.</li>
            </ul>
            <p className="text-slate-450 mt-4">
              <strong>Confidence Scoring</strong>: Signals are graded as HIGH, MEDIUM, or LOW based on sample size thresholds and model calibration historical consistency. Calibration ensures that a 60% probability prediction wins exactly 60% of the time in the long run.
            </p>
          </section>

          {/* Risk Disclaimer */}
          <footer className="border-t border-slate-900 pt-6 text-xs text-slate-500">
            <p className="mb-2">
              <strong>Statistical Disclaimer</strong>: Sports modeling involves probabilistic forecasts. Past performance results, equity simulation graphs, and calibration metrics are historical indications and do not guarantee future returns. No betting guarantees are made. Always apply responsible bankroll management.
            </p>
          </footer>

        </div>
        
      </div>
    </div>
  );
}
