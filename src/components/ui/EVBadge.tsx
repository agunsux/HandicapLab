'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EVBadgeProps {
  ev?: number;
  evPercent?: number;
  locked?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function EVBadge({ ev, evPercent, locked = false, size = 'md', className }: EVBadgeProps) {
  const effectiveEv = ev !== undefined ? ev : (evPercent !== undefined ? evPercent : 0);
  if (locked) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 font-mono font-medium rounded-full border bg-amber-500/10 text-amber-500 border-amber-500/20',
          size === 'sm' ? 'px-2 py-0.5 text-[10px]' : size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs',
          className
        )}
      >
        <Lock className="h-3 w-3 shrink-0" />
        Locked
      </span>
    );
  }

  const isPositive = effectiveEv > 0;
  const isZero = effectiveEv === 0;

  // Format percent cleanly whether passed as 8.55 or 0.0855
  const formattedVal = effectiveEv > 1 || effectiveEv < -1 ? effectiveEv.toFixed(1) : (effectiveEv * 100).toFixed(1);

  return (
    <span
      className={cn(
        'inline-flex items-center font-mono font-medium tabular-nums rounded-full border',
        isPositive
          ? 'bg-[#10B981]/12 text-[#10B981] border-[#10B981]/30'
          : isZero
          ? 'bg-[#F59E0B]/12 text-[#F59E0B] border-[#F59E0B]/30'
          : 'bg-[#EF4444]/12 text-[#EF4444] border-[#EF4444]/30',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs',
        className
      )}
    >
      {isPositive ? '+' : ''}
      {formattedVal}% EV
    </span>
  );
}
