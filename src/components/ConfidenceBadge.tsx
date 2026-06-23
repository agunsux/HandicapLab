import React from 'react';

interface ConfidenceBadgeProps {
  confidence: number | string; // Can be 0 to 1 number, or dot string like '🟢 High'
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  if (typeof confidence === 'string') {
    let colorClass = 'bg-slate-50 text-slate-700 border-slate-200';
    if (confidence.includes('High')) {
      colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (confidence.includes('Medium')) {
      colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (confidence.includes('Avoid')) {
      colorClass = 'bg-red-50 text-red-700 border-red-200';
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold transition-all shadow-sm ${colorClass}`}>
        {confidence}
      </span>
    );
  }

  // Legacy numeric confidence mapping
  let colorClass = 'bg-red-50 text-red-700 border-red-200';
  let label = '🔴 Avoid';

  if (confidence >= 0.75) {
    colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    label = '🟢 High';
  } else if (confidence >= 0.55) {
    colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
    label = '🟡 Medium';
  } else if (confidence >= 0.40) {
    colorClass = 'bg-slate-50 text-slate-700 border-slate-200';
    label = '⚪ Low';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold transition-all shadow-sm ${colorClass}`}>
      {label} {(confidence * 100).toFixed(0)}%
    </span>
  );
}
