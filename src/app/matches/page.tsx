import Link from 'next/link';
import React from 'react';
import { supabase } from '@/lib/supabase.server';
import { MatchCard } from '@/components/MatchCard';
import { AccuracyStats } from '@/components/AccuracyStats';
import { mockMatchesAndPredictions } from '@/lib/mockData';

export const revalidate = 60; // Revalidate every minute

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
      console.warn('⚠️ DB query returned empty or failed. Using fallback mock matches.');
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
    console.error('❌ DB connection failed. Using fallback mock matches:', err);
    matches = mockMatchesAndPredictions;
    isFallback = true;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Navigation Header */}
      <header className="bg-slate-950/80 backdrop-blur-md sticky top-0 border-b border-slate-900 py-5 px-4 mb-8 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="font-sans font-black text-lg md:text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-indigo-400 uppercase">
              HandicapLab
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-xs md:text-sm font-bold text-slate-400 hover:text-white transition-all uppercase tracking-wider">
              Home
            </Link>
            <Link href="/matches" className="text-xs md:text-sm font-bold text-white transition-all border-b border-emerald-500 pb-1 uppercase tracking-wider">
              Matches
            </Link>
            <Link href="/ledger" className="text-xs md:text-sm font-bold text-slate-400 hover:text-white transition-all uppercase tracking-wider">
              Ledger
            </Link>
            <Link href="/pricing" className="text-xs md:text-sm font-bold text-slate-400 hover:text-white transition-all uppercase tracking-wider">
              Pricing
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 flex flex-col gap-8">
        
        {/* Fallback Banner */}
        {isFallback && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-between text-xs md:text-sm font-medium">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>
                💡 Currently viewing offline sandbox predictions as database syncing is in progress.
              </span>
            </div>
          </div>
        )}

        {/* 1. AccuracyStats Component */}
        <AccuracyStats />

        {/* 2. Predictions List Grid */}
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-xl font-black text-white tracking-tight uppercase">
                Upcoming AI Match Predictions
              </h2>
              <p className="text-slate-500 text-xs md:text-sm mt-1">
                Poisson distribution match probabilities & recommended handicap lines.
              </p>
            </div>
            <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-md">
              Model v0.5-ai
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {matches.map((item: any, idx: number) => (
              <MatchCard 
                key={item.match.id || idx} 
                match={item.match} 
                prediction={item.prediction} 
              />
            ))}
          </div>
        </div>
        
      </div>
    </main>
  );
}
