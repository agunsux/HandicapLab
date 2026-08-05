'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Calendar, Filter, ArrowRight } from 'lucide-react';
import { FilterBar } from '@/components/ui/FilterBar';
import { DataTable, Column } from '@/components/ui/DataTable';

export default function MatchesExplorerPage() {
  const [season, setSeason] = useState('2023-2024');
  const [marketFilter, setMarketFilter] = useState('ALL');

  const filters = [
    {
      key: 'season',
      label: 'Season',
      value: season,
      onChange: setSeason,
      options: [
        { label: '2024-2025', value: '2024-2025' },
        { label: '2023-2024', value: '2023-2024' },
        { label: '2022-2023', value: '2022-2023' },
        { label: '2021-2022', value: '2021-2022' },
        { label: '2020-2021', value: '2020-2021' },
      ],
    },
    {
      key: 'market',
      label: 'Market Type',
      value: marketFilter,
      onChange: setMarketFilter,
      options: [
        { label: 'All Markets', value: 'ALL' },
        { label: 'Asian Handicap', value: 'AH' },
        { label: 'Over / Under', value: 'OU' },
        { label: 'Moneyline (1X2)', value: 'ML' },
      ],
    },
  ];

  const matchesData = [
    { id: 'hist-2024-001', date: '2024-05-19', home: 'Man City', score: '3 - 1', away: 'West Ham', xg: '2.8 - 0.4', ahLine: '-2.0', ouLine: '3.5', closingPinnacle: '1.18 / 8.50 / 17.00', result: 'H' },
    { id: 'hist-2024-002', date: '2024-05-19', home: 'Arsenal', score: '2 - 1', away: 'Everton', xg: '2.4 - 0.6', ahLine: '-1.75', ouLine: '3.0', closingPinnacle: '1.17 / 8.00 / 18.00', result: 'H' },
    { id: 'hist-2024-003', date: '2024-05-19', home: 'Liverpool', score: '2 - 0', away: 'Wolves', xg: '2.1 - 0.3', ahLine: '-1.5', ouLine: '3.25', closingPinnacle: '1.20 / 7.50 / 14.00', result: 'H' },
    { id: 'hist-2024-004', date: '2024-05-19', home: 'Brighton', score: '0 - 2', away: 'Man Utd', xg: '1.1 - 1.8', ahLine: '-0.25', ouLine: '3.5', closingPinnacle: '2.15 / 4.10 / 3.10', result: 'A' },
    { id: 'hist-2024-005', date: '2024-05-19', home: 'Chelsea', score: '2 - 1', away: 'Bournemouth', xg: '1.9 - 1.2', ahLine: '-1.0', ouLine: '3.5', closingPinnacle: '1.42 / 5.50 / 6.50', result: 'H' },
  ];

  const columns: Column<typeof matchesData[0]>[] = [
    { key: 'date', header: 'Date', render: (r) => <span className="font-mono text-xs text-[#9CA3AF]">{r.date}</span> },
    { key: 'match', header: 'Fixture (Home vs Away)', render: (r) => (
        <Link href={`/historical/matches/${r.id}`} className="font-bold text-[#F0FDF4] hover:text-[#10B981] transition-colors">
          {r.home} <span className="text-[#10B981] px-1 font-mono font-bold">{r.score}</span> {r.away}
        </Link>
      )
    },
    { key: 'xg', header: 'xG (H-A)', isNumeric: true, render: (r) => <span className="font-mono text-[#10B981]">{r.xg}</span> },
    { key: 'ahLine', header: 'AH Line', isNumeric: true, render: (r) => <span className="font-mono">{r.ahLine}</span> },
    { key: 'ouLine', header: 'OU Line', isNumeric: true, render: (r) => <span className="font-mono">{r.ouLine}</span> },
    { key: 'closingPinnacle', header: 'Pinnacle Closing ML', isNumeric: true, render: (r) => <span className="font-mono text-[#9CA3AF] text-[11px]">{r.closingPinnacle}</span> },
    { key: 'action', header: 'Action', render: (r) => (
        <Link href={`/historical/matches/${r.id}`} className="inline-flex items-center gap-1 font-mono text-[11px] text-[#10B981] hover:underline">
          <span>Details</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#10B981]" />
            <h1 className="text-xl font-bold text-[#F0FDF4]">Matches Explorer</h1>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Browse and query 2,660 completed Premier League historical fixtures.
          </p>
        </div>
      </div>

      <FilterBar filters={filters} onReset={() => { setSeason('2023-2024'); setMarketFilter('ALL'); }} />

      <DataTable columns={columns} data={matchesData} keyExtractor={(r) => r.id} />
    </div>
  );
}
