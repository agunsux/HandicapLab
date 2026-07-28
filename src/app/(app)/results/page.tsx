import { fetchSettledResults } from '@/lib/queries/results';

function resultColor(r: string) {
  const low = r.toLowerCase();
  if (low === 'won') return 'text-emerald-400';
  if (low === 'loss') return 'text-red-400';
  if (low === 'half win' || low === 'half_loss') return 'text-amber-400';
  return 'text-slate-400';
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams?: Promise<{ league?: string; market?: string }>;
}) {
  const params = await (searchParams ?? Promise.resolve<{ league?: string; market?: string }>({}));
  const { league, market } = params;

  const results = await fetchSettledResults({ league, market });

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white font-mono uppercase tracking-widest">Results</h1>
          <p className="text-xs text-slate-500 font-mono mt-1">Settled predictions with verified outcomes</p>
        </div>
        <form className="flex items-center gap-3">
          <select
            name="league"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-300"
            defaultValue={league || ''}
            onChange={(e) => e.target.form?.submit()}
          >
            <option value="">All Leagues</option>
            <option value="English Premier League">EPL</option>
            <option value="La Liga">La Liga</option>
            <option value="Bundesliga">Bundesliga</option>
            <option value="Serie A">Serie A</option>
            <option value="Ligue 1">Ligue 1</option>
          </select>
          <select
            name="market"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-300"
            defaultValue={market || ''}
            onChange={(e) => e.target.form?.submit()}
          >
            <option value="">All Markets</option>
            <option value="moneyline">Moneyline</option>
            <option value="handicap">Asian Handicap</option>
            <option value="over_under">Over/Under</option>
            <option value="btts">BTTS</option>
          </select>
        </form>
      </div>

      {results.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-3">📋</div>
          <p className="text-slate-400 text-sm font-mono">No settled results found.</p>
          <p className="text-slate-600 text-xs font-mono mt-2">
            Results appear here once predictions are settled.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-3 px-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">Date</th>
                <th className="text-left py-3 px-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">League</th>
                <th className="text-left py-3 px-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">Fixture</th>
                <th className="text-left py-3 px-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">Market</th>
                <th className="text-right py-3 px-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">Odds</th>
                <th className="text-left py-3 px-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">Result</th>
                <th className="text-right py-3 px-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">Profit</th>
                <th className="text-right py-3 px-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">ROI</th>
                <th className="text-right py-3 px-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">CLV</th>
                <th className="text-center py-3 px-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                  <td className="py-3 px-2 text-xs font-mono text-slate-400">{r.date}</td>
                  <td className="py-3 px-2 text-xs font-mono text-white">{r.league}</td>
                  <td className="py-3 px-2 text-xs font-medium text-white">{r.fixture}</td>
                  <td className="py-3 px-2 text-xs font-mono text-slate-400">{r.market}</td>
                  <td className="py-3 px-2 text-xs font-mono text-white text-right">{r.odds.toFixed(2)}</td>
                  <td className={`py-3 px-2 text-xs font-bold font-mono ${resultColor(r.result)}`}>{r.result}</td>
                  <td className="py-3 px-2 text-xs font-mono text-right text-white">{r.profit}</td>
                  <td className="py-3 px-2 text-xs font-mono text-right text-white">{r.roi}</td>
                  <td className="py-3 px-2 text-xs font-mono text-right text-emerald-400">{r.clv}</td>
                  <td className="py-3 px-2 text-center">
                    <span className="text-emerald-400 text-xs">{r.verified ? '✓' : '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}