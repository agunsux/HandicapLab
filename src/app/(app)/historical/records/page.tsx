'use client';

import React from 'react';
import { Award, Trophy } from 'lucide-react';
import { DataTable, Column } from '@/components/ui/DataTable';

export default function HistoricalRecordsPage() {
  const records = [
    { title: 'Highest Season Points Total', holder: 'Manchester City (100 Pts)', season: '2017-2018', category: 'Team Points' },
    { title: 'Most Goals in a Single EPL Season', holder: 'Erling Haaland (36 Goals)', season: '2022-2023', category: 'Player Goals' },
    { title: 'Highest Single-Match xG Accumulation', holder: 'Liverpool 4.1 xG vs Newcastle', season: '2023-2024', category: 'Match xG' },
    { title: 'Biggest Odds Drift Winning Bet', holder: 'Leicester City Win @ 5000.00', season: '2015-2016', category: 'Market Inefficiency' },
  ];

  const columns: Column<typeof records[0]>[] = [
    { key: 'title', header: 'Record Title', render: (r) => <span className="font-bold text-[#F0FDF4]">{r.title}</span> },
    { key: 'holder', header: 'Record Holder', render: (r) => <span className="text-[#10B981] font-bold font-mono">{r.holder}</span> },
    { key: 'season', header: 'Season', render: (r) => <span className="text-[#9CA3AF] font-mono text-xs">{r.season}</span> },
    { key: 'category', header: 'Category', render: (r) => <span className="px-2 py-0.5 rounded bg-[#1A1F2E] text-[#9CA3AF] font-mono text-[10px] uppercase">{r.category}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-[#F59E0B]" />
            <h1 className="text-xl font-bold text-[#F0FDF4]">Historical Records & Inefficiency Spikes</h1>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1 font-sans">
            All-time top achievements, market spikes, and xG anomalies documented in Gold Layer.
          </p>
        </div>
      </div>

      <DataTable columns={columns} data={records} keyExtractor={(r) => r.title} />
    </div>
  );
}
