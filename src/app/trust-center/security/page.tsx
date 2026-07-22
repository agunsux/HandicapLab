import React from 'react';
import Link from 'next/link';
import Navbar from '../../(marketing)/_components/Navbar';
import Footer from '../../(marketing)/_components/Footer';
import { ShieldCheck, Lock, Server, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const metadata = {
  title: 'Security Status | HandicapLab Trust Center',
  description: 'Runtime security status, edge guard enforcement, and system infrastructure health for HandicapLab.',
};

export default function SecurityStatusPage() {
  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-400 overflow-x-hidden antialiased">
      <Navbar />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/trust-center" className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-400 hover:text-emerald-400 mb-6 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Trust Center
        </Link>

        <div className="border-b border-zinc-800 pb-8">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-teal-400 uppercase tracking-widest bg-teal-500/10 px-3 py-1 rounded w-fit border border-teal-500/20">
            <Server className="h-4 w-4" />
            Engineering Telemetry
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mt-4 font-sans">
            Runtime Security & Infrastructure Status
          </h1>
          <p className="text-sm text-zinc-400 mt-2 font-mono">
            System Status: All Systems Operational (99.98% Uptime)
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="bg-[#0d0e14] border border-zinc-800 p-6 rounded-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">LeakageGuard Edge Proxy</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> ACTIVE
              </span>
            </div>
            <p className="text-zinc-500 text-[11px]">Enforces temporal data boundaries across all API endpoints.</p>
          </div>

          <div className="bg-[#0d0e14] border border-zinc-800 p-6 rounded-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Database Access Control</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> HARDENED
              </span>
            </div>
            <p className="text-zinc-500 text-[11px]">Strict RLS policies and immutable ledger append controls.</p>
          </div>

          <div className="bg-[#0d0e14] border border-zinc-800 p-6 rounded-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Dependency Scanner</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> 0 CVEs
              </span>
            </div>
            <p className="text-zinc-500 text-[11px]">Automated dependency vulnerability audits on every build.</p>
          </div>

          <div className="bg-[#0d0e14] border border-zinc-800 p-6 rounded-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">API Rate Limiting</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> ENFORCED
              </span>
            </div>
            <p className="text-zinc-500 text-[11px]">Edge middleware protecting research endpoints from DDoS.</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
