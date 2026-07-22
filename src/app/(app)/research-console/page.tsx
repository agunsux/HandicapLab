'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart2,
  TrendingUp,
  Sliders,
  Layers,
  Activity,
  ShieldCheck,
  RotateCcw,
  Zap,
  Target
} from 'lucide-react';

export default function ResearchConsolePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResearchData();
  }, []);

  const fetchResearchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/value-intelligence/research-console');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to load research console data', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 font-mono p-6 space-y-6">
      {/* Console Header */}
      <div className="border border-slate-800 bg-[#0F131C] p-4 rounded-lg flex justify-between items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Sliders className="h-5 w-5 text-sky-400" />
            <h1 className="text-xl font-bold text-slate-50 tracking-wider">
              QUANTITATIVE RESEARCH CONSOLE
            </h1>
            <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs px-2.5 py-0.5 rounded">
              INTERNAL MODEL ANALYSIS ONLY
            </span>
          </div>
          <p className="text-xs text-slate-400 font-sans">
            Evaluating ROI vs Expected Value, Closing Line Value (CLV) retention, confidence bucket calibration, and Kelly growth.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ROI vs EV Matrix */}
        <div className="border border-slate-800 bg-[#0F131C] p-4 rounded-lg space-y-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            ROI VS EXPECTED VALUE (EV) BUCKETS
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141A26] text-slate-400 uppercase">
                <tr>
                  <th className="p-2.5">EV BUCKET</th>
                  <th className="p-2.5 text-right">SAMPLE BETS</th>
                  <th className="p-2.5 text-right">HIT RATE</th>
                  <th className="p-2.5 text-right">AVG CLV</th>
                  <th className="p-2.5 text-right">REALIZED ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {(data?.evMatrix || []).map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-800/30">
                    <td className="p-2.5 font-bold text-slate-300">{row.evBucket}</td>
                    <td className="p-2.5 text-right text-slate-400">{row.bets}</td>
                    <td className="p-2.5 text-right text-slate-300">{(row.hitRate * 100).toFixed(1)}%</td>
                    <td className="p-2.5 text-right text-sky-400">+{(row.clv * 100).toFixed(1)}%</td>
                    <td className="p-2.5 text-right font-bold text-emerald-400">+{(row.roi * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Confidence Bucket Calibration Matrix */}
        <div className="border border-slate-800 bg-[#0F131C] p-4 rounded-lg space-y-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Target className="h-4 w-4 text-sky-400" />
            CONFIDENCE BUCKET CALIBRATION
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141A26] text-slate-400 uppercase">
                <tr>
                  <th className="p-2.5">CONFIDENCE RANGE</th>
                  <th className="p-2.5 text-right">SAMPLE SIZE</th>
                  <th className="p-2.5 text-right">HIT RATE</th>
                  <th className="p-2.5 text-right">AVG CLV</th>
                  <th className="p-2.5 text-right">ECE ERROR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {(data?.confidenceBuckets || []).map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-800/30">
                    <td className="p-2.5 font-bold text-slate-300">{row.bucketRange}</td>
                    <td className="p-2.5 text-right text-slate-400">{row.sampleSize}</td>
                    <td className="p-2.5 text-right text-slate-300">{(row.hitRate * 100).toFixed(1)}%</td>
                    <td className="p-2.5 text-right text-sky-400">+{(row.avgClv * 100).toFixed(1)}%</td>
                    <td className="p-2.5 text-right font-bold text-emerald-400">{(row.calibrationEce * 100).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Staking Simulation (Kelly vs Flat) */}
        <div className="lg:col-span-2 border border-slate-800 bg-[#0F131C] p-4 rounded-lg space-y-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-400" />
            STAKING GROWTH COMPARISON (QUARTER KELLY VS FLAT STAKE)
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141A26] text-slate-400 uppercase">
                <tr>
                  <th className="p-2.5">MONTH</th>
                  <th className="p-2.5 text-right">FLAT STAKE ROI</th>
                  <th className="p-2.5 text-right">QUARTER KELLY ROI</th>
                  <th className="p-2.5 text-right">COMPOUNDED BANKROLL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {(data?.stakingComparison || []).map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-800/30">
                    <td className="p-2.5 font-bold text-slate-300">{row.month} 2026</td>
                    <td className="p-2.5 text-right text-slate-300">+{(row.flatRoi * 100).toFixed(1)}%</td>
                    <td className="p-2.5 text-right text-emerald-400 font-bold">+{(row.kellyRoi * 100).toFixed(1)}%</td>
                    <td className="p-2.5 text-right text-purple-400 font-bold">{row.bankrollUnits} units</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
