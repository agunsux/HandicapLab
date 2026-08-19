// Offline backtest runner — executes the full walk-forward backtest against
// the Gold Layer and persists results. NOT called on page render.
//
// Usage: npm run homepage:backtest

import { BacktestRepository } from '@/lib/homepage/backtest/repository';

async function main() {
  console.log('[Homepage Backtest] Starting walk-forward backtest...');
  const start = Date.now();

  const result = await BacktestRepository.computeAndPersist();

  console.log(`[Homepage Backtest] Status: ${result.status}`);
  console.log(`[Homepage Backtest] Duration: ${((Date.now() - start) / 1000).toFixed(1)}s`);
  console.log(`[Homepage Backtest] Matches tested: ${result.matchesTested}`);
  console.log(`[Homepage Backtest] Bets: ${result.totalBets}`);
  console.log(`[Homepage Backtest] ROI: ${result.roiPct !== null ? result.roiPct.toFixed(2) + '%' : 'N/A'}`);
  console.log(`[Homepage Backtest] Win rate: ${result.winRate !== null ? result.winRate.toFixed(2) + '%' : 'N/A'}`);
  console.log(`[Homepage Backtest] CLV: ${result.avgClvPct !== null ? result.avgClvPct.toFixed(2) + '%' : 'N/A'}`);
  console.log(`[Homepage Backtest] Brier: ${result.brierScore ?? 'N/A'}`);
  console.log(`[Homepage Backtest] Log Loss: ${result.logLoss ?? 'N/A'}`);
  console.log(`[Homepage Backtest] Max Drawdown: ${result.maxDrawdown ?? 'N/A'}`);
  console.log(`[Homepage Backtest] Markets:`);
  for (const m of result.markets) {
    console.log(`  ${m.market}: ${m.totalBets} bets, ROI ${m.roiPct !== null ? m.roiPct.toFixed(2) + '%' : 'N/A'}, WR ${m.winRate !== null ? m.winRate.toFixed(2) + '%' : 'N/A'}`);
  }

  if (result.status === 'BLOCKED') {
    console.error(`[Homepage Backtest] BLOCKED: ${result.blockedReason}`);
    process.exit(1);
  }

  console.log('[Homepage Backtest] Done.');
}

main().catch((err) => {
  console.error('[Homepage Backtest] Fatal error:', err);
  process.exit(1);
});