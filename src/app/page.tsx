import React from 'react';
import Link from 'next/link';
import { getTerminalPredictions } from '@/lib/terminalData';
import { ArrowRight, ShieldCheck, CheckCircle2, Target, TrendingUp, BarChart3 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'HandicapLab — Asian Handicap, Over/Under & BTTS Intelligence',
  description: 'Stop betting blind. Transparent, data-backed football predictions for Asian Handicap, Over/Under and BTTS. 14 days free.',
};

export default async function HomePage() {
  const predictions = await getTerminalPredictions();
  const settled = predictions.filter((p) => p.settlement_status === 'SETTLED');

  // Real settled preview (latest 5 settled items)
  const settledPreview = settled.slice(0, 5);

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E] font-sans text-[#F0FDF4]">
      {/* SECTION 1 — HERO */}
      <section className="relative pt-24 pb-20 px-4 sm:px-6 lg:px-8 border-b border-[#1F2937]/70">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111827] border border-[#1F2937] text-xs font-mono text-[#10B981]">
            <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
            THREE MARKETS &bull; CLEAR SIGNALS &bull; REAL RESULTS
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display font-black text-white tracking-tight leading-[1.08]">
            STOP BETTING <span className="text-[#10B981]">BLIND.</span>
          </h1>

          <p className="text-base sm:text-xl text-[#9CA3AF] max-w-2xl mx-auto leading-relaxed">
            Data-backed football predictions for <strong className="text-white">Asian Handicap</strong>,{' '}
            <strong className="text-white">Over/Under</strong> and <strong className="text-white">BTTS</strong>.
          </p>

          <div className="pt-2 text-xs font-mono text-[#10B981] font-semibold tracking-wide uppercase">
            14 days free &bull; No credit card required
          </div>

          {/* Primary & Secondary CTAs */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/pricing"
              className="w-full sm:w-auto px-7 py-3.5 rounded-lg bg-[#10B981] hover:bg-[#10B981]/90 text-black font-display font-bold text-sm transition-all shadow-lg hover:shadow-[#10B981]/20 flex items-center justify-center gap-2"
            >
              START 14-DAY FREE TRIAL <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/track-record"
              className="w-full sm:w-auto px-7 py-3.5 rounded-lg bg-[#111827] hover:bg-[#1A2436] border border-[#1F2937] text-white font-mono text-sm transition-all flex items-center justify-center gap-2"
            >
              <BarChart3 className="h-4 w-4 text-[#9CA3AF]" />
              SEE TRACK RECORD
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 2 — THE THREE MARKETS */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center mb-12 space-y-2">
          <span className="text-xs font-mono uppercase tracking-widest text-[#10B981]">
            Focused Scope
          </span>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white">
            The Three Markets That Matter
          </h2>
          <p className="text-sm text-[#9CA3AF] max-w-xl mx-auto">
            We do not dilute focus across 50 sports or decorative prop bets. We engineer edges exclusively where liquid volume lives.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Asian Handicap */}
          <Link
            href="/asian-handicap"
            className="group p-6 rounded-2xl bg-[#111827]/70 border border-[#1F2937] hover:border-[#10B981]/60 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="h-10 w-10 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center mb-5 text-[#10B981]">
                <Target className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-[#10B981] transition-colors mb-2">
                Asian Handicap
              </h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Find signals where the market handicap line and our bivariate Dixon-Coles goal model disagree.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#1F2937] flex items-center justify-between text-xs font-mono text-[#10B981]">
              <span>Explore Asian Handicap</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Over / Under */}
          <Link
            href="/over-under"
            className="group p-6 rounded-2xl bg-[#111827]/70 border border-[#1F2937] hover:border-[#10B981]/60 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="h-10 w-10 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center mb-5 text-[#10B981]">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-[#10B981] transition-colors mb-2">
                Over / Under
              </h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Identify goal totals where our expected goals distribution deviates from closing market consensus.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#1F2937] flex items-center justify-between text-xs font-mono text-[#10B981]">
              <span>Explore Over / Under</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* BTTS */}
          <Link
            href="/btts"
            className="group p-6 rounded-2xl bg-[#111827]/70 border border-[#1F2937] hover:border-[#10B981]/60 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="h-10 w-10 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center mb-5 text-[#10B981]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-[#10B981] transition-colors mb-2">
                Both Teams To Score
              </h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Evaluate whether bookmakers have mispriced joint scoring probabilities based on defensive pace decay.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#1F2937] flex items-center justify-between text-xs font-mono text-[#10B981]">
              <span>Explore BTTS</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </section>

      {/* SECTION 3 — HOW IT WORKS */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-y border-[#1F2937]/70 bg-[#0E1413]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14 space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest text-[#10B981]">Workflow</span>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white">
              How HandicapLab Works
            </h2>
            <p className="text-sm text-[#9CA3AF]">
              Three simple steps from signal generation to audited settlement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl bg-[#111827]/60 border border-[#1F2937]">
              <div className="text-3xl font-mono font-bold text-[#10B981] mb-3">01</div>
              <h3 className="text-base font-bold text-white mb-2">Choose Your Market</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Select between Asian Handicap, Over/Under, or Both Teams To Score. No confusing sub-tiers or irrelevant sports.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#111827]/60 border border-[#1F2937]">
              <div className="text-3xl font-mono font-bold text-[#10B981] mb-3">02</div>
              <h3 className="text-base font-bold text-white mb-2">Check The Signal</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Review the selection, fair odds, Pinnacle closing benchmarks, and calculated expected edge (EV) before kickoff.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#111827]/60 border border-[#1F2937]">
              <div className="text-3xl font-mono font-bold text-[#10B981] mb-3">03</div>
              <h3 className="text-base font-bold text-white mb-2">Track The Result</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Every settled prediction is logged immutably to the public track record. Win or lose, nothing is deleted or hidden.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 — REAL TRACK RECORD PREVIEW */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-[#10B981]">
              Transparency First
            </span>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mt-1">
              Real Track Record
            </h2>
            <p className="text-xs text-[#9CA3AF] mt-1">
              Audited out-of-sample settlements. Zero synthetic or fabricated bets.
            </p>
          </div>

          <Link
            href="/track-record"
            className="text-xs font-mono text-[#10B981] hover:underline flex items-center gap-1.5 self-start sm:self-auto"
          >
            View Full Track Record ({settled.length} settled) <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {settledPreview.length === 0 ? (
          <div className="rounded-2xl border border-[#1F2937] bg-[#111827]/50 p-12 text-center">
            <BarChart3 className="h-10 w-10 text-[#9CA3AF]/40 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-white font-mono">Track record is building.</h3>
            <p className="text-xs text-[#9CA3AF] mt-1 max-w-md mx-auto">
              No settled predictions exist in the current evaluation cohort. Settled bets will be displayed here automatically as fixtures conclude.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#1F2937] bg-[#111827]/60 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1F2937] text-[#9CA3AF]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Match</th>
                  <th className="py-3 px-4">Market</th>
                  <th className="py-3 px-4">Pick</th>
                  <th className="py-3 px-4">Odds</th>
                  <th className="py-3 px-4">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2937]">
                {settledPreview.map((item) => (
                  <tr key={item.id} className="hover:bg-[#111827]/80">
                    <td className="py-3 px-4 text-[#9CA3AF] whitespace-nowrap">
                      {item.kickoff_at.slice(0, 10)}
                    </td>
                    <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                      {item.home_team} vs {item.away_team}
                    </td>
                    <td className="py-3 px-4 text-neutral-300">{item.market}</td>
                    <td className="py-3 px-4 text-[#10B981] capitalize">
                      {item.side} {item.line}
                    </td>
                    <td className="py-3 px-4 text-white font-bold">{item.taken_odds.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          (item.profit_loss || 0) > 0
                            ? 'bg-[#10B981]/15 text-[#10B981]'
                            : (item.profit_loss || 0) < 0
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {item.actual_outcome || (item.profit_loss || 0) > 0 ? 'WIN' : 'LOSS'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION 5 — WHY HANDICAPLAB */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-[#1F2937]/70 bg-[#0E1413]">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <span className="text-xs font-mono uppercase tracking-widest text-[#10B981]">
            Our Commitment
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-black text-white">
            REAL DATA. CLEAR SIGNALS. TRANSPARENT RESULTS.
          </h2>
          <p className="text-sm text-[#9CA3AF] max-w-2xl mx-auto leading-relaxed pt-2">
            No exaggerated marketing claims. No promises of guaranteed wealth. No cherry-picked winning slips. We build statistical models, benchmark them against Pinnacle closing prices, and publish every single outcome.
          </p>
        </div>
      </section>

      {/* SECTION 6 — 14-DAY TRIAL CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-[#1F2937]/70">
        <div className="max-w-3xl mx-auto text-center p-10 sm:p-14 rounded-3xl bg-[#111827] border border-[#1F2937] space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] text-xs font-mono">
            <ShieldCheck className="h-4 w-4" /> RISK FREE TRIAL
          </div>

          <h2 className="text-3xl sm:text-5xl font-display font-black text-white tracking-tight">
            TRY HANDICAPLAB FOR 14 DAYS.
          </h2>

          <p className="text-sm text-[#9CA3AF] max-w-lg mx-auto">
            Full access to Asian Handicap, Over/Under, and BTTS market signals. No credit card required at signup.
          </p>

          <div className="pt-2">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg bg-[#10B981] hover:bg-[#10B981]/90 text-black font-display font-bold text-sm transition-all shadow-lg hover:shadow-[#10B981]/20"
            >
              START FREE TRIAL <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 7 — MINIMAL FOOTER */}
      <footer className="py-8 px-4 sm:px-6 border-t border-[#1F2937] bg-[#0B0F0E]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#9CA3AF]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">HandicapLab</span> &bull; <span>Three markets. Clear signals.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/track-record" className="hover:text-white transition-colors">
              Track Record
            </Link>
            <Link href="/methodology" className="hover:text-white transition-colors">
              Methodology
            </Link>
            <Link href="/pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/app/profile" className="hover:text-white transition-colors">
              Account
            </Link>
          </div>

          <div className="text-[11px] text-[#6B7280]">
            &copy; {new Date().getFullYear()} HandicapLab. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
