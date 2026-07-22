// EPIC 35 — File-Backed Live Validation Store
// Persists every collection as an append-only JSONL journal under
// data/live-validation/. Lines are only ever appended — never rewritten —
// so historical records physically cannot be modified through this store.

import fs from 'fs';
import path from 'path';
import { MemoryLiveValidationStore } from './memory-store';

const COLLECTIONS = [
  'prediction_snapshots',
  'odds_snapshots',
  'settlements',
  'rolling_metrics',
  'calibration_history',
  'drift_events',
  'alert_history',
  'weekly_reports',
] as const;

type CollectionName = (typeof COLLECTIONS)[number];

export class FileLiveValidationStore extends MemoryLiveValidationStore {
  private dir: string;

  constructor(projectRoot?: string) {
    super();
    const root = projectRoot || process.cwd();
    this.dir = path.join(root, 'data', 'live-validation');
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
    this.loadJournals();
  }

  private journalPath(collection: CollectionName): string {
    return path.join(this.dir, `${collection}.jsonl`);
  }

  /** Replay journals into memory on startup — deterministic reload. */
  private loadJournals(): void {
    const loaders: Record<CollectionName, (rec: never) => Promise<void>> = {
      prediction_snapshots: rec => super.appendPrediction(rec),
      odds_snapshots: rec => super.appendOddsSnapshot(rec),
      settlements: rec => super.appendSettlement(rec),
      rolling_metrics: rec => super.appendRollingMetrics(rec),
      calibration_history: rec => super.appendCalibrationRecord(rec),
      drift_events: rec => super.appendDriftEvent(rec),
      alert_history: rec => super.appendAlert(rec),
      weekly_reports: rec => super.appendWeeklyReport(rec),
    };

    this.replaying = true;
    try {
      for (const collection of COLLECTIONS) {
        const file = this.journalPath(collection);
        if (!fs.existsSync(file)) continue;
        const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const record = JSON.parse(line);
            // Fire-and-forget is safe: memory appends are synchronous inside
            void loaders[collection](record as never);
          } catch {
            // Skip malformed journal lines rather than corrupting the run
          }
        }
      }
    } finally {
      this.replaying = false;
    }
  }

  private replaying = false;

  protected override onAppend(collection: string, record: unknown): void {
    if (this.replaying) return;
    const file = this.journalPath(collection as CollectionName);
    fs.appendFileSync(file, JSON.stringify(record) + '\n', 'utf-8');
  }
}
