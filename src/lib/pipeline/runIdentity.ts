// ============================================================================
// DAILY RUN IDENTITY & EXECUTION LIFECYCLE TRACKER
// ============================================================================
// Location: src/lib/pipeline/runIdentity.ts
//
// Invariants enforced:
// 1. Every daily execution gets a unique run_id: daily-YYYY-MM-DDTHH:mmZ
// 2. Persists: run_id, started_at, finished_at, status, trigger, code_version, model_versions
// 3. Statuses: STARTED, PARTIAL, SUCCESS, FAILED, QUOTA_BLOCKED
// 4. Never creates duplicate runs for the same logical execution day/slot
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

export type PipelineRunStatus = 'STARTED' | 'PARTIAL' | 'SUCCESS' | 'FAILED' | 'QUOTA_BLOCKED';

export interface StageExecutionRecord {
  stage: string;
  name: string;
  startedAt: string;
  finishedAt?: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED';
  recordsCount?: number;
  providerCalls?: number;
  details?: Record<string, any>;
  error?: string;
}

export interface DailyRunRecord {
  runId: string;
  dateStr: string; // YYYY-MM-DD
  startedAt: string;
  finishedAt?: string;
  status: PipelineRunStatus;
  trigger: 'SCHEDULER_CRON' | 'MANUAL' | 'EVENT' | 'RETRY';
  codeVersion: string;
  modelVersions: {
    ah: string;
    btts: string;
    ou: string;
  };
  stages: Record<string, StageExecutionRecord>;
  summary?: {
    fixturesScanned: number;
    predictionsGenerated: number;
    qualifiedPicks: number;
    highConfidencePicks: number;
    settledCount: number;
    salmoSyncStatus: 'SYNCED' | 'NO_PICKS' | 'FAILED' | 'SKIPPED';
    quotaUsed: {
      apiFootball: number;
      oddsPapi: number;
    };
  };
  error?: string;
}

function getRunsFilePath(): string {
  if (process.env.NODE_ENV === 'test') {
    return path.resolve('data/test_ledger/daily_runs.json');
  }
  if (process.env.VERCEL) {
    const os = require('os');
    return path.join(os.tmpdir(), 'handicaplab_daily_runs.json');
  }
  return path.resolve('data/ledger/daily_runs.json');
}

export class RunIdentityService {
  private static cachedRuns: Record<string, DailyRunRecord> | null = null;

  public static loadRuns(): Record<string, DailyRunRecord> {
    if (this.cachedRuns) return this.cachedRuns;

    try {
      const p = getRunsFilePath();
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.cachedRuns = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[RunIdentityService] Could not read daily_runs file:', e);
    }

    const empty = {};
    this.cachedRuns = empty;
    return empty;
  }

  public static saveRuns(runs: Record<string, DailyRunRecord>): void {
    try {
      const p = getRunsFilePath();
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(p, JSON.stringify(runs, null, 2), 'utf8');
      this.cachedRuns = runs;
    } catch (e) {
      console.warn('[RunIdentityService] Could not save daily_runs file:', e);
    }
  }

  /**
   * Generates deterministic daily run_id.
   * Format: daily-YYYY-MM-DDTHH:00Z
   */
  public static generateRunId(nowMs: number = Date.now()): string {
    const d = new Date(nowMs);
    const datePart = d.toISOString().slice(0, 10);
    const hours = String(d.getUTCHours()).padStart(2, '0');
    return `daily-${datePart}T${hours}:00Z`;
  }

  /**
   * Starts a new daily run or resumes existing run if in progress.
   */
  public static startDailyRun(options: {
    nowMs?: number;
    trigger?: 'SCHEDULER_CRON' | 'MANUAL' | 'EVENT' | 'RETRY';
    forceNew?: boolean;
  } = {}): { run: DailyRunRecord; isResume: boolean } {
    const nowMs = options.nowMs || Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const dateStr = nowIso.slice(0, 10);
    const runId = this.generateRunId(nowMs);

    const runs = this.loadRuns();
    const existing = runs[runId];

    if (existing && !options.forceNew && existing.status !== 'FAILED') {
      return { run: existing, isResume: true };
    }

    const newRun: DailyRunRecord = {
      runId,
      dateStr,
      startedAt: nowIso,
      status: 'STARTED',
      trigger: options.trigger || 'SCHEDULER_CRON',
      codeVersion: 'Sprint54-DailyPipeline-v1',
      modelVersions: {
        ah: 'AH-dixoncoles-v1.0.0',
        btts: 'BTTS-jointscore-v1.0.0',
        ou: 'ASIAN-TOTAL-jointscore-v1.0.0',
      },
      stages: {},
    };

    runs[runId] = newRun;
    this.saveRuns(runs);
    return { run: newRun, isResume: false };
  }

  /**
   * Records or updates a stage execution within a run.
   */
  public static updateStage(
    runId: string,
    stageKey: string,
    update: Partial<StageExecutionRecord> & { name?: string }
  ): void {
    const runs = this.loadRuns();
    const run = runs[runId];
    if (!run) return;

    const existingStage = run.stages[stageKey] || {
      stage: stageKey,
      name: update.name || stageKey,
      startedAt: new Date().toISOString(),
      status: 'PENDING',
    };

    run.stages[stageKey] = {
      ...existingStage,
      ...update,
    };

    this.saveRuns(runs);
  }

  /**
   * Completes a daily run with final status and summary.
   */
  public static completeDailyRun(
    runId: string,
    status: PipelineRunStatus,
    summary?: DailyRunRecord['summary'],
    error?: string,
    finishedAtMs?: number
  ): DailyRunRecord {
    const runs = this.loadRuns();
    const run = runs[runId];
    const nowIso = finishedAtMs ? new Date(finishedAtMs).toISOString() : new Date().toISOString();

    if (!run) {
      throw new Error(`[RunIdentityService] Run not found: ${runId}`);
    }

    run.status = status;
    run.finishedAt = nowIso;
    if (summary) run.summary = summary;
    if (error) run.error = error;

    this.saveRuns(runs);
    return run;
  }

  /**
   * Returns the latest successful run.
   */
  public static getLastSuccessfulRun(): DailyRunRecord | null {
    const runs = this.loadRuns();
    const successful = Object.values(runs)
      .filter((r) => r.status === 'SUCCESS')
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return successful[0] || null;
  }

  /**
   * Returns the most recent run regardless of status.
   */
  public static getLatestRun(): DailyRunRecord | null {
    const runs = this.loadRuns();
    const sorted = Object.values(runs).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return sorted[0] || null;
  }

  /**
   * Checks if pipeline has executed successfully in the last maxAgeHours (default 26h).
   */
  public static isPipelineHealthy(maxAgeHours: number = 26): {
    healthy: boolean;
    status: 'HEALTHY' | 'STALE' | 'FAILED' | 'PARTIAL';
    lastRun: DailyRunRecord | null;
    hoursSinceLastSuccess: number | null;
  } {
    const lastRun = this.getLatestRun();
    const lastSuccess = this.getLastSuccessfulRun();

    if (!lastRun) {
      return {
        healthy: false,
        status: 'STALE',
        lastRun: null,
        hoursSinceLastSuccess: null,
      };
    }

    if (!lastSuccess) {
      return {
        healthy: false,
        status: lastRun.status === 'FAILED' ? 'FAILED' : 'PARTIAL',
        lastRun,
        hoursSinceLastSuccess: null,
      };
    }

    const now = Date.now();
    const successTime = new Date(lastSuccess.finishedAt || lastSuccess.startedAt).getTime();
    const hoursSince = (now - successTime) / (1000 * 60 * 60);

    if (hoursSince > maxAgeHours) {
      return {
        healthy: false,
        status: 'STALE',
        lastRun,
        hoursSinceLastSuccess: Number(hoursSince.toFixed(1)),
      };
    }

    if (lastRun.status === 'FAILED') {
      return {
        healthy: false,
        status: 'FAILED',
        lastRun,
        hoursSinceLastSuccess: Number(hoursSince.toFixed(1)),
      };
    }

    if (lastRun.status === 'PARTIAL') {
      return {
        healthy: true, // Last success is still fresh
        status: 'PARTIAL',
        lastRun,
        hoursSinceLastSuccess: Number(hoursSince.toFixed(1)),
      };
    }

    return {
      healthy: true,
      status: 'HEALTHY',
      lastRun,
      hoursSinceLastSuccess: Number(hoursSince.toFixed(1)),
    };
  }

  public static clearForTesting(): void {
    this.cachedRuns = {};
    const p = getRunsFilePath();
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch {}
    }
  }
}
