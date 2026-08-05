'use client';

import React from 'react';
import { GitCompare, Trophy } from 'lucide-react';
import { DataTable, Column } from '@/components/ui/DataTable';

export default function HeadToHeadPage() {
  const h2hData = [
    { pair: 'Liverpool vs Arsenal', meetings: 14, hWins: 6, draws: 5, aWins: 3, avgGoals: 3.21, over25: '64.2%', lastMeeting: 'Liverpool 2-1 Arsenal (15 Aug 2024)' },
    { pair: 'Man City vs Liverpool', meetings: 16, hWins: 7, draws: 6, aWins: 3, avgGoals: 3.44, over25: '75.0%', lastMeeting: 'Man City 1-1 Liverpool (25 Nov 2023)' },
    { pair: 'Arsenal vs Tottenham', meetings: 14, hWins: 8, draws: 4, aWins: 2, avgGoals: 3.00, over25: '57.1%', lastMeeting: 'Tottenham 2-3 Arsenal (28 Apr 2024)' },
  ];

  const columns: Column<typeof h2hData[0]>[] = [
    { key: 'pair', header: 'H2H Matchup', render: (r) => <span className="font-bold text-[#F0FDF4] text-xs">{r.pair}</span> },
    { key: 'meetings', header: 'Matches', isNumeric: true },
    { key: 'hWins', header: 'Home W', isNumeric: true, render: (r) => <span className="font-mono text-[#10B981] font-bold">{r.hWins}</span> },
    { key: 'draws', header: 'Draws', isNumeric: true, render: (r) => <span className="font-mono text-[#F59E0B] font-bold">{r.draws}</span> },
    { key: 'aWins', header: 'Away W', isNumeric: true, render: (r) => <span className="font-mono text-[#EF4444] font-bold">{r.aWins}</span> },
    { key: 'avgGoals', header: 'Avg Goals', isNumeric: true, render: (r) => <span className="font-mono text-[#10B981]">{r.avgGoals}</span> },
    { key: 'over25', header: 'Over 2.5 %', isNumeric: true, render: (r) => <span className="font-mono text-[#F0FDF4]">{r.over25}</span> },
    { key: 'lastMeeting', header: 'Last Result', render: (r) => <span className="text-[#9CA3AF] text-[11px] font-mono">{r.lastMeeting}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-[#10B981]" />
            <h1 className="text-xl font-bold text-[#F0FDF4]">Head-to-Head Pairwise Explorer</h1>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1 font-sans">
            Pairwise historical matchups, scoring trends, and win distribution across 45,000+ team pairs.
          </p>
        </div>
      </div>

      <DataTable columns={columns} data={h2hData} keyExtractor={(r) => r.pair} />
    </div>
  );
}
