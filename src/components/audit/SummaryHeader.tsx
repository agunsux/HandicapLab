'use client';

import React from 'react';
import { Target, TrendingUp, CheckCircle, BarChart3, Clock, ArrowUpRight, ArrowDownRight, Scale } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

function KPICard({ title, value, subValue, icon, trend }: KPICardProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</span>
        <div className="text-slate-400 dark:text-slate-500">{icon}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
        {subValue && (
          <span
            className={`text-xs font-semibold flex items-center ${
              trend === 'up'
                ? 'text-emerald-600 dark:text-emerald-400'
                : trend === 'down'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {trend === 'up' && <ArrowUpRight className="w-3 h-3 mr-1" />}
            {trend === 'down' && <ArrowDownRight className="w-3 h-3 mr-1" />}
            {subValue}
          </span>
        )}
      </div>
    </div>
  );
}

export default function SummaryHeader() {
  // In a real implementation, these would be fetched from the API based on current filters.
  // We'll mock them for the initial UI layout.
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
      <KPICard 
        title="Predictions" 
        value="1,842" 
        subValue="47 Pending" 
        icon={<Target className="w-5 h-5" />} 
        trend="neutral" 
      />
      <KPICard 
        title="Accuracy" 
        value="58.7%" 
        subValue="+1.2%" 
        icon={<CheckCircle className="w-5 h-5" />} 
        trend="up" 
      />
      <KPICard 
        title="Realized ROI" 
        value="+8.41%" 
        subValue="Exp: +6.72%" 
        icon={<TrendingUp className="w-5 h-5" />} 
        trend="up" 
      />
      <KPICard 
        title="Avg CLV" 
        value="+0.09" 
        subValue="+0.02" 
        icon={<Scale className="w-5 h-5" />} 
        trend="up" 
      />
      <KPICard 
        title="Brier Score" 
        value="0.184" 
        subValue="Calibration: Exc." 
        icon={<BarChart3 className="w-5 h-5" />} 
        trend="down" // lower brier is better
      />
    </div>
  );
}
