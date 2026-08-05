'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

interface EngineStatus {
  fixtures_last_ingestion: string | null;
  predictions_last_run: string | null;
  odds_provider: 'LIVE' | 'DEGRADED' | 'INVALID_KEY' | 'NO_DATA';
  settled_count: number;
  leagues_modeled: number;
}

export function EngineStatusWidget({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/v1/engine/status');
        const json = await res.json();
        if (json.success) {
          setStatus(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch engine status:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();

    // Auto refresh every 5 minutes (300,000 ms) per §3 contract
    const interval = setInterval(fetchStatus, 300000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
        <Activity className="h-3.5 w-3.5" /> Checking engine heartbeat...
      </div>
    );
  }

  if (!status) return null;

  const isOddsDegraded = status.odds_provider !== 'LIVE';
  const oddsLabel = status.odds_provider === 'INVALID_KEY' 
    ? 'Odds Feed: Degraded (Invalid Key)' 
    : status.odds_provider === 'DEGRADED' 
    ? 'Odds Feed: Degraded' 
    : status.odds_provider === 'NO_DATA'
    ? 'Odds Feed: No Data'
    : 'Odds Feed: Live';

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
          isOddsDegraded ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
        }`}>
          {isOddsDegraded ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
          {oddsLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/80 bg-card/60 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Activity className="h-4 w-4 text-primary" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Autonomous Engine Heartbeat
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Fixtures: {status.fixtures_last_ingestion ? new Date(status.fixtures_last_ingestion).toLocaleString() : 'No recent sync'} · Predictions: {status.predictions_last_run ? new Date(status.predictions_last_run).toLocaleString() : 'Stale/None'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
            isOddsDegraded 
              ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' 
              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
          }`}>
            {isOddsDegraded ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {oddsLabel}
          </span>
          <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-muted/60 text-muted-foreground border border-border/50">
            Settled: {status.settled_count}
          </span>
        </div>
      </div>
    </div>
  );
}
