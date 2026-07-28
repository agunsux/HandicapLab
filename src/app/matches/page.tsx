import Link from 'next/link';
import React from 'react';
import { supabase } from '@/lib/supabase.server';
import { MatchCard } from '@/components/MatchCard';
import { mockMatchesAndPredictions } from '@/lib/mockData';

export const revalidate = 60;

export default async function MatchesPage() {
  let matches = [];
  let isFallback = false;

  try {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        id,
        home_team,
        away_team,
        league,
        kickoff,
        status,
        predictions(
          id,
          match_id,
          market_type,
          prediction,
          odds_snapshot
        )
      `)
      .eq('status', 'upcoming')
      .order('kickoff', { ascending: true })
      .limit(20);

    if (error || !data || data.length === 0) {
      matches = mockMatchesAndPredictions;
      isFallback = true;
    } else {
      matches = data
        .map((m: any) => ({
          match: {
            id: m.id,
            home_team: m.home_team,
            away_team: m.away_team,
            league: m.league,
            kickoff: m.kickoff,
            status: m.status,
          },
          prediction: m.predictions && m.predictions.length > 0 ? m.predictions : null,
        }))
        .filter((item) => item.prediction !== null);

      if (matches.length === 0) {
        matches = mockMatchesAndPredictions;
        isFallback = true;
      }
    }
  } catch (err) {
    matches = mockMatchesAndPredictions;
    isFallback = true;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {isFallback && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-between text-xs md:text-sm font-medium">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Viewing offline sandbox predictions — database syncing in progress.</span>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-lg font-bold text-white font-mono uppercase tracking-widest">Matches</h1>
        <p className="text-xs text-slate-500 font-mono mt-1">All upcoming fixtures with verified predictions</p>
      </div>

      <div className="grid gap-6">
        {matches.map((item: any, idx: number) => (
          <MatchCard
            key={item.match.id || idx}
            match={item.match}
            prediction={item.prediction}
          />
        ))}
      </div>
    </div>
  );
}