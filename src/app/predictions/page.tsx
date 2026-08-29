import React from 'react';
import { getTerminalPredictions } from '@/lib/terminalData';
import { PredictionsView } from '@/components/terminal/PredictionsView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Predictions Registry — HandicapLab',
  description: 'Full out-of-sample prediction audit trail with Closing Line Value (CLV) evaluation.',
};

export default async function PredictionsPage() {
  const predictions = await getTerminalPredictions();

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E] font-sans text-[#F0FDF4]">
      <PredictionsView initialPredictions={predictions} />
    </div>
  );
}
