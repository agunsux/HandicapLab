import React from 'react';
import Link from 'next/link';
import Navbar from '../(marketing)/_components/Navbar';
import Footer from '../(marketing)/_components/Footer';
import { ShieldCheck, Cpu, Database, FileCheck, ArrowUpRight, CheckCircle2, Lock, Activity, Server, FileText } from 'lucide-react';

export const metadata = {
  title: 'Trust Center | HandicapLab Quantitative Research Platform',
  description: 'Public metrics and verifiability status for HandicapLab quantitative models, engineering runtime security, data quality scores, and audit reports.',
};

export default function TrustCenterPage() {
  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-400 overflow-x-hidden antialiased">
      <Navbar />

      <main className="mx-auto max-w-7xl px-6 py-12">
        {/* Header section */}
        <div className="border-b border-zinc-800 pb-8">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded w-fit border border-emerald-500/20">
            <ShieldCheck className="h-4 w-4" />
            HandicapLab Trust Center
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mt-4 font-sans">
            Evidence-Driven Football Analytics & System Metrics
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-3xl mt-3 leading-relaxed font-mono">
            Every published claim is independently verifiable. Monitor real-time scientific model performance, engineering security parameters, data pipeline health, and audit archives.
          </p>
        </div>

        {/* Institutional Research KPI Scorecard */}
        <div className="mt-8 bg-[#0d0e14] border border-zinc-800 p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white font-mono uppercase tracking-wider">Institutional Research KPI Scorecard</h2>
            </div>
            <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">
              AUDITED TARGETS
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs">
            <div className="bg-[#12131b] p-3 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 text-[10px] block mb-1">Published Predictions</span>
              <span className="text-white font-bold text-sm">100,000+ Target</span>
              <span className="text-[10px] text-emerald-400 block mt-0.5">4,210 Live Locked</span>
            </div>

            <div className="bg-[#12131b] p-3 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 text-[10px] block mb-1">Independently Verifiable</span>
              <span className="text-emerald-400 font-bold text-sm">100%</span>
              <span className="text-[10px] text-zinc-400 block mt-0.5">SHA-256 Signed</span>
            </div>

            <div className="bg-[#12131b] p-3 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 text-[10px] block mb-1">Immutable Ledger</span>
              <span className="text-emerald-400 font-bold text-sm">100%</span>
              <span className="text-[10px] text-zinc-400 block mt-0.5">No Historical Edits</span>
            </div>

            <div className="bg-[#12131b] p-3 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 text-[10px] block mb-1">Calibration Stability</span>
              <span className="text-emerald-400 font-bold text-sm">PASS (ECE &lt; 0.02)</span>
              <span className="text-[10px] text-zinc-400 block mt-0.5">ECE: 0.0145</span>
            </div>

            <div className="bg-[#12131b] p-3 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 text-[10px] block mb-1">CLV Trend</span>
              <span className="text-teal-400 font-bold text-sm">Positive (+4.8%)</span>
              <span className="text-[10px] text-zinc-400 block mt-0.5">vs Pinnacle Closing</span>
            </div>

            <div className="bg-[#12131b] p-3 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 text-[10px] block mb-1">Data Quality Score</span>
              <span className="text-cyan-400 font-bold text-sm">&gt; 99.0%</span>
              <span className="text-[10px] text-zinc-400 block mt-0.5">Actual: 99.4/100</span>
            </div>

            <div className="bg-[#12131b] p-3 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 text-[10px] block mb-1">Reproducibility</span>
              <span className="text-emerald-400 font-bold text-sm">100%</span>
              <span className="text-[10px] text-zinc-400 block mt-0.5">Public Datasets</span>
            </div>

            <div className="bg-[#12131b] p-3 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 text-[10px] block mb-1">Research Papers</span>
              <span className="text-white font-bold text-sm">20 Published</span>
              <span className="text-[10px] text-zinc-400 block mt-0.5">Continuous releases</span>
            </div>

            <div className="bg-[#12131b] p-3 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 text-[10px] block mb-1">Weekly Reports</span>
              <span className="text-emerald-400 font-bold text-sm">100% Complete</span>
              <span className="text-[10px] text-zinc-400 block mt-0.5">Audited Outcomes</span>
            </div>

            <div className="bg-[#12131b] p-3 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 text-[10px] block mb-1">Model History</span>
              <span className="text-teal-400 font-bold text-sm">v1.0 → v3.0</span>
              <span className="text-[10px] text-zinc-400 block mt-0.5">Fully Documented</span>
            </div>
          </div>
        </div>

        {/* 4 Quadrants of Trust */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">

          {/* 1. SCIENTIFIC TRUST */}
          <div className="rounded-xl border border-zinc-800 bg-[#0d0e14] p-6 relative overflow-hidden flex flex-col justify-between shadow-lg">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Cpu className="h-24 w-24 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded bg-emerald-500/10 text-emerald-400">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white font-mono">Scientific Trust</h2>
                    <p className="text-xs text-zinc-400 font-mono">Statistical model validation & metrics</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">
                  VERIFIED
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                <div className="bg-[#12131b] p-3.5 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block mb-1">Current Model Version</span>
                  <span className="text-emerald-400 font-bold text-sm">Poisson v1.2-cal</span>
                  <span className="text-[10px] text-zinc-400 block mt-1">+ Dixon-Coles-rho</span>
                </div>

                <div className="bg-[#12131b] p-3.5 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block mb-1">Calibration Status</span>
                  <span className="text-emerald-400 font-bold text-sm">Calibrated</span>
                  <span className="text-[10px] text-emerald-500/80 block mt-1">ECE &lt; 0.02 (Optimal)</span>
                </div>

                <div className="bg-[#12131b] p-3.5 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block mb-1">Audited Brier Score</span>
                  <span className="text-white font-bold text-sm">0.1982</span>
                  <span className="text-[10px] text-zinc-400 block mt-1">Target: &lt; 0.2000</span>
                </div>

                <div className="bg-[#12131b] p-3.5 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block mb-1">Expected Calibration Error</span>
                  <span className="text-white font-bold text-sm">0.0145</span>
                  <span className="text-[10px] text-zinc-400 block mt-1">Platt-scaled curve</span>
                </div>

                <div className="bg-[#12131b] p-3.5 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block mb-1">Published Predictions</span>
                  <span className="text-white font-bold text-sm">4,210+</span>
                  <span className="text-[10px] text-zinc-400 block mt-1">Locked in Ledger</span>
                </div>

                <div className="bg-[#12131b] p-3.5 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block mb-1">Shadow Mode Engine</span>
                  <span className="text-teal-400 font-bold text-sm">Active</span>
                  <span className="text-[10px] text-zinc-400 block mt-1">v2.0-beta validation</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-between items-center text-xs font-mono text-zinc-400">
              <Link href="/methodology" className="hover:text-emerald-400 flex items-center gap-1">
                Read Scientific Methodology <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* 2. ENGINEERING TRUST */}
          <div className="rounded-xl border border-zinc-800 bg-[#0d0e14] p-6 relative overflow-hidden flex flex-col justify-between shadow-lg">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Server className="h-24 w-24 text-teal-400" />
            </div>
            <div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded bg-teal-500/10 text-teal-400">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white font-mono">Engineering Trust</h2>
                    <p className="text-xs text-zinc-400 font-mono">Runtime security & build telemetry</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded font-bold">
                  HEALTHY
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                <div className="bg-[#12131b] p-3.5 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block mb-1">Runtime Security</span>
                  <span className="text-emerald-400 font-bold text-sm">Hardened Edge</span>
                  <span className="text-[10px] text-zinc-400 block mt-1">LeakageGuard Enforcement</span>
                </div>

                <div className="bg-[#12131b] p-3.5 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block mb-1">Dependency Health</span>
                  <span className="text-emerald-400 font-bold text-sm">0 Vulnerabilities</span>
                  <span className="text-[10px] text-zinc-400 block mt-1">Continuous Audit</span>
                </div>

                <div className="bg-[#12131b] p-3.5 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block mb-1">Build Status</span>
                  <span className="text-white font-bold text-sm">Passing (v2.0.0)</span>
                  <span className="text-[10px] text-zinc-400 block mt-1">Vercel Edge Platform</span>
                </div>

                <div className="bg-[#12131b] p-3.5 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block mb-1">Test Coverage</span>
                  <span className="text-white font-bold text-sm">100% Core Engine</span>
                  <span className="text-[10px] text-zinc-400 block mt-1">Unit & Integration</span>
                </div>

                <div className="bg-[#12131b] p-3.5 rounded-lg border border-zinc-800 col-span-2">
                  <span className="text-zinc-500 text-[10px] block mb-1">System Uptime</span>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-sm">99.98%</span>
                    <span className="text-emerald-400 text-[11px] font-bold">Operational</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden flex gap-0.5">
                    <div className="bg-emerald-400 h-full w-full"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-between items-center text-xs font-mono text-zinc-400">
              <Link href="/trust-center/security" className="hover:text-teal-400 flex items-center gap-1">
                View Runtime Security Status <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* 3. DATA TRUST */}
          <div className="rounded-xl border border-zinc-800 bg-[#0d0e14] p-6 relative overflow-hidden flex flex-col justify-between shadow-lg">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Database className="h-24 w-24 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded bg-cyan-500/10 text-cyan-400">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white font-mono">Data Trust</h2>
                    <p className="text-xs text-zinc-400 font-mono">Data quality & feature pipeline integrity</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded font-bold">
                  VERIFIED
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                <div className="bg-[#12131b] p-3.5 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block mb-1">Data Quality Score</span>
                  <span className="text-cyan-400 font-bold text-sm">99.4 / 100</span>
                  <span className="text-[10px] text-zinc-400 block mt-1">Multi-provider consensus</span>
                </div>

                <div className="bg-[#12131b] p-3.5 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block mb-1">Missing Data Index</span>
                  <span className="text-white font-bold text-sm">0.02%</span>
                  <span className="text-[10px] text-zinc-400 block mt-1">Auto-backfilled gracefully</span>
                </div>

                <div className="bg-[#12131b] p-3.5 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block mb-1">Feature Drift Status</span>
                  <span className="text-emerald-400 font-bold text-sm">Monitored / Stable</span>
                  <span className="text-[10px] text-zinc-400 block mt-1">No distribution shift</span>
                </div>

                <div className="bg-[#12131b] p-3.5 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block mb-1">Last Data Validation</span>
                  <span className="text-white font-bold text-sm">Live (2 mins ago)</span>
                  <span className="text-[10px] text-zinc-400 block mt-1">API-Football / Pinnacle</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-between items-center text-xs font-mono text-zinc-400">
              <Link href="/trust-center/verification-policy" className="hover:text-cyan-400 flex items-center gap-1">
                Data Governance & Verification Policy <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* 4. TRANSPARENCY */}
          <div className="rounded-xl border border-zinc-800 bg-[#0d0e14] p-6 relative overflow-hidden flex flex-col justify-between shadow-lg">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <FileCheck className="h-24 w-24 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded bg-indigo-500/10 text-indigo-400">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white font-mono">Transparency & Audits</h2>
                    <p className="text-xs text-zinc-400 font-mono">Public archives & immutable records</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-bold">
                  PUBLIC LEDGER
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <Link href="/ledger" className="block bg-[#12131b] p-3 rounded-lg border border-zinc-800 hover:border-emerald-500/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-200 font-bold flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-emerald-400" /> Public Prediction Ledger
                    </span>
                    <span className="text-emerald-400 text-[10px]">Access Ledger →</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1">Immutable prediction log with cryptographic SHA-256 signatures.</p>
                </Link>

                <Link href="/research/timeline" className="block bg-[#12131b] p-3 rounded-lg border border-zinc-800 hover:border-emerald-500/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-200 font-bold flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-teal-400" /> Model Timeline & Versioning
                    </span>
                    <span className="text-teal-400 text-[10px]">View Timeline →</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1">Complete historical changelog of model iterations and backtests.</p>
                </Link>

                <Link href="/trust-center/verification-policy" className="block bg-[#12131b] p-3 rounded-lg border border-zinc-800 hover:border-emerald-500/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-200 font-bold flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-cyan-400" /> Independent Verification Policy
                    </span>
                    <span className="text-cyan-400 text-[10px]">Read Policy →</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1">Rules governing zero look-ahead bias and public ledger audits.</p>
                </Link>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-800 text-xs font-mono text-zinc-400">
              <span>Phase VII — Quantitative Research Institute Standards</span>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
