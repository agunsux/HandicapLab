import React from 'react';
import { generatePremierLeagueAhResearch } from '@/lib/research/premierLeagueAhEngine';
import { PremierLeagueAhResearchView } from '@/components/research/PremierLeagueAhResearchView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Premier League Asian Handicap Research (2024–2026) — HandicapLab',
  description:
    'Two-season empirical backtest and line matrix research for Premier League Asian Handicap +0 and line-level deviations with real Pinnacle closing odds.',
};

export default function PremierLeagueAhResearchPage() {
  const payload = generatePremierLeagueAhResearch();

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E]">
      <PremierLeagueAhResearchView data={payload} />
    </div>
  );
}
