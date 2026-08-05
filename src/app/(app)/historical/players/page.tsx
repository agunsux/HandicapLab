'use client';

import React from 'react';
import { UserCheck, Search } from 'lucide-react';
import { DataTable, Column } from '@/components/ui/DataTable';

export default function PlayersDirectoryPage() {
  const playersData = [
    { id: 'p1', name: 'Erling Haaland', team: 'Man City', pos: 'FW', mins: '2,550', goals: 27, xg: 24.3, assists: 5, yellow: 2, red: 0 },
    { id: 'p2', name: 'Mohamed Salah', team: 'Liverpool', pos: 'FW', mins: '2,420', goals: 22, xg: 19.8, assists: 10, yellow: 1, red: 0 },
    { id: 'p3', name: 'Son Heung-min', team: 'Tottenham', pos: 'FW', mins: '2,610', goals: 17, xg: 14.2, assists: 9, yellow: 0, red: 0 },
    { id: 'p4', name: 'Bukayo Saka', team: 'Arsenal', pos: 'FW', mins: '2,580', goals: 16, xg: 15.1, assists: 9, yellow: 4, red: 0 },
    { id: 'p5', name: 'Ollie Watkins', team: 'Aston Villa', pos: 'FW', mins: '2,700', goals: 19, xg: 18.2, assists: 13, yellow: 3, red: 0 },
  ];

  const columns: Column<typeof playersData[0]>[] = [
    { key: 'name', header: 'Player Name', render: (r) => <span className="font-bold text-[#F0FDF4]">{r.name}</span> },
    { key: 'team', header: 'Club', render: (r) => <span className="text-[#9CA3AF]">{r.team}</span> },
    { key: 'pos', header: 'Pos', render: (r) => <span className="font-mono text-[11px] text-[#10B981] font-bold">{r.pos}</span> },
    { key: 'mins', header: 'Mins', isNumeric: true },
    { key: 'goals', header: 'Goals', isNumeric: true, render: (r) => <span className="font-mono font-bold text-[#10B981]">{r.goals}</span> },
    { key: 'xg', header: 'xG', isNumeric: true, render: (r) => <span className="font-mono text-[#F0FDF4]">{r.xg}</span> },
    { key: 'assists', header: 'Assists', isNumeric: true },
    { key: 'cards', header: 'Yellow/Red', isNumeric: true, render: (r) => <span className="font-mono text-xs">{r.yellow}/{r.red}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-[#10B981]" />
            <h1 className="text-xl font-bold text-[#F0FDF4]">Players Historical Intelligence</h1>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1 font-sans">
            Individual xG, assists, minutes, and disciplinary history for 84,000+ player entities.
          </p>
        </div>
      </div>

      <DataTable columns={columns} data={playersData} keyExtractor={(r) => r.id} />
    </div>
  );
}
