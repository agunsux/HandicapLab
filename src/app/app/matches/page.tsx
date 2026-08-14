import Link from 'next/link';
import React from 'react';
import { supabase } from '@/lib/supabase.server';
import { MatchCard } from '@/components/MatchCard';

export const revalidate = 60;

export default async function MatchesPage() {
  let matches: any[] = [];
  let errorMessage: string | null = null;

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

    if (error) {
      errorMessage = error.message;
    } else if (data && data.length > 0) {
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
    }
  } catch (err: any) {
    errorMessage = err.message || 'Failed to fetch matches';
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-lg font-bold text-white font-mono uppercase tracking-widest">Matches</h1>
        <p className="text-xs text-slate-500 font-mono mt-1">All upcoming fixtures with verified predictions</p>
      </div>

      {matches.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500 font-mono">
            0
          </div>
          <p className="text-sm font-semibold text-slate-300 font-mono">No Upcoming Matches Found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {errorMessage ? `Database sync notice: ${errorMessage}` : 'No upcoming fixtures are currently registered in the database for the active whitelist leagues.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {matches.map((item: any, idx: number) => (
            <MatchCard
              key={item.match.id || idx}
              match={item.match}
              prediction={item.prediction}
            />
          ))}
        </div>
      )}
    </div>
  );
}