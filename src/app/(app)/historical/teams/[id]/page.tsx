'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { HistoricalSubNav } from '@/components/layout/HistoricalSubNav';
import { StatCard } from '@/components/ui/StatCard';
import { Users, TrendingUp, ShieldCheck, Activity } from 'lucide-react';
import { GoldService, GoldTeam } from '@/services/goldService';

export default function TeamDetailPage() {
  const params = useParams();
  const teamId = (params?.id as string) || '';
  const [activeTab, setActiveTab] = useState('overview');
  const [team, setTeam] = useState<GoldTeam | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeam() {
      if (!teamId) return;
      setLoading(true);
      try {
        const teams = await GoldService.getTeams();
        const found = teams.find(t => t.id?.toLowerCase() === teamId.toLowerCase() || t.name?.toLowerCase().includes(teamId.toLowerCase()));
        setTeam(found || null);
      } catch (err) {
        console.error('[TeamDetail] Failed to load team:', err);
        setTeam(null);
      } finally {
        setLoading(false);
      }
    }
    loadTeam();
  }, [teamId]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'statistics', label: 'Statistics' },
  ];

  if (loading) {
    return (
      <div className="p-12 text-center bg-[#111827] border border-[#1F2937] rounded-xl font-mono text-xs text-[#9CA3AF] animate-pulse">
        Loading team analytics from Gold Layer...
      </div>
    );
  }

  if (!team) {
    return (
      <div className="p-12 text-center bg-[#111827] border border-[#1F2937] rounded-xl font-mono text-xs text-[#9CA3AF] space-y-2">
        <div className="text-base font-bold text-white">Team Record Not Found</div>
        <p>No historical profile exists for team identifier &ldquo;{teamId}&rdquo; in the Gold Layer.</p>
      </div>
    );
  }

  const s = team.seasonStats;

  return (
    <div className="space-y-6">
      <HistoricalSubNav
        title={`${team.name} (${team.id.toUpperCase()})`}
        subtitle={`${team.country} • ${team.stadium || 'Stadium'} • Current ELO: ${s.elo > 0 ? s.elo : 'Unranked'}`}
        badge="Canonical Team Entity"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* OVERVIEW TAB CONTENT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Matches Played" value={`${s.played}`} subtitle={`${s.wins}W ${s.draws}D ${s.losses}L`} icon={Users} />
            <StatCard title="Goals Scored (GF)" value={`${s.gf}`} subtitle={`Avg ${(s.played > 0 ? s.gf / s.played : 0).toFixed(2)} / match`} icon={TrendingUp} />
            <StatCard title="Goals Conceded (GA)" value={`${s.ga}`} subtitle={`Avg ${(s.played > 0 ? s.ga / s.played : 0).toFixed(2)} / match`} icon={ShieldCheck} />
            <StatCard title="Current ELO Rating" value={s.elo > 0 ? `${s.elo}` : '—'} subtitle="Dynamic Team Strength" icon={Activity} />
          </div>

          {/* Form Section */}
          <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF] font-semibold">
              Recent Form (Last 5)
            </h3>
            {s.formLast5.length > 0 ? (
              <div className="flex gap-2 font-mono text-sm font-bold">
                {s.formLast5.map((res, i) => (
                  <span
                    key={i}
                    className={`px-3 py-1 rounded ${
                      res === 'W' ? 'bg-[#10B981]/20 text-[#10B981]' : res === 'D' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'bg-[#EF4444]/20 text-[#EF4444]'
                    }`}
                  >
                    {res}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs font-mono text-[#9CA3AF]">
                No form records recorded for this team.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
