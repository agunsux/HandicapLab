'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Percent, Target, Shield, CheckCircle2 } from 'lucide-react';

const mockSignals = [
  { match: 'Arsenal vs Man City', league: 'Premier League', market: 'AH -0.5', selection: 'home', entry: 1.95, closing: 1.82, clv: '+7.1%', profit: '+0.048u', isWin: true },
  { match: 'Monaco vs Lille', league: 'Ligue 1', market: 'OU Under 2.5', selection: 'under', entry: 1.85, closing: 1.78, clv: '+3.9%', profit: '+0.043u', isWin: true },
  { match: 'Lorient vs Troyes', league: 'Ligue 2', market: 'ML', selection: 'draw', entry: 3.40, closing: 3.55, clv: '-4.2%', profit: '-0.030u', isWin: false },
  { match: 'Real Madrid vs Milan', league: 'Champions League', market: 'AH -1.0', selection: 'home', entry: 2.10, closing: 1.92, clv: '+9.4%', profit: '+0.055u', isWin: true },
  { match: 'Chelsea vs Aston Villa', league: 'Premier League', market: 'OU Over 2.5', selection: 'over', entry: 1.90, closing: 1.80, clv: '+5.6%', profit: '+0.045u', isWin: true }
];

export default function LiveStats() {
  return (
    <section id="live-stats" className="py-24 border-t border-white/[0.05] bg-[#09090B] relative">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="text-xs font-bold text-emerald-400 font-mono uppercase tracking-widest bg-emerald-500/5 border border-emerald-500/10 px-3 py-1 rounded-full">
            Historical Performance & Audits
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-100 sm:text-4xl">
            Live Model Settlement & Verification
          </h2>
          <p className="text-zinc-400 text-sm md:text-base">
            Every trade is settled automatically using closing prices. Our results are verified programmatically, ensuring 100% transparency with zero look-ahead bias.
          </p>
        </div>

        {/* 2x2 Metric Grid */}
        <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Cumulative ROI', val: '+14.7%', desc: '60-day paper trading ledger', icon: TrendingUp, color: 'text-emerald-400' },
            { label: 'Win Rate', val: '60.1%', desc: '751 wins of 1,250 signals', icon: Target, color: 'text-zinc-100' },
            { label: 'Average CLV', val: '+3.15%', desc: 'Beating Pinnacle closing lines', icon: Percent, color: 'text-purple-400' },
            { label: 'Brier Score', val: '0.1824', desc: 'Probability calibration quality', icon: Shield, color: 'text-indigo-400' }
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
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Feed Updated 3 mins ago</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-white/[0.05] text-zinc-500 uppercase font-semibold bg-zinc-900/30">
                  <th className="py-3 px-6">Match / League</th>
                  <th className="py-3 px-6">Market</th>
                  <th className="py-3 px-6 text-center">Selection</th>
                  <th className="py-3 px-6 text-center">Entry Odds</th>
                  <th className="py-3 px-6 text-center">Closing Odds</th>
                  <th className="py-3 px-6 text-center">CLV</th>
                  <th className="py-3 px-6 text-right">PnL (Kelly)</th>
                  <th className="py-3 px-6 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {mockSignals.map((signal, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] text-zinc-300 transition-colors">
                    <td className="py-3.5 px-6 font-sans">
                      <div className="font-semibold text-zinc-100">{signal.match}</div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{signal.league}</div>
                    </td>
                    <td className="py-3.5 px-6 font-mono text-zinc-400">{signal.market}</td>
                    <td className="py-3.5 px-6 text-center">
                      <Badge className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px]">
                        {signal.selection.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-6 text-center font-semibold text-zinc-100">{signal.entry.toFixed(2)}</td>
                    <td className="py-3.5 px-6 text-center text-zinc-400">{signal.closing.toFixed(2)}</td>
                    <td className="py-3.5 px-6 text-center">
                      <span className={signal.clv.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}>
                        {signal.clv}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span className={signal.isWin ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                        {signal.profit}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <Badge className={
                        signal.isWin
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }>
                        {signal.isWin ? 'WIN' : 'LOSS'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
