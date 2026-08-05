'use client';

import React from 'react';
import { BarChart3, TrendingUp, ShieldCheck, Activity } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#10B981]" />
            <h1 className="text-xl font-bold text-[#F0FDF4]">Advanced Football Analytics</h1>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1 font-sans">
            Rolling xG, xGA, PPDA, team strength metrics, and ELO ratings trajectory.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="League Average xG" value="2.76 xG" subtitle="Premier League 2023-24" icon={TrendingUp} />
        <StatCard title="PPDA Average" value="10.4" subtitle="Passes Per Defensive Action" icon={Activity} />
        <StatCard title="Home Advantage Bonus" value="+0.32 xG" subtitle="Quantified Home Bonus" icon={ShieldCheck} />
        <StatCard title="Total xG Analyzed" value="7,420 xG" subtitle="Across 2,660 Fixtures" icon={BarChart3} />
      </div>
    </div>
  );
}
