'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  Legend
} from 'recharts';

const mockRoiData = [
  { date: '2026-07-01', roi: 4.2, clv: 0.05 },
  { date: '2026-07-05', roi: 5.1, clv: 0.06 },
  { date: '2026-07-10', roi: 4.8, clv: 0.08 },
  { date: '2026-07-15', roi: 6.2, clv: 0.07 },
  { date: '2026-07-20', roi: 7.9, clv: 0.09 },
  { date: '2026-07-25', roi: 7.5, clv: 0.08 },
  { date: '2026-07-28', roi: 8.41, clv: 0.09 },
];

export default function HistoricalCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* Rolling ROI Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Cumulative ROI</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockRoiData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRoi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
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
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Rolling Closing Line Value (CLV)</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={mockRoiData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }}
                itemStyle={{ color: '#3b82f6' }}
              />
              <Bar dataKey="clv" barSize={20} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="clv" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
