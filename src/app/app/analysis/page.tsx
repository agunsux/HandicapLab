'use client';

import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { usePerformance } from '@/hooks/useApi';
import { BarChart3, TrendingUp, Target, Percent, DollarSign } from 'lucide-react';

const PERIODS = [7, 14, 30, 90];

export default function AnalysisPage() {
  const [days, setDays] = useState(30);
  const { data: perf, isLoading } = usePerformance(days);

  const dailyHistory = perf?.dailyHistory || [];

  return (
    <div className="flex flex-col space-y-6 pb-8">
      {/* Header & Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-[#F0FDF4]">
            Performance Analytics
          </h1>
          <p className="mt-1 text-sm text-[#9CA3AF]">
            Quantitative model validation, cumulative yield, and daily profit/loss breakdown.
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1 p-1 bg-[#111827] border border-[#1F2937] rounded-xl w-fit">
          {PERIODS.map((p) => {
            const isActive = days === p;
            return (
              <button
                key={p}
                onClick={() => setDays(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#10B981] text-black shadow-sm'
                    : 'text-[#9CA3AF] hover:text-[#F0FDF4]'
                }`}
              >
                {p}D
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Summary Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Bets */}
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
            <span>Total Signals</span>
            <Target className="h-4 w-4 text-[#10B981]" />
          </div>
          <div className="mt-3 text-3xl font-display font-bold text-[#F0FDF4]">
            {isLoading ? '...' : perf?.totalBets || 0}
          </div>
          <p className="mt-1 text-[11px] text-[#9CA3AF]">Settled trades in {days}d</p>
        </div>

        {/* Win Rate */}
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
            <span>Win Rate</span>
            <Percent className="h-4 w-4 text-[#10B981]" />
          </div>
          <div className="mt-3 text-3xl font-display font-bold text-[#10B981]">
            {isLoading ? '...' : `${perf?.winRate || 0}%`}
          </div>
          <p className="mt-1 text-[11px] text-[#9CA3AF]">Model hit rate</p>
        </div>

        {/* Cumulative P/L */}
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
            <span>Cumulative P/L</span>
            <TrendingUp className="h-4 w-4 text-[#10B981]" />
          </div>
          <div className="mt-3 text-3xl font-display font-bold text-[#10B981]">
            {isLoading ? '...' : `+${perf?.cumulativePnL || 0} u`}
          </div>
          <p className="mt-1 text-[11px] text-[#9CA3AF]">Quarter Kelly compounding</p>
        </div>

        {/* ROI */}
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
            <span>ROI</span>
            <DollarSign className="h-4 w-4 text-[#F59E0B]" />
          </div>
          <div className="mt-3 text-3xl font-display font-bold text-[#F59E0B]">
            {isLoading ? '...' : `+${perf?.roi || 0}%`}
          </div>
          <p className="mt-1 text-[11px] text-[#9CA3AF]">Return on turnover</p>
        </div>
      </div>

      {/* Chart 1: Cumulative Profit (AreaChart) */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-[#F0FDF4]">Cumulative Profit Growth</h2>
            <p className="text-xs text-[#9CA3AF]">Units gained over time ({days} days window)</p>
          </div>
          <BarChart3 className="h-5 w-5 text-[#10B981]" />
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#9CA3AF"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}u`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0B0F0E',
                  borderColor: '#1F2937',
                  borderRadius: '0.5rem',
                  color: '#F0FDF4',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="#10B981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#emeraldGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Daily P/L (BarChart) */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-[#F0FDF4]">Daily Profit / Loss</h2>
            <p className="text-xs text-[#9CA3AF]">Daily unit variances across settled predictions</p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#9CA3AF"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}u`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0B0F0E',
                  borderColor: '#1F2937',
                  borderRadius: '0.5rem',
                  color: '#F0FDF4',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {dailyHistory.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.pnl >= 0 ? '#10B981' : '#EF4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
