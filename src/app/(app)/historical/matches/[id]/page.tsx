'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { HistoricalSubNav } from '@/components/layout/HistoricalSubNav';
import { StatCard } from '@/components/ui/StatCard';
import { Calendar, ShieldCheck, Activity, LineChart, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase.client';

export default function MatchDetailPage() {
  const params = useParams();
  const matchId = (params?.id as string) || '';
  const [activeTab, setActiveTab] = useState('statistics');
  const [match, setMatch] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMatch() {
      if (!matchId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single();

        if (error) {
          console.warn('[MatchDetail] Query error:', error.message);
          setMatch(null);
        } else {
          setMatch(data);
        }
      } catch (err) {
        console.error('[MatchDetail] Failed to load match:', err);
        setMatch(null);
      } finally {
        setLoading(false);
      }
    }
    loadMatch();
  }, [matchId]);

  const tabs = [
    { id: 'statistics', label: 'Match Stats' },
    { id: 'odds', label: 'Closing Odds' },
  ];

  if (loading) {
    return (
      <div className="p-12 text-center bg-[#111827] border border-[#1F2937] rounded-xl font-mono text-xs text-[#9CA3AF] animate-pulse">
        Loading verified match details from Gold Layer...
      </div>
    );
  }

  if (!match) {
    return (
      <div className="p-12 text-center bg-[#111827] border border-[#1F2937] rounded-xl font-mono text-xs text-[#9CA3AF] space-y-2">
        <div className="text-base font-bold text-white">Match Record Not Found</div>
        <p>The requested fixture ID ({matchId}) does not exist in the verified historical match repository.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="p-6 bg-[#111827] border border-[#1F2937] rounded-xl flex flex-col md:flex-row items-center justify-between gap-6 font-mono">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="text-3xl">⚽</div>
          <div>
            <h2 className="text-lg font-bold text-[#F0FDF4]">{match.home_team}</h2>
            <span className="text-xs text-[#9CA3AF]">xG {match.home_xg ?? '—'}</span>
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs text-[#9CA3AF] uppercase tracking-widest">{match.league}</div>
          <div className="text-3xl font-extrabold text-[#10B981] my-1 tracking-tight">
            {match.home_score ?? 0} - {match.away_score ?? 0}
          </div>
          <div className="text-[11px] text-[#9CA3AF]">
            {match.kickoff ? new Date(match.kickoff).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'} • Status: {match.status}
          </div>
        </div>

        <div className="flex items-center gap-4 text-center sm:text-right">
          <div>
            <h2 className="text-lg font-bold text-[#F0FDF4]">{match.away_team}</h2>
            <span className="text-xs text-[#9CA3AF]">xG {match.away_xg ?? '—'}</span>
          </div>
          <div className="text-3xl">⚽</div>
        </div>
      </div>

      <HistoricalSubNav
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* MATCH STATS TAB */}
      {activeTab === 'statistics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
          <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-[#9CA3AF] font-semibold">Attacking & xG Metrics</h3>
            <div className="space-y-2">
              <div className="flex justify-between"><span>Expected Goals (xG)</span><span className="font-bold text-[#10B981]">{match.home_xg ?? '—'} vs {match.away_xg ?? '—'}</span></div>
              <div className="flex justify-between"><span>Final Score</span><span className="font-bold">{match.home_score ?? 0} vs {match.away_score ?? 0}</span></div>
            </div>
          </div>

          <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-[#9CA3AF] font-semibold">Match Metadata</h3>
            <div className="space-y-2">
              <div className="flex justify-between"><span>League</span><span className="font-bold">{match.league}</span></div>
              <div className="flex justify-between"><span>Match Status</span><span className="font-bold text-[#10B981]">{match.status}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* CLOSING ODDS TAB */}
      {activeTab === 'odds' && (
        <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl space-y-4 font-mono text-xs">
          <h3 className="text-xs uppercase tracking-widest text-[#9CA3AF] font-semibold">Pinnacle Closing Lines</h3>
          <div className="p-4 bg-[#0B0F0E] border border-[#1F2937] rounded-lg text-slate-400">
            Closing odds recorded in prediction ledger for fixture {match.id}.
          </div>
        </div>
      )}
    </div>
  );
}
