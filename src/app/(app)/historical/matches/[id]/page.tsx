'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { HistoricalSubNav } from '@/components/layout/HistoricalSubNav';
import { StatCard } from '@/components/ui/StatCard';
import { Calendar, ShieldCheck, Activity, LineChart, TrendingUp, Award } from 'lucide-react';

export default function MatchDetailPage() {
  const params = useParams();
  const matchId = (params?.id as string) || 'hist-2024-001';
  const [activeTab, setActiveTab] = useState('timeline');

  const tabs = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'statistics', label: 'Match Stats' },
    { id: 'shots', label: 'Shots & xG Map' },
    { id: 'xg', label: 'xG Timeline' },
    { id: 'odds', label: 'Closing Odds' },
    { id: 'line-movement', label: 'Line Movement' },
    { id: 'lineups', label: 'Lineups' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="p-6 bg-[#111827] border border-[#1F2937] rounded-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="text-3xl">🔴</div>
          <div>
            <h2 className="text-lg font-bold text-[#F0FDF4]">Liverpool</h2>
            <span className="text-xs font-mono text-[#9CA3AF]">xG 1.8</span>
          </div>
        </div>

        <div className="text-center font-mono">
          <div className="text-xs text-[#9CA3AF] uppercase tracking-widest">Premier League • Matchday 23</div>
          <div className="text-3xl font-extrabold text-[#10B981] my-1 tracking-tight">2 - 1</div>
          <div className="text-[11px] text-[#9CA3AF]">15 Aug 2024 • Anfield • Ref: Michael Oliver</div>
        </div>

        <div className="flex items-center gap-4 text-center sm:text-right">
          <div>
            <h2 className="text-lg font-bold text-[#F0FDF4]">Arsenal</h2>
            <span className="text-xs font-mono text-[#9CA3AF]">xG 0.9</span>
          </div>
          <div className="text-3xl">🔴</div>
        </div>
      </div>

      <HistoricalSubNav
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* TIMELINE TAB */}
      {activeTab === 'timeline' && (
        <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl space-y-4 font-mono text-xs">
          <h3 className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF] font-semibold">Match Chronology</h3>
          <div className="space-y-2">
            {[
              { min: "12'", text: '⚽ Goal! Mohamed Salah (assist: Trent Alexander-Arnold)', xg: 'xG 0.12', team: 'home' },
              { min: "34'", text: '🟨 Yellow Card: Virgil van Dijk (Foul)', team: 'home' },
              { min: "45+2'", text: '⚽ Goal! Bukayo Saka (Penalty)', xg: 'xG 0.76', team: 'away' },
              { min: "67'", text: '⚽ Goal! Darwin Nunez (assist: Luis Diaz)', xg: 'xG 0.34', team: 'home' },
              { min: "89'", text: '🟨 Yellow Card: Declan Rice (Dissent)', team: 'away' },
            ].map((e, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-[#0B0F0E] border border-[#1F2937] rounded-lg">
                <span className="font-bold text-[#10B981] w-12">{e.min}</span>
                <span className="flex-1 text-[#F0FDF4]">{e.text}</span>
                {e.xg && <span className="px-2 py-0.5 rounded bg-[#10B981]/10 text-[#10B981] font-bold text-[10px]">{e.xg}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MATCH STATS TAB */}
      {activeTab === 'statistics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
          <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-[#9CA3AF] font-semibold">Attacking & xG Metrics</h3>
            <div className="space-y-2">
              <div className="flex justify-between"><span>Expected Goals (xG)</span><span className="font-bold text-[#10B981]">1.8 vs 0.9</span></div>
              <div className="flex justify-between"><span>Total Shots</span><span className="font-bold">12 vs 8</span></div>
              <div className="flex justify-between"><span>Shots on Target</span><span className="font-bold">5 vs 3</span></div>
              <div className="flex justify-between"><span>Corners</span><span className="font-bold">6 vs 2</span></div>
            </div>
          </div>

          <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-[#9CA3AF] font-semibold">Possession & Control</h3>
            <div className="space-y-2">
              <div className="flex justify-between"><span>Possession %</span><span className="font-bold text-[#10B981]">58% vs 42%</span></div>
              <div className="flex justify-between"><span>Pass Accuracy</span><span className="font-bold">84% vs 78%</span></div>
              <div className="flex justify-between"><span>PPDA (Pressing)</span><span className="font-bold">8.4 vs 12.1</span></div>
              <div className="flex justify-between"><span>Fouls Committed</span><span className="font-bold">12 vs 14</span></div>
            </div>
          </div>
        </div>
      )}

      {/* CLOSING ODDS TAB */}
      {activeTab === 'odds' && (
        <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl space-y-4 font-mono text-xs">
          <h3 className="text-xs uppercase tracking-widest text-[#9CA3AF] font-semibold">Pinnacle & Asian Market Closing Lines</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-[#0B0F0E] border border-[#1F2937] rounded-lg">
              <div className="text-[10px] text-[#9CA3AF]">Moneyline (Home / Draw / Away)</div>
              <div className="text-sm font-bold text-[#10B981] mt-1">1.65 / 3.90 / 5.20</div>
            </div>
            <div className="p-3 bg-[#0B0F0E] border border-[#1F2937] rounded-lg">
              <div className="text-[10px] text-[#9CA3AF]">Asian Handicap Line</div>
              <div className="text-sm font-bold text-[#10B981] mt-1">-1.0 (1.92 / 1.96)</div>
            </div>
            <div className="p-3 bg-[#0B0F0E] border border-[#1F2937] rounded-lg">
              <div className="text-[10px] text-[#9CA3AF]">Over / Under Line</div>
              <div className="text-sm font-bold text-[#10B981] mt-1">2.75 (1.88 / 2.02)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
