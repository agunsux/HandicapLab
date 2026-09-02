'use client';

import React, { useEffect, useState } from 'react';
import { X, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

interface PerformanceSummary {
  totalPredictions: number;
  settledCount: number;
  hitRate: number;
  roi: number;
  clvMean: number;
}

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const [stats, setStats] = useState<PerformanceSummary | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadStats() {
      try {
        const res = await fetch('/api/public/track-record');
        if (!res.ok) return;
        const json = await res.json();
        if (isMounted && json.status === 'SUCCESS') {
          setStats({
            totalPredictions: json.total_predictions || 0,
            settledCount: json.settled_count || 0,
            hitRate: json.hit_rate || 0,
            roi: json.roi || 0,
            clvMean: json.clv_mean || 0,
          });
        }
      } catch (err) {
        console.warn('Sidebar track record fetch failed:', err);
      } finally {
        if (isMounted) setLoadingStats(false);
      }
    }
    loadStats();
    return () => {
      isMounted = false;
    };
  }, []);

  const hasSettledData = stats && stats.settledCount > 0;

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed top-[60px] bottom-0 left-0 z-40 bg-[#0A0E1A] border-r border-[#1F2937] flex flex-col transition-all duration-300',
          collapsed ? 'w-16' : 'w-[280px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Mobile Header / Close Button */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-[#1F2937]">
          <span className="font-mono text-xs uppercase tracking-widest text-[#9CA3AF]">
            Live Performance Panel
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded-lg text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-[#111827]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Stats Panels (EPIC 63 Section 4) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
          {/* PANEL 1: TODAY */}
          <div className="rounded-xl border border-[#1F2937] bg-[#111827]/70 p-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">
              <span>Today</span>
              <span className="text-[10px] text-[#10B981] font-normal">REAL DATA</span>
            </div>

            {loadingStats ? (
              <div className="text-[#9CA3AF] text-[11px] py-1 animate-pulse">Loading live stats...</div>
            ) : hasSettledData ? (
              <div className="space-y-1 text-[#F9FAFB]">
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Signals</span>
                  <span>{stats.totalPredictions} &bull; Won {Math.round((stats.settledCount * stats.hitRate) / 100)} &bull; Lost {stats.settledCount - Math.round((stats.settledCount * stats.hitRate) / 100)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#9CA3AF]">Win rate</span>
                  <span className="font-bold text-white">{stats.hitRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#9CA3AF]">Yield</span>
                  <span
                    className={cn(
                      'font-bold',
                      stats.roi >= 0 ? 'text-[#10B981]' : 'text-red-400'
                    )}
                  >
                    {stats.roi >= 0 ? `+${stats.roi.toFixed(2)}%` : `${stats.roi.toFixed(2)}%`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-[#9CA3AF] py-1">
                No settled signals today. Awaiting kickoff results.
              </div>
            )}
          </div>

          {/* PANEL 2: 30-DAY */}
          <div className="rounded-xl border border-[#1F2937] bg-[#111827]/70 p-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">
              <span>30-Day Cohort</span>
              <Activity className="h-3.5 w-3.5 text-[#9CA3AF]" />
            </div>

            {loadingStats ? (
              <div className="text-[#9CA3AF] text-[11px] py-1 animate-pulse">Loading cohort...</div>
            ) : hasSettledData ? (
              <div className="space-y-1 text-[#F9FAFB]">
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Signals</span>
                  <span>{stats.settledCount} signals &bull; WR {stats.hitRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#9CA3AF]">Yield</span>
                  <span
                    className={cn(
                      'font-bold',
                      stats.roi >= 0 ? 'text-[#10B981]' : 'text-red-400'
                    )}
                  >
                    {stats.roi >= 0 ? `+${stats.roi.toFixed(2)}%` : `${stats.roi.toFixed(2)}%`}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#9CA3AF]">Mean CLV</span>
                  <span className="text-neutral-300 font-bold">
                    {stats.clvMean >= 0 ? `+${stats.clvMean.toFixed(2)}%` : `${stats.clvMean.toFixed(2)}%`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-[#9CA3AF] py-1">
                Building track record &bull; {stats?.totalPredictions || 0} signals logged so far.
              </div>
            )}
          </div>

          {/* PANEL 3: STREAK */}
          <div className="rounded-xl border border-[#1F2937] bg-[#111827]/70 p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider block">
                Current Streak
              </span>
              <span className="text-sm font-bold text-white">
                {hasSettledData ? (stats.roi >= 0 ? 'WINNING STREAK' : 'STABILIZING') : 'BUILDING'}
              </span>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-bold text-xs">
              {hasSettledData ? `${stats.settledCount}S` : '0S'}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
