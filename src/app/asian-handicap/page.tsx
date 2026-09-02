import React from 'react';
import { getMarketSignals } from '@/lib/marketSignals';
import { MarketSignalsFeed } from '@/components/terminal/MarketSignalsFeed';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Asian Handicap Signals — HandicapLab',
  description: 'Point-in-time Asian Handicap predictions, closing line value evaluations, and statistical model edges.',
};

export default async function AsianHandicapRoutePage() {
  const signals = await getMarketSignals('asian-handicap');

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E]">
      <MarketSignalsFeed
        currentMarket="asian-handicap"
        title="Asian Handicap Signals"
        description="Value opportunities where model probability deviates from Pinnacle handicap lines. Benchmarked strictly against Pinnacle closing odds."
        signals={signals}
      />
    </div>
  );
}

