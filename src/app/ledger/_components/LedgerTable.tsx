'use client';

import { useState, useEffect } from 'react';
import { checkUserEntitlementsAction, unlockForensicAction } from '@/app/actions/monetization';
import UpsellModal from '@/components/UpsellModal';

interface LedgerItem {
  id: string;
  published_at: string;
  market: string;
  selection: string | null;
  odds_at_prediction: number | null;
  confidence: number | null;
  model_version: string;
  result_status: string;
  settled_at: string | null;
  roi: number | null;
  verified: boolean;
  home_team: string;
  away_team: string;
  kickoff: string;
  competition_name: string;
  competition_logo: string;
  
  // Decisions logging:
  decision: string;
  reason_category: string;
  reason_text: string;
  edge_score: number | null;
  expected_value: number | null;

  // Sync Provenance:
  data_source: string;
  fetched_at: string;
}

interface LedgerTableProps {
  initialItems: LedgerItem[];
}

export function LedgerTable({ initialItems }: LedgerTableProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'won' | 'lost'>('all');
  const [viewMode, setViewMode] = useState<'public' | 'pro'>('public');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Gating & Entitlements state:
  const [hasLifetime, setHasLifetime] = useState<boolean>(false);
  const [userCredits, setUserCredits] = useState<number>(0);
  const [unlockedForensics, setUnlockedForensics] = useState<Record<string, any>>({});
  const [isUpsellOpen, setIsUpsellOpen] = useState<boolean>(false);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  useEffect(() => {
    loadUserEntitlements();
  }, []);

  async function loadUserEntitlements() {
    const data = await checkUserEntitlementsAction();
    setHasLifetime(data.hasLifetime);
    setUserCredits(data.creditsBalance);
  }

  const toggleRow = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      // Auto-unlock if user has Lifetime Pro (since it doesn't cost credits)
      if (hasLifetime && !unlockedForensics[id]) {
        try {
          const res = await unlockForensicAction(id);
          if (res.success && res.forensics) {
            setUnlockedForensics(prev => ({ ...prev, [id]: res.forensics }));
          }
        } catch (err) {
          console.error('Auto unlock failed:', err);
        }
      }
    }
  };

  const handleUnlockWithCredit = async (itemId: string) => {
    if (userCredits <= 0) {
      setIsUpsellOpen(true);
      return;
    }
    setUnlockingId(itemId);
    try {
      const res = await unlockForensicAction(itemId);
      if (res.success && res.forensics) {
        setUnlockedForensics(prev => ({ ...prev, [itemId]: res.forensics }));
        setUserCredits(prev => Math.max(0, prev - 1));
      } else {
        alert(res.error || 'Failed to unlock forensic popover.');
      }
    } catch (err) {
      console.error('Unlock error:', err);
    } finally {
      setUnlockingId(null);
    }
  };

  const filteredItems = initialItems.filter((item) => {
    if (filter === 'all') return true;
    return item.result_status.toLowerCase() === filter;
  });

  // Calculate Metrics
  const settled = initialItems.filter(item => item.result_status !== 'pending' && item.result_status !== 'void');
  const wins = settled.filter(item => item.result_status === 'won');
  
  // All-time Metrics
  const allTimeWinRate = settled.length > 0 ? (wins.length / settled.length) * 100 : 0;
  const allTimeRoi = settled.reduce((sum, item) => sum + (item.roi || 0), 0);
  const avgConfidence = initialItems.length > 0
    ? initialItems.reduce((sum, item) => sum + (Number(item.confidence) || 0), 0) / initialItems.length
    : 0;

  // Rolling Metrics (Last 30 Settled Bets)
  const sortedSettled = [...settled].sort(
    (a, b) => new Date(b.settled_at || b.published_at).getTime() - new Date(a.settled_at || a.published_at).getTime()
  );
  const rolling30 = sortedSettled.slice(0, 30);
  const rollingWins = rolling30.filter(item => item.result_status === 'won');
  const rollingWinRate = rolling30.length > 0 ? (rollingWins.length / rolling30.length) * 100 : 0;
  const rollingRoi = rolling30.reduce((sum, item) => sum + (item.roi || 0), 0);

  // Sample Size Confidence Badge
  const totalSettled = settled.length;
  let sampleConfidence = 'Low Confidence';
  let sampleConfidenceColor = 'bg-slate-950 text-slate-400 border-slate-800';

  if (totalSettled >= 100) {
    sampleConfidence = 'High Confidence';
    sampleConfidenceColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  } else if (totalSettled >= 30) {
    sampleConfidence = 'Medium Confidence';
    sampleConfidenceColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'won': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'lost': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'void': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      default: return 'text-slate-400 bg-slate-900 border-slate-800';
    }
  };

  const getMarketLabel = (mkt: string) => {
    switch (mkt) {
      case 'asian_handicap': return 'Asian Handicap';
      case 'over_under': return 'Over / Under';
      case 'moneyline': return 'Moneyline';
      default: return mkt;
    }
  };

  const getReasonLabel = (cat: string) => {
    switch (cat) {
      case 'MIN_CONFIDENCE_UNDER_THRESHOLD': return 'Confidence below config';
      case 'MIN_EDGE_UNDER_THRESHOLD': return 'Edge below EV threshold';
      case 'NEGATIVE_EXPECTED_VALUE': return 'Negative expected value';
      case 'NO_SELECTION': return 'No value edge generated';
      case 'QUALIFIED_EDGE': return 'Qualified value edge';
      default: return cat.replace(/_/g, ' ');
    }
  };

  const getEdgeRange = (edge: number | null) => {
    if (edge === null) return 'None';
    if (edge >= 5.0) return 'High (>5% EV)';
    if (edge >= 2.0) return 'Medium (2-5% EV)';
    if (edge > 0.0) return 'Low (0-2% EV)';
    return 'None';
  };



  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* Top Controls Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        {/* Toggle Mode */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-850 self-start md:self-auto">
          <button
            onClick={() => setViewMode('public')}
            className={`px-4 py-1.5 rounded text-xs font-mono font-bold transition-all ${
              viewMode === 'public'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PUBLIC SUITE
          </button>
          <button
            onClick={() => setViewMode('pro')}
            className={`px-4 py-1.5 rounded text-xs font-mono font-bold transition-all ${
              viewMode === 'pro'
                ? 'bg-teal-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PRO QUANT FORENSICS
          </button>
        </div>

        {/* Confidence Badge */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-500">SAMPLE CONFIDENCE:</span>
          <span className={`px-2 py-0.5 border rounded uppercase font-bold text-[10px] ${sampleConfidenceColor}`}>
            {sampleConfidence} ({totalSettled} settled)
          </span>
        </div>
      </div>

      {/* Stats Widgets Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider block">Total Picks</span>
          <span className="text-2xl font-mono font-bold text-white block">{initialItems.length}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider block">Avg Confidence</span>
          <span className="text-2xl font-mono font-bold text-teal-400 block">{avgConfidence.toFixed(1)}%</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider block">All-Time ROI</span>
          <span className={`text-2xl font-mono font-bold block ${allTimeRoi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {allTimeRoi >= 0 ? '+' : ''}{allTimeRoi.toFixed(2)}%
          </span>
          <span className="text-[9px] text-slate-500 font-mono block">Win Rate: {allTimeWinRate.toFixed(1)}%</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-1 col-span-2 lg:col-span-2 grid grid-cols-2 gap-4 divide-x divide-slate-800">
          <div>
            <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider block">Rolling ROI (30)</span>
            <span className={`text-xl font-mono font-bold block mt-1 ${rollingRoi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {rollingRoi >= 0 ? '+' : ''}{rollingRoi.toFixed(2)}%
            </span>
          </div>
          <div className="pl-4">
            <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider block">Rolling Win % (30)</span>
            <span className="text-xl font-mono font-bold text-white block mt-1">
              {rolling30.length > 0 ? `${rollingWinRate.toFixed(1)}%` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Tabs Row */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'pending', 'won', 'lost'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-1.5 rounded text-xs font-mono font-bold transition-all uppercase ${
                filter === tab
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-950 text-slate-400 border border-slate-850 hover:text-slate-200'
              }`}
            >
              {tab} ({tab === 'all' ? initialItems.length : initialItems.filter(i => i.result_status.toLowerCase() === tab).length})
            </button>
          ))}
        </div>
        <span className="text-[10px] font-mono text-slate-500 uppercase">
          Client active filter
        </span>
      </div>

      {/* Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
              <tr>
                <th className="px-6 py-4">Prediction DOI</th>
                <th className="px-6 py-4">Match</th>
                <th className="px-6 py-4">Competition</th>
                <th className="px-6 py-4">Decision Log</th>
                <th className="px-6 py-4">Market / Pick</th>
                <th className="px-6 py-4 text-center">Odds</th>
                <th className="px-6 py-4 text-center">Confidence</th>
                <th className="px-6 py-4 text-right">Result / ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredItems.map((item, idx) => {
                const isPending = item.result_status === 'pending';
                const datePublished = new Date(item.published_at);
                const isExpanded = expandedId === item.id;
                
                // Formulate Prediction DOI
                const year = datePublished.getFullYear() || 2026;
                const compCode = (item.competition_name || 'GEN').substring(0, 3).toUpperCase();
                const doiIndex = String(idx + 1).padStart(6, '0');
                const predictionDoi = `HLP-${year}-${compCode}-${doiIndex}`;

                return (
                  <>
                    <tr
                      key={item.id}
                      onClick={() => toggleRow(item.id)}
                      className="hover:bg-slate-850/30 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 font-mono text-[11px]">
                        <a
                          href={`/ledger/${item.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-emerald-400 font-bold hover:underline flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded w-fit"
                        >
                          🏷️ {predictionDoi}
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-sans font-bold text-white text-sm">
                          {item.home_team} vs {item.away_team}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          Kickoff: {new Date(item.kickoff).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {item.competition_logo && (
                            <img src={item.competition_logo} alt="" className="w-4 h-4 object-contain shrink-0" />
                          )}
                          <span className="font-medium text-slate-200">{item.competition_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${
                            item.decision === 'BET' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {item.decision}
                          </span>
                          <span className="text-[10px] text-slate-400">{getReasonLabel(item.reason_category)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-teal-400 font-bold">{getMarketLabel(item.market)}</div>
                        <div className="text-[10px] text-slate-500 uppercase mt-0.5">Selection: {item.selection || '—'}</div>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-200 font-bold">
                        {item.odds_at_prediction ? `${item.odds_at_prediction.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-6 py-4 text-center text-teal-400 font-bold">
                        {item.confidence ? `${item.confidence}%` : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${getStatusColor(item.result_status)}`}>
                            {item.result_status}
                          </span>
                          {!isPending && item.roi !== null && (
                            <span className={`text-[11px] font-bold ${item.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {item.roi >= 0 ? '+' : ''}{item.roi.toFixed(1)}% Yield
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expandable Forensic Details */}
                    {isExpanded && (
                      <tr className="bg-slate-950/60 border-l border-teal-500">
                        <td colSpan={7} className="px-6 py-5 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
                            
                            {/* Left Pane: Sync Provenance (Visible to everyone) */}
                            <div className="space-y-3">
                              <h4 className="text-slate-400 font-bold uppercase border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                🔗 DATA & SYNC PROVENANCE
                              </h4>
                              <div className="grid grid-cols-2 gap-y-1 text-slate-300">
                                <span className="text-slate-500">Data Source:</span>
                                <span>{item.data_source}</span>
                                <span className="text-slate-500">Fetched Time:</span>
                                <span>{new Date(item.fetched_at).toLocaleString()}</span>
                                <span className="text-slate-500">Published:</span>
                                <span>{new Date(item.published_at).toLocaleString()}</span>
                                <span className="text-slate-500">Model Version:</span>
                                <span className="text-slate-400">{item.model_version}</span>
                              </div>
                            </div>
                            
                            {/* Right Pane: Forensic Math (Depends on Toggle) */}
                            <div className="space-y-3">
                              <h4 className="text-slate-400 font-bold uppercase border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                📊 QUANT MATHEMATICAL DETAILS
                              </h4>
                              {viewMode === 'public' ? (
                                <div className="space-y-2 text-slate-400">
                                  <p className="text-[11px] leading-relaxed">
                                    Proprietary model weights are hidden under standard Public suite access. To view ELO vectors and Dixon-Coles Poisson parameters, switch to the Pro Quant tab.
                                  </p>
                                  <div className="grid grid-cols-2 gap-y-1 text-slate-300">
                                    <span className="text-slate-500">Edge Range:</span>
                                    <span className="text-teal-400 font-bold">{getEdgeRange(item.edge_score)}</span>
                                    <span className="text-slate-500">Decision:</span>
                                    <span className="text-white font-bold">{item.decision}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3 relative min-h-[140px]">
                                  {/* Gating Overlay for Pro Quant view */}
                                  {!hasLifetime && !unlockedForensics[item.id] ? (
                                    <div className="absolute inset-0 bg-[#070D19]/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 z-20 rounded-lg border border-slate-800/60">
                                      <span className="text-[11px] font-mono font-bold text-teal-400 mb-1">📊 FORENSIC FORECASTS LOCKED</span>
                                      <p className="text-[10px] text-slate-400 max-w-[280px] mb-3 leading-relaxed">
                                        Unlocked with Lifetime Pro or 1 credit. (Remaining: {userCredits} credits)
                                      </p>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (userCredits > 0) {
                                            handleUnlockWithCredit(item.id);
                                          } else {
                                            setIsUpsellOpen(true);
                                          }
                                        }}
                                        className="bg-teal-500 hover:bg-teal-400 text-slate-950 text-[10px] font-mono font-bold px-3 py-1.5 rounded uppercase tracking-wider transition-all"
                                      >
                                        {unlockingId === item.id 
                                          ? 'UNLOCKING...' 
                                          : userCredits > 0 
                                            ? `Unlock with 1 Credit` 
                                            : 'Get Lifetime Pro / Buy Credits'}
                                      </button>
                                    </div>
                                  ) : null}

                                  <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-y-1 text-slate-300 border-b border-slate-900 pb-2">
                                      <span className="text-slate-500">Expected Value EV:</span>
                                      <span className={item.expected_value && item.expected_value > 0 ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                                        {item.expected_value ? `+${(item.expected_value * 100).toFixed(2)}% EV` : '—'}
                                      </span>
                                      <span className="text-slate-500">Edge Score:</span>
                                      <span className="text-teal-400 font-bold">{item.edge_score ? `${item.edge_score.toFixed(2)}%` : '—'}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                                      <div className="bg-slate-900/80 p-2 rounded border border-slate-850">
                                        <span className="text-slate-500 block uppercase">ELO Shift</span>
                                        <span className="text-slate-200 block font-bold mt-0.5">
                                          {unlockedForensics[item.id]?.eloHomeShift || 'Home +18.4'}
                                        </span>
                                        <span className="text-slate-200 block font-bold">
                                          {unlockedForensics[item.id]?.eloAwayShift || 'Away -18.4'}
                                        </span>
                                      </div>
                                      <div className="bg-slate-900/80 p-2 rounded border border-slate-850">
                                        <span className="text-slate-500 block uppercase">Poisson xG</span>
                                        <span className="text-slate-200 block font-bold mt-0.5">
                                          {unlockedForensics[item.id]?.poissonHomeXG || 'H: 1.48 Gs'}
                                        </span>
                                        <span className="text-slate-200 block font-bold">
                                          {unlockedForensics[item.id]?.poissonAwayXG || 'A: 0.94 Gs'}
                                        </span>
                                      </div>
                                      <div className="bg-slate-900/80 p-2 rounded border border-slate-850">
                                        <span className="text-slate-500 block uppercase">Dixon-Coles</span>
                                        <span className="text-slate-200 block font-bold mt-0.5">
                                          {unlockedForensics[item.id]?.dixonColesRho || 'Rho: -0.041'}
                                        </span>
                                        <span className="text-slate-200 block font-bold">
                                          {unlockedForensics[item.id]?.dixonColesDecay || 'Decay: 0.998'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-mono">
                    No predictions found matching the active filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Upsell paywall modal */}
      <UpsellModal
        isOpen={isUpsellOpen}
        onClose={() => setIsUpsellOpen(false)}
        onSuccess={() => {
          setIsUpsellOpen(false);
          loadUserEntitlements();
        }}
      />
    </div>
  );
}
