'use client';

import React, { useState, useEffect } from 'react';
import { TrendingDown, LineChart } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { GoldService, GoldCompetition } from '@/services/goldService';

export default function HistoricalTrendsPage() {
  const [competitions, setCompetitions] = useState<GoldCompetition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const comps = await GoldService.getCompetitions();
        setCompetitions(comps);
      } catch (err) {
        console.error('Failed to load competition trends:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalMatches = competitions.reduce((acc, c) => acc + c.totalMatches, 0);
  const avgGoals = competitions.length > 0
    ? (competitions.reduce((acc, c) => acc + c.avgGoals, 0) / competitions.length).toFixed(2)
    : '—';
  const avgHomeWinPct = competitions.length > 0
    ? `${((competitions.reduce((acc, c) => acc + c.homeWinPct, 0) / competitions.length) * 100).toFixed(1)}%`
    : '—';

  return (
    <div className="space-y-6">
      <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-[#10B981]" />
          <h1 className="text-xl font-bold text-[#F0FDF4]">Macro Historical Trends & Overround Dynamics</h1>
        </div>
        <p className="text-xs text-[#9CA3AF] mt-1 font-sans">
          Macro-economic dynamics in sports trading: goal averages decay, home advantage shifts, and Pinnacle sharp margin trends.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Macro Goals / Match"
          value={avgGoals !== '—' ? `${avgGoals} Goals` : '—'}
          subtitle={`Across ${totalMatches.toLocaleString()} Matches`}
          icon={LineChart}
        />
        <StatCard
          title="Home Win Rate"
          value={avgHomeWinPct}
          subtitle="Top Leagues Composite"
          icon={TrendingDown}
        />
        <StatCard
          title="Pinnacle Benchmark Overround"
          value="~2.1%"
          subtitle="Sharp Closing Line Reference"
          icon={LineChart}
        />
      </div>
    </div>
  );
}
