// ============================================================================
// CANONICAL PERFORMANCE & ANALYTICS ENGINE
// ============================================================================
// Location: src/lib/ledger/canonicalPerformanceEngine.ts
//
// Invariants enforced:
// 1. Research ROI & Yield: Strictly total_profit / total_staked (losses never excluded).
// 2. Pending bets are strictly separated and NEVER included in realized performance.
// 3. Multi-dimensional breakdowns: market, line family, selection, league, bookmaker, time.
// 4. Diagnostic engines: Bankroll curve, Drawdown, Sharpe ratio, Brier calibration,
//    EV vs Realized P/L, CLV vs Profit 2x2 matrix, and Value bet analytics.
// ============================================================================

import {
  CanonicalPredictionRecord,
  CanonicalPerformanceReport,
  BankrollCurvePoint,
  DrawdownReport,
  CalibrationReport,
  CalibrationBucket,
  ClvProfitMatrix,
  ValueBetMetrics,
  DimensionMetricRow,
} from './predictionLedgerTypes';
import { CanonicalBetLedgerService } from './canonicalBetLedger';

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export class CanonicalPerformanceEngine {
  /**
   * Generates the comprehensive canonical performance report.
   */
  public static generateReport(
    predictions?: CanonicalPredictionRecord[],
    options?: {
      mode?: 'UNIT_STAKE_RESEARCH' | 'USER_BANKROLL_SIMULATION';
      startingBankroll?: number;
      stakeSize?: number;
    }
  ): CanonicalPerformanceReport {
    const all = predictions || CanonicalBetLedgerService.getAllPredictions();
    const mode = options?.mode || 'UNIT_STAKE_RESEARCH';
    const stakeUnit = options?.stakeSize || 1.0;
    const startBank = options?.startingBankroll || 100.0;

    let totalPredictions = all.length;
    let settledPredictions = 0;
    let pendingPredictions = 0;
    let wins = 0;
    let losses = 0;
    let pushes = 0;
    let halfWins = 0;
    let halfLosses = 0;
    let voids = 0;
    let cancelled = 0;

    let totalStaked = 0;
    let totalProfit = 0;

    const settledOdds: number[] = [];
    const settledModelProbs: number[] = [];
    const settledFairOdds: number[] = [];
    const settledEvs: number[] = [];
    const settledClvs: number[] = [];

    // Chronological sorting for bankroll curve
    const settledRecords = all
      .filter((p) => p.status === 'SETTLED' && p.settlement !== null)
      .sort((a, b) => {
        const tA = new Date(a.settlement!.settledAt || a.kickoffTimestamp).getTime();
        const tB = new Date(b.settlement!.settledAt || b.kickoffTimestamp).getTime();
        return tA - tB;
      });

    for (const p of all) {
      if (p.status === 'PENDING') {
        pendingPredictions++;
      } else if (p.status === 'VOID') {
        voids++;
      } else if (p.status === 'CANCELLED') {
        cancelled++;
      } else if (p.status === 'SETTLED' && p.settlement) {
        settledPredictions++;
        const s = p.settlement;
        const stake = s.stakeUnits || stakeUnit;
        totalStaked += stake;
        totalProfit += s.profitUnits;

        settledOdds.push(p.marketOdds);
        settledModelProbs.push(p.modelProbability);
        settledFairOdds.push(p.fairOdds);
        settledEvs.push(p.expectedValue);

        if (p.clvRecord && p.clvRecord.clvStatus === 'AVAILABLE' && p.clvRecord.clvPercentage !== null) {
          settledClvs.push(p.clvRecord.clvPercentage);
        }

        switch (s.outcome) {
          case 'WIN': wins++; break;
          case 'HALF_WIN': halfWins++; break;
          case 'PUSH': pushes++; break;
          case 'HALF_LOSS': halfLosses++; break;
          case 'LOSS': losses++; break;
          case 'VOID': voids++; break;
          case 'CANCELLED': cancelled++; break;
        }
      }
    }

    // Financial Metrics
    const totalReturn = Number((totalStaked + totalProfit).toFixed(4));
    const roiDecimal = totalStaked > 0 ? Number((totalProfit / totalStaked).toFixed(4)) : 0.0;
    const roiPct = Number((roiDecimal * 100).toFixed(2));
    const yieldDecimal = roiDecimal;
    const yieldPct = roiPct;

    // Rates (Decisions with definitive risk)
    const effectiveDecisions = wins + losses + pushes + halfWins + halfLosses;
    const winRatePct = effectiveDecisions > 0
      ? Number((((wins + 0.5 * halfWins) / effectiveDecisions) * 100).toFixed(2))
      : 0.0;
    const pushRatePct = effectiveDecisions > 0
      ? Number(((pushes / effectiveDecisions) * 100).toFixed(2))
      : 0.0;
    const lossRatePct = effectiveDecisions > 0
      ? Number((((losses + 0.5 * halfLosses) / effectiveDecisions) * 100).toFixed(2))
      : 0.0;

    // Odds & Probability Stats
    const averageOdds = settledOdds.length > 0 ? Number((settledOdds.reduce((a, b) => a + b, 0) / settledOdds.length).toFixed(3)) : 0;
    const medianOddsVal = Number(median(settledOdds).toFixed(3));
    const averageModelProbabilityPct = settledModelProbs.length > 0 ? Number(((settledModelProbs.reduce((a, b) => a + b, 0) / settledModelProbs.length) * 100).toFixed(2)) : 0;
    const averageFairOdds = settledFairOdds.length > 0 ? Number((settledFairOdds.reduce((a, b) => a + b, 0) / settledFairOdds.length).toFixed(3)) : 0;
    const averageMarketOdds = averageOdds;
    const averageEvPct = settledEvs.length > 0 ? Number(((settledEvs.reduce((a, b) => a + b, 0) / settledEvs.length) * 100).toFixed(2)) : 0;
    const medianEvPct = Number((median(settledEvs) * 100).toFixed(2));

    // CLV Stats
    const averageClvPct = settledClvs.length > 0 ? Number(((settledClvs.reduce((a, b) => a + b, 0) / settledClvs.length) * 100).toFixed(2)) : 0;
    const medianClvPct = Number((median(settledClvs) * 100).toFixed(2));
    const positiveClvCount = settledClvs.filter((c) => c > 0).length;
    const positiveClvRatePct = settledClvs.length > 0 ? Number(((positiveClvCount / settledClvs.length) * 100).toFixed(2)) : 0;

    // Bankroll Curve & Drawdown
    const { curve, drawdown } = this.computeBankrollAndDrawdown(settledRecords, startBank);

    // Sharpe Ratio
    const sharpeRatio = this.computeSharpeRatio(settledRecords);

    // EV vs Realized P/L
    let expectedProfitUnits = 0;
    for (const r of settledRecords) {
      expectedProfitUnits += (r.expectedValue * (r.settlement?.stakeUnits || 1.0));
    }
    expectedProfitUnits = Number(expectedProfitUnits.toFixed(4));
    const realizedProfitUnits = Number(totalProfit.toFixed(4));
    const evErrorUnits = Number((realizedProfitUnits - expectedProfitUnits).toFixed(4));

    // Value Bet Analytics
    const valueBets = this.computeValueBetMetrics(all);

    // Confidence Tiers
    const confidenceTiers = {
      high: this.buildDimensionRow('high', 'High Confidence (>70)', all.filter((p) => p.confidence === 'HIGH')),
      medium: this.buildDimensionRow('medium', 'Medium Confidence (50-70)', all.filter((p) => p.confidence === 'MEDIUM')),
      low: this.buildDimensionRow('low', 'Low / Pass (<50)', all.filter((p) => p.confidence === 'LOW' || p.confidence === 'PASS')),
    };

    // Breakdowns
    const byMarket = this.buildMarketBreakdown(all);
    const byLineFamily = this.buildLineFamilyBreakdown(all);
    const bySelection = this.buildSelectionBreakdown(all);
    const byLeague = this.buildLeagueBreakdown(all);
    const byBookmaker = this.buildBookmakerBreakdown(all);
    const byTime = this.buildTimeBreakdown(all);

    // Diagnostics
    const calibration = this.computeCalibrationReport(settledRecords);
    const clvProfitMatrix = this.computeClvProfitMatrix(settledRecords);

    return {
      generatedAtUtc: new Date().toISOString(),
      mode,
      stakeUnit,
      totalPredictions,
      settledPredictions,
      pendingPredictions,
      wins,
      losses,
      pushes,
      halfWins,
      halfLosses,
      voids,
      cancelled,
      totalStaked: Number(totalStaked.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(4)),
      totalReturn,
      roiDecimal,
      roiPct,
      yieldDecimal,
      yieldPct,
      winRatePct,
      pushRatePct,
      lossRatePct,
      averageOdds,
      medianOdds: medianOddsVal,
      averageModelProbabilityPct,
      averageFairOdds,
      averageMarketOdds,
      averageEvPct,
      medianEvPct,
      averageClvPct,
      medianClvPct,
      positiveClvRatePct,
      totalClvAvailable: settledClvs.length,
      startingBankroll: startBank,
      currentBankroll: drawdown.currentBankroll,
      drawdown,
      sharpeRatio,
      expectedProfitUnits,
      realizedProfitUnits,
      evErrorUnits,
      valueBets,
      confidenceTiers,
      byMarket,
      byLineFamily,
      bySelection,
      byLeague,
      byBookmaker,
      byTime,
      calibration,
      clvProfitMatrix,
    };
  }

  /**
   * Computes bankroll curve and drawdown parameters.
   */
  public static computeBankrollAndDrawdown(
    settled: CanonicalPredictionRecord[],
    startBank = 100.0
  ): { curve: BankrollCurvePoint[]; drawdown: DrawdownReport } {
    const curve: BankrollCurvePoint[] = [];
    let currentBank = startBank;
    let peakBank = startBank;
    let maxDrawdownUnits = 0;
    let maxDrawdownPct = 0;
    let peakDate: string | null = null;
    let maxDrawdownDate: string | null = null;

    settled.forEach((p, idx) => {
      const s = p.settlement!;
      const stake = s.stakeUnits || 1.0;
      const profit = s.profitUnits;
      const grossReturn = s.returnUnits;

      currentBank = Number((currentBank + profit).toFixed(4));
      if (currentBank > peakBank) {
        peakBank = currentBank;
        peakDate = s.settledAt.slice(0, 10);
      }

      const ddUnits = Number((peakBank - currentBank).toFixed(4));
      const ddPct = peakBank > 0 ? Number(((ddUnits / peakBank) * 100).toFixed(2)) : 0.0;

      if (ddUnits > maxDrawdownUnits) {
        maxDrawdownUnits = ddUnits;
        maxDrawdownPct = ddPct;
        maxDrawdownDate = s.settledAt.slice(0, 10);
      }

      curve.push({
        index: idx + 1,
        date: s.settledAt.slice(0, 10),
        predictionId: p.predictionId,
        fixture: p.fixture,
        market: p.market,
        selection: p.selection,
        line: p.line,
        odds: p.marketOdds,
        outcome: s.outcome,
        stake,
        profit,
        grossReturn,
        bankroll: currentBank,
        drawdownUnits: ddUnits,
        drawdownPct: ddPct,
      });
    });

    const currentDrawdownUnits = Number((peakBank - currentBank).toFixed(4));
    const currentDrawdownPct = peakBank > 0 ? Number(((currentDrawdownUnits / peakBank) * 100).toFixed(2)) : 0.0;

    const drawdown: DrawdownReport = {
      peakBankroll: Number(peakBank.toFixed(4)),
      currentBankroll: Number(currentBank.toFixed(4)),
      currentDrawdownUnits,
      currentDrawdownPct,
      maxDrawdownUnits: Number(maxDrawdownUnits.toFixed(4)),
      maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
      peakDate,
      maxDrawdownDate,
      isRecovered: currentDrawdownUnits <= 1e-6,
    };

    return { curve, drawdown };
  }

  /**
   * Computes Sharpe ratio on per-bet basis.
   */
  private static computeSharpeRatio(settled: CanonicalPredictionRecord[]): number {
    if (settled.length < 2) return 0.0;
    const returns = settled.map((p) => p.settlement!.profitUnits / (p.settlement!.stakeUnits || 1.0));
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    const std = Math.sqrt(variance);
    if (std <= 1e-6) return 0.0;
    return Number(((mean / std) * Math.sqrt(returns.length)).toFixed(2));
  }

  /**
   * Computes Value Bet performance.
   */
  private static computeValueBetMetrics(all: CanonicalPredictionRecord[]): ValueBetMetrics {
    const valueBets = all.filter((p) => p.valueStatus === 'VALUE' || p.expectedValue > 0);
    const settled = valueBets.filter((p) => p.status === 'SETTLED' && p.settlement !== null);
    const pending = valueBets.filter((p) => p.status === 'PENDING');

    let wins = 0;
    let losses = 0;
    let pushes = 0;
    let halfWins = 0;
    let halfLosses = 0;
    let totalStaked = 0;
    let totalProfit = 0;
    const evs: number[] = [];
    const clvs: number[] = [];

    for (const p of settled) {
      const s = p.settlement!;
      totalStaked += (s.stakeUnits || 1.0);
      totalProfit += s.profitUnits;
      evs.push(p.expectedValue);

      if (p.clvRecord?.clvStatus === 'AVAILABLE' && p.clvRecord.clvPercentage !== null) {
        clvs.push(p.clvRecord.clvPercentage);
      }

      switch (s.outcome) {
        case 'WIN': wins++; break;
        case 'HALF_WIN': halfWins++; break;
        case 'PUSH': pushes++; break;
        case 'HALF_LOSS': halfLosses++; break;
        case 'LOSS': losses++; break;
      }
    }

    const effective = wins + losses + pushes + halfWins + halfLosses;
    const hitRatePct = effective > 0
      ? Number((((wins + 0.5 * halfWins) / effective) * 100).toFixed(2))
      : 0.0;
    const roiPct = totalStaked > 0 ? Number(((totalProfit / totalStaked) * 100).toFixed(2)) : 0.0;
    const avgEvPct = evs.length > 0 ? Number(((evs.reduce((a, b) => a + b, 0) / evs.length) * 100).toFixed(2)) : 0.0;
    const avgClvPct = clvs.length > 0 ? Number(((clvs.reduce((a, b) => a + b, 0) / clvs.length) * 100).toFixed(2)) : 0.0;

    return {
      totalValueBets: valueBets.length,
      settledValueBets: settled.length,
      pendingValueBets: pending.length,
      wins,
      losses,
      pushes,
      halfWins,
      halfLosses,
      hitRatePct,
      totalStaked: Number(totalStaked.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(4)),
      roiPct,
      yieldPct: roiPct,
      averageEvPct: avgEvPct,
      averageClvPct: avgClvPct,
    };
  }

  /**
   * Computes Brier Score and probability calibration buckets.
   */
  private static computeCalibrationReport(settled: CanonicalPredictionRecord[]): CalibrationReport {
    const bucketDefs = [
      { label: '0.40 - 0.50', min: 0.40, max: 0.50 },
      { label: '0.50 - 0.60', min: 0.50, max: 0.60 },
      { label: '0.60 - 0.70', min: 0.60, max: 0.70 },
      { label: '0.70 - 0.80', min: 0.70, max: 0.80 },
      { label: '0.80 - 1.00', min: 0.80, max: 1.00 },
    ];

    let totalBrier = 0;
    let count = 0;

    const buckets: CalibrationBucket[] = bucketDefs.map((def) => {
      const inBucket = settled.filter(
        (p) => p.modelProbability >= def.min && p.modelProbability < def.max
      );

      let wins = 0;
      let sumProb = 0;
      let brierSum = 0;

      for (const p of inBucket) {
        const s = p.settlement!;
        let outcomeScore = 0.0;
        if (s.outcome === 'WIN') outcomeScore = 1.0;
        else if (s.outcome === 'HALF_WIN') outcomeScore = 0.75;
        else if (s.outcome === 'PUSH') outcomeScore = 0.5;
        else if (s.outcome === 'HALF_LOSS') outcomeScore = 0.25;
        else if (s.outcome === 'LOSS') outcomeScore = 0.0;

        wins += (s.outcome === 'WIN' ? 1 : s.outcome === 'HALF_WIN' ? 0.5 : 0);
        sumProb += p.modelProbability;
        const err = Math.pow(p.modelProbability - outcomeScore, 2);
        brierSum += err;
        totalBrier += err;
        count++;
      }

      const predictionsCount = inBucket.length;
      const empiricalWinRatePct = predictionsCount > 0 ? Number(((wins / predictionsCount) * 100).toFixed(2)) : 0;
      const expectedWinRatePct = predictionsCount > 0 ? Number(((sumProb / predictionsCount) * 100).toFixed(2)) : 0;
      const brierScoreContribution = predictionsCount > 0 ? Number((brierSum / predictionsCount).toFixed(4)) : 0;

      return {
        bucketRange: def.label,
        minProb: def.min,
        maxProb: def.max,
        predictionsCount,
        empiricalWins: wins,
        empiricalWinRatePct,
        expectedWinRatePct,
        brierScoreContribution,
      };
    });

    const overallBrierScore = count > 0 ? Number((totalBrier / count).toFixed(4)) : 0.0;
    return {
      totalSettledWithProb: count,
      overallBrierScore,
      buckets,
    };
  }

  /**
   * Diagnostic 2x2 Matrix: Positive/Negative CLV vs Profit/Loss.
   */
  private static computeClvProfitMatrix(settled: CanonicalPredictionRecord[]): ClvProfitMatrix {
    let posProfitCount = 0;
    let posProfitUnits = 0;
    let posLossCount = 0;
    let posLossUnits = 0;
    let negProfitCount = 0;
    let negProfitUnits = 0;
    let negLossCount = 0;
    let negLossUnits = 0;
    let neutralCount = 0;
    let totalWithClv = 0;

    for (const p of settled) {
      if (
        p.clvRecord &&
        p.clvRecord.clvStatus === 'AVAILABLE' &&
        p.clvRecord.clvPercentage !== null
      ) {
        totalWithClv++;
        const clv = p.clvRecord.clvPercentage;
        const profit = p.settlement!.profitUnits;

        if (clv > 0.0001) {
          if (profit > 0) {
            posProfitCount++;
            posProfitUnits += profit;
          } else if (profit < 0) {
            posLossCount++;
            posLossUnits += profit;
          } else {
            neutralCount++;
          }
        } else if (clv < -0.0001) {
          if (profit > 0) {
            negProfitCount++;
            negProfitUnits += profit;
          } else if (profit < 0) {
            negLossCount++;
            negLossUnits += profit;
          } else {
            neutralCount++;
          }
        } else {
          neutralCount++;
        }
      }
    }

    return {
      positiveClvProfitCount: posProfitCount,
      positiveClvProfitUnits: Number(posProfitUnits.toFixed(4)),
      positiveClvLossCount: posLossCount,
      positiveClvLossUnits: Number(posLossUnits.toFixed(4)),
      negativeClvProfitCount: negProfitCount,
      negativeClvProfitUnits: Number(negProfitUnits.toFixed(4)),
      negativeClvLossCount: negLossCount,
      negativeClvLossUnits: Number(negLossUnits.toFixed(4)),
      neutralClvCount: neutralCount,
      totalWithClv,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DIMENSION BREAKDOWN BUILDERS
  // ──────────────────────────────────────────────────────────────────────────

  private static buildDimensionRow(key: string, label: string, records: CanonicalPredictionRecord[]): DimensionMetricRow {
    let totalPredictions = records.length;
    let settledPredictions = 0;
    let pendingPredictions = 0;
    let wins = 0;
    let losses = 0;
    let pushes = 0;
    let halfWins = 0;
    let halfLosses = 0;
    let voids = 0;
    let totalStaked = 0;
    let totalProfit = 0;
    const odds: number[] = [];
    const evs: number[] = [];
    const clvs: number[] = [];

    for (const p of records) {
      if (p.status === 'PENDING') {
        pendingPredictions++;
      } else if (p.status === 'SETTLED' && p.settlement) {
        settledPredictions++;
        const s = p.settlement;
        totalStaked += (s.stakeUnits || 1.0);
        totalProfit += s.profitUnits;
        odds.push(p.marketOdds);
        evs.push(p.expectedValue);

        if (p.clvRecord?.clvStatus === 'AVAILABLE' && p.clvRecord.clvPercentage !== null) {
          clvs.push(p.clvRecord.clvPercentage);
        }

        switch (s.outcome) {
          case 'WIN': wins++; break;
          case 'HALF_WIN': halfWins++; break;
          case 'PUSH': pushes++; break;
          case 'HALF_LOSS': halfLosses++; break;
          case 'LOSS': losses++; break;
          case 'VOID': voids++; break;
        }
      }
    }

    const effective = wins + losses + pushes + halfWins + halfLosses;
    const winRatePct = effective > 0 ? Number((((wins + 0.5 * halfWins) / effective) * 100).toFixed(2)) : 0.0;
    const roiPct = totalStaked > 0 ? Number(((totalProfit / totalStaked) * 100).toFixed(2)) : 0.0;
    const avgOdds = odds.length > 0 ? Number((odds.reduce((a, b) => a + b, 0) / odds.length).toFixed(3)) : 0.0;
    const avgEvPct = evs.length > 0 ? Number(((evs.reduce((a, b) => a + b, 0) / evs.length) * 100).toFixed(2)) : 0.0;
    const avgClvPct = clvs.length > 0 ? Number(((clvs.reduce((a, b) => a + b, 0) / clvs.length) * 100).toFixed(2)) : 0.0;
    const posClv = clvs.filter((c) => c > 0).length;
    const positiveClvRatePct = clvs.length > 0 ? Number(((posClv / clvs.length) * 100).toFixed(2)) : 0.0;

    return {
      key,
      label,
      totalPredictions,
      settledPredictions,
      pendingPredictions,
      wins,
      losses,
      pushes,
      halfWins,
      halfLosses,
      voids,
      totalStaked: Number(totalStaked.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(4)),
      totalReturn: Number((totalStaked + totalProfit).toFixed(4)),
      roiPct,
      yieldPct: roiPct,
      winRatePct,
      avgOdds,
      avgEvPct,
      avgClvPct,
      positiveClvRatePct,
    };
  }

  private static buildMarketBreakdown(all: CanonicalPredictionRecord[]): Record<string, DimensionMetricRow> {
    const markets: Record<string, CanonicalPredictionRecord[]> = { AH: [], OU: [], BTTS: [] };
    for (const p of all) {
      if (!markets[p.market]) markets[p.market] = [];
      markets[p.market].push(p);
    }
    const res: Record<string, DimensionMetricRow> = {};
    for (const [mkt, list] of Object.entries(markets)) {
      res[mkt] = this.buildDimensionRow(mkt, `Market: ${mkt}`, list);
    }
    return res;
  }

  private static buildLineFamilyBreakdown(all: CanonicalPredictionRecord[]): Record<string, DimensionMetricRow> {
    const families: Record<string, CanonicalPredictionRecord[]> = {};
    for (const p of all) {
      const lineStr = p.line !== null ? Number(p.line).toFixed(2) : 'NONE';
      const key = `${p.market}_${lineStr}`;
      if (!families[key]) families[key] = [];
      families[key].push(p);
    }
    const res: Record<string, DimensionMetricRow> = {};
    for (const [fam, list] of Object.entries(families)) {
      res[fam] = this.buildDimensionRow(fam, fam, list);
    }
    return res;
  }

  private static buildSelectionBreakdown(all: CanonicalPredictionRecord[]): Record<string, DimensionMetricRow> {
    const selections: Record<string, CanonicalPredictionRecord[]> = {};
    for (const p of all) {
      const key = `${p.market}_${p.selection}`;
      if (!selections[key]) selections[key] = [];
      selections[key].push(p);
    }
    const res: Record<string, DimensionMetricRow> = {};
    for (const [sel, list] of Object.entries(selections)) {
      res[sel] = this.buildDimensionRow(sel, sel, list);
    }
    return res;
  }

  private static buildLeagueBreakdown(all: CanonicalPredictionRecord[]): Record<string, DimensionMetricRow> {
    const leagues: Record<string, CanonicalPredictionRecord[]> = {};
    for (const p of all) {
      const l = p.league || p.competition || 'Other';
      if (!leagues[l]) leagues[l] = [];
      leagues[l].push(p);
    }
    const res: Record<string, DimensionMetricRow> = {};
    for (const [l, list] of Object.entries(leagues)) {
      res[l] = this.buildDimensionRow(l, l, list);
    }
    return res;
  }

  private static buildBookmakerBreakdown(all: CanonicalPredictionRecord[]): Record<string, DimensionMetricRow> {
    const books: Record<string, CanonicalPredictionRecord[]> = {};
    for (const p of all) {
      const b = p.bookmaker || 'Pinnacle';
      if (!books[b]) books[b] = [];
      books[b].push(p);
    }
    const res: Record<string, DimensionMetricRow> = {};
    for (const [b, list] of Object.entries(books)) {
      res[b] = this.buildDimensionRow(b, b, list);
    }
    return res;
  }

  private static buildTimeBreakdown(all: CanonicalPredictionRecord[]): Record<string, DimensionMetricRow> {
    const days: Record<string, CanonicalPredictionRecord[]> = {};
    for (const p of all) {
      const dateStr = p.kickoffTimestamp.slice(0, 10);
      if (!days[dateStr]) days[dateStr] = [];
      days[dateStr].push(p);
    }
    const res: Record<string, DimensionMetricRow> = {};
    for (const [d, list] of Object.entries(days)) {
      res[d] = this.buildDimensionRow(d, d, list);
    }
    return res;
  }
}
