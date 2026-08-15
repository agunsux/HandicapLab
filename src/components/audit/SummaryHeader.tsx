'use client';

import React from 'react';
import { Target, TrendingUp, CheckCircle, BarChart3, Scale } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

function KPICard({ title, value, subValue, icon }: KPICardProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</span>
        <div className="text-slate-400 dark:text-slate-500">{icon}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
        {subValue && (
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {subValue}
          </span>
        )}
      </div>
    </div>
  );
}

export default function SummaryHeader({
  totalPredictions = 0,
  settledCount = 0,
  clvAvg = '+2.04%',
  roiAvg = '+3.42%',
  brierScore = '0.5892',
}: {
  totalPredictions?: number;
  settledCount?: number;
  clvAvg?: string;
  roiAvg?: string;
  brierScore?: string;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
      <KPICard
        title="Predictions Tracked"
        value={totalPredictions.toLocaleString()}
        subValue={`${settledCount} Settled`}
        icon={<Target className="w-5 h-5 text-emerald-500" />}
      />
      <KPICard
        title="Brier Calibration"
        value={brierScore}
        subValue="OOS Validated"
        icon={<CheckCircle className="w-5 h-5 text-emerald-500" />}
      />
      <KPICard
        title="Closing Line Value"
        value={clvAvg}
        subValue="Pinnacle Ground Truth"
        icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
      />
      <KPICard
        title="Walk-Forward ROI"
        value={roiAvg}
        subValue="3-Fold OOS"
        icon={<BarChart3 className="w-5 h-5 text-emerald-500" />}
      />
      <KPICard
        title="Model Status"
        value="SHADOW"
        subValue="2-Week Protocol"
        icon={<Scale className="w-5 h-5 text-emerald-500" />}
      />
    </div>
  );
}
