import React from 'react';
import { getMarketSignals } from '@/lib/marketSignals';
import { MarketSignalsFeed } from '@/components/terminal/MarketSignalsFeed';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Both Teams To Score (BTTS) — HandicapLab',
  description: 'Joint probability evaluation for Both Teams to Score based on defensive rate-decay indicators.',
};

export default async function BttsRoutePage() {
  const signals = await getMarketSignals('btts');

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E]">
      <MarketSignalsFeed
        currentMarket="btts"
        title="Both Teams To Score (BTTS)"
        description="Signals evaluating whether bookmaker odds accurately represent mutual scoring probability based on defensive match dynamics."
        signals={signals}
      />
    </div>
  );
}

