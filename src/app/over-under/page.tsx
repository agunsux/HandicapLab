import React from 'react';
import { getMarketSignals } from '@/lib/marketSignals';
import { MarketSignalsFeed } from '@/components/terminal/MarketSignalsFeed';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Over / Under Signals — HandicapLab',
  description: 'Goal totals predictions based on bivariate expected goals decay models against market closing totals.',
};

export default async function OverUnderRoutePage() {
  const signals = await getMarketSignals('over-under');

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E]">
      <MarketSignalsFeed
        currentMarket="over-under"
        title="Over / Under Signals"
        description="Goal totals value opportunities identified by comparing our expected goals distributions against market consensus."
        signals={signals}
      />
    </div>
  );
}

