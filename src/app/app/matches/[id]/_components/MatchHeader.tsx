import React from 'react';
import Link from 'next/link';
import { DbMatch } from '@/lib/data/match';

interface MatchHeaderProps {
  match: DbMatch;
}

export function MatchHeader({ match }: MatchHeaderProps) {
  const matchDate = new Date(match.kickoff);
  const formattedDate = matchDate.toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const formattedTime = matchDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const displayStatus = match.status === 'finished' ? 'Finished' : 'Upcoming';
  const isFinished = match.status === 'finished';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Upper bar: Back navigation & Competition info */}
      <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded">
            {match.league}
          </span>
          {match.tournament_stage && (
            <span className="text-[10px] text-slate-500 font-mono border border-slate-800 px-1.5 py-0.5 rounded">
              {match.tournament_stage}
            </span>
          )}
        </div>
        <Link href="/matches">
          <button className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 font-mono text-xs transition-colors border border-slate-700/50">
            ← Back to Matches
          </button>
        </Link>
      </div>

      {/* Main Scoreboard / Header */}
      <div className="p-6 md:p-8 flex flex-col items-center justify-center text-center gap-6">
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 w-full max-w-3xl">
          {/* Home Team */}
          <div className="flex-1 flex flex-col items-center md:items-end text-center md:text-right">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
              {match.home_team}
            </h1>
            <span className="text-xs text-slate-500 font-mono mt-1">Home Team</span>
          </div>

          {/* Score / Status Divider */}
          <div className="flex flex-col items-center justify-center px-4 py-2 bg-slate-950/60 rounded-2xl border border-slate-800 min-w-[120px]">
            {isFinished ? (
              <div className="text-3xl md:text-4xl font-extrabold font-mono text-white tracking-widest">
                {match.home_goals ?? 0} - {match.away_goals ?? 0}
              </div>
            ) : (
              <div className="text-sm font-black font-mono text-emerald-400 uppercase tracking-widest animate-pulse">
                VS
              </div>
            )}
            <span className={`text-[10px] font-mono px-2 py-0.5 mt-1.5 rounded uppercase ${
              isFinished ? 'bg-slate-800 text-slate-400' : 'bg-emerald-500/10 text-emerald-400'
            }`}>
              {displayStatus}
            </span>
          </div>

          {/* Away Team */}
          <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
              {match.away_team}
            </h1>
            <span className="text-xs text-slate-500 font-mono mt-1">Away Team</span>
          </div>
        </div>

        {/* Kickoff details */}
        <div className="pt-4 border-t border-slate-800/60 w-full max-w-md text-xs text-slate-400 font-mono">
          <div>{formattedDate}</div>
          <div className="text-slate-500 mt-1">Kickoff: {formattedTime}</div>
          {match.venue && (
            <div className="text-slate-500 mt-0.5">Venue: {match.venue}</div>
          )}
        </div>
      </div>
    </div>
  );
}
