'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ElementType;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  change,
  changeType = 'neutral',
  icon: Icon,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'p-4 bg-[#111827] border border-[#1F2937] rounded-xl hover:border-[#374151] transition-all flex flex-col justify-between',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs uppercase tracking-widest text-[#9CA3AF] font-semibold">
          {title}
        </span>
        {Icon && (
          <div className="p-1.5 rounded-lg bg-[#0B0F0E] border border-[#1F2937] text-[#10B981]">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-1">
        <span className="text-xl font-bold font-mono tabular-nums tracking-tight text-[#F0FDF4]">
          {value}
        </span>

        {change && (
          <span
            className={cn(
              'text-xs font-mono font-semibold px-1.5 py-0.5 rounded border',
              changeType === 'positive'
                ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30'
                : changeType === 'negative'
                ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'
                : 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30'
            )}
          >
            {change}
          </span>
        )}
      </div>

      {subtitle && (
        <span className="text-[11px] text-[#9CA3AF] mt-1 font-sans">
          {subtitle}
        </span>
      )}
    </div>
  );
}
