import React from 'react';
import { PredictionCard } from './PredictionCard';
import { ConfidenceBadge } from './ConfidenceBadge';

export function MatchCard({ match, prediction }: any) {
  if (!match || !prediction) return null;

  // Formatting pick labels and probabilities
  const ahPick = prediction.ah_home_prob > prediction.ah_away_prob 
    ? `${match.home_team.name} (AH 0)` 
    : `${match.away_team.name} (AH 0)`;
  const ahProb = Math.max(prediction.ah_home_prob, prediction.ah_away_prob);
  
  const ouPick = prediction.ou_over_prob > prediction.ou_under_prob 
    ? 'Over 2.5' 
    : 'Under 2.5';
  const ouProb = Math.max(prediction.ou_over_prob, prediction.ou_under_prob);
  
  const bttsPick = prediction.btts_yes_prob > prediction.btts_no_prob ? 'Yes' : 'No';
  const bttsProb = Math.max(prediction.btts_yes_prob, prediction.btts_no_prob);

  const mlPick = prediction.ml_home_prob > Math.max(prediction.ml_draw_prob, prediction.ml_away_prob) 
    ? match.home_team.name 
    : prediction.ml_away_prob > Math.max(prediction.ml_draw_prob, prediction.ml_home_prob) 
      ? match.away_team.name 
      : 'Draw';
  const mlProb = Math.max(prediction.ml_home_prob, prediction.ml_draw_prob, prediction.ml_away_prob);

  // Parse time
  const matchTime = new Date(match.match_date).toLocaleTimeString([], {
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
            {match.home_team.name} <span className="text-slate-400 font-medium">vs</span> {match.away_team.name}
          </h3>
        </div>
        <ConfidenceBadge confidence={prediction.final_confidence} />
      </div>
      
      {/* Card Predictions Grid */}
      <div className="p-5 grid grid-cols-2 gap-4 bg-slate-50/30">
        <PredictionCard market="Match Winner" pick={mlPick} probability={mlProb} />
        <PredictionCard market="Over/Under" pick={ouPick} probability={ouProb} />
        <PredictionCard market="Asian Handicap" pick={ahPick} probability={ahProb} />
        <PredictionCard market="BTTS" pick={bttsPick} probability={bttsProb} />
      </div>
    </div>
  );
}
