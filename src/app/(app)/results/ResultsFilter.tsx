'use client';

import React from 'react';

export function ResultsFilter({
  defaultLeague,
  defaultMarket,
}: {
  defaultLeague?: string;
  defaultMarket?: string;
}) {
  return (
    <form className="flex items-center gap-3">
      <select
        name="league"
        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-300"
        defaultValue={defaultLeague || ''}
        onChange={(e) => e.target.form?.submit()}
      >
        <option value="">All Leagues</option>
        <option value="English Premier League">EPL</option>
        <option value="La Liga">La Liga</option>
        <option value="Bundesliga">Bundesliga</option>
        <option value="Serie A">Serie A</option>
        <option value="Ligue 1">Ligue 1</option>
      </select>
      <select
        name="market"
        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-300"
        defaultValue={defaultMarket || ''}
        onChange={(e) => e.target.form?.submit()}
      >
        <option value="">All Markets</option>
        <option value="moneyline">Moneyline</option>
        <option value="handicap">Asian Handicap</option>
        <option value="over_under">Over/Under</option>
        <option value="btts">BTTS</option>
      </select>
    </form>
  );
}
