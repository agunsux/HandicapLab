'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, ShieldCheck, Activity } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { GoldService, GoldCompetition, GoldMatchDetail } from '@/services/goldService';

export default function AnalyticsPage() {
  const [competitions, setCompetitions] = useState<GoldCompetition[]>([]);
  const [matches, setMatches] = useState<GoldMatchDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      try {
        const [comps, matchData] = await Promise.all([
          GoldService.getCompetitions().catch(() => []),
          GoldService.getMatches().catch(() => [])
        ]);
        setCompetitions(Array.isArray(comps) ? comps : []);
        setMatches(Array.isArray(matchData) ? matchData : []);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  const totalMatches = matches.length;
  const totalXg = matches.reduce((acc, m) => acc + (m.homeXg || 0) + (m.awayXg || 0), 0);
  const avgXg = totalMatches > 0 ? (totalXg / totalMatches).toFixed(2) : '—';
  const homeAdvantageXg = totalMatches > 0 
    ? ((matches.reduce((acc, m) => acc + (m.homeXg || 0) - (m.awayXg || 0), 0)) / totalMatches).toFixed(2)
    : '—';

  return (
    <div className="space-y-6">
      <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#10B981]" />
            <h1 className="text-xl font-bold text-[#F0FDF4]">Advanced Football Analytics</h1>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1 font-sans">
            Rolling xG, xGA, team strength metrics, and verified empirical distributions from Gold Layer.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Gold Dataset xG Avg"
          value={avgXg !== '—' ? `${avgXg} xG` : '—'}
          subtitle={totalMatches > 0 ? `Across ${totalMatches.toLocaleString()} Matches` : 'No verified matches in Gold Layer'}
          icon={TrendingUp}
        />
        <StatCard
          title="Tracked Competitions"
          value={competitions.length > 0 ? `${competitions.length} Leagues` : '0'}
          subtitle="Top Tier Whitelist"
          icon={Activity}
        />
        <StatCard
          title="Empirical Home xG Edge"
          value={homeAdvantageXg !== '—' ? `+${homeAdvantageXg} xG` : '—'}
          subtitle="Home Advantage Differential"
          icon={ShieldCheck}
        />
        <StatCard
          title="Total xG Captured"
          value={totalXg > 0 ? `${totalXg.toFixed(1)} xG` : '—'}
          subtitle={totalMatches > 0 ? `Verified Provider Records` : 'Empty DB'}
          icon={BarChart3}
        />
      </div>

      {totalMatches === 0 && !loading && (
        <div className="p-8 text-center bg-[#111827] border border-[#1F2937] rounded-xl font-mono text-xs text-[#9CA3AF] space-y-1">
          <div className="text-sm font-bold text-white">No Historical Football Match Records Available</div>
          <p>Analytical calculations will automatically compute once match data is populated in the Gold Layer.</p>
        </div>
      )}
    </div>
  );
}
