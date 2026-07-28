'use client';

import React from 'react';
import { Database, TrendingUp, AlertTriangle, Scale, Clock, Activity, Fingerprint, Search } from 'lucide-react';

interface Props {
  predictionId: string;
}

export default function ExpandableMatchDetail({ predictionId }: Props) {
  // In a real implementation, this would fetch data based on predictionId
  
  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-200">
      
      {/* 1. Evidence Panel & Snapshot */}
      <div className="flex flex-col gap-4">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
          <Fingerprint className="w-4 h-4 text-indigo-500" />
          Evidence Panel
        </h4>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Model Version</span>
            <span className="font-mono text-slate-900 dark:text-white">v2.8.3</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Feature Store</span>
            <span className="font-mono text-slate-900 dark:text-white">v17</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Snapshot Hash</span>
            <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">a7f8b9...c3d2</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Manifest</span>
            <span className="font-medium text-slate-900 dark:text-white">Daily Manifest #418</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Kelly Fraction</span>
            <span className="font-medium text-slate-900 dark:text-white">0.31 Units</span>
          </div>
        </div>
      </div>

      {/* 2. Feature Contributions */}
      <div className="flex flex-col gap-4">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
          <Activity className="w-4 h-4 text-emerald-500" />
          Feature Contribution
        </h4>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-4 text-sm">
          <div>
            <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2">Top Positive Features</div>
            <ul className="space-y-1">
              <li className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">+ Home xG Edge</span><span className="font-mono text-emerald-600">+0.12</span></li>
              <li className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">+ Away Fatigue (Rest &lt; 3d)</span><span className="font-mono text-emerald-600">+0.08</span></li>
              <li className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">+ Defensive Rating Delta</span><span className="font-mono text-emerald-600">+0.05</span></li>
            </ul>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
            <div className="text-xs font-medium text-rose-600 dark:text-rose-400 mb-2">Top Negative Features</div>
            <ul className="space-y-1">
              <li className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">- Market Momentum</span><span className="font-mono text-rose-600">-0.04</span></li>
              <li className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">- Missing Key Midfielder</span><span className="font-mono text-rose-600">-0.03</span></li>
            </ul>
          </div>
        </div>
      </div>

      {/* 3. AI Post Match Analysis */}
      <div className="flex flex-col gap-4">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
          <Database className="w-4 h-4 text-amber-500" />
          AI Post-Match Analysis
        </h4>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4 text-sm h-full">
          <p className="text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">
            <strong className="text-amber-700 dark:text-amber-400 block mb-1">Why prediction succeeded:</strong>
            The model correctly identified the home team's structural xG advantage. The away team's fatigue played a major role in the second half, leading to two late goals exactly as the fatigue model predicted.
          </p>
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-amber-200/50 dark:border-amber-800/50 text-xs">
            <span className="bg-amber-100 dark:bg-amber-800/50 text-amber-800 dark:text-amber-400 px-2 py-1 rounded">Calibration Bucket: 82%</span>
            <span className="bg-amber-100 dark:bg-amber-800/50 text-amber-800 dark:text-amber-400 px-2 py-1 rounded">Brier: 0.12</span>
          </div>
        </div>
      </div>

      {/* 4. Visual Timeline (Spans full width) */}
      <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-4">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
          <Clock className="w-4 h-4 text-blue-500" />
          Audit Timeline
        </h4>
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 w-full h-0.5 bg-slate-200 dark:bg-slate-700 -z-10 transform -translate-y-1/2"></div>
          
          {[
            { label: 'Generated', time: '10:00' },
            { label: 'Odds Captured', time: '10:01' },
            { label: 'Published', time: '10:05' },
            { label: 'Kickoff', time: '14:00' },
            { label: 'Closing Odds', time: '14:00' },
            { label: 'Settlement', time: '16:05' },
            { label: 'Audit Locked', time: '16:10' }
          ].map((step, i) => (
            <div key={i} className="flex flex-col items-center bg-slate-50 dark:bg-slate-900/50 px-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 mb-2 border-2 border-white dark:border-slate-900"></div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{step.label}</span>
              <span className="text-[10px] text-slate-500">{step.time}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
