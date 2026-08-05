'use client';

import React from 'react';
import { Radio, Activity, LineChart, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function LiveMatchesPage() {
  const liveMatches = [
    {
      id: 'live-1',
      home: 'Liverpool',
      away: 'Arsenal',
      homeScore: 2,
      awayScore: 1,
      minute: "67'",
      xg: '1.8 - 0.9',
      shots: '12 - 5',
      corners: '5 - 2',
      cards: '1 - 2',
      homeOdds: 1.35,
      drawOdds: 4.50,
      awayOdds: 8.50,
    },
    {
      id: 'live-2',
      home: 'Real Madrid',
      away: 'Barcelona',
      homeScore: 1,
      awayScore: 1,
      minute: "34'",
      xg: '0.9 - 1.2',
      shots: '6 - 8',
      corners: '3 - 4',
      cards: '2 - 1',
      homeOdds: 2.10,
      drawOdds: 3.10,
      awayOdds: 3.40,
    },
  ];

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
        <span className="px-2.5 py-1 text-xs font-mono font-bold bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30 rounded-full animate-pulse">
          ● 2 MATCHES LIVE
        </span>
      </div>

      {/* Live Match Cards */}
      <div className="space-y-4 font-mono text-xs">
        {liveMatches.map((m) => (
          <div key={m.id} className="p-5 bg-[#111827] border border-[#1F2937] hover:border-[#10B981]/50 rounded-xl transition-all space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
              <div className="flex items-center gap-2 text-[#EF4444] font-bold">
                <span className="h-2 w-2 rounded-full bg-[#EF4444] animate-ping" />
                <span>LIVE {m.minute}</span>
              </div>
              <div className="text-[11px] text-[#9CA3AF]">xG: <span className="text-[#10B981] font-bold">{m.xg}</span></div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔴</span>
                <span className="text-base font-bold text-[#F0FDF4]">{m.home}</span>
              </div>
              <div className="text-2xl font-extrabold text-[#10B981] px-4 py-1 bg-[#0B0F0E] rounded-lg border border-[#1F2937]">
                {m.homeScore} - {m.awayScore}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-base font-bold text-[#F0FDF4]">{m.away}</span>
                <span className="text-xl">🔴</span>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 p-3 bg-[#0B0F0E] rounded-lg text-center text-[11px] text-[#9CA3AF]">
              <div>Shots: <span className="text-[#F0FDF4] font-bold">{m.shots}</span></div>
              <div>Corners: <span className="text-[#F0FDF4] font-bold">{m.corners}</span></div>
              <div>Cards: <span className="text-[#F0FDF4] font-bold">{m.cards}</span></div>
              <div>Live 1X2: <span className="text-[#10B981] font-bold">{m.homeOdds} / {m.drawOdds} / {m.awayOdds}</span></div>
              <div className="col-span-3 sm:col-span-1 text-right">
                <Link href={`/historical/matches/${m.id}`} className="text-[#10B981] hover:underline font-bold">
                  View Stats →
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
