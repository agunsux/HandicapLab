import React from 'react';
import { generatePremierLeagueAhResearch } from '@/lib/research/premierLeagueAhEngine';
import { PremierLeagueAhResearchView } from '@/components/research/PremierLeagueAhResearchView';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Premier League Asian Handicap Research (2024–2026) — HandicapLab',
  description:
    'Two-season empirical backtest and line matrix research for Premier League Asian Handicap +0 and line-level deviations with real Pinnacle closing odds.',
};

export default function PremierLeagueAhResearchPage() {
  let payload: any = null;
  try {
    payload = generatePremierLeagueAhResearch();
  } catch (err) {
    console.warn('[PremierLeagueAhResearchPage] Research dataset unavailable:', (err as Error)?.message || err);
  }

  if (!payload) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0B0F0E] text-[#F0FDF4] p-8">
        <div className="max-w-4xl mx-auto p-6 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 font-mono text-sm space-y-2">
          <div className="text-base font-bold">RESEARCH DATASET NOT BUNDLED</div>
          <p>
            The Premier League Asian Handicap canonical matches dataset is not bundled in this container deployment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E]">
      <PremierLeagueAhResearchView data={payload} />
    </div>
  );
}
