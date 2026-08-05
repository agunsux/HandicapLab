'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface HistoricalSubNavProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  title?: string;
  subtitle?: string;
  badge?: string;
}

export function HistoricalSubNav({
  tabs,
  activeTab,
  onTabChange,
  title,
  subtitle,
  badge,
}: HistoricalSubNavProps) {
  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4 mb-6">
      {title && (
        <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-[#1F2937]">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-sans tracking-tight text-[#F0FDF4]">{title}</h1>
              {badge && (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 rounded-full uppercase">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-[#9CA3AF] mt-0.5">{subtitle}</p>}
          </div>
        </div>
      )}

      {/* Tabs list */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5',
                isActive
                  ? 'bg-[#10B981] text-black font-semibold shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                  : 'text-[#9CA3AF] hover:text-[#F0FDF4] hover:bg-[#1A1F2E]'
              )}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold',
                    isActive ? 'bg-black/20 text-black' : 'bg-[#0B0F0E] text-[#9CA3AF]'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
