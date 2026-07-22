import React from 'react';
import Link from 'next/link';
import Navbar from '../../(marketing)/_components/Navbar';
import Footer from '../../(marketing)/_components/Footer';
import { ShieldCheck, Lock, CheckCircle2, FileText, ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Verification Policy | HandicapLab Trust Center',
  description: 'Independent verification policy and zero look-ahead data governance standards for HandicapLab predictions.',
};

export default function VerificationPolicyPage() {
  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-400 overflow-x-hidden antialiased">
      <Navbar />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/trust-center" className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-400 hover:text-emerald-400 mb-6 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Trust Center
        </Link>

        <div className="border-b border-zinc-800 pb-8">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded w-fit border border-emerald-500/20">
            <ShieldCheck className="h-4 w-4" />
            Governance Document
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mt-4 font-sans">
            Independent Verification Policy
          </h1>
          <p className="text-sm text-zinc-400 mt-2 font-mono">
            Effective Date: July 2026 | Version 2.0-Governance
          </p>
        </div>

        <div className="prose prose-invert max-w-none mt-8 font-sans space-y-8 text-zinc-300 text-sm leading-relaxed">
          <section className="bg-[#0d0e14] border border-zinc-800 p-6 rounded-xl space-y-3">
            <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-400" /> 1. The Immutability Principle
            </h2>
            <p>
              Every prediction published by HandicapLab is timestamped and recorded prior to match kickoff. Once written to the Public Ledger, predictions cannot be modified, edited, or deleted under any circumstances. The only allowed append action is post-match outcome settlement.
            </p>
          </section>

          <section className="bg-[#0d0e14] border border-zinc-800 p-6 rounded-xl space-y-3">
            <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-teal-400" /> 2. Zero Look-Ahead Bias Guarantee (LeakageGuard)
            </h2>
            <p>
              HandicapLab enforces an invariant data pipeline constraint: no model feature may consume data with a timestamp greater than or equal to the scheduled kickoff time of the predicted match. Any attempt to introduce post-kickoff data during validation or re-training will automatically trigger an internal audit alarm and halt signal generation.
            </p>
          </section>

          <section className="bg-[#0d0e14] border border-zinc-800 p-6 rounded-xl space-y-3">
            <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-400" /> 3. Prediction DOI & Cryptographic Signatures
            </h2>
            <p>
              Each published prediction is assigned a permanent identifier termed the <strong>Prediction DOI</strong> (e.g. <code>HLP-2026-EPL-000421</code>). Each entry contains a deterministic SHA-256 hash generated over the inputs (probability distributions, fair odds, EV calculation, and market parameters) to allow independent third-party cryptographic verification.
            </p>
          </section>

          <section className="bg-[#0d0e14] border border-zinc-800 p-6 rounded-xl space-y-3">
            <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-400" /> 4. Pinnacle Closing Line Value (CLV) Benchmarking
            </h2>
            <p>
              Model quality is measured against closing odds provided by Pinnacle. Closing line value (CLV) serves as our primary quantitative benchmark alongside Brier Score and Expected Calibration Error (ECE), ensuring transparent performance tracking against efficient market prices.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
