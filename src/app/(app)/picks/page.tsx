import { TrackRecordCard } from '@/components/TrackRecordCard';
import { HistoricalValidation } from '@/components/HistoricalValidation';
import { fetchTodayPicks } from '@/lib/queries/picks';
import { fetchTrackRecord } from '@/lib/queries/performance';

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  } catch {
    return '';
  }
}

function confidenceColor(c: string) {
  const low = c.toLowerCase();
  if (low === 'high') return 'text-emerald-400';
  if (low === 'medium') return 'text-amber-400';
  return 'text-slate-400';
}

export default async function PicksPage() {
  const [picks, trackRecord] = await Promise.all([
    fetchTodayPicks(),
    fetchTrackRecord(),
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <TrackRecordCard data={trackRecord} />

      <div>
        <h2 className="text-lg font-bold text-white font-mono uppercase tracking-widest mb-6">
          Today&apos;s Best Picks
        </h2>

        {picks.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <div className="text-3xl mb-3">📋</div>
            <p className="text-slate-400 text-sm font-mono">No picks available for today.</p>
            <p className="text-slate-600 text-xs font-mono mt-2">
              Predictions appear here once the prediction engine generates them.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {picks.map((p) => (
              <div
                key={p.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest">
                        {p.competition}
                      </span>
                      <span className="text-[10px] text-slate-600">&bull;</span>
                      <span className="text-[10px] font-mono text-slate-500">{formatTime(p.kickoff)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-white">{p.homeTeam}</span>
                      <span className="text-xs text-slate-500 font-mono">vs</span>
                      <span className="text-lg font-bold text-white">{p.awayTeam}</span>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider ${confidenceColor(p.confidence)} bg-slate-800 border border-slate-700`}
                  >
                    {p.confidence === 'low' || !p.confidence ? 'Low' : p.confidence}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-800/30 rounded-xl mb-3">
                  <div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase mb-1">Market</div>
                    <div className="text-sm font-bold text-white font-mono">{p.market.toUpperCase().replace('_', ' ')}</div>
                    <div className="text-xs text-emerald-400 font-semibold">{p.pick}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase mb-1">Probability</div>
                    <div className="text-lg font-bold text-white font-mono">{(p.probability * 100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase mb-1">Odds</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">Pinnacle: </span>
                        <span className="text-white font-mono font-bold">{p.pinnacleOdds.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">SBOBET: </span>
                        <span className="text-white font-mono font-bold">{p.sbobetOdds.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Fair: </span>
                        <span className="text-emerald-400 font-mono font-bold">{p.fairOdds.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">EV: </span>
                        <span className="text-emerald-400 font-mono font-bold">
                          {(p.expectedValue * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase mb-1">Recommended</div>
                    <div className="text-sm font-bold text-emerald-400">{p.pick}</div>
                  </div>
                </div>

                <HistoricalValidation
                  sampleSize={p.historicalSampleSize}
                  winRate={p.historicalWinRate}
                  avgOdds={p.historicalAvgOdds}
                  historicalRoi={p.historicalRoi}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}