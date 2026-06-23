import React from 'react';
import { PredictionCard } from './PredictionCard';
import { ConfidenceBadge } from './ConfidenceBadge';

export function MatchCard({ match, prediction }: any) {
  if (!match || !prediction) return null;

  const homeTeam = match.home_team;
  const awayTeam = match.away_team;

  let mlHome = 0, mlDraw = 0, mlAway = 0;
  let ahLineVal = 0, ahHome = 0;
  let ouLineVal = 0, overVal = 0;
  let confidenceVal = 'Low';

  if (Array.isArray(prediction)) {
    // New Sprints 5 schema (array of predictions)
    const mlPred = prediction.find((p: any) => p.market_type === 'ML');
    const ahPred = prediction.find((p: any) => p.market_type === 'AH');
    const ouPred = prediction.find((p: any) => p.market_type === 'OU');

    if (mlPred) {
      const predData = typeof mlPred.prediction === 'object' && mlPred.prediction ? mlPred.prediction : {};
      mlHome = Number(predData.home_prob || predData.homeWinProb || 0);
      mlDraw = Number(predData.draw_prob || predData.drawProb || 0);
      mlAway = Number(predData.away_prob || predData.awayWinProb || 0);
      confidenceVal = predData.confidence || mlPred.confidence || 'Low';
    }
    if (ahPred) {
      const predData = typeof ahPred.prediction === 'object' && ahPred.prediction ? ahPred.prediction : {};
      ahLineVal = Number(predData.ah_line || ahPred.ah_line || 0);
      ahHome = Number(predData.ah_prob || ahPred.ah_prob || 0);
      if (!mlPred) {
        confidenceVal = predData.confidence || ahPred.confidence || 'Low';
      }
    }
    if (ouPred) {
      const predData = typeof ouPred.prediction === 'object' && ouPred.prediction ? ouPred.prediction : {};
      ouLineVal = Number(predData.ou_line || ouPred.ou_line || 0);
      overVal = Number(predData.over_prob || ouPred.over_prob || 0);
      if (!mlPred && !ahPred) {
        confidenceVal = predData.confidence || ouPred.confidence || 'Low';
      }
    }
  } else {
    // Legacy schema (flat object)
    mlHome = Number(prediction.home_prob || 0);
    mlDraw = Number(prediction.draw_prob || 0);
    mlAway = Number(prediction.away_prob || 0);
    ahLineVal = Number(prediction.ah_line || 0);
    ahHome = Number(prediction.ah_prob || 0);
    ouLineVal = Number(prediction.ou_line || 0);
    overVal = Number(prediction.over_prob || 0);
    confidenceVal = prediction.confidence || 'Low';
  }

  // 1. Moneyline Pick & Prob
  let mlPick = 'Draw';
  let mlProb = mlDraw;

  if (mlHome > Math.max(mlDraw, mlAway)) {
    mlPick = homeTeam;
    mlProb = mlHome;
  } else if (mlAway > Math.max(mlHome, mlDraw)) {
    mlPick = awayTeam;
    mlProb = mlAway;
  }

  // 2. Asian Handicap Pick & Prob
  let ahPick = '';
  let ahProb = 0;

  if (ahHome >= 0.50) {
    ahPick = `${homeTeam} (${ahLineVal >= 0 ? '+' : ''}${ahLineVal})`;
    ahProb = ahHome;
  } else {
    // If we cover away, the line sign is inverted
    const awayLine = -ahLineVal;
    ahPick = `${awayTeam} (${awayLine >= 0 ? '+' : ''}${awayLine})`;
    ahProb = 1 - ahHome;
  }

  // 3. Over/Under Pick & Prob
  let ouPick = '';
  let ouProb = 0;

  if (overVal >= 0.50) {
    ouPick = `Over ${ouLineVal}`;
    ouProb = overVal;
  } else {
    ouPick = `Under ${ouLineVal}`;
    ouProb = 1 - overVal;
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
        <ConfidenceBadge confidence={confidenceVal} />
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
