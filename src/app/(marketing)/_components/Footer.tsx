'use client';

import React from 'react';
import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.05] bg-[#09090B] py-12 text-zinc-500 font-sans text-xs">
      <div className="mx-auto max-w-7xl px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Left Column: Logo & Branding */}
        <div className="space-y-4 md:col-span-2">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-gradient-to-br from-emerald-400 to-teal-500 font-bold text-[#09090B] text-sm tracking-tighter">
              H
            </div>
            <span className="font-bold tracking-tight text-zinc-100 text-sm">
              Handicap<span className="text-emerald-400">Lab</span>
            </span>
          </Link>
          <p className="text-zinc-500 text-xs max-w-sm leading-relaxed">
            HandicapLab is a quantitative analytics and statistical forecasting platform for football markets. We model probability surfaces using pure historical indicators.
          </p>
        </div>

        {/* Middle Column: Research & Trust Links */}
        <div className="space-y-3">
          <span className="font-mono text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">Governance & Audit</span>
          <ul className="space-y-2 font-mono text-[11px]">
            <li>
              <Link href="/methodology" className="hover:text-emerald-400 transition-colors">Scientific Methodology</Link>
            </li>
            <li>
              <Link href="/trust-center/verification-policy" className="hover:text-emerald-400 transition-colors">Verification Policy</Link>
            </li>
            <li>
              <Link href="/research/hall-of-mistakes" className="hover:text-amber-400 transition-colors flex items-center gap-1 text-amber-400/90 font-bold">
                ⚠️ Hall of Mistakes
              </Link>
            </li>
            <li>
              <Link href="/research/reports" className="hover:text-emerald-400 transition-colors">Weekly & Monthly Reports</Link>
            </li>
            <li>
              <Link href="/research/timeline" className="hover:text-emerald-400 transition-colors">Model Timeline (v1 → v3)</Link>
            </li>
            <li>
              <Link href="/trust-center/security" className="hover:text-emerald-400 transition-colors">Security Status</Link>
            </li>
          </ul>
        </div>

        {/* Right Column: Ledger & Infrastructure */}
        <div className="space-y-3">
          <span className="font-mono text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">Public Infrastructure</span>
          <ul className="space-y-2 font-mono text-[11px]">
            <li>
              <Link href="/validation" className="hover:text-emerald-400 transition-colors">Live Validation Dashboard</Link>
            </li>
            <li>
              <Link href="/ledger" className="hover:text-emerald-400 transition-colors">Public Ledger</Link>
            </li>
            <li>
              <Link href="/trust-center" className="hover:text-emerald-400 transition-colors">Trust Center</Link>
            </li>
            <li>
              <Link href="/research/datasets" className="hover:text-emerald-400 transition-colors">Open Datasets (CSV)</Link>
            </li>
            <li>
              <Link href="/methodology#api" className="hover:text-emerald-400 transition-colors">API Documentation</Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Disclaimers & Copyright */}
      <div className="mx-auto max-w-7xl px-6 mt-12 pt-8 border-t border-white/[0.05] space-y-4">
        <p className="text-[10px] leading-relaxed text-zinc-600">
          <strong>Risk Disclosure & Betting Warning:</strong> Sports speculation involves substantial financial risk. HandicapLab provides mathematical probability outputs and model-implied edges for informational and research purposes only. We do not operate a sportsbook, accept bets, or offer financial advice. All model forecasts are based on historical probability and do not guarantee future returns. speculator assumes 100% responsibility for their capital allocations.
        </p>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 text-zinc-600 text-[10px]">
          <span>© {currentYear} HandicapLab. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/" className="hover:underline">Privacy Policy</Link>
            <Link href="/" className="hover:underline">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
