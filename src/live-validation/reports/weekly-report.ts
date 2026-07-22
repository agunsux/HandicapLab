// EPIC 35.10 — Weekly Scientific Report
// Automatically generates an exportable weekly evidence report:
// summary, confidence distribution, league/market comparison, best/worst
// cases, model stability and rule-based recommendations.
//
// Reports are appended to the immutable weekly_reports collection and
// rendered to markdown for export.

import * as crypto from 'crypto';
import type {
  BreakdownMetrics,
  PredictionSnapshotRecord,
  SettlementRecordLV,
  WeeklyReportRecord,
} from '../types';
import type { LiveValidationStore } from '../store/types';
import type { Clock } from '../scheduler/prediction-scheduler';
import { computeWindowMetrics, confidenceBucket } from '../metrics/rolling-metrics';

function meanConfidence(predictions: PredictionSnapshotRecord[]): number | null {
  if (predictions.length === 0) return null;
  return (
    predictions.reduce((a, p) => a + p.prediction.confidence, 0) / predictions.length
  );
}

function caseLabel(pred: PredictionSnapshotRecord | undefined, s: SettlementRecordLV): string {
  if (!pred) return s.fixtureId;
  return `${pred.fixture.homeTeam} vs ${pred.fixture.awayTeam} (${pred.fixture.league})`;
}

function renderBreakdownTable(title: string, breakdown: Record<string, BreakdownMetrics>): string {
  const rows = Object.entries(breakdown);
  if (rows.length === 0) return `### ${title}\n\n_No settled bets this week._\n`;
  const lines = [
    `### ${title}`,
    '',
    '| Segment | Bets | ROI | Hit Rate | Profit | Avg Odds | Avg CLV |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const [key, b] of rows.sort(([a], [z]) => a.localeCompare(z))) {
    lines.push(
      `| ${key} | ${b.bets} | ${(b.roi * 100).toFixed(2)}% | ${(b.hitRate * 100).toFixed(1)}% | ${b.profit.toFixed(2)}u | ${b.avgOdds.toFixed(2)} | ${b.avgClv !== null ? (b.avgClv * 100).toFixed(2) + '%' : 'n/a'} |`
    );
  }
  return lines.join('\n') + '\n';
}

export function renderReportMarkdown(report: Omit<WeeklyReportRecord, 'markdown'>): string {
  const s = report.summary;
  const lines: string[] = [
    `# Weekly Live Validation Report`,
    '',
    `**Week:** ${report.weekStart.slice(0, 10)} → ${report.weekEnd.slice(0, 10)}`,
    `**Generated:** ${report.createdAt}`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|---|---|`,
    `| Predictions | ${s.predictionCount} |`,
    `| Settled bets | ${s.settledCount} |`,
    `| ROI | ${(s.roi * 100).toFixed(2)}% |`,
    `| CLV | ${s.clv !== null ? (s.clv * 100).toFixed(2) + '%' : 'n/a'} |`,
    `| Calibration error (ECE) | ${s.calibrationError ?? 'n/a'} |`,
    `| Hit rate | ${(s.hitRate * 100).toFixed(1)}% |`,
    `| Total profit | ${s.totalProfit.toFixed(2)}u |`,
    '',
    '## Confidence Distribution',
    '',
    ...Object.entries(report.confidenceDistribution).map(
      ([bucket, count]) => `- ${bucket}: ${count}`
    ),
    '',
    renderBreakdownTable('League Comparison', report.leagueComparison),
    renderBreakdownTable('Market Comparison', report.marketComparison),
    '### Best Cases',
    '',
    ...(report.bestCases.length > 0
      ? report.bestCases.map(c => `- ${c.fixture} — ${c.market} — **+${c.profit.toFixed(2)}u**`)
      : ['_None._']),
    '',
    '### Worst Cases',
    '',
    ...(report.worstCases.length > 0
      ? report.worstCases.map(c => `- ${c.fixture} — ${c.market} — **${c.profit.toFixed(2)}u**`)
      : ['_None._']),
    '',
    '## Model Stability',
    '',
    `- Drift events: ${report.modelStability.driftEvents} (critical: ${report.modelStability.criticalDriftEvents})`,
    `- Confidence drift vs prior week: ${report.modelStability.confidenceDrift !== null ? report.modelStability.confidenceDrift.toFixed(4) : 'n/a'}`,
    '',
    '## Recommendations',
    '',
    ...report.recommendations.map(r => `- ${r}`),
    '',
  ];
  return lines.join('\n');
}

/** Rule-based, non-prescriptive observations — never changes the model. */
function buildRecommendations(report: Omit<WeeklyReportRecord, 'markdown' | 'recommendations'>): string[] {
  const recs: string[] = [];
  const s = report.summary;

  if (s.settledCount === 0) {
    recs.push('No settled bets this week — verify scheduler and settlement automation health.');
    return recs;
  }
  if (s.roi < 0) {
    recs.push(`Weekly ROI is negative (${(s.roi * 100).toFixed(2)}%) — monitor the 30/90-day windows before drawing conclusions.`);
  } else {
    recs.push(`Weekly ROI is positive (${(s.roi * 100).toFixed(2)}%) — continue autonomous validation.`);
  }
  if (s.clv !== null && s.clv < 0) {
    recs.push('CLV is negative — the market is closing tighter than our entry; review odds capture timing.');
  }
  if (s.calibrationError !== null && s.calibrationError > 0.06) {
    recs.push(`ECE ${s.calibrationError} exceeds 0.06 — inspect the calibration monitor buckets.`);
  }
  if (report.modelStability.criticalDriftEvents > 0) {
    recs.push('Critical drift detected — audit inputs before trusting this week\'s metrics.');
  }
  if (recs.length === 1) {
    recs.push('No anomalies detected — evidence collection proceeding normally.');
  }
  return recs;
}

export class WeeklyReportGenerator {
  constructor(
    private deps: {
      store: LiveValidationStore;
      schemaVersion: string;
      clock?: Clock;
      idFactory?: () => string;
    }
  ) {}

  /** Generate + append the report for the 7 days ending at `asOf` (now). */
  async run(correlationId = 'weekly-report'): Promise<WeeklyReportRecord> {
    const { store } = this.deps;
    const now = this.deps.clock ? this.deps.clock() : new Date();
    const weekEnd = now.toISOString();
    const weekStart = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const priorWeekStart = new Date(now.getTime() - 14 * 86_400_000).toISOString();

    const allPredictions = await store.listPredictions();
    const allSettlements = await store.listSettlements();

    const weekPredictions = allPredictions.filter(
      p => p.model.predictionTimestamp >= weekStart && p.model.predictionTimestamp <= weekEnd
    );
    const priorPredictions = allPredictions.filter(
      p => p.model.predictionTimestamp >= priorWeekStart && p.model.predictionTimestamp < weekStart
    );
    const weekSettlements = allSettlements.filter(
      s => s.settledAt >= weekStart && s.settledAt <= weekEnd
    );

    // Reuse the rolling engine's pure window computation for the week
    const metrics = computeWindowMetrics(allPredictions, allSettlements, 7, weekEnd, {
      schemaVersion: this.deps.schemaVersion,
      correlationId,
      idFactory: this.deps.idFactory,
    });

    const confidenceDistribution: Record<string, number> = {};
    for (const p of weekPredictions) {
      const bucket = confidenceBucket(p.prediction.confidence);
      confidenceDistribution[bucket] = (confidenceDistribution[bucket] ?? 0) + 1;
    }

    const predById = new Map(allPredictions.map(p => [p.id, p]));
    const ranked = [...weekSettlements].sort((a, b) => b.profit - a.profit);
    const toCase = (s: SettlementRecordLV) => ({
      predictionId: s.predictionId,
      fixture: caseLabel(predById.get(s.predictionId), s),
      profit: s.profit,
      market: s.market,
    });
    const bestCases = ranked.slice(0, 5).filter(s => s.profit > 0).map(toCase);
    const worstCases = ranked.slice(-5).filter(s => s.profit < 0).reverse().map(toCase);

    const driftEvents = await store.listDriftEvents({ from: weekStart, to: weekEnd });
    const currentConf = meanConfidence(weekPredictions);
    const priorConf = meanConfidence(priorPredictions);
    const confidenceDrift =
      currentConf !== null && priorConf !== null
        ? Number((currentConf - priorConf).toFixed(4))
        : null;

    const idFactory = this.deps.idFactory ?? (() => crypto.randomUUID());
    const base: Omit<WeeklyReportRecord, 'markdown' | 'recommendations'> = {
      id: idFactory(),
      weekStart,
      weekEnd,
      summary: {
        predictionCount: weekPredictions.length,
        settledCount: weekSettlements.length,
        roi: metrics.roi,
        clv: metrics.avgClv,
        calibrationError: metrics.calibrationError,
        hitRate: metrics.hitRate,
        totalProfit: metrics.totalProfit,
      },
      confidenceDistribution,
      leagueComparison: metrics.leagueBreakdown,
      marketComparison: metrics.marketBreakdown,
      bestCases,
      worstCases,
      modelStability: {
        driftEvents: driftEvents.length,
        criticalDriftEvents: driftEvents.filter(d => d.severity === 'critical').length,
        confidenceDrift,
      },
      createdAt: weekEnd,
      createdBy: 'weekly-report-generator',
      schemaVersion: this.deps.schemaVersion,
      correlationId,
    };

    const recommendations = buildRecommendations(base);
    const withRecs = { ...base, recommendations };
    const record: WeeklyReportRecord = {
      ...withRecs,
      markdown: renderReportMarkdown(withRecs),
    };

    await store.appendWeeklyReport(record);
    return record;
  }
}
