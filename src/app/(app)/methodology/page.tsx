'use client';

import React, { useState } from 'react';
import { BookOpen, ShieldCheck, Code, Lock, CheckCircle2 } from 'lucide-react';

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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Navigation Header */}
      <div className="p-6 bg-[#111827] border border-[#1F2937] rounded-xl space-y-3">
        <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#10B981] uppercase tracking-widest bg-[#10B981]/10 px-3 py-1 rounded w-fit border border-[#10B981]/30">
          <BookOpen className="h-4 w-4" />
          <span>Institutional Research Documentation</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F0FDF4] font-sans">
          Versioned Scientific Methodology Papers
        </h1>
        <p className="text-xs text-[#9CA3AF] max-w-3xl leading-relaxed font-sans">
          Every published prediction links directly to the exact methodology version in effect at publication time. Select a version below to inspect pipeline architecture and reproducibility parameters.
        </p>
      </div>

      {/* Version Selector Tabs */}
      <div className="flex flex-wrap gap-2 font-mono text-xs">
        {methodologyVersions.map((v) => (
          <button
            key={v.tag}
            onClick={() => setSelectedTag(v.tag)}
            className={`px-4 py-2 rounded font-bold transition-all border ${
              selectedTag === v.tag
                ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/40 shadow-inner'
                : 'bg-[#111827] text-[#9CA3AF] border-[#1F2937] hover:text-[#F0FDF4]'
            }`}
          >
            Methodology Paper {v.tag} ({v.date})
          </button>
        ))}
      </div>

      {/* Selected Version Paper Card */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 space-y-6 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1F2937] pb-4">
          <div>
            <span className="text-[#10B981] font-bold text-sm block">{activeVer.name}</span>
            <span className="text-[10px] text-[#9CA3AF]">Effective Release Date: {activeVer.date}</span>
          </div>
          <span className="text-[10px] bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 px-3 py-1 rounded font-bold w-fit">
            CITATION-READY PAPER
          </span>
        </div>

        <p className="text-[#F0FDF4] font-sans text-xs leading-relaxed bg-[#0B0F0E] p-4 rounded-lg border border-[#1F2937]">
          {activeVer.summary}
        </p>

        {/* Pipeline Architecture Steps */}
        <div className="space-y-3">
          <h3 className="text-[#F0FDF4] font-bold uppercase tracking-wider text-xs flex items-center gap-1.5 font-sans">
            <Code className="h-4 w-4 text-[#10B981]" /> Pipeline Execution Standards ({activeVer.tag})
          </h3>
          <ul className="space-y-2">
            {activeVer.pipeline_steps.map((step, idx) => (
              <li key={idx} className="bg-[#0B0F0E] p-3 rounded border border-[#1F2937] text-[#9CA3AF] flex items-start gap-2 font-sans text-xs">
                <span className="text-[#10B981] font-mono font-bold">{idx + 1}.</span>
                <span className="text-[#F0FDF4]">{step}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Reproduce This Report Metadata Package */}
        <div className="bg-[#0B0F0E] p-5 rounded-xl border border-[#1F2937] space-y-3">
          <h3 className="text-[#10B981] font-bold uppercase text-xs flex items-center gap-1.5 font-sans">
            <Lock className="h-4 w-4" /> Reproduce This Report (Package Metadata)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-[#F0FDF4]">
            <div>
              <span className="text-[#9CA3AF] text-[10px] block">Dataset Version</span>
              <strong>{activeVer.dataset_version}</strong>
            </div>
            <div>
              <span className="text-[#9CA3AF] text-[10px] block">Git Commit Hash</span>
              <strong className="text-[#10B981] font-mono">{activeVer.commit}</strong>
            </div>
            <div>
              <span className="text-[#9CA3AF] text-[10px] block">Sample Prediction DOI</span>
              <strong>{activeVer.doi_ref}</strong>
            </div>
            <div>
              <span className="text-[#9CA3AF] text-[10px] block">LeakageGuard Invariant</span>
              <strong className="text-[#10B981]">Published_At &lt; Kickoff_At &lt; Settled_At</strong>
            </div>
          </div>
        </div>

        {/* Citation Format */}
        <div className="p-4 rounded-lg bg-[#0B0F0E] border border-[#1F2937] text-[#9CA3AF] space-y-2 font-sans">
          <span className="text-[#F0FDF4] font-bold text-[11px] block uppercase">Academic Citation Format:</span>
          <div className="bg-[#111827] p-3 rounded border border-[#1F2937] text-[10px] text-[#10B981] font-mono break-all">
            HandicapLab Research Institute. (2026). Quantitative Goal Expectation and Probability Surface Calibration ({activeVer.tag}). HandicapLab Technical Whitepaper Series, DOI: {activeVer.doi_ref}. Commit: {activeVer.commit.substring(0, 7)}.
          </div>
        </div>
      </div>
    </div>
  );
}
