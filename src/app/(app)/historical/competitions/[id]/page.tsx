'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { HistoricalSubNav } from '@/components/layout/HistoricalSubNav';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Trophy, Calendar, LineChart, TrendingUp, Filter } from 'lucide-react';

export default function CompetitionDetailPage() {
  const params = useParams();
  const compId = (params?.id as string) || 'EPL';
  const [activeTab, setActiveTab] = useState('overview');
  const [season, setSeason] = useState('2023-2024');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'standings', label: 'Standings', count: 20 },
    { id: 'fixtures', label: 'Fixtures', count: 380 },
    { id: 'results', label: 'Results', count: 380 },
    { id: 'statistics', label: 'Statistics' },
    { id: 'odds', label: 'Odds Analytics' },
    { id: 'trends', label: 'Trends' },
  ];

  const standingsData = [
    { pos: 1, team: 'Manchester City', p: 38, w: 28, d: 7, l: 3, gf: 94, ga: 33, gd: '+61', pts: 91, form: 'WWWWD' },
    { pos: 2, team: 'Arsenal', p: 38, w: 26, d: 6, l: 6, gf: 88, ga: 42, gd: '+46', pts: 84, form: 'WLWDW' },
    { pos: 3, team: 'Liverpool', p: 38, w: 24, d: 8, l: 6, gf: 86, ga: 41, gd: '+45', pts: 80, form: 'WWWLW' },
    { pos: 4, team: 'Aston Villa', p: 38, w: 20, d: 8, l: 10, gf: 76, ga: 61, gd: '+15', pts: 68, form: 'LWDWW' },
    { pos: 5, team: 'Tottenham Hotspur', p: 38, w: 20, d: 6, l: 12, gf: 74, ga: 61, gd: '+13', pts: 66, form: 'WLLWL' },
  ];

  const standingsColumns: Column<typeof standingsData[0]>[] = [
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
          {r.form.split('').map((c, i) => (
            <span
              key={i}
              className={`px-1.5 py-0.5 rounded ${
                c === 'W' ? 'bg-[#10B981]/20 text-[#10B981]' : c === 'D' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'bg-[#EF4444]/20 text-[#EF4444]'
              }`}
            >
              {c}
            </span>
          ))}
        </div>
      )
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Context Navigation & Season Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <HistoricalSubNav
          title={`Premier League (${compId})`}
          subtitle="Tier 1 Core Competition • 7 Seasons Ingested (2,660 Matches)"
          badge="Gold Layer Verified"
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div className="flex items-center gap-2 bg-[#111827] p-2 rounded-xl border border-[#1F2937] shrink-0">
          <Calendar className="h-4 w-4 text-[#10B981]" />
          <span className="text-xs font-mono text-[#9CA3AF]">Season:</span>
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="bg-[#0B0F0E] border border-[#1F2937] text-[#F0FDF4] text-xs font-mono rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#10B981]"
          >
            <option value="2024-2025">2024-2025</option>
            <option value="2023-2024">2023-2024</option>
            <option value="2022-2023">2022-2023</option>
            <option value="2021-2022">2021-2022</option>
            <option value="2020-2021">2020-2021</option>
            <option value="2019-2020">2019-2020</option>
            <option value="2018-2019">2018-2019</option>
          </select>
        </div>
      </div>

      {/* OVERVIEW TAB CONTENT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Matches Played" value="380 / 380" subtitle={`Season ${season}`} icon={Calendar} />
            <StatCard title="Total Goals" value="1,067" subtitle="Avg 2.81 goals/match" change="+0.12 vs avg" changeType="positive" icon={TrendingUp} />
            <StatCard title="Home Win %" value="46.2%" subtitle="Draw 23.8% | Away 30.0%" icon={Trophy} />
            <StatCard title="Over 2.5 Goals %" value="55.4%" subtitle="BTTS 52.1%" change="+3.2%" changeType="positive" icon={LineChart} />
          </div>

          {/* Standings Snippet */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF] font-semibold">
                Official Season Standings ({season})
              </h3>
              <button onClick={() => setActiveTab('standings')} className="text-xs font-mono text-[#10B981] hover:underline">
                View Full Table →
              </button>
            </div>
            <DataTable columns={standingsColumns} data={standingsData} keyExtractor={(r) => r.team} />
          </div>
        </div>
      )}

      {/* STANDINGS TAB CONTENT */}
      {activeTab === 'standings' && (
        <div className="space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF] font-semibold">Full Standings Table</h3>
          <DataTable columns={standingsColumns} data={standingsData} keyExtractor={(r) => r.team} />
        </div>
      )}
    </div>
  );
}
