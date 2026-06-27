import React from 'react';

interface OddsMovementProps {
  openingOdds: number | null;
  currentOdds: number | null;
}

export function OddsMovement({ openingOdds, currentOdds }: OddsMovementProps) {
  if (!openingOdds) {
    return <span className="text-slate-400">—</span>;
  }
  if (!currentOdds) {
    return (
      <span className="text-slate-300 font-mono">
        {openingOdds.toFixed(2)} <span className="text-slate-500 text-xs">(Locked)</span>
      </span>
    );
  }

  const diff = currentOdds - openingOdds;
  const isUp = diff > 0;
  const isDown = diff < 0;

  return (
    <div className="flex items-center gap-1.5 font-mono text-sm">
      <span className="text-slate-500 line-through text-xs">{openingOdds.toFixed(2)}</span>
      <span className="font-semibold text-slate-200">{currentOdds.toFixed(2)}</span>
      {isUp && <span className="text-emerald-500 text-xs">▲ (+{(diff).toFixed(2)})</span>}
      {isDown && <span className="text-rose-500 text-xs">▼ ({(diff).toFixed(2)})</span>}
    </div>
  );
}
