'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Target,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Calendar,
  Layers,
  Activity,
  AlertCircle
} from 'lucide-react';
import { GoldService, GoldCompetition } from '@/services/goldService';

export default function DashboardPage() {
  const [topValueBets, setTopValueBets] = useState<any[]>([]);
  const [competitions, setCompetitions] = useState<GoldCompetition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const [betsRes, comps] = await Promise.all([
          fetch('/api/value-intelligence/bets').then(r => r.json()).catch(() => ({ success: false, data: [] })),
          GoldService.getCompetitions().catch(() => [])
        ]);

        if (betsRes.success && Array.isArray(betsRes.data)) {
          setTopValueBets(betsRes.data.slice(0, 5));
        } else {
          setTopValueBets([]);
        }

        setCompetitions(Array.isArray(comps) ? comps : []);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Today's Top Value Bets Horizontal Cards */}
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

        {loading ? (
          <div className="p-8 text-center bg-[#111827] border border-[#1F2937] rounded-xl text-xs font-mono text-[#9CA3AF] animate-pulse">
            Loading live market edge opportunities...
          </div>
        ) : topValueBets.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {topValueBets.map((b) => (
              <div
                key={b.id}
                className="min-w-[240px] p-4 bg-[#111827] border border-[#1F2937] hover:border-[#10B981]/50 rounded-xl transition-all flex flex-col justify-between shrink-0 font-mono text-xs"
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] text-[#9CA3AF] mb-2">
                    <span>{b.league}</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#10B981]/10 text-[#10B981] font-bold">
                      {b.confidenceBucket || 'ACTIVE'}
                    </span>
                  </div>
                  <div className="font-sans font-bold text-[#F0FDF4] mb-1">
                    {b.homeTeam} vs {b.awayTeam}
                  </div>
                  <div className="text-[#10B981] font-bold">
                    {b.selection} ({b.market})
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-[#1F2937] flex items-center justify-between text-xs">
                  <span className="text-[#9CA3AF]">Odds: <strong className="text-[#F0FDF4]">{b.bookmakerOdds?.toFixed(2) || '—'}</strong></span>
                  <span className="font-bold text-[#10B981]">+{(b.expectedValue * 100).toFixed(1)}% EV</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 bg-[#111827] border border-[#1F2937] rounded-xl text-center font-mono space-y-1">
            <div className="text-xs text-[#F0FDF4] font-bold">No Qualifying Value Opportunities Active</div>
            <p className="text-[11px] text-[#9CA3AF]">
              All upcoming fixtures are currently efficiently priced within model variance margins (&lt; +4% EV).
            </p>
          </div>
        )}
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

          {competitions.length > 0 ? (
            <div className="space-y-3">
              {competitions.slice(0, 2).map((comp) => (
                <div key={comp.id} className="p-3 bg-[#0B0F0E] border border-[#1F2937] rounded-lg space-y-1">
                  <div className="flex justify-between font-sans font-bold text-[#F0FDF4]">
                    <span>{comp.name}</span>
                    <span className="text-[#10B981]">{comp.totalMatches.toLocaleString()} Matches</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] text-[#9CA3AF]">
                    <div>Avg Goals: <strong className="text-[#F0FDF4]">{comp.avgGoals.toFixed(2)}</strong></div>
                    <div>Home Win: <strong className="text-[#F0FDF4]">{(comp.homeWinPct * 100).toFixed(1)}%</strong></div>
                    <div>Over 2.5: <strong className="text-[#F0FDF4]">{(comp.over25Pct * 100).toFixed(1)}%</strong></div>
                    <div>AH Fav Win: <strong className="text-[#10B981]">{(comp.ahFavWinPct * 100).toFixed(1)}%</strong></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 bg-[#0B0F0E] border border-[#1F2937] rounded-lg text-center space-y-1">
              <div className="text-xs text-[#9CA3AF]">No historical league aggregates available in Gold Layer.</div>
            </div>
          )}
        </div>

        {/* Popular Competitions Grid */}
        <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-[#F59E0B]" />
              <h3 className="font-sans font-bold text-[#F0FDF4]">Tracked Competitions</h3>
            </div>
            <Link href="/historical/competitions" className="text-[11px] text-[#10B981] hover:underline">
              View All →
            </Link>
          </div>

          {competitions.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {competitions.map((c) => (
                <Link
                  key={c.id}
                  href={`/historical/competitions/${c.id}`}
                  className="p-3 bg-[#0B0F0E] border border-[#1F2937] hover:border-[#10B981]/50 rounded-lg transition-all text-center space-y-1 group"
                >
                  <div className="text-xl">{c.flag || '⚽'}</div>
                  <div className="font-sans font-bold text-[#F0FDF4] group-hover:text-[#10B981] transition-colors truncate">{c.name}</div>
                  <div className="text-[10px] text-[#9CA3AF]">{c.totalMatches.toLocaleString()} Matches</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-6 bg-[#0B0F0E] border border-[#1F2937] rounded-lg text-center space-y-1">
              <div className="text-xs text-[#9CA3AF]">No tracked competitions available in Gold Layer view.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
