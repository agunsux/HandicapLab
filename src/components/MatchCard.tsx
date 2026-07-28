import React from 'react';
import Link from 'next/link';
import { PredictionCard } from './PredictionCard';
import { ConfidenceBadge } from './ConfidenceBadge';

export function MatchCard({ match, prediction }: any) {
  if (!match || !prediction) return null;

  const homeTeam = match.home_team;
  const awayTeam = match.away_team;

  let mlHome = 0, mlDraw = 0, mlAway = 0;
  let ahLineVal = 0, ahHome = 0;
  let ouLineVal = 0, overVal = 0;
  let bttsYes = 0;
  let confidenceVal = 'Low';

  if (Array.isArray(prediction)) {
    const mlPred = prediction.find((p: any) => p.market_type === 'ML');
    const ahPred = prediction.find((p: any) => p.market_type === 'AH');
    const ouPred = prediction.find((p: any) => p.market_type === 'OU');
    const bttsPred = prediction.find((p: any) => p.market_type === 'BTTS');

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
      if (!mlPred) confidenceVal = predData.confidence || ahPred.confidence || 'Low';
    }
    if (ouPred) {
      const predData = typeof ouPred.prediction === 'object' && ouPred.prediction ? ouPred.prediction : {};
      ouLineVal = Number(predData.ou_line || ouPred.ou_line || 0);
      overVal = Number(predData.over_prob || ouPred.over_prob || 0);
      if (!mlPred && !ahPred) confidenceVal = predData.confidence || ouPred.confidence || 'Low';
    }
    if (bttsPred) {
      const predData = typeof bttsPred.prediction === 'object' && bttsPred.prediction ? bttsPred.prediction : {};
      bttsYes = Number(predData.btts_yes_prob || predData.yes_prob || 0);
      if (!mlPred && !ahPred && !ouPred) confidenceVal = predData.confidence || bttsPred.confidence || 'Low';
    }
  } else {
    mlHome = Number(prediction.home_prob || 0);
    mlDraw = Number(prediction.draw_prob || 0);
    mlAway = Number(prediction.away_prob || 0);
    ahLineVal = Number(prediction.ah_line || 0);
    ahHome = Number(prediction.ah_prob || 0);
    ouLineVal = Number(prediction.ou_line || 0);
    overVal = Number(prediction.over_prob || 0);
    bttsYes = Number(prediction.btts_yes_prob || 0);
    confidenceVal = prediction.confidence || 'Low';
  }

  let mlPick = 'Draw';
  let mlProb = mlDraw;
  if (mlHome > Math.max(mlDraw, mlAway)) {
    mlPick = homeTeam;
    mlProb = mlHome;
  } else if (mlAway > Math.max(mlHome, mlDraw)) {
    mlPick = awayTeam;
    mlProb = mlAway;
  }

  let ahPick = '';
  let ahProb = 0;
  if (ahHome >= 0.50) {
    ahPick = `${homeTeam} (${ahLineVal >= 0 ? '+' : ''}${ahLineVal})`;
    ahProb = ahHome;
  } else {
    const awayLine = -ahLineVal;
    ahPick = `${awayTeam} (${awayLine >= 0 ? '+' : ''}${awayLine})`;
    ahProb = 1 - ahHome;
  }

  const ouPick = overVal >= 0.50 ? `Over ${ouLineVal}` : `Under ${ouLineVal}`;
  const ouProb = overVal >= 0.50 ? overVal : 1 - overVal;

  const bttsPick = bttsYes >= 0.50 ? 'Yes' : 'No';
  const bttsProb = bttsYes >= 0.50 ? bttsYes : 1 - bttsYes;

  const matchTime = new Date(match.kickoff).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return (
    <Link href={`/matches/${match.id}`} className="block transition-transform duration-200 hover:-translate-y-0.5">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-all duration-300">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex px-2 py-0.5 bg-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-300 rounded">
                {match.league || 'League'}
              </span>
              <span className="text-xs font-semibold text-slate-500">{matchTime}</span>
            </div>
            <h3 className="text-base font-extrabold text-white tracking-tight">
              {homeTeam} <span className="text-slate-500 font-medium font-sans">vs</span> {awayTeam}
            </h3>
          </div>
          <ConfidenceBadge confidence={confidenceVal} />
        </div>

        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <PredictionCard market="Moneyline" pick={mlPick} probability={mlProb} />
          <PredictionCard market="Asian Handicap" pick={ahPick} probability={ahProb} />
          <PredictionCard market="Over/Under" pick={ouPick} probability={ouProb} />
          <PredictionCard market="BTTS" pick={bttsPick} probability={bttsProb} />
        </div>
      </div>
    </Link>
  );
}