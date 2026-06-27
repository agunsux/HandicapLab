import React from 'react';
import Link from 'next/link';
import { SignalBadge } from './SignalBadge';
import { MarketTag } from './MarketTag';
import { OddsMovement } from './OddsMovement';
import { ConfidenceBadge } from '../ConfidenceBadge';

interface SignalCardProps {
  signal: {
    id: string;
    match: string;
    league: string;
    kickoff_time: string;
    market_category: string;
    market_selection: string;
    odds: number;
    opening_odds: number | null;
    current_odds: number | null;
    edge_percentage: number | null;
    confidence_score: number;
    confidence_label: string;
    status: string;
  };
}

export function SignalCard({ signal }: SignalCardProps) {
  const isPremiumLocked = signal.current_odds === null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 hover:border-slate-700 transition-all shadow-md relative overflow-hidden flex flex-col justify-between h-full">
      {/* Top Section */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-slate-400 text-xs font-semibold tracking-wider uppercase">
            {signal.league || 'International Match'}
          </span>
          <div className="flex items-center gap-1.5">
            <MarketTag marketCategory={signal.market_category} />
            <SignalBadge status={signal.status} />
          </div>
        </div>

        {/* Match Header */}
        <h3 className="text-slate-100 font-bold text-lg mb-4">
          {signal.match}
        </h3>

        {/* Selection Details */}
        <div className="bg-slate-950 border border-slate-850 rounded p-3 mb-4">
          <span className="text-slate-500 text-xs block mb-1">RECOMMENDED PICK</span>
          <span className="text-slate-200 font-bold text-base tracking-wide capitalize">
            {signal.market_selection.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800 text-sm">
        <div>
          <span className="text-slate-500 text-xs block mb-1">ODDS MOVEMENT</span>
          {isPremiumLocked ? (
            <span className="text-slate-400 font-mono text-xs">🔒 Premium</span>
          ) : (
            <OddsMovement openingOdds={signal.opening_odds} currentOdds={signal.current_odds} />
          )}
        </div>

        <div>
          <span className="text-slate-500 text-xs block mb-1">EXPECTED EDGE</span>
          {isPremiumLocked ? (
            <span className="text-amber-500 font-semibold text-xs flex items-center gap-1">
              🔒 Lock Edge
            </span>
          ) : (
            <span className="font-bold font-mono text-emerald-400 text-sm">
              +{Number(signal.edge_percentage).toFixed(1)}%
            </span>
          )}
        </div>

        <div className="col-span-2 flex items-center justify-between mt-2 pt-2 border-t border-slate-850">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-xs">Confidence:</span>
            <ConfidenceBadge confidence={signal.confidence_score} />
          </div>
          
          <Link
            href={`/signals/${signal.id}`}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition"
          >
            Details →
          </Link>
        </div>
      </div>
    </div>
  );
}
