'use client';

import React, { useState } from 'react';
import {
  FileText,
  GitBranch,
  BookOpen,
  HelpCircle,
  Layers,
  CheckCircle2
} from 'lucide-react';

export default function DocumentationPortalPage() {
  const [activeSection, setActiveSection] = useState<'timeline' | 'math' | 'policy'>('timeline');

  const timeline = [
    { version: 'v1.40.0', name: 'Public Ledger & Transparency Platform', date: '2026-07-23', desc: 'Immutable public ledger, verification certificates, weekly/monthly report generator, and Hall of Shame postmortems.' },
    { version: 'v1.39.0', name: 'Data Quality & Integrity Platform', date: '2026-07-22', desc: '0-100 Data Quality Score, automated integrity checkers, feature drift detector, and data lineage visualizer.' },
    { version: 'v1.38.0', name: 'Quantitative Market Intelligence Platform', date: '2026-07-22', desc: 'Market Quality Score (0-100), EV decay engine, closing line intelligence, and Quarter-Kelly risk optimization.' },
    { version: 'v1.37.0', name: 'Scientific Validation Platform', date: '2026-07-22', desc: '6-layer scientific validation framework, Brier score, ECE, 95% Wilson CIs, and k-NN match search.' },
    { version: 'v1.36.0', name: 'Value Betting Intelligence Platform', date: '2026-07-22', desc: 'Positioned HandicapLab as a Value Betting Intelligence Platform (Model Fair Odds vs Market Odds).' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 font-mono p-6 space-y-6">
      {/* Header */}
      <div className="border border-slate-800 bg-[#0F131C] p-5 rounded-lg flex justify-between items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-sky-400" />
            <h1 className="text-xl font-bold text-slate-50 tracking-wider">
              PUBLIC DOCUMENTATION & MODEL TIMELINE
            </h1>
            <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs px-2.5 py-0.5 rounded">
              OPEN SCIENCE PORTAL
            </span>
          </div>
          <p className="text-xs text-slate-400 font-sans">
            Architecture manuals, Expected Value formulations, 95% Confidence Interval math, and model evolution timeline.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {[
          { id: 'timeline', label: '01 // MODEL EVOLUTION TIMELINE', icon: GitBranch },
          { id: 'math', label: '02 // MATHEMATICAL SPECIFICATIONS', icon: FileText },
          { id: 'policy', label: '03 // PUBLIC VERIFICATION POLICY', icon: CheckCircle2 },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`px-4 py-2 rounded text-xs font-bold transition-all flex items-center gap-2 ${
                activeSection === tab.id
                  ? 'bg-sky-500 text-slate-950'
                  : 'bg-[#141A26] text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Section 1: Timeline */}
      {activeSection === 'timeline' && (
        <div className="border border-slate-800 bg-[#0F131C] p-5 rounded-lg space-y-4">
          <h3 className="text-sm font-bold text-sky-400">VERSION RELEASE CHRONOLOGY</h3>
          <div className="space-y-4">
            {timeline.map((node, idx) => (
              <div key={idx} className="bg-[#141A26] border border-slate-800 p-4 rounded space-y-2 text-xs">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-emerald-400 text-sm">{node.version} — {node.name}</span>
                  <span className="text-slate-400">{node.date}</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">{node.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Math Specs */}
      {activeSection === 'math' && (
        <div className="border border-slate-800 bg-[#0F131C] p-5 rounded-lg space-y-4 text-xs">
          <h3 className="text-sm font-bold text-sky-400">EXPECTED VALUE & FAIR ODDS FORMULAS</h3>
          <div className="bg-[#141A26] p-4 rounded space-y-2">
            <div className="font-bold text-slate-200">1. Model Fair Odds Formula</div>
            <div className="text-emerald-400 font-mono">Fair Odds = 1 / Model Probability</div>
            <div className="font-bold text-slate-200 mt-2">2. Expected Value (EV) Formula</div>
            <div className="text-emerald-400 font-mono">EV = (Model Probability * Bookmaker Odds) - 1</div>
          </div>
        </div>
      )}

      {/* Section 3: Verification Policy */}
      {activeSection === 'policy' && (
        <div className="border border-slate-800 bg-[#0F131C] p-5 rounded-lg space-y-3 text-xs leading-relaxed text-slate-300">
          <h3 className="text-sm font-bold text-sky-400">PUBLIC VERIFICATION POLICY</h3>
          <p>
            All predictions, probabilities, historical performance metrics, and research reports published by HandicapLab are generated from version-controlled models and immutable datasets. Every published result is traceable, reproducible, and independently auditable. Historical records are append-only and are never altered after publication.
          </p>
        </div>
      )}
    </div>
  );
}
