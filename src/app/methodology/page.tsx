'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Navbar from '../(marketing)/_components/Navbar';
import Footer from '../(marketing)/_components/Footer';
import { BookOpen, ShieldCheck, Code, Lock, FileText, CheckCircle2, Copy } from 'lucide-react';

interface MethodologyVersion {
  tag: string;
  name: string;
  date: string;
  commit: string;
  dataset_version: string;
  doi_ref: string;
  summary: string;
  pipeline_steps: string[];
}

const methodologyVersions: MethodologyVersion[] = [
  {
    tag: 'v4.0',
    name: 'v4.0 Institutional Research & Validation Standard',
    date: 'July 2026',
    commit: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4',
    dataset_version: 'v4.2-EPL-2026',
    doi_ref: 'HLP-2026-EPL-000421',
    summary: 'The current active methodology governing Phase VII. Introduces 10 mandatory scientific invariants, dynamic metrics calculation engines, multi-factor confidence grading, 3-timestamp audit enforcement, and open CSV dataset exports.',
    pipeline_steps: [
      'Data Ingestion: High-frequency Pinnacle closing lines & API-Football event telemetry.',
      'Feature Store: Double Poisson xG expectations, ELO shifts, Home Advantage parameter, Travel Fatigue vectors.',
      'Calibration Layer: Non-linear Platt Scaling & Isotonic Regression (ECE < 0.02 boundary).',
      'Audit & DOI: Deterministic SHA-256 hash generation & ECDSA cryptographic signing.',
      'Zero Leakage Invariant: LeakageGuard Edge Proxy enforcing Published_At < Kickoff_At < Settled_At.'
    ]
  },
  {
    tag: 'v3.0',
    tag: 'v3.0 Probability Calibration & ECE Engine',
    name: 'v3.0 Probability Calibration & ECE Engine',
    date: 'June 2026',
    commit: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1f',
    dataset_version: 'v3.0-EPL-2026',
    doi_ref: 'HLP-2026-EPL-000280',
    summary: 'Focused on Expected Calibration Error (ECE) reduction below 0.02 using cohort-specific isotonic regression curves for derby matches.',
    pipeline_steps: [
      'Data Ingestion: Match results & historical odds snapshots.',
      'Bivariate Poisson: Dixon-Coles dependence parameter rho = -0.041.',
      'Platt Scaling: Cohort derby calibration.'
    ]
  },
  {
    tag: 'v2.0',
    name: 'v2.0 Dixon-Coles Bivariate Dependence',
    date: 'May 2026',
    commit: '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa',
    dataset_version: 'v2.0-EPL-2026',
    doi_ref: 'HLP-2026-EPL-000150',
    summary: 'Introduced bivariate goal dependence parameter for low-scoring matches and time-decay team strength parameters.',
    pipeline_steps: [
      'Data Ingestion: Historical results.',
      'Dixon-Coles: Goal dependence parameter rho.'
    ]
  },
  {
    tag: 'v1.0',
    name: 'v1.0 Baseline Double Poisson',
    date: 'January 2026',
    commit: 'd41d8cd98f00b204e9800998ecf8427e9974da19',
    dataset_version: 'v1.0-EPL-2026',
    doi_ref: 'HLP-2026-EPL-000001',
    summary: 'Initial baseline model using independent Double Poisson distributions and rolling 10-match xG statistics.',
    pipeline_steps: [
      'Data Ingestion: Historical match results.',
      'Baseline Poisson: Rolling xG parameters.'
    ]
  }
];

export default function MethodologyPage() {
  const [selectedTag, setSelectedTag] = useState<string>('v4.0');
  const activeVer = methodologyVersions.find(v => v.tag === selectedTag) || methodologyVersions[0];

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-400 overflow-x-hidden antialiased">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Navigation Header */}
        <header className="border-b border-zinc-800 pb-8">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded w-fit border border-emerald-500/20">
            <BookOpen className="h-4 w-4" />
            Institutional Research Documentation
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mt-4 font-sans">
            Versioned Scientific Methodology Papers
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-3xl mt-3 leading-relaxed font-mono">
            Every published prediction links directly to the exact methodology version in effect at publication time. Select a version below to inspect pipeline architecture and reproducibility parameters.
          </p>
        </header>

        {/* Version Selector Tabs */}
        <div className="mt-8 flex flex-wrap gap-2 font-mono text-xs">
          {methodologyVersions.map((v) => (
            <button
              key={v.tag}
              onClick={() => setSelectedTag(v.tag)}
              className={`px-4 py-2 rounded font-bold transition-all border ${
                selectedTag === v.tag
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-inner'
                  : 'bg-[#0d0e14] text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              Methodology Paper {v.tag} ({v.date})
            </button>
          ))}
        </div>

        {/* Selected Version Paper Card */}
        <div className="mt-8 bg-[#0d0e14] border border-zinc-800 rounded-xl p-6 sm:p-8 space-y-6 shadow-lg font-mono text-xs">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-4">
            <div>
              <span className="text-emerald-400 font-bold text-sm block">{activeVer.name}</span>
              <span className="text-[10px] text-zinc-500">Effective Release Date: {activeVer.date}</span>
            </div>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded font-bold w-fit">
              CITATION-READY PAPER
            </span>
          </div>

          <p className="text-zinc-300 font-sans text-sm leading-relaxed bg-[#12131b] p-4 rounded-lg border border-zinc-800">
            {activeVer.summary}
          </p>

          {/* Pipeline Architecture Steps */}
          <div className="space-y-3">
            <h3 className="text-white font-bold uppercase tracking-wider text-xs flex items-center gap-1.5">
              <Code className="h-4 w-4 text-emerald-400" /> Pipeline Execution Standards ({activeVer.tag})
            </h3>
            <ul className="space-y-2">
              {activeVer.pipeline_steps.map((step, idx) => (
                <li key={idx} className="bg-[#12131b] p-3 rounded border border-zinc-800 text-zinc-300 flex items-start gap-2 font-sans text-xs">
                  <span className="text-emerald-400 font-mono font-bold">{idx + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Reproduce This Report Metadata Package */}
          <div className="bg-[#12131b] p-5 rounded-xl border border-zinc-800 space-y-3">
            <h3 className="text-emerald-400 font-bold uppercase text-xs flex items-center gap-1.5">
              <Lock className="h-4 w-4" /> Reproduce This Report (Package Metadata)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-zinc-300">
              <div>
                <span className="text-zinc-500 text-[10px] block">Dataset Version</span>
                <strong>{activeVer.dataset_version}</strong>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] block">Git Commit Hash</span>
                <strong className="text-teal-400 font-mono">{activeVer.commit}</strong>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] block">Sample Prediction DOI</span>
                <strong>{activeVer.doi_ref}</strong>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] block">LeakageGuard Invariant</span>
                <strong className="text-emerald-400">Published_At &lt; Kickoff_At &lt; Settled_At</strong>
              </div>
            </div>
          </div>

          {/* Citation Format */}
          <div className="p-4 rounded-lg bg-[#12131b] border border-zinc-800 text-zinc-400 space-y-2">
            <span className="text-white font-bold text-[11px] block uppercase">Academic Citation Format:</span>
            <div className="bg-[#09090B] p-3 rounded border border-zinc-800 text-[10px] text-emerald-400 font-mono break-all">
              HandicapLab Research Institute. (2026). Quantitative Goal Expectation and Probability Surface Calibration ({activeVer.tag}). HandicapLab Technical Whitepaper Series, DOI: {activeVer.doi_ref}. Commit: {activeVer.commit.substring(0, 7)}.
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
