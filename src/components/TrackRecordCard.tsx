export function TrackRecordCard() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
      <div className="flex items-center gap-2 mb-6">
        <h2 className="text-lg font-bold text-white font-mono uppercase tracking-widest">Verified Track Record</h2>
        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/20">
          Verified ✓
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
        <div>
          <div className="text-3xl font-bold text-white font-mono">10</div>
          <div className="text-[11px] font-mono text-slate-500 uppercase mt-1">Seasons</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-white font-mono">182,431</div>
          <div className="text-[11px] font-mono text-slate-500 uppercase mt-1">Verified Bets</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-emerald-400 font-mono">+12.4%</div>
          <div className="text-[11px] font-mono text-slate-500 uppercase mt-1">ROI</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-emerald-400 font-mono">+8.3%</div>
          <div className="text-[11px] font-mono text-slate-500 uppercase mt-1">Yield</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-emerald-400 font-mono">+2.7%</div>
          <div className="text-[11px] font-mono text-slate-500 uppercase mt-1">CLV</div>
        </div>
        <div>
          <div className="text-sm font-mono text-slate-400 mt-1">Last Updated</div>
          <div className="text-sm font-bold text-white font-mono">5 min ago</div>
        </div>
      </div>
    </div>
  );
}