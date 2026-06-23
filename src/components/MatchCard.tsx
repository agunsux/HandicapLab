import React from 'react';
import { PredictionCard } from './PredictionCard';
import { ConfidenceBadge } from './ConfidenceBadge';

export function MatchCard({ match, prediction }: any) {
  if (!match || !prediction) return null;

  const homeTeam = match.home_team;
  const awayTeam = match.away_team;

  // 1. Moneyline Pick & Prob
  let mlPick = 'Draw';
  let mlProb = Number(prediction.draw_prob);

  if (Number(prediction.home_prob) > Math.max(Number(prediction.draw_prob), Number(prediction.away_prob))) {
    mlPick = homeTeam;
    mlProb = Number(prediction.home_prob);
  } else if (Number(prediction.away_prob) > Math.max(Number(prediction.home_prob), Number(prediction.draw_prob))) {
    mlPick = awayTeam;
    mlProb = Number(prediction.away_prob);
  }

  // 2. Asian Handicap Pick & Prob
  const ahLine = Number(prediction.ah_line);
  const ahHomeProb = Number(prediction.ah_prob);
  let ahPick = '';
  let ahProb = 0;

  if (ahHomeProb >= 0.50) {
    ahPick = `${homeTeam} (${ahLine >= 0 ? '+' : ''}${ahLine})`;
    ahProb = ahHomeProb;
  } else {
    // If we cover away, the line sign is inverted
    const awayLine = -ahLine;
    ahPick = `${awayTeam} (${awayLine >= 0 ? '+' : ''}${awayLine})`;
    ahProb = 1 - ahHomeProb;
  }

  // 3. Over/Under Pick & Prob
  const ouLine = Number(prediction.ou_line);
  const overProb = Number(prediction.over_prob);
  let ouPick = '';
  let ouProb = 0;

  if (overProb >= 0.50) {
    ouPick = `Over ${ouLine}`;
    ouProb = overProb;
  } else {
    ouPick = `Under ${ouLine}`;
    ouProb = 1 - overProb;
  }

  // Parse kickoff time
  const matchTime = new Date(match.kickoff).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return (
    <div className="bg-gradient-to-br from-white to-slate-50/50 border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:border-slate-300/80 transition-all duration-300 flex flex-col justify-between">
      {/* Card Header */}
      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex px-2 py-0.5 bg-indigo-50 text-[10px] font-black uppercase tracking-wider text-indigo-600 rounded">
              {match.league || 'League'}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {matchTime}
            </span>
          </div>
          <h3 className="text-base font-extrabold text-slate-800 tracking-tight">
            {homeTeam} <span className="text-slate-400 font-medium font-sans">vs</span> {awayTeam}
          </h3>
        </div>
        <ConfidenceBadge confidence={prediction.confidence} />
      </div>
      
      {/* Card Predictions Grid (3 markets) */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/30">
        <PredictionCard market="Match Winner" pick={mlPick} probability={mlProb} />
        <PredictionCard market="Over/Under" pick={ouPick} probability={ouProb} />
        <PredictionCard market="Asian Handicap" pick={ahPick} probability={ahProb} />
      </div>
    </div>
  );
}
