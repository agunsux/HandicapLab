'use client';

import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';

export interface FilterOption {
  key: string;
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (val: string) => void;
}

interface FilterBarProps {
  filters: FilterOption[];
  onReset?: () => void;
}

export function FilterBar({ filters, onReset }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#111827] border border-[#1F2937] rounded-xl text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-[#9CA3AF] font-mono uppercase tracking-widest text-[10px] font-semibold pr-2 border-r border-[#1F2937]">
          <Filter className="h-3.5 w-3.5 text-[#10B981]" />
          <span>Filters</span>
        </div>

        {filters.map((f) => (
          <div key={f.key} className="flex items-center gap-1.5">
            <span className="text-[#9CA3AF] text-[11px] font-medium">{f.label}:</span>
            <select
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              className="bg-[#0B0F0E] border border-[#1F2937] text-[#F0FDF4] rounded-md px-2 py-1 font-mono text-xs focus:outline-none focus:border-[#10B981]"
            >
              {f.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {onReset && (
        <button
          onClick={onReset}
          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono text-[#9CA3AF] hover:text-[#F0FDF4] hover:bg-[#1A1F2E] rounded-md border border-[#1F2937] transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset</span>
        </button>
      )}
    </div>
  );
}
