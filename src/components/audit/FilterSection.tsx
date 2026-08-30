'use client';

import React from 'react';
import { Calendar, Trophy, BarChart, Activity, Download } from 'lucide-react';

export default function FilterSection() {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2 w-full">
        
        {/* Time Filter */}
        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
            <Calendar className="w-4 h-4 text-slate-500" />
          </div>
          <select className="bg-transparent border-none text-sm font-medium focus:ring-0 px-3 py-2 text-slate-700 dark:text-slate-300 outline-none">
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>This Season</option>
            <option>All Time</option>
            <option>Custom Range</option>
          </select>
        </div>

        {/* League Filter */}
        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
            <Trophy className="w-4 h-4 text-slate-500" />
          </div>
          <select className="bg-transparent border-none text-sm font-medium focus:ring-0 px-3 py-2 text-slate-700 dark:text-slate-300 outline-none">
            <option>All Leagues</option>
            <option>Premier League</option>
            <option>Serie A</option>
            <option>La Liga</option>
            <option>Bundesliga</option>
            <option>Ligue 1</option>
          </select>
        </div>

        {/* Market Filter */}
        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
            <BarChart className="w-4 h-4 text-slate-500" />
          </div>
          <select className="bg-transparent border-none text-sm font-medium focus:ring-0 px-3 py-2 text-slate-700 dark:text-slate-300 outline-none">
            <option>All Markets</option>
            <option>Asian Handicap</option>
            <option>Over/Under</option>
            <option>BTTS</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
            <Activity className="w-4 h-4 text-slate-500" />
          </div>
          <select className="bg-transparent border-none text-sm font-medium focus:ring-0 px-3 py-2 text-slate-700 dark:text-slate-300 outline-none">
            <option>All Status</option>
            <option>Win</option>
            <option>Loss</option>
            <option>Push</option>
            <option>Pending</option>
          </select>
        </div>

      </div>

      <div className="flex items-center shrink-0">
        <button 
          onClick={() => window.open('/api/audit/export?format=csv')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>
    </div>
  );
}
