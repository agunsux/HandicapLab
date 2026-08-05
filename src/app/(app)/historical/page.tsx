'use client';

import React from 'react';
import Link from 'next/link';
import {
  Trophy,
  Users,
  Calendar,
  UserCheck,
  LineChart,
  GitCompare,
  TrendingDown,
  Award,
  ArrowRight,
  Database,
  Search,
} from 'lucide-react';
import { SearchBar } from '@/components/ui/SearchBar';

const HISTORICAL_MODULES = [
  { id: 'competitions', title: 'Competitions', count: '120+ Leagues', desc: 'Browse 7 seasons of Premier League, La Liga, Serie A, Bundesliga & Tier 1 data.', href: '/historical/competitions', icon: Trophy, accent: 'from-[#10B981]/20 to-transparent' },
  { id: 'teams', title: 'Teams', count: '3,400+ Clubs', desc: 'Canonical entity analytics, rolling xG form, ELO ratings, and historical performance.', href: '/historical/teams', icon: Users, accent: 'from-[#3B82F6]/20 to-transparent' },
  { id: 'matches', title: 'Matches', count: '180,000+ Matches', desc: 'Deep match explorer with shots map, minute-by-minute xG accumulation, and lineups.', href: '/historical/matches', icon: Calendar, accent: 'from-[#F59E0B]/20 to-transparent' },
  { id: 'players', title: 'Players', count: '84,000+ Players', desc: 'Individual player stats, expected goals, assists, and disciplinary history.', href: '/historical/players', icon: UserCheck, accent: 'from-[#8B5CF6]/20 to-transparent' },
  { id: 'odds-explorer', title: 'Odds Explorer', count: '2.1M Odds Rows', desc: 'Query Pinnacle opening & closing lines, Steam/Drift line movement, and CLV analysis.', href: '/historical/odds-explorer', icon: LineChart, isKiller: true, accent: 'from-[#10B981]/30 to-transparent' },
  { id: 'h2h', title: 'Head-to-Head', count: '45,000 Pairs', desc: 'Pairwise historical head-to-head records, goal averages, and matchup trends.', href: '/historical/h2h', icon: GitCompare, accent: 'from-[#EC4899]/20 to-transparent' },
  { id: 'trends', title: 'Trends', count: '890 Trends', desc: 'League-wide scoring shifts, home advantage decay, and market overround dynamics.', href: '/historical/trends', icon: TrendingDown, accent: 'from-[#14B8A6]/20 to-transparent' },
  { id: 'records', title: 'Records', count: '120 Records', desc: 'All-time winning streaks, peak xG performances, and market inefficiency spikes.', href: '/historical/records', icon: Award, accent: 'from-[#F59E0B]/20 to-transparent' },
];

export default function HistoricalLandingPage() {
  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-r from-[#111827] via-[#1A1F2E] to-[#0B0F0E] border border-[#1F2937] rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Database className="h-48 w-48 text-[#10B981]" />
        </div>
        <div className="relative z-10 space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs font-mono font-bold uppercase tracking-widest">
            <span>Football Data Warehouse</span>
            <span className="text-[#F59E0B]">★ Star Feature</span>
          </div>
          <h1 className="text-3xl font-bold font-sans tracking-tight text-[#F0FDF4]">
            Historical Intelligence Engine
          </h1>
          <p className="text-xs text-[#9CA3AF] leading-relaxed">
            Query across 2,660 completed EPL matches, 21,660 historical odds, and 6,239 settled value bets.
            Powered by Gold Layer materialized views with zero future data leakage.
          </p>

          <div className="pt-2">
            <SearchBar />
          </div>
        </div>
      </div>

      {/* Grid of 8 Historical Modules */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-mono uppercase tracking-widest text-[#9CA3AF] font-semibold">
            Intelligence Modules
          </h2>
          <span className="text-xs font-mono text-[#10B981]">8 Modules Active</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {HISTORICAL_MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.id}
                href={mod.href}
                className="group relative p-5 bg-[#111827] border border-[#1F2937] hover:border-[#10B981]/50 rounded-xl transition-all duration-200 flex flex-col justify-between overflow-hidden"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${mod.accent}`} />

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-lg bg-[#0B0F0E] border border-[#1F2937] text-[#10B981] group-hover:scale-105 transition-transform">
                      <Icon className="h-5 w-5" />
                    </div>
                    {mod.isKiller ? (
                      <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-[#10B981] text-black rounded uppercase">
                        Killer Feature
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-[#9CA3AF]">{mod.count}</span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-[#F0FDF4] group-hover:text-[#10B981] transition-colors mb-1">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-[#9CA3AF] leading-normal">{mod.desc}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#1F2937]/50 flex items-center justify-between text-xs font-mono text-[#9CA3AF] group-hover:text-[#F0FDF4]">
                  <span>Explore Module</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform text-[#10B981]" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
