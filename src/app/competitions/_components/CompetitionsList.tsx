'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LeagueCache } from '@/lib/data/leagues';

interface CompetitionsListProps {
  competitions: LeagueCache[];
}

export function CompetitionsList({ competitions }: CompetitionsListProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'league' | 'cup' | 'tournament'>('all');

  // Filter list
  const filtered = competitions.filter((comp) => {
    if (activeFilter === 'all') return true;
    return comp.competition_type === activeFilter;
  });

  // Sort: priority ASC (1, 2, 3), then alphabetically
  const sorted = [...filtered].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.name.localeCompare(b.name);
  });

  const getFormatLabel = (fmt: string) => {
    switch (fmt) {
      case 'round_robin': return 'Round Robin';
      case 'knockout': return 'Knockout';
      case 'group_knockout': return 'Group + Knockout';
      case 'two_legged': return 'Two-Legged';
      case 'mixed': return 'Mixed Format';
      default: return fmt;
    }
  };

  const getTeamsCount = (comp: LeagueCache) => {
    if (comp.slug === 'world-cup-2026') return '48';
    if (comp.competition_type === 'league') {
      if (comp.slug === 'bundesliga' || comp.slug === 'eredivisie') return '18';
      return '20';
    }
    if (comp.slug === 'uefa-champions-league') return '36';
    return '—';
  };

  return (
    <div className="space-y-8">
      {/* Navigation Filter Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-slate-900 pb-6">
        {(['all', 'league', 'cup', 'tournament'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-5 py-2 text-xs font-mono font-bold tracking-wider uppercase rounded-full border transition-all ${
              activeFilter === filter
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-lg shadow-emerald-500/5'
                : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            {filter === 'all' ? 'All Competitions' : `${filter}s`}
          </button>
        ))}
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sorted.map((comp) => {
          const isWorldCup = comp.slug === 'world-cup-2026';
          return (
            <Card
              key={comp.api_id}
              className={`bg-slate-900 border-slate-800 hover:border-emerald-500/20 transition-all flex flex-col justify-between overflow-hidden relative ${
                isWorldCup ? 'ring-1 ring-emerald-500/30' : ''
              }`}
            >
              {isWorldCup && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[9px] font-mono font-bold px-2 py-0.5 rounded-bl">
                  FEATURED
                </div>
              )}
              
              <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4 space-y-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                    <span>{isWorldCup ? '🌎' : ''} {comp.region}</span>
                  </div>
                  <CardTitle className="text-base font-extrabold text-white">{comp.name}</CardTitle>
                </div>
                {/* Logo wrapper */}
                <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-850 flex items-center justify-center p-1.5 shrink-0">
                  <img src={comp.logo_url} alt={comp.name} className="max-h-full max-w-full object-contain" />
                </div>
              </CardHeader>
              
              <CardContent className="pt-2 space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-slate-950 text-slate-400 border border-slate-850 px-2 py-0.5 rounded">
                    {comp.competition_type}
                  </span>
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-slate-950 text-emerald-400/80 border border-slate-850 px-2 py-0.5 rounded">
                    {getFormatLabel(comp.format)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/40 p-2.5 rounded-lg border border-slate-850">
                  <div className="text-slate-500">
                    Avg Goals: <span className="text-slate-300 font-bold">{comp.stats.avgGoals ? comp.stats.avgGoals.toFixed(2) : '—'}</span>
                  </div>
                  <div className="text-slate-500">
                    Teams: <span className="text-slate-300 font-bold">{getTeamsCount(comp)}</span>
                  </div>
                  <div className="text-slate-500">
                    Over 2.5: <span className="text-slate-300 font-bold">{comp.stats.over25Percent ? `${comp.stats.over25Percent}%` : '—'}</span>
                  </div>
                  <div className="text-slate-500">
                    BTTS: <span className="text-slate-300 font-bold">{comp.stats.bttsPercent ? `${comp.stats.bttsPercent}%` : '—'}</span>
                  </div>
                </div>
                
                <Link href={`/competitions/${comp.slug}`} className="block">
                  <button className="w-full py-2 rounded bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-mono transition-colors">
                    Explore Value Edges →
                  </button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
