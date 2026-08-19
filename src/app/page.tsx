import Link from 'next/link';
import { HomepageDashboard } from '@/components/homepage/HomepageDashboard';
import { Shield, BrainCircuit, Activity, Star } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E] font-sans text-[#F0FDF4]">
      {/* PRIMARY INTELLIGENCE SURFACE */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl pt-10 sm:pt-14 pb-12 flex-1">
        <HomepageDashboard />
      </main>

      {/* INSTITUTIONAL INTEGRITY & HOW IT WORKS */}
      <section className="py-16 border-t border-[#1F2937] bg-[#111827]/40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-mono uppercase tracking-widest text-[#10B981] mb-2 font-semibold">
              Quantitative Architecture
            </h2>
            <h3 className="text-2xl font-display font-bold text-white">
              Institutional Mathematical Modeling
            </h3>
            <p className="text-sm text-[#9CA3AF] mt-2">
              Every probability, fair line, and closing edge is derived from out-of-sample statistical models.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-xl border border-[#1F2937] bg-[#0B0F0E]/80 p-6">
              <div className="h-10 w-10 rounded-lg bg-[#111827] border border-[#1F2937] flex items-center justify-center mb-4 text-[#10B981]">
                <Activity className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-base text-[#F0FDF4] mb-2">Bivariate Poisson &amp; Elo</h4>
              <p className="text-xs text-[#9CA3AF] leading-relaxed font-sans">
                Matches are modeled using Dixon-Coles bivariate Poisson formulations with dynamic home advantage decay and time-decay weighted Elo power ratings.
              </p>
            </div>

            <div className="rounded-xl border border-[#1F2937] bg-[#0B0F0E]/80 p-6">
              <div className="h-10 w-10 rounded-lg bg-[#111827] border border-[#1F2937] flex items-center justify-center mb-4 text-[#10B981]">
                <Shield className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-base text-[#F0FDF4] mb-2">Pinnacle Ground Truth</h4>
              <p className="text-xs text-[#9CA3AF] leading-relaxed font-sans">
                Pinnacle closing lines are ingested as the market ground truth for Closing Line Value (CLV) calculations. No synthetic or unverified odds.
              </p>
            </div>

            <div className="rounded-xl border border-[#1F2937] bg-[#0B0F0E]/80 p-6">
              <div className="h-10 w-10 rounded-lg bg-[#111827] border border-[#1F2937] flex items-center justify-center mb-4 text-[#10B981]">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-base text-[#F0FDF4] mb-2">Walk-Forward Validation</h4>
              <p className="text-xs text-[#9CA3AF] leading-relaxed font-sans">
                Zero future leakage. Every historical backtest is evaluated expanding-window style strictly on past matches prior to kickoff timestamp.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* COMPLIANCE & LEGAL NOTICE */}
      <section className="py-8 bg-[#0B0F0E] border-t border-[#1F2937]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl text-center text-xs text-[#9CA3AF]">
          <p className="max-w-3xl mx-auto leading-relaxed">
            HandicapLab is an independent sports analytics and statistical intelligence platform. We do not operate a sportsbook, take wagers, or accept user deposits. All data and analysis are provided strictly for research and modeling purposes.
          </p>
        </div>
      </section>
    </div>
  );
}
