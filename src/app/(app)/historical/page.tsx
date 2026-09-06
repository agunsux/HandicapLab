'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Database, Trophy, Users, Calendar, UserCheck, LineChart, GitCompare,
  TrendingDown, Award, ArrowRight, CheckCircle2, Circle, AlertTriangle, XCircle, ChevronDown,
} from 'lucide-react';
import { SearchBar } from '@/components/ui/SearchBar';
import { HistoricalMarketExplorer } from '@/components/historical/HistoricalMarketExplorer';
import type { HistoricalStatusPayload, LeagueRow } from '@/lib/historical/historicalResearchService';

type StatusLevel = HistoricalStatusPayload['pipeline'][number]['status'];

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}
function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

// ─── small presentational helpers ─────────────────────────────────────────
function Pill({ status, label }: { status: StatusLevel | 'READY' | 'NOT_STARTED'; label: string }) {
  const styles: Record<string, string> = {
    VERIFIED: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/40',
    READY: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/40',
    PENDING: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/40',
    BLOCKED: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/40',
    NOT_STARTED: 'bg-[#6B7280]/10 text-[#9CA3AF] border-[#6B7280]/40',
    SOURCE: 'bg-[#3B82F6]/10 text-[#60A5FA] border-[#3B82F6]/40',
  };
  const dot: Record<string, string> = { VERIFIED: '✓', READY: '✓', PENDING: '○', BLOCKED: '⚠', NOT_STARTED: '○', SOURCE: '■' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-bold uppercase tracking-wider ${styles[status]}`}>
      <span>{dot[status]}</span>
      {label}
    </span>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-mono uppercase tracking-widest text-[#F0FDF4] font-bold">{title}</h2>
      {sub && <p className="text-xs text-[#9CA3AF] mt-0.5">{sub}</p>}
    </div>
  );
}

function Kpi({ value, label, accent = 'text-[#F0FDF4]' }: { value: string; label: string; accent?: string }) {
  return (
    <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl">
      <div className={`text-3xl font-bold font-mono tabular-nums ${accent}`}>{value}</div>
      <div className="text-[11px] font-mono uppercase tracking-widest text-[#9CA3AF] mt-1">{label}</div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────
export default function HistoricalResearchDashboard() {
  const [status, setStatus] = useState<HistoricalStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showProvenance, setShowProvenance] = useState(false);
  const [openCluster, setOpenCluster] = useState<'A' | 'B' | 'C' | null>('A');

  useEffect(() => {
    let mounted = true;
    fetch('/api/v1/historical/status', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`status endpoint ${r.status}`);
        return (await r.json()) as HistoricalStatusPayload;
      })
      .then((p) => mounted && setStatus(p))
      .catch((e: Error) => mounted && setError(e.message));
    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return (
      <div className="p-6 bg-[#1A1F2E] border border-[#EF4444]/40 rounded-2xl space-y-3">
        <div className="flex items-center gap-2 text-[#EF4444] font-mono uppercase tracking-widest text-xs font-bold">
          <XCircle className="h-4 w-4" /> Historical Status Unavailable
        </div>
        <p className="text-xs text-[#9CA3AF]">The research API could not be reached ({error}). No synthetic metrics are rendered.</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-6 bg-[#111827] border border-[#1F2937] rounded-2xl">
        <div className="h-4 w-40 rounded bg-[#1F2937] animate-pulse mb-4" />
        <div className="h-3 w-72 rounded bg-[#1F2937] animate-pulse" />
        <div className="text-[11px] font-mono text-[#9CA3AF] mt-4">Loading historical research status…</div>
      </div>
    );
  }

  const { dataset, market, leagues, clusters, goldLayer, pipeline, backtest } = status;
  const goldBlocked = goldLayer.status === 'BLOCKED' || status.dataSource === 'SOURCE';
  const backtestStatus: StatusLevel = backtest.ready ? 'READY' : 'NOT_STARTED';

  const modules = [
    { id: 'competitions', title: 'Competitions', count: `${fmt(dataset.canonicalMatches)} Matches`, desc: 'Browse verified Cluster A league data (matches, coverage, seasons).', href: '/historical/competitions', icon: Trophy, accent: 'from-[#10B981]/20 to-transparent' },
    { id: 'teams', title: 'Teams', count: 'Not in dataset', desc: 'Out of scope for europe-dataset-v1 — no fabricated roster data.', href: '/historical/teams', icon: Users, accent: 'from-[#3B82F6]/20 to-transparent' },
    { id: 'matches', title: 'Matches', count: `${fmt(dataset.canonicalMatches)} Matches`, desc: 'Match explorer over the verified historical dataset.', href: '/historical/matches', icon: Calendar, accent: 'from-[#F59E0B]/20 to-transparent' },
    { id: 'players', title: 'Players', count: 'Out of scope', desc: 'Player roster/xG pages are not part of this verified dataset.', href: '/historical/players', icon: UserCheck, accent: 'from-[#8B5CF6]/20 to-transparent' },
    { id: 'odds-explorer', title: 'Odds Explorer', count: `${fmtK(market.observations.total)} Odds Observations`, desc: 'Pinnacle/Bet365 opening & closing ML rows from the market layer.', href: '/historical/odds-explorer', icon: LineChart, isKiller: true, accent: 'from-[#10B981]/30 to-transparent' },
    { id: 'h2h', title: 'Head-to-Head', count: 'Out of scope', desc: 'Not part of europe-dataset-v1.', href: '/historical/h2h', icon: GitCompare, accent: 'from-[#EC4899]/20 to-transparent' },
    { id: 'trends', title: 'Trends', count: `${dataset.canonicalMatches} Matches`, desc: 'Market coverage and league comparison view.', href: '/historical/trends', icon: TrendingDown, accent: 'from-[#14B8A6]/20 to-transparent' },
    { id: 'records', title: 'Records', count: 'Out of scope', desc: 'Not part of europe-dataset-v1.', href: '/historical/records', icon: Award, accent: 'from-[#F59E0B]/20 to-transparent' },
  ];

  return (
    <div className="space-y-8">
      {/* ── Hero status banner ── */}
      <div className="p-6 bg-gradient-to-r from-[#111827] via-[#1A1F2E] to-[#0B0F0E] border border-[#1F2937] rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Database className="h-48 w-48 text-[#10B981]" />
        </div>
        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs font-mono font-bold uppercase tracking-widest">
            <span>Historical Research</span>
          </div>
          <h1 className="text-3xl font-bold font-sans tracking-tight text-[#F0FDF4]">Historical Research · European Football Dataset</h1>
          <p className="text-xs text-[#9CA3AF] leading-relaxed">
            Verified historical data for Moneyline, Asian Handicap and Over/Under research.
            Dataset <span className="text-[#F0FDF4] font-mono">{dataset.version}</span> · source-derived metrics labeled plainly when the Gold Layer is not live.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#9CA3AF]">Dataset&nbsp;<Pill status={dataset.label === 'DB VERIFIED' ? 'VERIFIED' : 'SOURCE'} label={dataset.label} /></span>
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#9CA3AF]">Gold Layer&nbsp;<Pill status={goldLayer.status as StatusLevel} label={goldLayer.status} /></span>
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#9CA3AF]">Backtest&nbsp;<Pill status={backtestStatus} label={backtestStatus} /></span>
            <a
              href="/api/v1/export/historical"
              download
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10B981]/20 hover:bg-[#10B981]/30 border border-[#10B981]/50 text-[#10B981] text-[11px] font-mono font-bold transition-colors ml-auto"
            >
              📥 Export Dataset (CSV)
            </a>
          </div>

          {goldBlocked && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#FCA5A5]">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-xs leading-relaxed">
                <span className="font-bold font-mono uppercase tracking-wider">Gold Layer {goldLayer.status}</span> — {goldLayer.reason ? `${goldLayer.reason}: ` : ''}credentialed Supabase verification required before live database numbers can be shown. All metrics below are labeled <span className="font-mono">SOURCE</span>.
              </p>
            </div>
          )}

          <div className="pt-1">
            <SearchBar />
          </div>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi value={fmt(dataset.canonicalMatches)} label="Historical Matches" accent="text-[#10B981]" />
        <Kpi value={fmt(market.observations.total)} label="Market Observations" accent="text-[#34D399]" />
        <Kpi value={fmt(clusters.find((c) => c.cluster === 'A')?.leaguesIncluded ?? 0)} label="Top European Leagues" />
        <Kpi value={fmt(3)} label="Research Markets" />
      </div>

      {/* ── Market coverage ── */}
      <div>
        <SectionTitle title="Market Coverage" sub="Per-market observations and league coverage — derived from the actual data layer." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {([
            { title: 'Moneyline', code: 'ML', obs: market.observations.ml, cov: market.coverage.ml },
            { title: 'Asian Handicap', code: 'AH', obs: market.observations.ah, cov: market.coverage.ah },
            { title: 'Over / Under', code: 'OU', obs: market.observations.ou, cov: market.coverage.ou },
          ] as const).map((m) => (
            <div key={m.code} className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#9CA3AF] font-bold">{m.title}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0B0F0E] border border-[#1F2937] text-[#10B981]">{m.code}</span>
              </div>
              <div className="text-2xl font-mono font-bold text-[#F0FDF4] tabular-nums">{fmt(m.obs)} <span className="text-xs text-[#9CA3AF]">observations</span></div>
              <div className="mt-3 pt-3 border-t border-[#1F2937]/60 space-y-1 text-[11px] font-mono">
                <div className="flex justify-between"><span className="text-[#9CA3AF]">League coverage</span><span className="text-[#F0FDF4]">{m.cov.toFixed(2)}%</span></div>
                <div className="flex justify-between"><span className="text-[#9CA3AF]">Source</span><span className="text-[#F0FDF4]">Historical bookmaker data</span></div>
                <div className="flex justify-between"><span className="text-[#9CA3AF]">Integrity</span><span className="text-[#10B981]">{dataset.label}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Historical Market Explorer (EPIC-66 Empirical Discovery) ── */}
      <div>
        <HistoricalMarketExplorer />
      </div>

      {/* ── League coverage table ── */}
      <div>
        <SectionTitle title="League Coverage" sub={`${leagues.filter((l) => l.status !== 'SOURCE ABSENT').length} leagues loaded · Cluster A · coverage values from the data layer.`} />
        <div className="overflow-x-auto rounded-xl border border-[#1F2937]">
          <table className="w-full text-left text-xs bg-[#111827]">
            <thead className="bg-[#0B0F0E] text-[10px] font-mono uppercase tracking-widest text-[#9CA3AF]">
              <tr>
                <th className="px-4 py-3">League</th><th className="px-4 py-3">Cluster</th><th className="px-4 py-3 text-right">Matches</th>
                <th className="px-4 py-3 text-right">ML</th><th className="px-4 py-3 text-right">AH</th><th className="px-4 py-3 text-right">OU</th><th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2937]/60">
              {leagues
                .filter((l) => l.cluster === 'A' || l.status !== 'SOURCE ABSENT')
                .map((l: LeagueRow) => (
                  <tr key={l.leagueId} className="hover:bg-[#1A1F2E]/60">
                    <td className="px-4 py-2.5 font-semibold text-[#F0FDF4]">{l.name}</td>
                    <td className="px-4 py-2.5"><span className="font-mono text-[#10B981] border border-[#10B981]/30 rounded px-1.5 py-0.5 text-[10px]">{l.cluster}</span></td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#9CA3AF]">{l.matches ? fmt(l.matches) : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#F0FDF4]">{l.matches ? `${l.ml.toFixed(2)}%` : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#F0FDF4]">{l.matches ? `${l.ah.toFixed(2)}%` : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#F0FDF4]">{l.matches ? `${l.ou.toFixed(2)}%` : '—'}</td>
                    <td className="px-4 py-2.5"><Pill status={l.status === 'SOURCE ABSENT' ? 'NOT_STARTED' : 'READY'} label={l.status} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cluster view ── */}
      <div>
        <SectionTitle title="Cluster Structure" sub="Three-cluster research structure. Absence of source data in B/C is shown deliberately." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {clusters.map((c) => {
            const open = openCluster === c.cluster;
            const cls = c.cluster === 'A'
              ? 'border-[#10B981]/40'
              : 'border-[#1F2937]';
            return (
              <div key={c.cluster} className={`p-5 bg-[#111827] border rounded-xl ${cls}`}>
                <button onClick={() => setOpenCluster(open ? null : c.cluster)} className="w-full text-left flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[#9CA3AF]">Cluster {c.cluster}</div>
                    <div className="text-sm font-bold text-[#F0FDF4] mt-0.5">{c.label}</div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-[#9CA3AF] transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                <div className="mt-3 text-[11px] font-mono text-[#9CA3AF]">
                  {c.leaguesIncluded} leagues · {c.matches ? fmt(c.matches) : 0} matches
                  {c.markets ? ` · ${c.markets}` : ''}
                </div>
                {c.leaguesIncluded === 0 && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#EF4444]/40 text-[10px] font-mono uppercase text-[#F87171]">
                    <AlertTriangle className="h-3 w-3" /> Source Data Absent
                  </div>
                )}
                {open && (
                  <div className="mt-3 pt-3 border-t border-[#1F2937]/60 space-y-1">
                    {c.leaguesPresent.length > 0 && <div className="text-[10px] font-mono uppercase text-[#10B981]">Loaded: {c.leaguesPresent.join(' · ')}</div>}
                    <div className="text-[11px] font-mono text-[#F0FDF4]">
                      {c.excludedNames.length > 0 ? <>Excluded: <span className="text-[#9CA3AF]">{c.excludedNames.join(' · ')}</span></> : 'No excluded leagues in this cluster.'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Data integrity + provenance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl">
          <SectionTitle title="Data Integrity" />
          <div className="space-y-2 text-[11px] font-mono">
            {[
              ['Canonical Matches', fmt(dataset.canonicalMatches)],
              ['Invalid Records', fmt(dataset.rejected)],
              ['Duplicates Remaining', fmt(dataset.duplicatesRemaining)],
              ['Synthetic Records', fmt(dataset.synthetic)],
              ['Unknown Provenance', fmt(dataset.unknownProvenance)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-1 border-b border-[#1F2937]/40 last:border-0">
                <span className="text-[#9CA3AF]">{k}</span><span className="text-[#F0FDF4] tabular-nums">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider">
            <Pill status={dataset.label === 'DB VERIFIED' ? 'VERIFIED' : 'SOURCE'} label={dataset.label} />
            <span className="text-[#9CA3AF]">{goldBlocked ? 'DB verification pending' : 'database verified'}</span>
          </div>
        </div>

        <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-mono uppercase tracking-widest text-[#F0FDF4] font-bold">Dataset Provenance</h2>
            <button onClick={() => setShowProvenance(!showProvenance)} className="text-[10px] font-mono uppercase tracking-wider text-[#10B981] border border-[#10B981]/30 rounded px-2 py-1 hover:bg-[#10B981]/10">
              {showProvenance ? 'Hide' : 'View Provenance'}
            </button>
          </div>
          <div className="space-y-2 text-[11px] font-mono">
            <div className="flex justify-between"><span className="text-[#9CA3AF]">Dataset</span><span className="text-[#F0FDF4]">{dataset.version}</span></div>
            <div className="flex justify-between"><span className="text-[#9CA3AF]">Source</span><span className="text-[#F0FDF4]">football-data.co.uk</span></div>
            <div className="flex justify-between"><span className="text-[#9CA3AF]">Dataset Hash</span><span className="text-[#F0FDF4] font-mono">{dataset.hashShort}…</span></div>
            <div className="flex justify-between"><span className="text-[#9CA3AF]">Canonical Records</span><span className="text-[#F0FDF4] tabular-nums">{fmt(dataset.canonicalMatches)}</span></div>
            {market.window && (
              <div className="flex justify-between"><span className="text-[#9CA3AF]">Window</span><span className="text-[#F0FDF4]">{market.window.earliest} → {market.window.latest}</span></div>
            )}
          </div>
          {showProvenance && (
            <div className="mt-3 p-3 rounded-lg bg-[#0B0F0E] border border-[#1F2937] space-y-1.5 text-[11px] font-mono break-all">
              <div><span className="text-[#9CA3AF]">Full hash: </span><span className="text-[#34D399]">{dataset.hash}</span></div>
              <div><span className="text-[#9CA3AF]">Schema version: </span><span className="text-[#F0FDF4]">{dataset.schemaVersion}</span></div>
              <div><span className="text-[#9CA3AF]">Normalization: </span><span className="text-[#F0FDF4]">{dataset.normalizationVersion}</span></div>
              <div><span className="text-[#9CA3AF]">Last generated: </span><span className="text-[#F0FDF4]">{dataset.generatedAt}</span></div>
              <div><span className="text-[#9CA3AF]">Raw records: </span><span className="text-[#F0FDF4]">{fmt(dataset.rawRecordCount)}</span></div>
              <div><span className="text-[#9CA3AF]">Duplicates resolved: </span><span className="text-[#F0FDF4]">{fmt(dataset.duplicatesResolved)}</span></div>
            </div>
          )}
        </div>
      </div>

      {/* ── Gold layer pipeline ── */}
      <div>
        <SectionTitle title="Gold Layer Pipeline" sub="Every node is honest about whether it is verified, pending, or blocked." />
        <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-0">
            {pipeline.map((node, i) => (
              <React.Fragment key={node.id}>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#F0FDF4]">{node.label}</span>
                  <Pill status={node.status} label={node.status} />
                </div>
                {i < pipeline.length - 1 && (
                  <span className="hidden md:block text-[#4B5563] font-mono">↓</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ── Backtest readiness ── */}
      <div>
        <SectionTitle title="Backtest Readiness" />
        <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF]">Status</span>
            <Pill status={backtestStatus} label={backtest.ready ? 'READY' : 'NOT STARTED'} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5">
            {backtest.checklist.map((c) => {
              const Icon = c.state === 'done' ? CheckCircle2 : c.state === 'blocked' ? AlertTriangle : c.state === 'pending' ? Circle : Circle;
              const color = c.state === 'done' ? 'text-[#10B981]' : c.state === 'blocked' ? 'text-[#EF4444]' : 'text-[#6B7280]';
              return (
                <div key={c.id} className="flex items-center gap-2 text-[11px] font-mono">
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                  <span className="text-[#D1D5DB]">{c.label}</span>
                  {c.detail && <span className="text-[#9CA3AF]">({c.detail})</span>}
                </div>
              );
            })}
          </div>
          {!backtest.ready && (
            <p className="mt-4 text-[11px] text-[#9CA3AF] leading-relaxed">
              Dataset-side readiness is complete; backtest execution is gated on credentialed Gold Layer verification and UI verification.
            </p>
          )}
        </div>
      </div>

      {/* ── Module nav (dynamic counts) ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-mono uppercase tracking-widest text-[#9CA3AF] font-semibold">Intelligence Modules</h2>
          <span className="text-xs font-mono text-[#10B981]">Counts from status API</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link key={mod.id} href={mod.href} className="group relative p-5 bg-[#111827] border border-[#1F2937] hover:border-[#10B981]/50 rounded-xl transition-all duration-200 flex flex-col justify-between overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${mod.accent}`} />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-lg bg-[#0B0F0E] border border-[#1F2937] text-[#10B981] group-hover:scale-105 transition-transform">
                      <Icon className="h-5 w-5" />
                    </div>
                    {mod.isKiller ? (
                      <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-[#10B981] text-black rounded uppercase">Killer Feature</span>
                    ) : (
                      <span className="text-[11px] font-mono text-[#9CA3AF]">{mod.count}</span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-[#F0FDF4] group-hover:text-[#10B981] transition-colors mb-1">{mod.title}</h3>
                  <p className="text-xs text-[#9CA3AF] leading-normal">{mod.desc}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#1F2937]/50 flex items-center justify-between text-xs font-mono text-[#9CA3AF] group-hover:text-[#F0FDF4]">
                  <span>Explore Module</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform text-[#10B981]" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
