import type { TrackRecordData } from '@/lib/queries/performance';

export function TrackRecordCard({ data, showBacktestLabel = false }: { data: TrackRecordData; showBacktestLabel?: boolean }) {
  const isInsufficient = data.sampleSize < 30;
  const needsDirectional = data.sampleSize >= 30 && data.sampleSize < 100;

  const label = data.isBacktest || showBacktestLabel
    ? 'Backtest / Paper Trading Track Record'
    : 'Verified Track Record';

  const labelClass = data.isBacktest
    ? 'text-amber-400 border-amber-500/20 bg-amber-500/10'
    : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
      <div className="flex items-center gap-2 mb-6">
        <h2 className="text-lg font-bold text-white font-mono uppercase tracking-widest">{label}</h2>
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${labelClass}`}>
          {data.isBacktest ? 'Backtest ✓' : isInsufficient ? 'Building...' : 'Verified ✓'}
        </span>
      </div>

      {data.sampleSize === 0 ? (
        <div className="text-center py-8">
          <div className="text-3xl mb-3">📊</div>
          <p className="text-slate-400 text-sm font-mono">Insufficient sample &mdash; building track record</p>
          <p className="text-slate-600 text-xs font-mono mt-2">
            Track record metrics will appear here once settled predictions are available.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          <div>
            <div className="text-3xl font-bold text-white font-mono">{data.seasonsAnalysed}</div>
            <div className="text-[11px] font-mono text-slate-500 uppercase mt-1">Seasons</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white font-mono">{data.verifiedBets.toLocaleString()}</div>
            <div className="text-[11px] font-mono text-slate-500 uppercase mt-1">Verified Bets</div>
          </div>
          <div>
            <div className={`text-3xl font-bold font-mono ${data.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {data.roi >= 0 ? '+' : ''}{data.roi}%
            </div>
            <div className="text-[11px] font-mono text-slate-500 uppercase mt-1">ROI</div>
          </div>
          <div>
            <div className={`text-3xl font-bold font-mono ${data.yield >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {data.yield >= 0 ? '+' : ''}{data.yield}%
            </div>
            <div className="text-[11px] font-mono text-slate-500 uppercase mt-1">Yield</div>
          </div>
          <div>
            <div className={`text-3xl font-bold font-mono ${data.clv >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {data.clv >= 0 ? '+' : ''}{data.clv}%
            </div>
            <div className="text-[11px] font-mono text-slate-500 uppercase mt-1">CLV</div>
          </div>
          <div>
            <div className="text-sm font-mono text-slate-400 mt-1">Last Updated</div>
            <div className="text-sm font-bold text-white font-mono">
              {data.lastUpdated ? formatRelativeTime(data.lastUpdated) : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {needsDirectional && (
        <p className="text-[10px] text-slate-500 font-mono mt-4 text-center border-t border-slate-800 pt-3">
          Sample size below 100 &mdash; directional only.
        </p>
      )}
      {isInsufficient && data.sampleSize > 0 && (
        <p className="text-[10px] text-slate-500 font-mono mt-4 text-center border-t border-slate-800 pt-3">
          Sample size below 30 &mdash; illustrative only.
        </p>
      )}
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch {
    return 'N/A';
  }
}
