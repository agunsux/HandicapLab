import { TrackRecordCard } from '@/components/TrackRecordCard';
import { HistoricalValidation } from '@/components/HistoricalValidation';

const picks = [
  {
    id: '1',
    competition: 'English Premier League',
    kickoff: '2026-07-28T19:45:00Z',
    homeTeam: 'Manchester City',
    awayTeam: 'Arsenal',
    market: 'moneyline',
    pick: 'Manchester City',
    probability: 0.68,
    pinnacleOdds: 1.95,
    sbobetOdds: 1.92,
    fairOdds: 1.85,
    expectedValue: 0.054,
    confidence: 'high',
    historical: { sampleSize: 187, winRate: 64.2, avgOdds: 1.92, historicalRoi: 18.2 },
  },
  {
    id: '2',
    competition: 'Serie A',
    kickoff: '2026-07-28T18:30:00Z',
    homeTeam: 'Inter Milan',
    awayTeam: 'AC Milan',
    market: 'asian_handicap',
    pick: 'Inter Milan -0.5',
    probability: 0.62,
    pinnacleOdds: 2.05,
    sbobetOdds: 2.02,
    fairOdds: 1.95,
    expectedValue: 0.063,
    confidence: 'high',
    historical: { sampleSize: 245, winRate: 58.8, avgOdds: 2.03, historicalRoi: 20.4 },
  },
  {
    id: '3',
    competition: 'Bundesliga',
    kickoff: '2026-07-28T17:30:00Z',
    homeTeam: 'Bayern Munich',
    awayTeam: 'Borussia Dortmund',
    market: 'over_under',
    pick: 'Over 2.5 Goals',
    probability: 0.71,
    pinnacleOdds: 1.80,
    sbobetOdds: 1.78,
    fairOdds: 1.72,
    expectedValue: 0.047,
    confidence: 'medium',
    historical: { sampleSize: 312, winRate: 66.3, avgOdds: 1.79, historicalRoi: 15.7 },
  },
  {
    id: '4',
    competition: 'La Liga',
    kickoff: '2026-07-28T20:00:00Z',
    homeTeam: 'Barcelona',
    awayTeam: 'Real Madrid',
    market: 'btts',
    pick: 'Both Teams to Score - Yes',
    probability: 0.65,
    pinnacleOdds: 1.90,
    sbobetOdds: 1.88,
    fairOdds: 1.82,
    expectedValue: 0.044,
    confidence: 'medium',
    historical: { sampleSize: 168, winRate: 61.9, avgOdds: 1.89, historicalRoi: 12.8 },
  },
];

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
}

function confidenceColor(c: string) {
  if (c === 'high') return 'text-emerald-400';
  if (c === 'medium') return 'text-amber-400';
  return 'text-slate-400';
}

export default function PicksPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <TrackRecordCard />

      <div>
        <h2 className="text-lg font-bold text-white font-mono uppercase tracking-widest mb-6">
          Today&apos;s Best Picks
        </h2>
        <div className="grid gap-6">
          {picks.map((p) => (
            <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest">{p.competition}</span>
                    <span className="text-[10px] text-slate-600">•</span>
                    <span className="text-[10px] font-mono text-slate-500">{formatTime(p.kickoff)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-white">{p.homeTeam}</span>
                    <span className="text-xs text-slate-500 font-mono">vs</span>
                    <span className="text-lg font-bold text-white">{p.awayTeam}</span>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider ${confidenceColor(p.confidence)} bg-slate-800 border border-slate-700`}>
                  {p.confidence}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-800/30 rounded-xl mb-3">
                <div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase mb-1">Market</div>
                  <div className="text-sm font-bold text-white font-mono">{p.market.replace('_', ' ').toUpperCase()}</div>
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
                      <span className="text-emerald-400 font-mono font-bold">+{(p.expectedValue * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase mb-1">Recommended</div>
                  <div className="text-sm font-bold text-emerald-400">{p.pick}</div>
                </div>
              </div>

              <HistoricalValidation
                sampleSize={p.historical.sampleSize}
                winRate={p.historical.winRate}
                avgOdds={p.historical.avgOdds}
                historicalRoi={p.historical.historicalRoi}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}