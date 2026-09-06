'use client';

import React, { useState } from 'react';

export interface CoverageBadgeProps {
  market: 'AH' | 'OU' | 'BTTS';
  rate: number; // in percentage (0-100) or decimal (0-1)
  sampleSize: number;
  venue?: 'H' | 'A' | 'O' | 'home' | 'away' | 'overall';
  line?: string | number;
  className?: string;
}

export const CoverageBadge: React.FC<CoverageBadgeProps> = ({
  market,
  rate,
  sampleSize,
  venue = 'O',
  line,
  className = '',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Normalize rate to 0-100 percentage
  const pct = rate <= 1.0 && rate > 0 ? Math.round(rate * 100) : Math.round(rate);

  // Normalize venue badge indicator
  const venueCode =
    venue === 'home' || venue === 'H'
      ? 'H'
      : venue === 'away' || venue === 'A'
      ? 'A'
      : 'O';

  // Determine color coding: Green (>60%), Yellow (50-60%), Red (<50%)
  let colorClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  let indicatorDot = 'bg-rose-400';
  if (pct > 60) {
    colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    indicatorDot = 'bg-emerald-400';
  } else if (pct >= 50) {
    colorClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    indicatorDot = 'bg-amber-400';
  }

  // Label formulation
  let label = '';
  if (market === 'AH') {
    label = `AH Cover ${pct}% (${venueCode})`;
  } else if (market === 'OU') {
    label = `OU${line || '2.5'} ${pct}%`;
  } else {
    label = `BTTS ${pct}%`;
  }

  // Tooltip description
  const getTooltipText = () => {
    const venueLabel = venueCode === 'H' ? 'Home matches' : venueCode === 'A' ? 'Away matches' : 'All matches';
    if (market === 'AH') {
      return `Team has covered Asian Handicap ${line ? `at ${line}` : ''} in ${pct}% of ${venueLabel.toLowerCase()} (sample size: ${sampleSize} matches).`;
    }
    if (market === 'OU') {
      return `Matches exceeded ${line || '2.5'} total goals in ${pct}% of evaluated games (sample size: ${sampleSize} matches).`;
    }
    return `Both teams scored in ${pct}% of evaluated games (sample size: ${sampleSize} matches).`;
  };

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono font-bold tracking-tight cursor-help transition-colors ${colorClasses} ${className}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${indicatorDot}`} />
        <span>{label}</span>
        <span className="text-[9px] opacity-70 font-normal">n={sampleSize}</span>
      </span>

      {/* Hover Forensic Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-52 p-2 bg-[#111827] border border-[#1F2937] rounded-lg shadow-xl text-[11px] text-slate-300 font-sans leading-relaxed pointer-events-none">
          <div className="font-mono font-bold text-white mb-0.5 flex items-center justify-between border-b border-[#1F2937] pb-1">
            <span>{market} Coverage</span>
            <span className="text-[10px] text-[#10B981]">n={sampleSize}</span>
          </div>
          <p className="mt-1">{getTooltipText()}</p>
          {sampleSize < 10 && (
            <p className="text-[10px] text-amber-400 mt-1 font-mono">
              ⚠️ Small sample warning (n &lt; 10)
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CoverageBadge;
