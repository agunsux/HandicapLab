'use client';

import React from 'react';
import { TrendingDown, LineChart } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';

export default function HistoricalTrendsPage() {
  return (
    <div className="space-y-6">
      <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-[#10B981]" />
          <h1 className="text-xl font-bold text-[#F0FDF4]">Macro Historical Trends & Overround Dynamics</h1>
        </div>
        <p className="text-xs text-[#9CA3AF] mt-1 font-sans">
          Macro-economic changes in sports trading: goal averages decay, home advantage shifts, and Pinnacle margin trends across 7 seasons.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Premier League Goals/Match" value="2.81 Goals" subtitle="7 Season Average (2,660 Matches)" change="+0.14 trend" changeType="positive" icon={LineChart} />
        <StatCard title="Home Advantage Decay" value="46.2% Win Rate" subtitle="Down from 48.5% in 2018" change="-2.3%" changeType="negative" icon={TrendingDown} />
        <StatCard title="Pinnacle Average Overround" value="2.14%" subtitle="Tightest Margin in Global Betting" icon={LineChart} />
      </div>
    </div>
  );
}
