import React from 'react';
import { MatchMarketData, MarketOdds, OddsQuote } from '@/lib/data/market';

interface MarketPanelProps {
  marketData: MatchMarketData | null;
}

export function MarketPanel({ marketData }: MarketPanelProps) {
  // If no market data is available at all
  const hasData = marketData && (marketData.moneyline || marketData.asianHandicap || marketData.overUnder);
  
  if (!hasData) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-lg">
        <div className="text-3xl mb-2">📈</div>
        <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
          Market Data
        </h4>
        <p className="text-xs text-slate-500 font-mono mt-2 bg-slate-950/40 py-2.5 rounded-lg border border-slate-850 max-w-sm mx-auto">
          No market data available.
        </p>
      </div>
    );
  }

  // Render individual quote row
  const renderQuote = (quote: OddsQuote | null, type: 'ML' | 'AH' | 'OU', label: string) => {
    if (!quote || (quote.homeOdds === 0 && quote.awayOdds === 0)) {
      return (
        <div className="flex justify-between items-center py-2 text-xs font-mono border-b border-slate-800/40 last:border-0">
          <span className="text-slate-500">{label}</span>
          <span className="text-slate-600 italic">Not available</span>
        </div>
      );
    }

    return (
      <div className="flex justify-between items-center py-2 text-xs font-mono border-b border-slate-800/40 last:border-0">
        <span className="text-slate-500">{label}</span>
        <div className="flex gap-2 text-slate-200">
          {type === 'ML' ? (
            <>
              <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850 text-slate-350">
                H: <strong className="text-white">{quote.homeOdds.toFixed(2)}</strong>
              </span>
              {quote.drawOdds !== undefined && quote.drawOdds > 0 && (
                <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850 text-slate-350">
                  D: <strong className="text-slate-400">{quote.drawOdds.toFixed(2)}</strong>
                </span>
              )}
              <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850 text-slate-350">
                A: <strong className="text-white">{quote.awayOdds.toFixed(2)}</strong>
              </span>
            </>
          ) : (
            <>
              <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850 text-slate-350">
                H: <strong className="text-white">{quote.homeOdds.toFixed(2)}</strong>
              </span>
              <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850 text-slate-350">
                A: <strong className="text-white">{quote.awayOdds.toFixed(2)}</strong>
              </span>
            </>
          )}
        </div>
      </div>
    );
  };

  // Render a specific market card block
  const renderMarketCard = (odds: MarketOdds | null, title: string, badgeText: string, badgeColor: string) => {
    if (!odds) {
      return (
        <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-5 opacity-60">
          <div className="flex justify-between items-center pb-2 border-b border-slate-850 mb-3">
            <h4 className="text-xs font-mono font-black text-slate-500 uppercase tracking-widest">{title}</h4>
            <span className="text-[9px] font-mono text-slate-600 bg-slate-950 px-1.5 py-0.5 rounded">Offline</span>
          </div>
          <p className="text-xs text-slate-500 font-mono italic">Market not active</p>
        </div>
      );
    }

    const hasOdds = odds.opening || odds.current || odds.closing;
    if (!hasOdds) {
      return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex justify-between items-center pb-2 border-b border-slate-850 mb-3">
            <h4 className="text-xs font-mono font-black text-slate-400 uppercase tracking-widest">{title}</h4>
            <span className={`text-[9px] font-mono ${badgeColor} px-1.5 py-0.5 rounded`}>{badgeText}</span>
          </div>
          <p className="text-xs text-slate-500 font-mono italic">No odds details for this market</p>
        </div>
      );
    }

    return (
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 space-y-3 hover:border-slate-700/60 transition-all shadow-md">
        <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-mono font-black text-slate-200 uppercase tracking-widest">{title}</h4>
            {odds.line !== null && (
              <span className="text-[10px] font-mono font-extrabold text-white bg-slate-950 border border-slate-850 px-1 rounded">
                {odds.line > 0 ? `+${odds.line}` : odds.line}
              </span>
            )}
          </div>
          <span className={`text-[9px] font-mono ${badgeColor} px-1.5 py-0.5 rounded`}>
            {badgeText} ({odds.bookmaker})
          </span>
        </div>
        <div className="flex flex-col">
          {renderQuote(odds.opening, odds.marketType, 'Opening Odds')}
          {renderQuote(odds.current, odds.marketType, 'Current Odds')}
          {renderQuote(odds.closing, odds.marketType, 'Closing Odds')}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex flex-col gap-1 border-l-2 border-indigo-500 pl-4">
        <h3 className="text-sm font-black text-white uppercase tracking-wider font-sans">
          Live Market Odds & Pricing Snapshot
        </h3>
        <p className="text-slate-500 text-[11px] font-mono">
          Compare market pricing across Opening, Current, and Closing lines from leading quantitative bookmakers.
        </p>
      </div>

      {/* Grid of market bookmaker panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {renderMarketCard(marketData.moneyline, 'Moneyline (1X2)', 'ML', 'text-emerald-400 bg-emerald-500/10')}
        {renderMarketCard(marketData.asianHandicap, 'Asian Handicap', 'AH', 'text-indigo-400 bg-indigo-500/10')}
        {renderMarketCard(marketData.overUnder, 'Over / Under', 'OU', 'text-amber-400 bg-amber-500/10')}
      </div>
    </div>
  );
}
