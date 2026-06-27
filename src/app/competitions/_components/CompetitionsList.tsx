'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LeagueCache } from '@/lib/data/leagues';

interface CompetitionsListProps {
  competitions: LeagueCache[];
}

export function CompetitionsList({ competitions }: CompetitionsListProps) {
  const [activeType, setActiveType] = useState<'all' | 'league' | 'cup' | 'tournament'>('all');
  const [activeStatus, setActiveStatus] = useState<'all' | 'active' | 'upcoming' | 'confidence' | 'edge'>('all');
  const [sortBy, setSortBy] = useState<'opportunity' | 'confidence' | 'edge' | 'data' | 'popularity'>('opportunity');

  // Filter list by both dimensions
  const filtered = competitions.filter((comp) => {
    // 1. Filter by Competition Type
    if (activeType !== 'all' && comp.competition_type !== activeType) {
      return false;
    }

    // 2. Filter by Calibration Status
    if (activeStatus === 'active') return comp.is_currently_active;
    if (activeStatus === 'upcoming') return comp.season_status === 'upcoming' || comp.season_status === 'offseason';
    if (activeStatus === 'confidence') return comp.sample_confidence === 'high' || comp.model_confidence_score > 70;
    if (activeStatus === 'edge') return comp.edge_potential_score > 70;

    return true;
  });

  // Sort list dynamically
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'opportunity') {
      const oppA = a.historical_accuracy * a.data_quality_score * (100 - a.market_efficiency_score) * a.sample_size_score;
      const oppB = b.historical_accuracy * b.data_quality_score * (100 - b.market_efficiency_score) * b.sample_size_score;
      return oppB - oppA;
    }
    if (sortBy === 'confidence') return b.model_confidence_score - a.model_confidence_score;
    if (sortBy === 'edge') return b.edge_potential_score - a.edge_potential_score;
    if (sortBy === 'data') return b.sample_size_score - a.sample_size_score;
    if (sortBy === 'popularity') {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  const getFormatLabel = (fmt: string) => {
    switch (fmt) {
      case 'round_robin': return 'Round Robin';
      case 'knockout': return 'Knockout';
      case 'group_knockout': return 'Group + Knockout';
      case 'two_legged': return 'Two-Legged';
      case 'mixed': return 'Mixed';
      default: return fmt;
    }
  };

  const getConfidenceBadgeColor = (tier: string) => {
    switch (tier) {
      case 'high': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'medium': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-slate-950 text-slate-500 border-slate-850';
    }
  };

  return (
    <div className="space-y-8">
      {/* Filters Toolbar */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">Filters</h3>
            <p className="text-[11px] text-slate-500">Slice our predictive universe by competition format and model status.</p>
          </div>
          {/* Sort selector dropdown */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-850 self-start md:self-auto">
            <span className="text-[10px] font-mono text-slate-500 uppercase">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-200 text-xs font-mono font-semibold focus:outline-none cursor-pointer"
            >
              <option value="opportunity">Model Opportunity</option>
              <option value="confidence">Model Confidence</option>
              <option value="edge">Edge Potential</option>
              <option value="data">Data Volume</option>
              <option value="popularity">Popularity</option>
            </select>
          </div>
        </div>

        {/* Primary Type Filters */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-850/60 pt-3">
          <span className="text-[10px] font-mono text-slate-500 uppercase w-16">Type:</span>
          {(['all', 'league', 'cup', 'tournament'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`px-3 py-1 text-[11px] font-mono font-bold rounded transition-colors ${
                activeType === type
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-950 text-slate-400 border border-slate-850 hover:text-slate-200'
              }`}
            >
              {type === 'all' ? 'All Types' : `${type}s`}
            </button>
          ))}
        </div>

        {/* Secondary Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-850/60 pt-3">
          <span className="text-[10px] font-mono text-slate-500 uppercase w-16">Status:</span>
          {(['all', 'active', 'upcoming', 'confidence', 'edge'] as const).map((status) => {
            const labelMap = {
              all: 'All Schedules',
              active: 'Currently Active',
              upcoming: 'Upcoming Season',
              confidence: 'High Confidence',
              edge: 'High Edge Potential'
            };
            return (
              <button
                key={status}
                onClick={() => setActiveStatus(status)}
                className={`px-3 py-1 text-[11px] font-mono font-bold rounded transition-colors ${
                  activeStatus === status
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:text-slate-200'
                }`}
              >
                {labelMap[status]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sorted.map((comp) => {
          const isWorldCup = comp.slug === 'world-cup-2026';
          const isCalibration = comp.is_currently_active || comp.featured_calibration;

          // Opportunity index calculation for visualization
          const oppRaw = comp.historical_accuracy * comp.data_quality_score * (100 - comp.market_efficiency_score) * comp.sample_size_score;
          // Normalise to 100 max roughly
          const oppNormalized = Math.min(100, Math.round(oppRaw / 75000));

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

              <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                    <span>{comp.region}</span>
                  </div>
                  <CardTitle className="text-base font-extrabold text-white flex items-center gap-2">
                    {comp.name}
                  </CardTitle>
                </div>
                {/* Logo wrapper */}
                <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-850 flex items-center justify-center p-1.5 shrink-0">
                  <img src={comp.logo_url} alt={comp.name} className="max-h-full max-w-full object-contain" />
                </div>
              </CardHeader>

              <CardContent className="pt-2 space-y-4">
                {/* Status Badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-slate-950 text-slate-400 border border-slate-850 px-2 py-0.5 rounded">
                    {comp.competition_type}
                  </span>
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-slate-950 text-slate-400 border border-slate-850 px-2 py-0.5 rounded">
                    {getFormatLabel(comp.format)}
                  </span>
                  {isCalibration && (
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded animate-pulse">
                      ⚡ Calibration Mode
                    </span>
                  )}
                  {comp.matches_count > 0 && (
                    <span className={`text-[9px] font-mono font-bold uppercase tracking-wider border px-2 py-0.5 rounded ${getConfidenceBadgeColor(comp.sample_confidence)}`}>
                      {comp.sample_confidence} Conf
                    </span>
                  )}
                </div>

                {/* Model Calibration Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/40 p-2.5 rounded-lg border border-slate-850">
                  <div className="text-slate-500">
                    Model Edge: <span className="text-emerald-400 font-bold">+{comp.edge_potential_score}%</span>
                  </div>
                  <div className="text-slate-500">
                    Model Conf: <span className="text-slate-300 font-bold">{comp.model_confidence_score}%</span>
                  </div>
                  <div className="text-slate-500">
                    Accuracy: <span className="text-slate-300 font-bold">{comp.prediction_accuracy ? `${comp.prediction_accuracy.toFixed(1)}%` : '—'}</span>
                  </div>
                  <div className="text-slate-500">
                    ROI Simulation: <span className={`font-bold ${comp.roi_simulation && comp.roi_simulation > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {comp.roi_simulation !== null ? `${comp.roi_simulation > 0 ? '+' : ''}${comp.roi_simulation.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                </div>

                {/* Model Opportunity Level Meter */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                    <span>MODEL OPPORTUNITY INDEX</span>
                    <span className="text-emerald-400 font-bold">{oppNormalized}/100</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 rounded overflow-hidden border border-slate-850">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                      style={{ width: `${oppNormalized}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-500">
                  <div>Market Efficiency: <span className="text-slate-300">{comp.market_efficiency_score}%</span></div>
                  <div>Data Sample: <span className="text-slate-300">{comp.matches_count} matches</span></div>
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
