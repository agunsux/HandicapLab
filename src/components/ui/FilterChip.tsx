'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  label: string;
  count?: number;
}

export function FilterChip({ active = false, label, count, className, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer select-none',
        active
          ? 'bg-[#6366F1]/15 text-[#818CF8] border border-[#6366F1]/50 shadow-sm'
          : 'bg-[#1A1D24] text-[#8B92A8] border border-[#1F232C] hover:bg-[#1E2129] hover:text-[#F0F1F5]',
        className
      )}
      {...props}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            'px-1.5 py-0.2 rounded-full text-[10px] tabular-nums',
            active ? 'bg-[#6366F1]/30 text-[#818CF8]' : 'bg-[#111318] text-[#5A6070]'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
