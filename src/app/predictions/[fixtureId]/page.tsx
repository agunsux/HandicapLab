import React from 'react';
import Link from 'next/link';
import { getTerminalPredictions } from '@/lib/terminalData';
import { ResearchBanner } from '@/components/terminal/ResearchBanner';
import { ArrowLeft, ShieldAlert, Activity, CheckCircle, Clock } from 'lucide-react';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ fixtureId: string }>;
}

export default async function FixturePredictionDetailPage({ params }: PageProps) {
  const { fixtureId } = await params;
  const decodedId = decodeURIComponent(fixtureId);

  const allPredictions = await getTerminalPredictions();
  const fixturePredictions = allPredictions.filter(
    (p) => p.fixture_id === decodedId || p.fixture_id === fixtureId
  );

  if (fixturePredictions.length === 0) {
    // If not found in current ledger, show message with link back
    return (
      <div className="flex flex-col min-h-screen bg-[#0B0F0E] font-sans text-[#F0FDF4]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl pt-10 pb-16">
          <Link
            href="/predictions"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#9CA3AF] hover:text-white mb-6"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Predictions
          </Link>
          <div className="bg-[#111827]/60 border border-[#1F2937] rounded-xl p-12 text-center">
            <ShieldAlert className="h-10 w-10 text-amber-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white">Fixture Not Found in Active Registry</h2>
            <p className="text-xs text-[#9CA3AF] mt-1 max-w-md mx-auto">
              No predictions recorded for fixture ID: <code className="text-amber-300 font-mono">{decodedId}</code>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const sample = fixturePredictions[0];
  const dateFormatted = new Date(sample.kickoff_at).toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E] font-sans text-[#F0FDF4]">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl pt-8 pb-16 flex-1">
        {/* Navigation */}
        <Link
          href="/predictions"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-[#9CA3AF] hover:text-white mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Predictions
        </Link>

        {/* Fixture Header */}
        <div className="bg-[#111827]/80 border border-[#1F2937] rounded-xl p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span className="text-xs font-mono text-amber-400 uppercase tracking-wider">
              {sample.league_name} &bull; {dateFormatted} UTC
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-mono font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <ShieldAlert className="h-3.5 w-3.5" /> RESEARCH ONLY
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">
                {sample.home_team} <span className="text-[#9CA3AF] text-xl font-normal">vs</span> {sample.away_team}
              </h1>
              <div className="text-xs font-mono text-[#9CA3AF] mt-1">
                Fixture Reference: <code className="text-neutral-300">{sample.fixture_id}</code>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {sample.settlement_status === 'SETTLED' ? (
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 rounded-lg text-xs font-mono">
                  <CheckCircle className="h-3.5 w-3.5" /> SETTLED
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-[#1F2937] text-neutral-300 border border-[#374151] rounded-lg text-xs font-mono">
                  <Clock className="h-3.5 w-3.5" /> PENDING KICKOFF
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RESEARCH BANNER */}
        <ResearchBanner />

        {/* Lines Breakdown */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#10B981]" /> Asian Handicap Market Lines &amp; Inferences
          </h2>
          <p className="text-xs text-[#9CA3AF] mb-4">
            All handicap lines evaluated by Dixon-Coles goal expectation matrix.
          </p>

          <div className="space-y-4">
            {fixturePredictions.map((pred) => (
              <div
                key={pred.id}
                className="bg-[#111827]/60 border border-[#1F2937] rounded-xl p-5"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1F2937]">
                  <div>
                    <span className="text-xs font-mono text-[#9CA3AF] block">SELECTION &amp; HANDICAP</span>
                    <div className="text-base font-bold text-white capitalize">
                      {pred.side === 'home' ? pred.home_team : pred.away_team} ({pred.line > 0 ? `+${pred.line}` : pred.line})
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-xs font-mono">
                    <div>
                      <span className="text-[#9CA3AF] block text-[10px]">TAKEN ODDS</span>
                      <span className="text-sm font-bold text-white">{pred.taken_odds.toFixed(2)}</span>
                    </div>
                    {pred.closing_odds && (
                      <div>
                        <span className="text-[#9CA3AF] block text-[10px]">CLOSING (PINNACLE)</span>
                        <span className="text-sm font-bold text-[#10B981]">{pred.closing_odds.toFixed(2)}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-[#9CA3AF] block text-[10px]">MODEL FAIR ODDS</span>
                      <span className="text-sm font-bold text-amber-300">{pred.fair_odds.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Quantitative Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 text-xs font-mono">
                  <div className="bg-[#0B0F0E] p-3 rounded-lg border border-[#1F2937]">
                    <span className="text-[#9CA3AF] text-[10px] block">MODEL FAIR PROB</span>
                    <span className="text-sm font-bold text-white">{(pred.fair_probability * 100).toFixed(2)}%</span>
                  </div>
                  <div className="bg-[#0B0F0E] p-3 rounded-lg border border-[#1F2937]">
                    <span className="text-[#9CA3AF] text-[10px] block">DEVIG MARKET PROB</span>
                    <span className="text-sm font-bold text-neutral-300">{(pred.devig_market_probability * 100).toFixed(2)}%</span>
                  </div>
                  <div className="bg-[#0B0F0E] p-3 rounded-lg border border-[#1F2937]">
                    <span className="text-[#9CA3AF] text-[10px] block">STATISTICAL EDGE</span>
                    <span className={pred.edge > 0 ? 'text-amber-300 font-bold text-sm' : 'text-neutral-400 font-bold text-sm'}>
                      {(pred.edge * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="bg-[#0B0F0E] p-3 rounded-lg border border-[#1F2937]">
                    <span className="text-[#9CA3AF] text-[10px] block">EXPECTED VALUE (EV)</span>
                    <span className={pred.ev > 0 ? 'text-amber-300 font-bold text-sm' : 'text-neutral-400 font-bold text-sm'}>
                      {pred.ev > 0 ? `+${pred.ev.toFixed(2)}%` : `${pred.ev.toFixed(2)}%`}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[#1F2937] flex flex-wrap items-center justify-between text-[11px] text-[#9CA3AF] font-mono">
                  <span>Model: <strong>{pred.model_version}</strong></span>
                  <span>Qualification: <strong className="text-amber-300">NOT_VALIDATED</strong></span>
                  {pred.clv !== undefined && pred.clv !== null && (
                    <span>CLV: <strong className={pred.clv >= 0 ? 'text-[#10B981]' : 'text-red-400'}>{pred.clv >= 0 ? `+${pred.clv.toFixed(2)}%` : `${pred.clv.toFixed(2)}%`}</strong></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
