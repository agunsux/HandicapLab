const results = [
  { date: '2026-07-27', league: 'EPL', fixture: 'Liverpool vs Chelsea', market: 'Moneyline', odds: 2.10, result: 'Won', profit: '+1.10', roi: '+52.4%', clv: '+2.1%', verified: true },
  { date: '2026-07-27', league: 'La Liga', fixture: 'Atletico vs Valencia', market: 'AH -0.75', odds: 1.95, result: 'Half Win', profit: '+0.48', roi: '+22.9%', clv: '+1.8%', verified: true },
  { date: '2026-07-26', league: 'Bundesliga', fixture: 'Dortmund vs Leipzig', market: 'O/U 2.5', odds: 1.85, result: 'Loss', profit: '-1.00', roi: '-54.1%', clv: '-0.5%', verified: true },
  { date: '2026-07-26', league: 'Serie A', fixture: 'Juventus vs Napoli', market: 'BTTS', odds: 2.00, result: 'Won', profit: '+1.00', roi: '+50.0%', clv: '+3.2%', verified: true },
  { date: '2026-07-25', league: 'EPL', fixture: 'Man Utd vs Spurs', market: 'Moneyline', odds: 1.90, result: 'Won', profit: '+0.90', roi: '+47.4%', clv: '+1.5%', verified: true },
  { date: '2026-07-25', league: 'Ligue 1', fixture: 'PSG vs Lyon', market: 'AH -1.5', odds: 2.05, result: 'Loss', profit: '-1.00', roi: '-48.8%', clv: '-1.2%', verified: true },
  { date: '2026-07-24', league: 'EPL', fixture: 'Arsenal vs Brighton', market: 'O/U 2.5', odds: 1.80, result: 'Won', profit: '+0.80', roi: '+44.4%', clv: '+2.4%', verified: true },
  { date: '2026-07-24', league: 'La Liga', fixture: 'Barcelona vs Sevilla', market: 'Moneyline', odds: 1.72, result: 'Won', profit: '+0.72', roi: '+41.9%', clv: '+1.9%', verified: true },
];

function resultColor(r: string) {
  if (r === 'Won') return 'text-emerald-400';
  if (r === 'Loss') return 'text-red-400';
  return 'text-amber-400';
}

export default function ResultsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white font-mono uppercase tracking-widest">Results</h1>
          <p className="text-xs text-slate-500 font-mono mt-1">Settled predictions with verified outcomes</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-300">
            <option>All Leagues</option>
            <option>EPL</option>
            <option>La Liga</option>
            <option>Bundesliga</option>
            <option>Serie A</option>
          </select>
          <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-300">
            <option>All Markets</option>
            <option>Moneyline</option>
            <option>Asian Handicap</option>
            <option>Over/Under</option>
            <option>BTTS</option>
          </select>
        </div>
      </div>

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
            {results.map((r, i) => (
              <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
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
                  <span className="text-emerald-400 text-xs">✓</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}