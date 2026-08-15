'use client';

import React from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { BarChart3 } from 'lucide-react';

export interface TimeSeriesPoint {
  date: string;
  roi: number;
  clv: number;
}

export default function HistoricalCharts({
  data = [],
}: {
  data?: TimeSeriesPoint[];
}) {
  if (!data || data.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center shadow-sm">
          <BarChart3 className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Cumulative ROI Performance
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Historical series builds as settled matches accumulate in warehouse.
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center shadow-sm">
          <BarChart3 className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Rolling Closing Line Value (CLV)
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pinnacle closing line delta tracked across settlement lifecycle.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Rolling ROI Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Cumulative ROI
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRoi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }}
                itemStyle={{ color: '#10b981' }}
              />
              <Area type="monotone" dataKey="roi" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRoi)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Average CLV Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Rolling Closing Line Value (CLV)
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorClv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }}
                itemStyle={{ color: '#3b82f6' }}
              />
              <Area type="monotone" dataKey="clv" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorClv)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
