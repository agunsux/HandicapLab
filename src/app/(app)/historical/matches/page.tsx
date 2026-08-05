'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, ArrowRight } from 'lucide-react';
import { FilterBar } from '@/components/ui/FilterBar';
import { DataTable, Column } from '@/components/ui/DataTable';
import { GoldService, GoldMatchDetail } from '@/services/goldService';

export default function MatchesExplorerPage() {
  const [season, setSeason] = useState('2023-2024');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [matches, setMatches] = useState<GoldMatchDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    GoldService.getMatches().then((res) => {
      setMatches(res);
      setLoading(false);
    });
  }, []);

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

  const columns: Column<GoldMatchDetail>[] = [
    { key: 'kickoffAt', header: 'Kickoff', render: (r) => <span className="font-mono text-xs text-[#9CA3AF]">{r.kickoffAt ? r.kickoffAt.split('T')[0] : '—'}</span> },
    { key: 'match', header: 'Fixture (Home vs Away)', render: (r) => (
        <Link href={`/historical/matches/${r.matchId}`} className="font-bold text-[#F0FDF4] hover:text-[#10B981] transition-colors">
          {r.homeTeam} <span className="text-[#10B981] px-1 font-mono font-bold">{r.homeScore} - {r.awayScore}</span> {r.awayTeam}
        </Link>
      )
    },
    { key: 'homeXg', header: 'xG (H-A)', isNumeric: true, render: (r) => <span className="font-mono text-[#10B981]">{r.homeXg} - {r.awayXg}</span> },
    { key: 'venue', header: 'Venue', render: (r) => <span className="font-mono text-xs text-[#9CA3AF]">{r.venue}</span> },
    { key: 'referee', header: 'Referee', render: (r) => <span className="font-mono text-xs text-[#9CA3AF]">{r.referee}</span> },
    { key: 'action', header: 'Action', render: (r) => (
        <Link href={`/historical/matches/${r.matchId}`} className="inline-flex items-center gap-1 font-mono text-[11px] text-[#10B981] hover:underline">
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

      {loading ? (
        <div className="p-12 text-center text-[#9CA3AF] font-mono text-xs bg-[#111827] border border-[#1F2937] rounded-xl">
          Loading Gold Layer matches...
        </div>
      ) : matches.length === 0 ? (
        <div className="p-12 text-center text-[#9CA3AF] font-mono text-xs bg-[#111827] border border-[#1F2937] rounded-xl">
          NO MATCHES FOUND IN GOLD LAYER
        </div>
      ) : (
        <DataTable columns={columns} data={matches} keyExtractor={(r) => r.matchId} />
      )}
    </div>
  );
}
