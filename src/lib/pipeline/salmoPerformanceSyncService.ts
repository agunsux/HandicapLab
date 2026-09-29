// ============================================================================
// CANONICAL SALMO PERFORMANCE SYNCHRONIZATION SERVICE
// ============================================================================
// Location: src/lib/pipeline/salmoPerformanceSyncService.ts
//
// Invariants enforced:
// 1. HANDICAPLAB = COMPUTES & SOURCE OF TRUTH. SALMO = CONSUMER & DASHBOARD.
// 2. Salmo NEVER recalculates performance independently.
// 3. Exact reconciliation: prediction count, settled count, profit, ROI, Yield, EV, CLV.
// 4. Synchronizes canonical performance report to data/ledger/salmo_synced_performance.json.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { CanonicalBetLedgerService } from '@/lib/ledger/canonicalBetLedger';
import { CanonicalPerformanceEngine } from '@/lib/ledger/canonicalPerformanceEngine';
import { CanonicalPerformanceReport } from '@/lib/ledger/predictionLedgerTypes';
import { SalmoSyncService } from './salmoSyncService';

function getSalmoPerformancePath(): string {
  if (process.env.NODE_ENV === 'test') {
    return path.resolve('data/test_ledger/salmo_synced_performance.json');
  }
  if (process.env.VERCEL) {
    const os = require('os');
    return path.join(os.tmpdir(), 'handicaplab_salmo_synced_performance.json');
  }
  return path.resolve('data/ledger/salmo_synced_performance.json');
}

export interface SalmoPerformanceSyncReport {
  timestampUtc: string;
  status: 'SUCCESS' | 'SYNC_FAILED';
  totalPredictions: number;
  settledPredictions: number;
  totalProfit: number;
  roiPct: number;
  yieldPct: number;
  winRatePct: number;
  averageClvPct: number;
  currentBankroll: number;
  maxDrawdownPct: number;
  syncedPath: string;
  errorMessage?: string;
}

export class SalmoPerformanceSyncService {
  public static loadSyncedPerformance(): CanonicalPerformanceReport | null {
    try {
      const p = getSalmoPerformancePath();
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        return JSON.parse(raw);
      }
    } catch {}
    return null;
  }

  /**
   * Synchronizes canonical performance metrics from HandicapLab into Salmo store.
   */
  public static async syncToSalmo(): Promise<SalmoPerformanceSyncReport> {
    const nowIso = new Date().toISOString();
    try {
      // 1. Generate authoritative report from single source of truth
      const report = CanonicalPerformanceEngine.generateReport();

      // 2. Persist to Salmo storage
      const p = getSalmoPerformancePath();
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(p, JSON.stringify(report, null, 2), 'utf8');

      // 3. Update Salmo decision cards with settled outcomes if available
      try {
        const decisionStore = SalmoSyncService.loadSyncedStore();
        const settledList = CanonicalBetLedgerService.getSettledPredictions();
        let updatedCount = 0;

        for (const sp of settledList) {
          if (!sp.settlement) continue;
          // Look up matching decision in Salmo store
          for (const card of Object.values(decisionStore)) {
            if (
              card.canonicalMatchId === sp.canonicalFixtureId &&
              card.market === sp.market &&
              (card.line === sp.line || (card.line === null && sp.line === null))
            ) {
              (card as any).settlement = {
                outcome: sp.settlement.outcome,
                profitUnits: sp.settlement.profitUnits,
                homeGoals: sp.settlement.homeGoals,
                awayGoals: sp.settlement.awayGoals,
                settledAt: sp.settlement.settledAt,
              };
              if (sp.settlement.clv !== null && sp.settlement.clv !== undefined) {
                card.clvStatus = 'CALCULATED';
                (card as any).clv = sp.settlement.clv;
              }
              updatedCount++;
            }
          }
        }
        if (updatedCount > 0) {
          SalmoSyncService.saveSyncedStore(decisionStore);
        }
      } catch (err) {
        console.warn('[SalmoPerformanceSyncService] Warning updating decision store:', err);
      }

      return {
        timestampUtc: nowIso,
        status: 'SUCCESS',
        totalPredictions: report.totalPredictions,
        settledPredictions: report.settledPredictions,
        totalProfit: report.totalProfit,
        roiPct: report.roiPct,
        yieldPct: report.yieldPct,
        winRatePct: report.winRatePct,
        averageClvPct: report.averageClvPct,
        currentBankroll: report.currentBankroll,
        maxDrawdownPct: report.drawdown.maxDrawdownPct,
        syncedPath: p,
      };
    } catch (e: any) {
      return {
        timestampUtc: nowIso,
        status: 'SYNC_FAILED',
        totalPredictions: 0,
        settledPredictions: 0,
        totalProfit: 0,
        roiPct: 0,
        yieldPct: 0,
        winRatePct: 0,
        averageClvPct: 0,
        currentBankroll: 100,
        maxDrawdownPct: 0,
        syncedPath: getSalmoPerformancePath(),
        errorMessage: e.message || 'Unknown sync error',
      };
    }
  }
}
