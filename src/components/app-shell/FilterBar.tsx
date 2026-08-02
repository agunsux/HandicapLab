'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export function FilterBar({ 
  filters, 
  activeFilter, 
  onFilterChange 
}: { 
  filters: string[], 
  activeFilter: string, 
  onFilterChange: (f: string) => void 
}) {
  return (
    <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none items-center border-b border-border">
      {filters.map(filter => (
        <button 
          key={filter}
          onClick={() => onFilterChange(filter)}
          className={cn(
            "px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-[1px]",
            activeFilter === filter 
              ? "border-primary text-foreground" 
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}
