import Link from 'next/link';
import { headers } from 'next/headers';
import { OpportunitiesTable } from '@/components/opportunities/OpportunitiesTable';
import { cn } from '@/lib/utils';
import { getSecureOpportunities } from '@/services/opportunities.service';
import { Shield, BrainCircuit, Activity, Star } from 'lucide-react';
import { ParticleField } from '@/components/landing/ParticleField';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id') || undefined;

  // Fetch 2 best value bets for the teaser securely via DTO
  const mappedOpportunities = await getSecureOpportunities(userId, 2);

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E] font-sans text-[#F0FDF4]">
      {/* 1. HERO SECTION WITH MIDNIGHT EMERALD PARTICLE FIELD */}
      <section className="relative min-h-[600px] lg:min-h-[70vh] flex items-center justify-center pt-28 pb-20 border-b border-[#1F2937] bg-[#0B0F0E] overflow-hidden">
        {/* Canvas Particle Field */}
        <ParticleField />

        {/* Hero Content (Relative z-10 Above Canvas) */}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl text-center">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-xs sm:text-sm font-semibold tracking-widest text-[#10B981] uppercase">
              Where Odds Meet Evidence · Pinnacle Ground Truth
            </h2>

            <h1 className="text-5xl sm:text-6xl md:text-7xl font-display font-bold tracking-tight text-[#F0FDF4] leading-[1.1]">
              Trade the Edge.<br />
              <span className="text-[#10B981]">Not the Hype.</span>
            </h1>

            <p className="text-lg sm:text-xl text-[#9CA3AF] max-w-2xl mx-auto leading-relaxed">
              AI-powered value detection for Asian Handicap, Over/Under, Moneyline &amp; BTTS. We uncover market inefficiencies using mathematical rigor.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4 justify-center pt-4">
              <Link
                href="/pricing"
                className="px-6 py-3.5 bg-[#10B981] hover:bg-[#10B981]/90 text-black font-bold rounded-lg shadow-md transition-colors text-sm"
              >
                Get Pro Access
              </Link>

              <Link
                href="/methodology"
                className="px-6 py-3.5 border border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/10 font-semibold rounded-lg transition-colors text-sm"
              >
                View Methodology
              </Link>
            </div>

            {/* Trust Bar Below CTAs */}
            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-[#9CA3AF]">
              <div className="flex items-center gap-1 text-[#F59E0B]">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <span>Trusted by 2,400+ quantitative traders worldwide</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. LIVE SIGNAL PREVIEW */}
      <section className="py-24 border-b border-[#1F2937] bg-[#111827]/40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl font-display font-bold text-[#F0FDF4] mb-2">Live Signal Preview</h2>
              <p className="text-[#9CA3AF]">Real-time value bets detected across global football markets.</p>
            </div>
          </div>

          <div className="relative rounded-xl overflow-hidden border border-[#1F2937] bg-[#0B0F0E]">
            <div className={cn('p-1', !userId && 'filter blur-[6px] opacity-60 select-none pointer-events-none')}>
              {mappedOpportunities.length > 0 ? (
                <OpportunitiesTable data={mappedOpportunities} previewMode={true} />
              ) : (
                <div className="text-center py-12">
                  <div className="text-[#9CA3AF] mb-4 uppercase tracking-widest text-xs font-bold">ENGINE STATUS</div>
                  <div className="text-[#F0FDF4] font-medium mb-2">Scanning for validated opportunities.</div>
                  <div className="text-[#9CA3AF] text-sm">Check back before the next kickoff window.</div>
                </div>
              )}
            </div>

            {!userId && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0B0F0E]/40">
                <div className="bg-[#111827] border border-[#1F2937] p-8 rounded-xl flex flex-col items-center shadow-2xl max-w-sm mx-4 text-center">
                  <div className="bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
                    Pro Access Required
                  </div>
                  <h3 className="text-xl font-bold text-[#F0FDF4] mb-2">Market Data Locked</h3>
                  <p className="text-sm text-[#9CA3AF] mb-6">
                    Sign in to view real-time statistical edges, fair odds, and model probabilities.
                  </p>
                  <Link
                    href="/pricing"
                    className="w-full bg-[#10B981] text-black px-4 py-3 rounded-lg font-bold text-sm hover:bg-[#10B981]/90 transition-colors shadow-sm"
                  >
                    View Pricing
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. HONEST STAT STRIP */}
      <section className="py-8 bg-[#0B0F0E] border-b border-[#1F2937]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-12">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-[#111827] border border-[#1F2937] flex items-center justify-center shrink-0">
                <span className="text-[#10B981] font-mono font-bold">01</span>
              </div>
              <span className="font-semibold tracking-wide uppercase text-sm text-[#F0FDF4]">No Tipsters.</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-[#111827] border border-[#1F2937] flex items-center justify-center shrink-0">
                <span className="text-[#10B981] font-mono font-bold">02</span>
              </div>
              <span className="font-semibold tracking-wide uppercase text-sm text-[#F0FDF4]">No Affiliates.</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-[#111827] border border-[#1F2937] flex items-center justify-center shrink-0">
                <span className="text-[#10B981] font-mono font-bold">03</span>
              </div>
              <span className="font-semibold tracking-wide uppercase text-sm text-[#F0FDF4]">Pure Mathematics.</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS */}
      <section className="py-24 border-b border-[#1F2937] bg-[#111827]/40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <h2 className="text-3xl font-display font-bold text-[#F0FDF4] mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <div className="h-12 w-12 rounded-lg bg-[#0B0F0E] border border-[#1F2937] flex items-center justify-center mb-6 text-[#10B981]">
                <Activity className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-xl text-[#F0FDF4] mb-3">Model Probabilities</h3>
              <p className="text-[#9CA3AF] leading-relaxed">
                Using Poisson distribution, Elo ratings, and Dixon-Coles adjustments to model expected outcomes accurately.
              </p>
            </div>
            <div>
              <div className="h-12 w-12 rounded-lg bg-[#0B0F0E] border border-[#1F2937] flex items-center justify-center mb-6 text-[#10B981]">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-xl text-[#F0FDF4] mb-3">Compare to Market</h3>
              <p className="text-[#9CA3AF] leading-relaxed">
                We continuously ingest pinnacle odds to map market prices against our derived fair odds.
              </p>
            </div>
            <div>
              <div className="h-12 w-12 rounded-lg bg-[#0B0F0E] border border-[#1F2937] flex items-center justify-center mb-6 text-[#10B981]">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-xl text-[#F0FDF4] mb-3">Identify Edge</h3>
              <p className="text-[#9CA3AF] leading-relaxed">
                Highlighting statistically meaningful differences where the market misprices expected value.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FOUR MARKETS */}
      <section className="py-24 bg-[#0B0F0E] border-b border-[#1F2937]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <h2 className="text-3xl font-display font-bold text-[#F0FDF4] mb-12 text-center">Core Markets</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 text-center shadow-sm">
              <h3 className="font-bold text-lg text-[#F0FDF4]">Moneyline</h3>
            </div>
            <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 text-center shadow-sm">
              <h3 className="font-bold text-lg text-[#F0FDF4]">Asian Handicap</h3>
            </div>
            <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 text-center shadow-sm">
              <h3 className="font-bold text-lg text-[#F0FDF4]">Over/Under</h3>
            </div>
            <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 text-center shadow-sm">
              <h3 className="font-bold text-lg text-[#F0FDF4]">BTTS</h3>
            </div>
          </div>
        </div>
      </section>

      {/* 6. WHAT WE ARE NOT */}
      <section className="py-24 bg-[#111827]/40 border-b border-[#1F2937]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl text-center">
          <h2 className="text-xl font-display font-bold text-[#10B981] mb-8 uppercase tracking-widest">
            What We Are Not
          </h2>
          <div className="bg-[#0B0F0E] border border-[#1F2937] rounded-xl p-8 text-left mb-8 shadow-sm">
            <p className="text-[#F0FDF4] font-medium mb-6">HandicapLab does not:</p>
            <ul className="space-y-4 text-[#9CA3AF] font-mono text-sm">
              <li className="flex items-center gap-3">
                <span className="text-[#10B981] font-bold text-lg">&times;</span> accept wagers
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[#10B981] font-bold text-lg">&times;</span> hold user funds
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[#10B981] font-bold text-lg">&times;</span> place wagers
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[#10B981] font-bold text-lg">&times;</span> operate a sportsbook
              </li>
            </ul>
          </div>
          <p className="text-sm text-[#9CA3AF] max-w-xl mx-auto leading-relaxed">
            HandicapLab is a sports data and analytical platform. Analysis is provided for informational and research purposes only.
          </p>
        </div>
      </section>

      {/* 7. HISTORICAL VALIDATION */}
      <section className="py-24 bg-[#0B0F0E]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl text-center">
          <h2 className="text-3xl font-display font-bold text-[#F0FDF4] mb-6">Historical Validation</h2>
          <p className="text-lg text-[#9CA3AF] mb-8 leading-relaxed">
            Our models are continuously backtested against closing lines to ensure positive expected value.{' '}
            <strong className="text-[#F0FDF4]">Live production track records will be published as predictions are settled.</strong>
          </p>
          <div className="inline-block bg-[#111827] border border-[#1F2937] rounded-full px-6 py-2">
            <span className="text-sm font-bold text-[#F0FDF4]">0 Settled Production Signals</span>
          </div>
        </div>
      </section>
    </div>
  );
}
