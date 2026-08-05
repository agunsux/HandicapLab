'use client';

import React, { useState } from 'react';
import { Search, Command, Users, Calendar, Trophy, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function HistoricalSearchPage() {
  const [query, setQuery] = useState('');

  const results = [
    { type: 'team', title: 'Liverpool FC', category: 'Team • England', href: '/historical/teams/liverpool', icon: Users },
    { type: 'team', title: 'Manchester City', category: 'Team • England', href: '/historical/teams/mancity', icon: Users },
    { type: 'competition', title: 'Premier League (2023-24)', category: 'Competition • 380 Matches', href: '/historical/competitions/EPL', icon: Trophy },
    { type: 'match', title: 'Liverpool 2 - 1 Arsenal (15 Aug 2024)', category: 'Match • Premier League', href: '/historical/matches/hist-2024-001', icon: Calendar },
  ].filter((item) => item.title.toLowerCase().includes(query.toLowerCase()) || query === '');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="p-6 bg-[#111827] border border-[#1F2937] rounded-xl space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-[#10B981]" />
          <h1 className="text-xl font-bold text-[#F0FDF4]">Global Historical Search</h1>
        </div>
        <p className="text-xs text-[#9CA3AF] font-sans">
          Spotlight-style search across 2,660 completed matches, 3,400+ clubs, and 84,000+ players.
        </p>

        <div className="flex items-center px-4 py-3 bg-[#0B0F0E] border border-[#1F2937] rounded-xl gap-3">
          <Search className="h-5 w-5 text-[#10B981]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type team, match, league, player name..."
            className="flex-1 bg-transparent text-[#F0FDF4] text-sm focus:outline-none font-sans"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 text-[10px] font-mono font-medium bg-[#1A1F2E] border border-[#1F2937] text-[#9CA3AF] rounded">
            <Command className="h-3 w-3" />K
          </kbd>
        </div>
      </div>

      <div className="p-4 bg-[#111827] border border-[#1F2937] rounded-xl space-y-2">
        <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-[#9CA3AF]">
          Categorized Search Results ({results.length})
        </div>
        {results.map((r, i) => {
          const Icon = r.icon;
          return (
            <Link
              key={i}
              href={r.href}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-[#1A1F2E] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#0B0F0E] border border-[#1F2937] text-[#10B981]">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#F0FDF4] group-hover:text-[#10B981] transition-colors">{r.title}</div>
                  <div className="text-xs text-[#9CA3AF]">{r.category}</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#9CA3AF] group-hover:text-[#10B981] group-hover:translate-x-1 transition-all" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
