import React from 'react';
import Link from 'next/link';
import { PredictionCard } from './PredictionCard';
import { ConfidenceBadge } from './ConfidenceBadge';

export function MatchCard({ match, prediction }: any) {
  if (!match || !prediction) return null;

  const ahPick = prediction.ah_home_prob > prediction.ah_away_prob ? match.home_team.name : match.away_team.name;
  const ahProb = Math.max(prediction.ah_home_prob, prediction.ah_away_prob);
  
  const ouPick = prediction.ou_over_prob > prediction.ou_under_prob ? 'Over' : 'Under';
  const ouProb = Math.max(prediction.ou_over_prob, prediction.ou_under_prob);
  
  const bttsPick = prediction.btts_yes_prob > prediction.btts_no_prob ? 'Yes' : 'No';
  const bttsProb = Math.max(prediction.btts_yes_prob, prediction.btts_no_prob);

  const mlPick = prediction.ml_home_prob > Math.max(prediction.ml_draw_prob, prediction.ml_away_prob) ? match.home_team.name : 
                 prediction.ml_away_prob > Math.max(prediction.ml_draw_prob, prediction.ml_home_prob) ? match.away_team.name : 'Draw';
  const mlProb = Math.max(prediction.ml_home_prob, prediction.ml_draw_prob, prediction.ml_away_prob);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 font-medium mb-1">{match.league} • {new Date(match.match_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          <h3 className="text-lg font-bold text-slate-800">{match.home_team.name} vs {match.away_team.name}</h3>
        </div>
        <ConfidenceBadge confidence={prediction.final_confidence} />
      </div>
      
      <div className="p-4 grid grid-cols-2 gap-3">
        <PredictionCard market="Asian Handicap" pick={ahPick} probability={ahProb} />
        <PredictionCard market="Over/Under" pick={ouPick} probability={ouProb} />
        <PredictionCard market="Match Winner" pick={mlPick} probability={mlProb} />
        <PredictionCard market="BTTS" pick={bttsPick} probability={bttsProb} />
      </div>
      

    </div>
  );
}
