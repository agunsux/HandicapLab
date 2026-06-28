import React from 'react';

interface SignalBadgeProps {
  status: string;
}

export function SignalBadge({ status }: SignalBadgeProps) {
  const normStatus = (status || '').toUpperCase();
  let colorClass = 'bg-slate-800 text-slate-300 border-slate-700';

  if (normStatus === 'OPEN' || normStatus === 'ACTIVE') {
    colorClass = 'bg-emerald-950 text-emerald-400 border-emerald-800';
  } else if (normStatus === 'LOCKED' || normStatus === 'STALE') {
    colorClass = 'bg-amber-950 text-amber-400 border-amber-800';
  } else if (normStatus === 'CLOSED') {
    colorClass = 'bg-rose-950 text-rose-400 border-rose-800';
  } else if (normStatus === 'LIVE') {
    colorClass = 'bg-blue-950 text-blue-400 border-blue-800';
  } else if (normStatus === 'SETTLED') {
    colorClass = 'bg-indigo-950 text-indigo-400 border-indigo-800';
  } else if (normStatus === 'VOID') {
    colorClass = 'bg-zinc-800 text-zinc-400 border-zinc-700';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border ${colorClass}`}>
      {normStatus}
    </span>
  );
}
