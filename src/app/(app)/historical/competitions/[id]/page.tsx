'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { HistoricalSubNav } from '@/components/layout/HistoricalSubNav';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Trophy, Calendar, LineChart, TrendingUp } from 'lucide-react';
import { GoldService, GoldCompetition, GoldTeam } from '@/services/goldService';

interface StandingsRow {
  pos: number;
  team: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: string;
  pts: number;
  form: string;
}

export default function CompetitionDetailPage() {
  const params = useParams();
  const compId = (params?.id as string) || '';
  const [activeTab, setActiveTab] = useState('overview');
  const [season, setSeason] = useState('2023-2024');
  const [competition, setCompetition] = useState<GoldCompetition | null>(null);
  const [teams, setTeams] = useState<GoldTeam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [comps, allTeams] = await Promise.all([
          GoldService.getCompetitions().catch(() => []),
          GoldService.getTeams().catch(() => [])
        ]);

        const currentComp = comps.find(c => c.id?.toLowerCase() === compId?.toLowerCase() || c.name?.toLowerCase().includes(compId?.toLowerCase()));
        setCompetition(currentComp || null);
        setTeams(allTeams);
      } catch (err) {
        console.error('Failed to load competition details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [compId]);

  const standingsData: StandingsRow[] = teams.map((t, idx) => {
    const s = t.seasonStats;
    const diff = s.gf - s.ga;
    return {
      pos: idx + 1,
      team: t.name,
      p: s.played,
      w: s.wins,
      d: s.draws,
      l: s.losses,
      gf: s.gf,
      ga: s.ga,
      gd: diff >= 0 ? `+${diff}` : `${diff}`,
      pts: s.pts,
      form: s.formLast5.join(''),
    };
  });

  const standingsColumns: Column<StandingsRow>[] = [
    { key: 'pos', header: 'Pos', isNumeric: true, className: 'w-12 font-bold text-[#10B981]' },
    { key: 'team', header: 'Team', render: (r) => <span className="font-bold text-[#F0FDF4]">{r.team}</span> },
    { key: 'p', header: 'P', isNumeric: true },
    { key: 'w', header: 'W', isNumeric: true },
    { key: 'd', header: 'D', isNumeric: true },
    { key: 'l', header: 'L', isNumeric: true },
    { key: 'gf', header: 'GF', isNumeric: true },
    { key: 'ga', header: 'GA', isNumeric: true },
    { key: 'gd', header: 'GD', isNumeric: true, render: (r) => <span className="font-mono text-[#10B981] font-semibold">{r.gd}</span> },
    { key: 'pts', header: 'Pts', isNumeric: true, render: (r) => <span className="font-mono font-bold text-base text-[#F0FDF4]">{r.pts}</span> },
    { key: 'form', header: 'Form (Last 5)', render: (r) => (
        <div className="flex gap-1 font-mono text-[10px] font-bold">
          {r.form ? r.form.split('').map((c, i) => (
            <span
              key={i}
              className={`px-1.5 py-0.5 rounded ${
                c === 'W' ? 'bg-[#10B981]/20 text-[#10B981]' : c === 'D' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'bg-[#EF4444]/20 text-[#EF4444]'
              }`}
            >
              {c}
            </span>
          )) : <span className="text-slate-500">—</span>}
        </div>
      )
    },
  ];

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'standings', label: 'Standings', count: teams.length },
    { id: 'statistics', label: 'Statistics' },
  ];

  const compTitle = competition?.name || compId || 'Competition';

  return (
    <div className="space-y-6">
      {/* Top Context Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <HistoricalSubNav
          title={`${compTitle}`}
          subtitle={`Gold Layer Verified • ${competition ? `${competition.totalMatches} Matches` : 'Awaiting Ingestion'}`}
          badge={competition ? "Gold Layer Verified" : "Data Pending"}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* OVERVIEW TAB CONTENT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Matches Ingested" value={competition ? `${competition.totalMatches.toLocaleString()}` : '0'} subtitle="Total Verified" icon={Calendar} />
            <StatCard title="Avg Goals" value={competition ? `${competition.avgGoals.toFixed(2)}` : '—'} subtitle="Historical Average" icon={TrendingUp} />
            <StatCard title="Home Win %" value={competition ? `${(competition.homeWinPct * 100).toFixed(1)}%` : '—'} subtitle={`Draw ${(competition ? competition.drawPct * 100 : 0).toFixed(1)}%`} icon={Trophy} />
            <StatCard title="Over 2.5 Goals %" value={competition ? `${(competition.over25Pct * 100).toFixed(1)}%` : '—'} subtitle={`BTTS ${(competition ? competition.bttsPct * 100 : 0).toFixed(1)}%`} icon={LineChart} />
          </div>

          {/* Standings Snippet */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF] font-semibold">
                Season Standings
              </h3>
              {standingsData.length > 0 && (
                <button onClick={() => setActiveTab('standings')} className="text-xs font-mono text-[#10B981] hover:underline">
                  View Full Table →
                </button>
              )}
            </div>
            {standingsData.length > 0 ? (
              <DataTable columns={standingsColumns} data={standingsData} keyExtractor={(r) => r.team} />
            ) : (
              <div className="p-8 text-center bg-[#111827] border border-[#1F2937] rounded-xl font-mono text-xs text-[#9CA3AF]">
                No standings records available in Gold Layer for this competition.
              </div>
            )}
          </div>
        </div>
      )}

      {/* STANDINGS TAB CONTENT */}
      {activeTab === 'standings' && (
        <div className="space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF] font-semibold">Full Standings Table</h3>
          {standingsData.length > 0 ? (
            <DataTable columns={standingsColumns} data={standingsData} keyExtractor={(r) => r.team} />
          ) : (
            <div className="p-8 text-center bg-[#111827] border border-[#1F2937] rounded-xl font-mono text-xs text-[#9CA3AF]">
              No standings records available in Gold Layer for this competition.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
