'use client';

import React, { useState, useEffect } from 'react';
import { Radio, Activity, LineChart, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase.client';

export default function LiveMatchesPage() {
  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLiveMatches() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('matches')
          .select('*')
          .eq('status', 'live')
          .order('kickoff', { ascending: true });

        if (error) {
          console.warn('[LiveMatchesPage] Error fetching live matches:', error.message);
          setLiveMatches([]);
        } else {
          setLiveMatches(data || []);
        }
      } catch (err) {
        console.error('[LiveMatchesPage] Failed to load live fixtures:', err);
        setLiveMatches([]);
      } finally {
        setLoading(false);
      }
    }
    fetchLiveMatches();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-[#EF4444] animate-pulse" />
            <h1 className="text-xl font-bold text-[#F0FDF4]">Live In-Play Matches</h1>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1 font-sans">
            Real-time match dynamics, minute-by-minute xG accumulation, and live market odds.
          </p>
        </div>
        <span className={`px-2.5 py-1 text-xs font-mono font-bold rounded-full ${
          liveMatches.length > 0
            ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30 animate-pulse'
            : 'bg-slate-800 text-slate-400 border border-slate-700'
        }`}>
          ● {liveMatches.length} {liveMatches.length === 1 ? 'MATCH' : 'MATCHES'} LIVE
        </span>
      </div>

      {/* Live Match Cards / Empty State */}
      {loading ? (
        <div className="p-8 text-center bg-[#111827] border border-[#1F2937] rounded-xl text-xs font-mono text-[#9CA3AF] animate-pulse">
          Querying live in-play feeds...
        </div>
      ) : liveMatches.length > 0 ? (
        <div className="space-y-4 font-mono text-xs">
          {liveMatches.map((m) => (
            <div key={m.id} className="p-5 bg-[#111827] border border-[#1F2937] hover:border-[#10B981]/50 rounded-xl transition-all space-y-4">
              <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
                <div className="flex items-center gap-2 text-[#EF4444] font-bold">
                  <span className="h-2 w-2 rounded-full bg-[#EF4444] animate-ping" />
                  <span>LIVE {m.minute ? `${m.minute}'` : ''}</span>
                </div>
                <div className="text-[11px] text-[#9CA3AF]">
                  xG: <span className="text-[#10B981] font-bold">{m.home_xg ?? '0.0'} - {m.away_xg ?? '0.0'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold text-[#F0FDF4]">{m.home_team}</span>
                </div>
                <div className="text-2xl font-extrabold text-[#10B981] px-4 py-1 bg-[#0B0F0E] rounded-lg border border-[#1F2937]">
                  {m.home_score ?? 0} - {m.away_score ?? 0}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold text-[#F0FDF4]">{m.away_team}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-[#0B0F0E] rounded-lg text-center text-[11px] text-[#9CA3AF]">
                <div>League: <span className="text-[#F0FDF4] font-bold">{m.league}</span></div>
                <div>Status: <span className="text-[#10B981] font-bold">{m.status}</span></div>
                <div>Kickoff: <span className="text-[#F0FDF4] font-bold">{m.kickoff ? new Date(m.kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span></div>
                <div className="text-right">
                  <Link href={`/historical/matches/${m.id}`} className="text-[#10B981] hover:underline font-bold">
                    View Details →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center bg-[#111827] border border-[#1F2937] rounded-xl font-mono text-xs text-[#9CA3AF] space-y-2">
          <div className="text-base font-bold text-white">No Live In-Play Matches Currently Active</div>
          <p className="max-w-md mx-auto text-slate-400">
            Live telemetry activates automatically when fixtures in whitelisted leagues kick off. Check back during scheduled match windows.
          </p>
        </div>
      )}
    </div>
  );
}
