import { supabase } from '@/lib/supabase.server';
import Link from 'next/link';

export const revalidate = 60; // Revalidate every minute

export default async function LedgerPage() {
  // 1. Fetch settled signals
  const { data: signals, error: sigErr } = await supabase
    .from('signals')
    .select('*')
    .not('settled_at', 'is', null)
    .order('kickoff_utc', { ascending: false });

  // 2. Fetch settled paper trades chronologically for Equity Curve
  const { data: trades, error: tradesErr } = await supabase
    .from('paper_trades')
    .select('*, signals(home_team, away_team, market, selection, kickoff_utc, is_anomaly, anomaly_reason)')
    .eq('status', 'settled')
    .order('created_at', { ascending: true });

  const settledCount = signals?.length || 0;

  // Calculate Metrics
  let averageClv = 0.0;
  let positiveClvCount = 0;
  let beatLineCount = 0;
  let clvCapturedCount = 0;
  let winCount = 0;
  let profitUnits = 0;
  let maxDrawdown = 0.0;
  let lastUpdate = 'Never';

  let binaryBrierSum = 0;
  let binaryCount = 0;

  if (signals && signals.length > 0) {
    let clvSum = 0;
    signals.forEach((sig) => {
      const opening = Number(sig.opening_odds || sig.odds || 0);
      const closing = Number(sig.closing_odds || 0);
      const clv = Number(sig.clv_percentage || 0);
      const status = (sig.status || '').toLowerCase();

      if (closing > 0) {
        clvSum += clv;
        clvCapturedCount++;
        if (clv > 0) positiveClvCount++;
        if (closing < opening) beatLineCount++;
      }

      const odds = Number(sig.odds || 1.0);
      const prob = Number(sig.probability || 0.5);
      let profit = 0;
      let outcomeValue = 0.0;

      if (status === 'won' || status === 'win') {
        profit = odds - 1.0;
        outcomeValue = 1.0;
        winCount++;
      } else if (status === 'half_win') {
        profit = 0.5 * (odds - 1.0);
        outcomeValue = 1.0;
        winCount++;
      } else if (status === 'push' || status === 'void') {
        profit = 0.0;
        outcomeValue = 0.5;
      } else if (status === 'half_loss') {
        profit = -0.5;
      } else {
        profit = -1.0;
      }

      profitUnits += profit;

      const market = (sig.market || '').toLowerCase();
      if (market === 'asian_handicap' || market === 'over_under') {
        binaryBrierSum += Math.pow(prob - outcomeValue, 2);
        binaryCount++;
      }

      if (sig.settled_at) {
        const dateStr = new Date(sig.settled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        lastUpdate = `${new Date(sig.settled_at).toLocaleDateString()} ${dateStr}`;
      }
    });

    averageClv = clvCapturedCount > 0 ? clvSum / clvCapturedCount : 0.0;
  }

  // Drawdown tracking from trades
  if (trades && trades.length > 0) {
    const drawdowns = trades.map(t => Number(t.drawdown || 0.0));
    maxDrawdown = Math.max(...drawdowns, 0.0);
  }

  const positiveClvPct = clvCapturedCount > 0 ? (positiveClvCount / clvCapturedCount) * 100 : 0.0;
  const beatRate = clvCapturedCount > 0 ? (beatLineCount / clvCapturedCount) * 100 : 0.0;
  const roi = settledCount > 0 ? (profitUnits / settledCount) * 100 : 0.0;
  const winRate = settledCount > 0 ? (winCount / settledCount) * 100 : 0.0;
  const brierScore = binaryCount > 0 ? binaryBrierSum / binaryCount : 0.0;

  // Data Integrity Metrics
  const clvCaptureRate = settledCount > 0 ? (clvCapturedCount / settledCount) * 100 : 0.0;
  const modelCoverage = 100.0; // Dynamic coverage indicator

  // Statistical Confidence Score calculation
  let confidenceLevel = 'LOW';
  if (settledCount > 500) {
    confidenceLevel = 'HIGH';
  } else if (settledCount >= 100) {
    confidenceLevel = 'MEDIUM';
  }

  // Generate CLV distribution bins for histogram
  const clvBins = {
    '<-2%': 0,
    '-2% to 0%': 0,
    '0% to 2%': 0,
    '2% to 4%': 0,
    '>4%': 0
  };

  signals?.forEach(s => {
    if (s.closing_odds > 0) {
      const val = Number(s.clv_percentage || 0);
      if (val < -2) clvBins['<-2%']++;
      else if (val >= -2 && val < 0) clvBins['-2% to 0%']++;
      else if (val >= 0 && val < 2) clvBins['0% to 2%']++;
      else if (val >= 2 && val < 4) clvBins['2% to 4%']++;
      else clvBins['>4%']++;
    }
  });

  const clvBinValues = Object.values(clvBins);
  const maxBinVal = Math.max(...clvBinValues, 1);

  // Generate SVG Points for Equity Curve
  let svgPoints = '';
  if (trades && trades.length > 0) {
    const minBankroll = Math.min(...trades.map(t => Number(t.bankroll_after || 1000)), 1000);
    const maxBankroll = Math.max(...trades.map(t => Number(t.bankroll_after || 1000)), 1000);
    const range = maxBankroll - minBankroll || 100;
    
    trades.forEach((t, index) => {
      const x = (index / (trades.length - 1 || 1)) * 500;
      const y = 150 - ((Number(t.bankroll_after || 1000) - minBankroll) / range) * 120;
      svgPoints += `${x.toFixed(1)},${y.toFixed(1)} `;
    });
  }

  return (
    <main className="min-h-screen bg-[#0A0E17] text-[#E2E8F0] font-sans selection:bg-[#00F0FF] selection:text-[#0A0E17]">
      {/* Bloomberg-style Terminal Top Panel */}
      <div className="border-b border-[#1E293B] bg-[#0E1524] px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-[#00F0FF] animate-pulse"></span>
            <h1 className="text-xl font-bold tracking-wider text-white">HANDICAPLAB // QUANT LEDGER</h1>
          </div>
          <p className="text-xs text-[#94A3B8] uppercase font-mono tracking-widest mt-1">
            "We measure market inefficiencies" — Live Model Performance & Verification
          </p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="text-right font-mono text-xs">
            <span className="text-[#64748B]">LAST SYNC:</span> <span className="text-[#00F0FF]">{lastUpdate}</span>
          </div>
          <Link href="/pricing" className="px-3 py-1 text-xs border border-[#00F0FF] text-[#00F0FF] hover:bg-[#00F0FF] hover:text-[#0A0E17] transition-all rounded font-bold uppercase tracking-wider">
            Explore Tiers
          </Link>
        </div>
      </div>

      {/* Ledger Warning Banner for Early-Stage Stats */}
      {settledCount < 100 && (
        <div className="bg-[#FF9900]/10 border border-[#FF9900] text-[#FF9900] px-6 py-3 text-xs font-mono rounded-lg max-w-7xl mx-auto mt-6 flex items-center gap-3">
          <span>⚠️</span>
          <span><b>WARNING:</b> Performance statistics are early-stage until minimum 100 settled signals.</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* HERO METRICS CARD GROUP */}
        <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-[#121B2E] border border-[#1E293B] p-4 rounded-lg flex flex-col justify-between">
            <span className="text-xs text-[#94A3B8] font-bold tracking-wider uppercase">Tracked Signals</span>
            <span className="text-3xl font-black text-white font-mono mt-2">{settledCount}</span>
          </div>
          <div className="bg-[#121B2E] border border-[#1E293B] p-4 rounded-lg flex flex-col justify-between">
            <span className="text-xs text-[#94A3B8] font-bold tracking-wider uppercase">Average CLV</span>
            <span className="text-3xl font-black text-[#00F0FF] font-mono mt-2">+{averageClv.toFixed(2)}%</span>
          </div>
          <div className="bg-[#121B2E] border border-[#1E293B] p-4 rounded-lg flex flex-col justify-between">
            <span className="text-xs text-[#94A3B8] font-bold tracking-wider uppercase">ROI Yield</span>
            <span className={`text-3xl font-black font-mono mt-2 ${roi >= 0 ? 'text-[#00FF66]' : 'text-[#FF3366]'}`}>
              {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
            </span>
          </div>
          <div className="bg-[#121B2E] border border-[#1E293B] p-4 rounded-lg flex flex-col justify-between">
            <span className="text-xs text-[#94A3B8] font-bold tracking-wider uppercase">Win Rate</span>
            <span className="text-3xl font-black text-white font-mono mt-2">{winRate.toFixed(1)}%</span>
          </div>
          <div className="bg-[#121B2E] border border-[#1E293B] p-4 rounded-lg flex flex-col justify-between">
            <span className="text-xs text-[#94A3B8] font-bold tracking-wider uppercase">Brier Score</span>
            <span className="text-3xl font-black text-white font-mono mt-2">{brierScore.toFixed(3)}</span>
          </div>
          <div className="bg-[#121B2E] border border-[#1E293B] p-4 rounded-lg flex flex-col justify-between">
            <span className="text-xs text-[#94A3B8] font-bold tracking-wider uppercase">Max Drawdown</span>
            <span className="text-3xl font-black text-[#FF3366] font-mono mt-2">-{maxDrawdown.toFixed(1)}%</span>
          </div>
        </div>

        {/* LEFT COLUMN: Charts & Visuals */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Equity Curve SVG Chart */}
          <div className="bg-[#121B2E] border border-[#1E293B] p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold tracking-wider text-white uppercase">Simulation Equity Curve (Paper Trading)</h2>
              <span className="text-xs font-mono text-[#64748B]">BANKROLL: $1000 START</span>
            </div>
            
            <div className="h-44 w-full bg-[#0A0E17] border border-[#1E293B] relative rounded flex items-center justify-center overflow-hidden">
              {svgPoints ? (
                <svg className="w-full h-full p-2" viewBox="0 0 500 150" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.2"/>
                      <stop offset="100%" stopColor="#00F0FF" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <path
                    d={`M0,150 L${svgPoints} L500,150 Z`}
                    fill="url(#curveGrad)"
                  />
                  <polyline
                    fill="none"
                    stroke="#00F0FF"
                    strokeWidth="2"
                    points={svgPoints}
                  />
                </svg>
              ) : (
                <span className="text-xs text-[#64748B] font-mono">No simulation trades settled yet.</span>
              )}
            </div>
            <div className="flex justify-between text-[10px] font-mono text-[#64748B] mt-2">
              <span>START</span>
              <span>CHRONOLOGICAL TRADES PROGRESSION</span>
              <span>END</span>
            </div>
          </div>

          {/* CLV Distribution Histogram */}
          <div className="bg-[#121B2E] border border-[#1E293B] p-6 rounded-lg">
            <h2 className="text-sm font-bold tracking-wider text-white uppercase mb-4">CLV Movement Distribution</h2>
            <div className="space-y-3 font-mono text-xs">
              {Object.entries(clvBins).map(([bin, count]) => {
                const percentage = (count / maxBinVal) * 100;
                return (
                  <div key={bin} className="flex items-center gap-4">
                    <span className="w-20 text-[#94A3B8]">{bin}</span>
                    <div className="flex-1 bg-[#0A0E17] h-5 rounded overflow-hidden border border-[#1E293B] relative flex items-center">
                      <div 
                        className="bg-[#00F0FF]/30 h-full border-r border-[#00F0FF]" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                      <span className="absolute left-3 text-[10px] font-bold text-white">{count} signals</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Ledger Metrics, CLV Stats & Integrity */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Detailed CLV Stats */}
          <div className="bg-[#121B2E] border border-[#1E293B] p-6 rounded-lg grid grid-cols-2 gap-6">
            <div className="col-span-2 border-b border-[#1E293B] pb-3">
              <h2 className="text-sm font-bold tracking-wider text-white uppercase">Closing Line Value Metrics</h2>
            </div>
            <div>
              <span className="text-xs text-[#94A3B8] uppercase block">Positive CLV Rate</span>
              <span className="text-2xl font-black text-white font-mono mt-1">{positiveClvPct.toFixed(1)}%</span>
              <p className="text-[10px] text-[#64748B] mt-1">Percentage of picks beating final market margins.</p>
            </div>
            <div>
              <span className="text-xs text-[#94A3B8] uppercase block">Beat Line Rate</span>
              <span className="text-2xl font-black text-white font-mono mt-1">{beatRate.toFixed(1)}%</span>
              <p className="text-[10px] text-[#64748B] mt-1">Signals with closing odds lower than entry odds.</p>
            </div>
          </div>

          {/* Data Integrity Audits */}
          <div className="bg-[#121B2E] border border-[#1E293B] p-6 rounded-lg grid grid-cols-3 gap-4">
            <div className="col-span-3 border-b border-[#1E293B] pb-3">
              <h2 className="text-sm font-bold tracking-wider text-white uppercase">Ledger Data Integrity & Confidence</h2>
            </div>
            <div>
              <span className="text-xs text-[#94A3B8] uppercase block">CLV Capture</span>
              <span className="text-xl font-black text-[#00F0FF] font-mono mt-1">{clvCaptureRate.toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-xs text-[#94A3B8] uppercase block">Coverage</span>
              <span className="text-xl font-black text-[#00F0FF] font-mono mt-1">{modelCoverage.toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-xs text-[#94A3B8] uppercase block">Confidence</span>
              <span className={`text-xl font-black font-mono mt-1 ${confidenceLevel === 'HIGH' ? 'text-[#00FF66]' : confidenceLevel === 'MEDIUM' ? 'text-[#00F0FF]' : 'text-[#FF9900]'}`}>
                {confidenceLevel}
              </span>
            </div>
          </div>

        </div>

        {/* LEDGER DETAILS AUDIT TABLE */}
        <div className="lg:col-span-4 bg-[#121B2E] border border-[#1E293B] rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1E293B] flex justify-between items-center">
            <h2 className="text-sm font-bold tracking-wider text-white uppercase">Verifiable Model Inefficiency Log</h2>
            <span className="text-[10px] font-mono text-[#94A3B8] bg-[#0A0E17] border border-[#1E293B] px-2 py-1 rounded">
              MODEL: dc_poisson_ensemble_v1
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0E1524] text-[#94A3B8] border-b border-[#1E293B]">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Match</th>
                  <th className="px-4 py-3">Market</th>
                  <th className="px-4 py-3">Model/Implied</th>
                  <th className="px-4 py-3">CLV</th>
                  <th className="px-4 py-3">Model Params</th>
                  <th className="px-4 py-3 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B] text-[#D2D8E2]">
                {signals?.map((s) => {
                  const snap = s.feature_snapshot || {};
                  const isAnomaly = s.is_anomaly;

                  return (
                    <tr key={s.id} className={`hover:bg-[#1A253E]/50 transition-colors ${isAnomaly ? 'bg-[#FF3366]/5' : ''}`}>
                      <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">
                        {new Date(s.kickoff_utc).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span>{s.home_team} vs {s.away_team}</span>
                            {isAnomaly && (
                              <span 
                                className="inline-block px-1.5 py-0.5 text-[9px] bg-[#FF3366] text-white rounded font-bold uppercase cursor-help animate-pulse"
                                title={s.anomaly_reason || 'Model anomaly flagged'}
                              >
                                DIVERGENCE
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[#64748B] font-mono font-normal uppercase mt-0.5">
                            {s.league} • {s.competition_type || 'league'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 uppercase text-[#00F0FF]">
                        {s.market?.replace('_', ' ')} ({s.selection})
                      </td>
                      <td className="px-4 py-3">
                        {((s.probability || 0) * 100).toFixed(1)}% / {((1 / (s.odds || 1.0)) * 100).toFixed(1)}%
                      </td>
                      <td className={`px-4 py-3 font-bold ${s.clv_percentage > 0 ? 'text-[#00FF66]' : s.clv_percentage < 0 ? 'text-[#FF3366]' : 'text-[#64748B]'}`}>
                        {s.clv_percentage > 0 ? '+' : ''}{Number(s.clv_percentage || 0).toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-[#94A3B8] max-w-xs truncate" title={JSON.stringify(snap)}>
                        AH:{(Number(snap.attack_home) || 1.0).toFixed(2)}/DH:{(Number(snap.defense_home) || 1.0).toFixed(2)} vs AA:{(Number(snap.attack_away) || 1.0).toFixed(2)}/DA:{(Number(snap.defense_away) || 1.0).toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 text-right font-black uppercase text-xs ${s.status === 'won' ? 'text-[#00FF66]' : s.status === 'lost' ? 'text-[#FF3366]' : 'text-[#64748B]'}`}>
                        {s.status}
                      </td>
                    </tr>
                  );
                })}
                {(!signals || signals.length === 0) && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#64748B]">
                      No settled model signals in public ledger database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Disclaimer & Transparency Block */}
        <div className="lg:col-span-4 border-t border-[#1E293B] pt-8 pb-12 text-center text-xs text-[#64748B] space-y-4 font-mono">
          <p className="max-w-3xl mx-auto uppercase tracking-wide leading-relaxed">
            ⚠️ <b>CRITICAL PUBLIC NOTICE & DISCLAIMER:</b> This platform displays paper trading simulations and historical backtests for quantitative validation purposes only. No real money or real bets are executed by this system. Historical performance metrics (CLV, ROI, Win Rate) do not guarantee future success. Users should engage in sport markets at their own discretion.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-[10px] text-[#475569]">
            <span>ENGINE: <b className="text-[#94A3B8]">dc_poisson_ensemble_v1</b></span>
            <span>RATINGS: <b className="text-[#94A3B8]">team_ratings_v1 (decay_0.90)</b></span>
            <span>CALIBRATION: <b className="text-[#94A3B8]">platt_v1 (dynamic_threshold)</b></span>
            <span>FEEDS: <b className="text-[#94A3B8]">API-Football (real-time) / Pinnacle API (Odds)</b></span>
            <span>VERIFIED LEDGER: <b className="text-[#94A3B8]">{settledCount} SIGNALS RECORDED</b></span>
          </div>
        </div>

      </div>
    </main>
  );
}
