'use client';

import React from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Trophy,
  TrendingUp,
  Target,
  Radio,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';

export default function DashboardPage() {
  const topValueBets = [
    { match: 'Liverpool vs Brighton', pick: 'Liverpool -1.25', odds: 1.95, ev: '+8.4%', edge: 'A+', league: 'Premier League' },
    { match: 'Arsenal vs Everton', pick: 'Over 2.75 Goals', odds: 1.88, ev: '+6.2%', edge: 'A', league: 'Premier League' },
    { match: 'Real Madrid vs Barcelona', pick: 'Real Madrid ML', odds: 2.10, ev: '+5.1%', edge: 'B+', league: 'La Liga' },
    { match: 'Inter vs AC Milan', pick: 'BTTS Yes', odds: 1.75, ev: '+4.8%', edge: 'B', league: 'Serie A' },
    { match: 'Bayern vs Dortmund', pick: 'Over 3.5 Goals', odds: 2.05, ev: '+7.1%', edge: 'A', league: 'Bundesliga' },
  ];

  const popularCompetitions = [
    { id: 'EPL', name: 'Premier League', country: 'England', flag: '🏴', matches: 2660 },
    { id: 'LALIGA', name: 'La Liga', country: 'Spain', flag: '🇪🇸', matches: 2660 },
    { id: 'SERIEA', name: 'Serie A', country: 'Italy', flag: '🇮🇹', matches: 2660 },
    { id: 'BUNDESLIGA', name: 'Bundesliga', country: 'Germany', flag: '🇩🇪', matches: 2142 },
    { id: 'LIGUE1', name: 'Ligue 1', country: 'France', flag: '🇫🇷', matches: 2420 },
    { id: 'EREDIVISIE', name: 'Eredivisie', country: 'Netherlands', flag: '🇳🇱', matches: 2142 },
  ];

  return (
    <div className="space-y-6">
      {/* Today's Top 5 Value Bets Horizontal Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#10B981]" />
            <h2 className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF] font-semibold">
              Top Value Bet Opportunities (EV ≥ +4%)
            </h2>
          </div>
          <Link href="/value-bets" className="text-xs font-mono text-[#10B981] hover:underline">
            View All Signals →
          </Link>
        </div>

        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          {topValueBets.map((b, i) => (
            <div
              key={i}
              className="min-w-[240px] p-4 bg-[#111827] border border-[#1F2937] hover:border-[#10B981]/50 rounded-xl transition-all flex flex-col justify-between shrink-0 font-mono text-xs"
            >
              <div>
                <div className="flex items-center justify-between text-[10px] text-[#9CA3AF] mb-2">
                  <span>{b.league}</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#10B981]/10 text-[#10B981] font-bold">{b.edge}</span>
                </div>
                <div className="font-sans font-bold text-[#F0FDF4] mb-1">{b.match}</div>
                <div className="text-[#10B981] font-bold">{b.pick}</div>
              </div>

              <div className="mt-3 pt-2 border-t border-[#1F2937] flex items-center justify-between text-xs">
                <span className="text-[#9CA3AF]">Odds: <strong className="text-[#F0FDF4]">{b.odds}</strong></span>
                <span className="font-bold text-[#10B981]">{b.ev} EV</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid: Historical Insights & Popular Competitions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Historical Insights Panel */}
        <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-[#10B981]" />
              <h3 className="font-sans font-bold text-[#F0FDF4]">Historical Insights (Gold Layer)</h3>
            </div>
            <Link href="/historical" className="text-[11px] text-[#10B981] hover:underline">
              Historical Hub →
            </Link>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-[#0B0F0E] border border-[#1F2937] rounded-lg space-y-1">
              <div className="flex justify-between font-sans font-bold text-[#F0FDF4]">
                <span>Premier League</span>
                <span className="text-[#10B981]">2,660 Matches</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] text-[#9CA3AF]">
                <div>Avg Goals: <strong className="text-[#F0FDF4]">2.81</strong></div>
                <div>Home Win: <strong className="text-[#F0FDF4]">46.2%</strong></div>
                <div>Over 2.5: <strong className="text-[#F0FDF4]">55.4%</strong></div>
                <div>AH Fav Win: <strong className="text-[#10B981]">52.3%</strong></div>
              </div>
            </div>

            <div className="p-3 bg-[#0B0F0E] border border-[#1F2937] rounded-lg space-y-1">
              <div className="flex justify-between font-sans font-bold text-[#F0FDF4]">
                <span>La Liga</span>
                <span className="text-[#10B981]">2,660 Matches</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] text-[#9CA3AF]">
                <div>Avg Goals: <strong className="text-[#F0FDF4]">2.65</strong></div>
                <div>Home Win: <strong className="text-[#F0FDF4]">44.8%</strong></div>
                <div>Over 2.5: <strong className="text-[#F0FDF4]">49.2%</strong></div>
                <div>AH Fav Win: <strong className="text-[#10B981]">51.1%</strong></div>
              </div>
            </div>
          </div>
        </div>

        {/* Popular Competitions Grid */}
        <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-[#F59E0B]" />
              <h3 className="font-sans font-bold text-[#F0FDF4]">Popular Historical Competitions</h3>
            </div>
            <Link href="/historical/competitions" className="text-[11px] text-[#10B981] hover:underline">
              View All 120+ →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {popularCompetitions.map((c) => (
              <Link
                key={c.id}
                href={`/historical/competitions/${c.id}`}
                className="p-3 bg-[#0B0F0E] border border-[#1F2937] hover:border-[#10B981]/50 rounded-lg transition-all text-center space-y-1 group"
              >
                <div className="text-xl">{c.flag}</div>
                <div className="font-sans font-bold text-[#F0FDF4] group-hover:text-[#10B981] transition-colors">{c.name}</div>
                <div className="text-[10px] text-[#9CA3AF]">{c.matches} Matches</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
