'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { HistoricalSubNav } from '@/components/layout/HistoricalSubNav';
import { StatCard } from '@/components/ui/StatCard';
import { Users, TrendingUp, ShieldCheck, Calendar, Activity } from 'lucide-react';

export default function TeamDetailPage() {
  const params = useParams();
  const teamId = (params?.id as string) || 'mancity';
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'fixtures', label: 'Fixtures', count: 38 },
    { id: 'results', label: 'Results', count: 38 },
    { id: 'squad', label: 'Squad', count: 26 },
    { id: 'statistics', label: 'Statistics' },
    { id: 'odds', label: 'Odds History' },
    { id: 'h2h', label: 'Head-to-Head' },
    { id: 'xg', label: 'xG Profile' },
    { id: 'rolling', label: 'Rolling Form' },
  ];

  return (
    <div className="space-y-6">
      <HistoricalSubNav
        title={`Manchester City (${teamId.toUpperCase()})`}
        subtitle="Etihad Stadium • Premier League • ELO 1985 • Season 2023-2024"
        badge="Canonical Entity #249"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* OVERVIEW TAB CONTENT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="League Rank" value="#1 (1st)" subtitle="91 Pts (28W 7D 3L)" icon={Users} />
            <StatCard title="Expected Goals (xG)" value="88.4 xG" subtitle="Actual Goals: 94 (+5.6 diff)" change="+0.15/match" changeType="positive" icon={TrendingUp} />
            <StatCard title="Expected Goals Against" value="32.1 xGA" subtitle="Actual Conceded: 33 (-0.9 diff)" change="Best in League" changeType="positive" icon={ShieldCheck} />
            <StatCard title="Current ELO Rating" value="1,985" subtitle="World #1 Club ELO" change="+34 ELO gain" changeType="positive" icon={Activity} />
          </div>

          {/* Rolling Form Section */}
          <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF] font-semibold">
              Recent Match Trajectory (Last 5)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 font-mono text-xs">
              {[
                { match: 'vs West Ham (H)', score: '3 - 1', result: 'W', xg: '2.8 - 0.4', date: '19 May 2024' },
                { match: 'vs Tottenham (A)', score: '2 - 0', result: 'W', xg: '1.9 - 0.9', date: '14 May 2024' },
                { match: 'vs Fulham (A)', score: '4 - 0', result: 'W', xg: '3.2 - 0.2', date: '11 May 2024' },
                { match: 'vs Wolves (H)', score: '5 - 1', result: 'W', xg: '4.1 - 0.6', date: '04 May 2024' },
                { match: 'vs Nottm Forest (A)', score: '2 - 0', result: 'W', xg: '1.4 - 1.1', date: '28 Apr 2024' },
              ].map((m, idx) => (
                <div key={idx} className="p-3 bg-[#0B0F0E] border border-[#1F2937] rounded-lg space-y-1">
                  <div className="flex justify-between text-[10px] text-[#9CA3AF]">
                    <span>{m.date}</span>
                    <span className="text-[#10B981] font-bold">{m.result}</span>
                  </div>
                  <div className="font-bold text-[#F0FDF4] text-xs">{m.match}</div>
                  <div className="text-sm font-bold text-[#10B981]">{m.score}</div>
                  <div className="text-[10px] text-[#9CA3AF]">xG: {m.xg}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
