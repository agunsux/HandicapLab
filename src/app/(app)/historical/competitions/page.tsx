'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { GoldService, GoldCompetition } from '@/services/goldService';
import { Trophy, ArrowRight, Filter } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';

export default function CompetitionsListPage() {
  const [competitions, setCompetitions] = useState<GoldCompetition[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('ALL');

  useEffect(() => {
    GoldService.getCompetitions().then(setCompetitions);
  }, []);

  const filtered = selectedCountry === 'ALL'
    ? competitions
    : competitions.filter((c) => c.country.toLowerCase() === selectedCountry.toLowerCase());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-[#111827] border border-[#1F2937] rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[#10B981]" />
            <h1 className="text-xl font-bold text-[#F0FDF4]">Historical Competitions</h1>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1 font-sans">
            Browse top football leagues and competitions with 7 full seasons of historical data.
          </p>
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-[#9CA3AF]" />
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="bg-[#0B0F0E] border border-[#1F2937] text-[#F0FDF4] text-xs font-mono rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#10B981]"
          >
            <option value="ALL">All Countries</option>
            <option value="England">England</option>
            <option value="Spain">Spain</option>
            <option value="Italy">Italy</option>
            <option value="Germany">Germany</option>
            <option value="France">France</option>
            <option value="Netherlands">Netherlands</option>
          </select>
        </div>
      </div>

      {/* Grid of Competitions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((comp) => (
          <Link
            key={comp.id}
            href={`/historical/competitions/${comp.id}`}
            className="p-5 bg-[#111827] border border-[#1F2937] hover:border-[#10B981]/50 rounded-xl transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{comp.flag}</span>
                  <div>
                    <h3 className="text-base font-bold text-[#F0FDF4] group-hover:text-[#10B981] transition-colors">
                      {comp.name}
                    </h3>
                    <span className="text-[10px] font-mono text-[#9CA3AF] uppercase tracking-widest">
                      {comp.country}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 rounded">
                  2018-2025
                </span>
              </div>

              {/* Stats Summary Table inside card */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-[#0B0F0E] border border-[#1F2937] rounded-lg text-center my-3 font-mono">
                <div>
                  <div className="text-[9px] text-[#9CA3AF] uppercase">Total Matches</div>
                  <div className="text-xs font-bold text-[#F0FDF4] tabular-nums">{comp.totalMatches}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#9CA3AF] uppercase">Avg Goals</div>
                  <div className="text-xs font-bold text-[#10B981] tabular-nums">{comp.avgGoals}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#9CA3AF] uppercase">Home Win %</div>
                  <div className="text-xs font-bold text-[#F0FDF4] tabular-nums">{comp.homeWinPct}%</div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#1F2937]/50 flex items-center justify-between text-xs font-mono text-[#9CA3AF] group-hover:text-[#F0FDF4]">
              <span>View Competition Specs</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform text-[#10B981]" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
