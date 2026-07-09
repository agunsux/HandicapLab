// Start Shadow Pipeline — CLI Worker for Live Data Acquisition
// Run: npx tsx src/scripts/start-shadow-pipeline.ts

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createShadowPrediction, settlePrediction, type PredictionRequest } from '../lib/data/prediction/engine';
import { MemoryOddsSnapshotStore } from '../lib/data/snapshots/engine';
import { createEvidenceEntry, MemoryEvidenceLedgerStore } from '../lib/data/evidence/ledger';
import { evaluateWindows, DEFAULT_EVALUATION_WINDOWS } from '../lib/data/evaluation/runner';
import type { Fixture, OddsSnapshot, MarketType } from '../lib/data/providers/types';

const C = {
  pollIntervalMs: 60_000,
  researchRunDir: path.join(process.cwd(), 'shadow_runs'),
  modelVersion: 'v0.5-ai',
  bootstrapResamples: 10000,
};

// Structured Logger
type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
function log(level: LogLevel, event: string, data?: Record<string, any>): void {
  const entry = { timestamp: new Date().toISOString(), level, event, ...data };
  if (level === 'ERROR') console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

// Graceful shutdown
let shutdownRequested = false;
function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    if (shutdownRequested) return;
    shutdownRequested = true;
    log('INFO', 'shutdown', { signal });
    const allEvidence = await evidenceStore.getAll();
    log('INFO', 'shutdown_summary', { totalEvidence: allEvidence.length, settledCount: allEvidence.filter(e => e.actualOutcome !== null).length, chainValid: (await evidenceStore.verifyChainIntegrity()).valid });
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

interface ShadowRunMetadata {
const oddsStore = new MemoryOddsSnapshotStore();
const evidenceStore = new MemoryEvidenceLedgerStore();

setupGracefulShutdown();
  runId: string;
  startedAt: string;
  modelVersion: string;
  pollIntervalMs: number;
  fixturesProcessed: number;
  predictionsGenerated: number;
  settlementsRecorded: number;
  evidenceChainValid: boolean;
}

async function ensureOutputDir(): Promise<string> {
  const runId = new Date().toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, 'Z');
  const dir = path.join(C.researchRunDir, runId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function saveOutput(dir: string, name: string, data: any): void {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2), 'utf8');
}

async function processFixture(fixture: Fixture, oddsSnapshot: OddsSnapshot, marketType: MarketType, line: number, retries = 3): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      log('INFO', 'processing_fixture', { fixture: fixture.fixtureId, home: fixture.homeTeam, away: fixture.awayTeam, market: marketType, attempt });
      const oddsRecord = { ...oddsSnapshot, id: `odds_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, chainHash: '', previousSnapshotId: null, providerName: oddsSnapshot.providerName || 'demo', rawResponseHash: oddsSnapshot.rawResponseHash || '' };
      await oddsStore.append(oddsRecord);
      const cronoEvidence = await evidenceStore.getAll();

      // Also store ODDS_CAPTURED evidence
      const oddsEvidence = createEvidenceEntry(
        { id: '', fixtureId: fixture.fixtureId, modelVersion: C.modelVersion, modelHash: '', marketType, selection: 'home' as any, line, predictionProb: 0, marketProb: 0, edge: 0, expectedValue: 0, confidence: 0, oddsSnapshotId: oddsRecord.id, inputDataHash: '', featureVersion: '', datasetVersion: '', timestamp: new Date() },
        null,
        cronoEvidence.length > 0 ? cronoEvidence[cronoEvidence.length - 1].id : null,
        'ODDS_CAPTURED'
      );
      await evidenceStore.append(oddsEvidence);

      const request: PredictionRequest = { fixture, oddsSnapshot: oddsRecord, marketType, line };
      const { prediction, settlement } = await createShadowPrediction(request, oddsStore);
      const allEvidence = await evidenceStore.getAll();
      const previousEntryId = allEvidence.length > 0 ? allEvidence[allEvidence.length - 1].id : null;
      const evidence = createEvidenceEntry(prediction, null, previousEntryId, 'PREDICTION_CREATED');
      await evidenceStore.append(evidence);
      log('INFO', 'prediction_created', { fixture: fixture.fixtureId, edge: prediction.edge.toFixed(4), confidence: prediction.confidence.toFixed(4), modelHash: prediction.modelHash.slice(0, 12) });
      return;
    } catch (err) {
      log('WARN', 'retry_fixture', { fixture: fixture.fixtureId, attempt, error: err instanceof Error ? err.message : 'unknown' });
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
}

async function generateReport(dir: string): Promise<void> {
  const allEvidence = await evidenceStore.getAll();
  const evaluations = evaluateWindows(allEvidence, DEFAULT_EVALUATION_WINDOWS);
  const chainValid = (await evidenceStore.verifyChainIntegrity()).valid;
  saveOutput(dir, 'shadow_evaluation.json', evaluations);

  const settledCount = allEvidence.filter(e => e.actualOutcome !== null).length;
  const unsettledCount = allEvidence.length - settledCount;

  let report = `# Shadow Pipeline Report\n\n**Generated:** ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n| Metric | Value |\n| - | - |\n`;
  report += `| Total Predictions | ${allEvidence.length} |\n| Settled | ${settledCount} |\n| Unsettled | ${unsettledCount} |\n| Chain Valid | ${chainValid ? '✅' : '❌'} |\n\n`;
  report += `## Evaluation Windows\n\n| Window | Bets | ROI | CLV | ECE | Sharpe | Bootstrap CI | Meets |\n| - | - | - | - | - | - | - | - |\n`;
  for (const ev of evaluations) {
    report += `| ${ev.window} | ${ev.settledPredictions} | ${(ev.metrics.roi * 100).toFixed(2)}% | ${(ev.metrics.avgCLV * 100).toFixed(2)}% | ${(ev.metrics.ece * 100).toFixed(2)}% | ${ev.risk.sharpeRatio.toFixed(2)} | [${(ev.bootstrap.roiCI[0] * 100).toFixed(1)}, ${(ev.bootstrap.roiCI[1] * 100).toFixed(1)}] | ${ev.meetsMinimum ? '✅' : '❌'} |\n`;
  }
  report += `\n## Shadow Production Readiness\n\n`;
  report += `| Gate | Required | Current | Status |\n| - | - | - | - |\n`;
  const best = evaluations.find(e => e.window === '180d') || evaluations.find(e => e.window === '90d') || evaluations[0];
  report += `| Min 500 settled | ≥ 500 | ${settledCount} | ${settledCount >= 500 ? '✅' : `⏳ ${500 - settledCount} remaining`} |\n`;
  if (best) {
    report += `| CLV positive | > 0 | ${(best.metrics.avgCLV * 100).toFixed(2)}% | ${best.metrics.avgCLV > 0 ? '✅' : '❌'} |\n`;
    report += `| Bootstrap CI > 0 | Lower > 0 | ${(best.bootstrap.roiLower * 100).toFixed(2)}% | ${best.bootstrap.roiLower > 0 ? '✅' : '❌'} |\n`;
    report += `| Calibration (ECE) | < 5% | ${(best.metrics.ece * 100).toFixed(2)}% | ${best.metrics.ece < 0.05 ? '✅' : '❌'} |\n`;
  }
  fs.writeFileSync(path.join(dir, 'shadow_report.md'), report, 'utf8');
  console.log(`[REPORT] Saved to ${path.join(dir, 'shadow_report.md')}`);
}
async function main() {
  console.log('=== Shadow Pipeline Worker ===');
  console.log(`Model: ${C.modelVersion}`);
  console.log(`Output: ${C.researchRunDir}\n`);

  const outputDir = await ensureOutputDir();
  const startTime = Date.now();
  const metadata: ShadowRunMetadata = {
    runId: path.basename(outputDir),
    startedAt: new Date().toISOString(),
    modelVersion: C.modelVersion,
    pollIntervalMs: C.pollIntervalMs,
    fixturesProcessed: 0,
    predictionsGenerated: 0,
    settlementsRecorded: 0,
    evidenceChainValid: true,
  };

  // Dev demo: process one simulated fixture
  {
    const fixture: Fixture = {
      fixtureId: 'fixture_dev_1', league: 'EPL', season: '2024-2025',
      tournamentStage: 'regular_season', homeTeam: 'Arsenal', awayTeam: 'Chelsea',
      kickoffTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(), updatedAt: new Date(),
    };
    const oddsSnapshot: OddsSnapshot = {
      id: 'odds_dev_1', fixtureId: fixture.fixtureId, bookmaker: 'pinnacle',
      marketType: 'moneyline', line: 0, priceHome: 2.10, priceAway: 3.80, priceDraw: 3.40,
      capturedAt: new Date(),
    };
    await processFixture(fixture, oddsSnapshot, 'moneyline', 0);
    metadata.fixturesProcessed++;
    metadata.predictionsGenerated++;
  }

  await generateReport(outputDir);
  metadata.evidenceChainValid = (await evidenceStore.verifyChainIntegrity()).valid;
  saveOutput(outputDir, 'metadata.json', {
    ...metadata, executionSeconds: (Date.now() - startTime) / 1000,
    predictionsGenerated: (await evidenceStore.getAll()).length,
  });

  const allEvidence = await evidenceStore.getAll();
  const settledCount = allEvidence.filter(e => e.actualOutcome !== null).length;
  console.log(`\n=== Summary ===`);
  console.log(`Predictions: ${allEvidence.length}`);
  console.log(`Settled: ${settledCount}`);
  console.log(`Chain valid: ${metadata.evidenceChainValid}`);
  console.log(`Report: ${path.join(outputDir, 'shadow_report.md')}\n`);
  console.log(`=== Shadow Production Readiness ===`);
  console.log(settledCount >= 500 ? `✅ Min 500 settled: ${settledCount}` : `⏳ Need ${500 - settledCount} more`);
}

main().catch(e => { console.error('[FATAL]', e); process.exit(1); });
