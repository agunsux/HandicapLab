import React from 'react';

interface MarketTagProps {
  marketCategory: string;
}

export function MarketTag({ marketCategory }: MarketTagProps) {
  let label = 'Unknown Market';
  let badgeColor = 'bg-slate-900 text-slate-400 border-slate-800';

  const cat = (marketCategory || '').toLowerCase();
  if (cat === 'asian_handicap' || cat === 'ah') {
    label = 'Asian Handicap';
    badgeColor = 'bg-blue-950 text-blue-400 border-blue-900';
  } else if (cat === 'over_under' || cat === 'ou') {
    label = 'Over/Under';
    badgeColor = 'bg-purple-950 text-purple-400 border-purple-900';
  } else if (cat === 'moneyline' || cat === 'ml') {
    label = 'Moneyline';
    badgeColor = 'bg-indigo-950 text-indigo-400 border-indigo-900';
  } else if (cat === 'btts') {
    label = 'BTTS';
    badgeColor = 'bg-pink-950 text-pink-400 border-pink-900';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badgeColor}`}>
      {label}
    </span>
  );
}
