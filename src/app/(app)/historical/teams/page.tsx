'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { GoldService, GoldTeam } from '@/services/goldService';
import { Users, Filter, ArrowRight, ShieldCheck } from 'lucide-react';

export default function TeamsListPage() {
  const [teams, setTeams] = useState<GoldTeam[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    GoldService.getTeams().then(setTeams);
  }, []);

  const filtered = teams.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-[#111827] border border-[#1F2937] rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#10B981]" />
            <h1 className="text-xl font-bold text-[#F0FDF4]">Canonical Teams Directory</h1>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1 font-sans">
            Explore 3,400+ canonical club entities resolved across all historical providers.
          </p>
        </div>

        {/* Filter / Search Bar */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter team name..."
          className="bg-[#0B0F0E] border border-[#1F2937] text-[#F0FDF4] text-xs font-mono rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#10B981] w-56"
        />
      </div>

      {/* Grid of Team Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((t) => (
          <Link
            key={t.id}
            href={`/historical/teams/${t.id}`}
            className="p-5 bg-[#111827] border border-[#1F2937] hover:border-[#10B981]/50 rounded-xl transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#0B0F0E] border border-[#1F2937] flex items-center justify-center text-xl">
                    {t.logo}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#F0FDF4] group-hover:text-[#10B981] transition-colors">
                      {t.name}
                    </h3>
                    <span className="text-[10px] font-mono text-[#9CA3AF] uppercase tracking-widest">
                      {t.stadium}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-[#10B981]">{t.seasonStats.elo} ELO</div>
                  <div className="text-[9px] font-mono text-[#9CA3AF]">{t.seasonStats.pts} Pts</div>
                </div>
              </div>

              {/* Mini Stats Row */}
              <div className="grid grid-cols-4 gap-2 p-2.5 bg-[#0B0F0E] border border-[#1F2937] rounded-lg text-center font-mono text-xs my-2">
                <div>
                  <div className="text-[9px] text-[#9CA3AF] uppercase">Record</div>
                  <div className="font-bold text-[#F0FDF4]">{t.seasonStats.wins}-{t.seasonStats.draws}-{t.seasonStats.losses}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#9CA3AF] uppercase">GF/GA</div>
                  <div className="font-bold text-[#F0FDF4]">{t.seasonStats.gf}/{t.seasonStats.ga}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#9CA3AF] uppercase">xG</div>
                  <div className="font-bold text-[#10B981]">{t.seasonStats.xg}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#9CA3AF] uppercase">xGA</div>
                  <div className="font-bold text-[#EF4444]">{t.seasonStats.xga}</div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#1F2937]/50 flex items-center justify-between text-xs font-mono text-[#9CA3AF] group-hover:text-[#F0FDF4]">
              <span>View Team Intelligence</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform text-[#10B981]" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
