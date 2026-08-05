'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Activity, Gauge, Target, Wallet, Shield } from 'lucide-react';
import { EngineStatusWidget } from '@/components/engine/EngineStatusWidget';
import { ValueBetsFeed } from '@/components/terminal/ValueBetsFeed';

interface DashboardStats {
  building: boolean;
  settled_count: number;
  required_settled_count?: number;
  brier_score?: number;
  clv?: number;
  portfolio_ev?: number;
  marketCounts?: Record<string, number>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topBets, setTopBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [statsRes, signalsRes] = await Promise.all([
          fetch('/api/v1/stats/dashboard'),
          fetch('/api/v1/signals?limit=5')
        ]);

        const statsJson = await statsRes.json();
        const signalsJson = await signalsRes.json();

        if (statsJson.success) setStats(statsJson.data);
        if (signalsJson.success) setTopBets(signalsJson.data || []);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();

    const interval = setInterval(loadDashboard, 300000);
    return () => clearInterval(interval);
  }, []);

  const isBuilding = !stats || stats.building;

  const metrics = [
    { 
      label: 'Avg CLV (7d)', 
      value: isBuilding ? 'Building Track Record' : `+${((stats?.clv || 0) * 100).toFixed(1)}%`, 
      sub: isBuilding ? `Requires 50 settled (${stats?.settled_count || 0}/50)` : 'Pinnacle close', 
      icon: Gauge 
    },
    { 
      label: 'Model Brier', 
      value: isBuilding ? 'Building Track Record' : `${stats?.brier_score?.toFixed(3)}`, 
      sub: isBuilding ? `Requires 50 settled (${stats?.settled_count || 0}/50)` : 'Calibration', 
      icon: Activity 
    },
    { 
      label: 'Portfolio EV', 
      value: isBuilding ? 'Building Track Record' : `+${((stats?.portfolio_ev || 0) * 100).toFixed(1)}%`, 
      sub: isBuilding ? `Requires 50 settled (${stats?.settled_count || 0}/50)` : 'Edge-weighted', 
      icon: Target 
    },
    { 
      label: 'Kelly Exposure', 
      value: isBuilding ? 'Building Track Record' : 'Quarter Kelly', 
      sub: isBuilding ? `Requires 50 settled (${stats?.settled_count || 0}/50)` : 'Kelly Fraction', 
      icon: Wallet 
    },
  ];

  const marketCounts = stats?.marketCounts || { AH: 0, OU: 0, ML: 0, BTTS: 0 };

  return (
    <div className="flex flex-col space-y-6 pb-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-display font-semibold tracking-tight text-[#F0F1F5]">Dashboard</h1>
        <p className="mt-1 text-sm text-[#8B92A8]">
          Market intelligence summary — calibrated probabilities, expected value and closing line value.
        </p>
      </div>

      {/* Autonomous Engine Heartbeat */}
      <EngineStatusWidget />

      {/* Hero metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-[#1F232C] bg-[#111318] p-4">
            <div className="flex items-center gap-2">
              <m.icon className="h-4 w-4 text-[#8B92A8]" />
              <span className="text-[10px] font-medium uppercase tracking-widest text-[#8B92A8]">
                {m.label}
              </span>
            </div>
            <div className={`mt-3 font-semibold tracking-tight ${isBuilding ? 'text-xs text-amber-400' : 'text-2xl tabular-nums text-[#F0F1F5]'}`}>
              {m.value}
            </div>
            <div className="mt-1 text-xs text-[#5A6070]">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Market coverage */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          { key: 'AH', label: 'Asian Handicap', href: '/app/markets/asian-handicap' },
          { key: 'OU', label: 'Over / Under', href: '/app/markets/over-under' },
          { key: 'ML', label: 'Moneyline', href: '/app/markets/moneyline' },
          { key: 'BTTS', label: 'BTTS', href: '/app/markets/btts' },
        ]).map((mk) => {
          const count = marketCounts[mk.key] || 0;
          return (
            <Link
              key={mk.key}
              href={mk.href}
              className="group flex items-center justify-between rounded-xl border border-[#1F232C] bg-[#111318] px-4 py-3 transition-colors hover:border-[#2A2F3A] hover:bg-[#1A1D24]/50"
            >
              <div>
                <div className="text-sm font-medium text-[#F0F1F5]">{mk.label}</div>
                <div className="mt-0.5 text-xs text-[#8B92A8]">{count} active signals</div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#8B92A8] transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>

      {/* Top EV today */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[#8B92A8]">
            Highest EV Today
          </h2>
          <Link
            href="/app/value-bets"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#818CF8] hover:text-[#6366F1] transition-colors"
          >
            All opportunities <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {topBets.length === 0 ? (
          <div className="rounded-xl border border-[#1F232C] bg-[#111318]/40 p-8 text-center">
            <p className="text-sm text-[#8B92A8]">
              Engine is scanning. No validated opportunities for this window yet.
            </p>
          </div>
        ) : (
          <ValueBetsFeed bets={topBets} />
        )}
      </div>

      {/* Research note */}
      <div className="flex items-start gap-3 rounded-xl border border-[#1F232C] bg-[#111318] p-4">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-xs leading-relaxed text-[#8B92A8]">
          HandicapLab quantitative models operate under strict data governance. Pinnacle remains the ground truth for Closing Line Value (CLV) evaluation.
        </p>
      </div>
    </div>
  );
}