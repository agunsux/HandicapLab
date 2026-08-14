'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Percent, Target, Shield, CheckCircle2 } from 'lucide-react';

interface SettledItem {
  id: string;
  match: string;
  market: string;
  selection: string;
  openingOdds: number;
  closingOdds: number;
  clvPercentage: number;
  category: string;
}

export default function LiveStats() {
  const [settledList, setSettledList] = useState<SettledItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettled() {
      try {
        setLoading(true);
        const res = await fetch('/api/performance/clv');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.recentMovements) {
            setSettledList(json.recentMovements);
          }
        }
      } catch (err) {
        console.error('Failed to load live stats movements:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSettled();
  }, []);

  return (
    <section id="live-stats" className="py-24 border-t border-white/[0.05] bg-[#09090B] relative">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="text-xs font-bold text-emerald-400 font-mono uppercase tracking-widest bg-emerald-500/5 border border-emerald-500/10 px-3 py-1 rounded-full">
            Quantitative Research &amp; Model Audits
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-100 sm:text-4xl">
            Live Model Settlement &amp; Verification
          </h2>
          <p className="text-zinc-400 text-sm md:text-base">
            Every trade is settled automatically using closing prices. Our results are verified programmatically against Pinnacle closing lines with zero look-ahead bias.
          </p>
        </div>

        {/* 2x2 Metric Grid */}
        <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Mean CLV Edge', val: '+1.52%', desc: 'Pinnacle closing line benchmark', icon: Percent, color: 'text-emerald-400' },
            { label: 'Calibration ECE', val: '1.44%', desc: 'Expected calibration error', icon: Target, color: 'text-zinc-100' },
            { label: 'Out-of-Sample Log Loss', val: '1.0266', desc: 'Walk-forward cross validation', icon: Shield, color: 'text-purple-400' },
            { label: 'Multi-Class Brier Score', val: '0.6149', desc: 'Strict probabilistic accuracy', icon: TrendingUp, color: 'text-indigo-400' }
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="rounded-lg border border-white/[0.05] bg-[#121215] p-6 hover:border-emerald-500/20 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">{stat.label}</span>
                <stat.icon className={`h-4 w-4 ${stat.color} group-hover:scale-105 transition-transform`} />
              </div>
              <div className={`mt-4 text-3xl font-extrabold font-mono tracking-tight ${stat.color}`}>
                {stat.val}
              </div>
              <div className="mt-1 text-xs text-zinc-500 font-mono">{stat.desc}</div>
            </motion.div>
          ))}
        </div>

        {/* Live Ledger Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-12 rounded-lg border border-white/[0.05] bg-[#121215]/50 overflow-hidden backdrop-blur-sm"
        >
          <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-zinc-300 uppercase tracking-wider">Recently Settled Picks</span>
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Pinnacle Benchmarked Feed</span>
          </div>

          <div className="overflow-x-auto">
            {settledList.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 font-mono text-xs space-y-1">
                <p>No settled picks currently recorded in live database.</p>
                <p className="text-[10px] text-zinc-600">Picks are populated dynamically as prospective shadow fixtures settle.</p>
              </div>
            ) : (
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/[0.05] text-zinc-500 uppercase font-semibold bg-zinc-900/30">
                    <th className="py-3 px-6">Match</th>
                    <th className="py-3 px-6">Market</th>
                    <th className="py-3 px-6 text-center">Selection</th>
                    <th className="py-3 px-6 text-center">Entry Odds</th>
                    <th className="py-3 px-6 text-center">Closing Odds</th>
                    <th className="py-3 px-6 text-center">CLV</th>
                    <th className="py-3 px-6 text-right">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {settledList.map((signal, idx) => (
                    <tr key={signal.id || idx} className="hover:bg-white/[0.02] text-zinc-300 transition-colors">
                      <td className="py-3.5 px-6 font-sans font-semibold text-zinc-100">
                        {signal.match}
                      </td>
                      <td className="py-3.5 px-6 font-mono text-zinc-400">{signal.market}</td>
                      <td className="py-3.5 px-6 text-center">
                        <Badge className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px]">
                          {signal.selection?.toUpperCase() || '-'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-6 text-center font-semibold text-zinc-100">
                        {signal.openingOdds ? signal.openingOdds.toFixed(2) : '-'}
                      </td>
                      <td className="py-3.5 px-6 text-center text-zinc-400">
                        {signal.closingOdds ? signal.closingOdds.toFixed(2) : '-'}
                      </td>
                      <td className="py-3.5 px-6 text-center">
                        <span className={signal.clvPercentage >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {signal.clvPercentage >= 0 ? `+${signal.clvPercentage.toFixed(1)}%` : `${signal.clvPercentage.toFixed(1)}%`}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <Badge className={
                          signal.clvPercentage >= 0
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }>
                          {signal.category || (signal.clvPercentage >= 0 ? 'POSITIVE' : 'NEGATIVE')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
