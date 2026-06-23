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
              S
            </div>
            <span className="font-bold tracking-tight text-zinc-100 text-sm">
              Shinerva<span className="text-emerald-400">.id</span>
            </span>
          </Link>
          <p className="text-zinc-500 text-xs max-w-sm leading-relaxed">
            Shinerva.id is a quantitative analytics and statistical forecasting platform for football markets. We model probability surfaces using pure historical indicators.
          </p>
        </div>

        {/* Middle Column: Links */}
        <div className="space-y-3">
          <span className="font-mono text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Navigation</span>
          <ul className="space-y-2">
            <li>
              <a href="#the-edge" className="hover:text-zinc-300 transition-colors">The Edge</a>
            </li>
            <li>
              <a href="#live-stats" className="hover:text-zinc-300 transition-colors">Live Performance</a>
            </li>
            <li>
              <a href="#pricing" className="hover:text-zinc-300 transition-colors">Pricing</a>
            </li>
            <li>
              <Link href="/dashboard" className="hover:text-zinc-300 transition-colors">Ledger Dashboard</Link>
            </li>
          </ul>
        </div>

        {/* Right Column: Platform details */}
        <div className="space-y-3">
          <span className="font-mono text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Engine Details</span>
          <ul className="space-y-2 font-mono text-[10px] text-zinc-500">
            <li>Primary Model: Poisson v1.2-cal</li>
            <li>Secondary Model: Dixon-Coles-rho</li>
            <li>Staking Metric: Fractional Kelly (0.25)</li>
            <li>Audited Brier Range: 0.18 - 0.22</li>
          </ul>
        </div>
      </div>

      {/* Disclaimers & Copyright */}
      <div className="mx-auto max-w-7xl px-6 mt-12 pt-8 border-t border-white/[0.05] space-y-4">
        <p className="text-[10px] leading-relaxed text-zinc-600">
          <strong>Risk Disclosure & Betting Warning:</strong> Sports speculation involves substantial financial risk. Shinerva.id provides mathematical probability outputs and model-implied edges for informational and research purposes only. We do not operate a sportsbook, accept bets, or offer financial advice. All model forecasts are based on historical probability and do not guarantee future returns. speculator assumes 100% responsibility for their capital allocations.
        </p>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 text-zinc-600 text-[10px]">
          <span>© {currentYear} Shinerva.id. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/" className="hover:underline">Privacy Policy</Link>
            <Link href="/" className="hover:underline">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
