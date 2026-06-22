import React from 'react';

interface ConfidenceBadgeProps {
  confidence: number; // 0 to 1
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  let colorClass = 'bg-red-100 text-red-800 border-red-200';
  let label = 'Low';

  if (confidence >= 0.75) {
    colorClass = 'bg-green-100 text-green-800 border-green-200';
    label = 'High';
  } else if (confidence >= 0.5) {
    colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
    label = 'Moderate';
  }

  return (
    <span className={`px-2 py-1 rounded-full border text-xs font-semibold ${colorClass}`}>
      {label} {(confidence * 100).toFixed(0)}%
    </span>
  );
}
