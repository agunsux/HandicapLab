// EPIC 35.1 — Automatic Prediction Scheduler
// Runs before every kickoff: discovers upcoming fixtures, generates
// predictions via the frozen engine, and appends immutable snapshots.
//
// Guarantees:
//   * retries with backoff       * timeout protection
//   * duplicate prevention       * idempotency (one snapshot per fixture)
//
// Prediction generation NEVER executes twice for the same fixture+model.

import * as crypto from 'crypto';
import type { LiveFixture, FixtureOddsSet, SchedulerRunReport } from '../types';
import type { LiveValidationStore } from '../store/types';
import type { LiveValidationConfig } from '../config';
import { buildPredictionSnapshot, type ModelVersionInfo } from '../snapshot/snapshot-builder';
import { OddsTracker } from '../snapshot/odds-tracker';

/** Fixture discovery contract — any provider adapter can satisfy this. */
export interface LiveFixtureSource {
  /** Upcoming fixtures with kickoff inside [from, to] */
  getUpcomingFixtures(from: string, to: string): Promise<LiveFixture[]>;
}

/** Odds source contract — returns current quotes for one fixture. */
export interface LiveOddsSource {
  getOdds(fixtureId: string): Promise<FixtureOddsSet | null>;
}

/** Injectable clock so runs are fully deterministic in replay tests. */
export type Clock = () => Date;

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  backoffMs = 50
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

export class PredictionScheduler {
  private oddsTracker: OddsTracker;

  constructor(
    private deps: {
      fixtures: LiveFixtureSource;
      odds: LiveOddsSource;
      store: LiveValidationStore;
      versions: ModelVersionInfo;
      config: LiveValidationConfig;
      clock?: Clock;
      idFactory?: () => string;
    }
  ) {
    this.oddsTracker = new OddsTracker(deps.store, {
      steamThreshold: deps.config.odds.steamThreshold,
      schemaVersion: deps.config.schemaVersion,
      idFactory: deps.idFactory,
    });
  }

  private now(): Date {
    return this.deps.clock ? this.deps.clock() : new Date();
  }

  private newId(): string {
    return this.deps.idFactory ? this.deps.idFactory() : crypto.randomUUID();
  }

  /** Execute one scheduler pass. Safe to call repeatedly — idempotent. */
  async run(): Promise<SchedulerRunReport> {
    const { store, config } = this.deps;
    const runId = this.newId();
    const startedAt = this.now().toISOString();

    const windowFrom = new Date(
      this.now().getTime() + config.scheduler.minLeadMinutes * 60_000
    ).toISOString();
    const windowTo = new Date(
      this.now().getTime() + config.scheduler.lookAheadHours * 3_600_000
    ).toISOString();

    const report: SchedulerRunReport = {
      runId,
      startedAt,
      finishedAt: startedAt,
      fixturesDiscovered: 0,
      predictionsCreated: 0,
      duplicatesSkipped: 0,
      failures: [],
      success: true,
    };

    let fixtures: LiveFixture[] = [];
    try {
      fixtures = await withTimeout(
        this.deps.fixtures.getUpcomingFixtures(windowFrom, windowTo),
        config.scheduler.timeoutMs
      );
    } catch (err) {
      report.success = false;
      report.failures.push({
        fixtureId: '*discovery*',
        error: err instanceof Error ? err.message : String(err),
      });
      report.finishedAt = this.now().toISOString();
      return report;
    }

    report.fixturesDiscovered = fixtures.length;

    for (const fixture of fixtures) {
      // Duplicate prevention — a fixture is predicted exactly once
      if (await store.hasPredictionForFixture(fixture.fixtureId)) {
        report.duplicatesSkipped++;
        continue;
      }

      try {
        await withRetry(
          () =>
            withTimeout(
              this.predictFixture(fixture, runId),
              config.scheduler.timeoutMs
            ),
          config.scheduler.maxRetries
        );
        report.predictionsCreated++;
      } catch (err) {
        report.success = false;
        report.failures.push({
          fixtureId: fixture.fixtureId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    report.finishedAt = this.now().toISOString();
    return report;
  }

  private async predictFixture(fixture: LiveFixture, correlationId: string): Promise<void> {
    const { store, config, versions } = this.deps;

    // Re-check inside the critical section (idempotency under retries)
    if (await store.hasPredictionForFixture(fixture.fixtureId)) return;

    const odds = await this.deps.odds.getOdds(fixture.fixtureId);
    if (!odds || odds.quotes.length === 0) {
      throw new Error(`No odds available for fixture ${fixture.fixtureId}`);
    }

    // Capture prediction-time odds (append-only journal)
    await this.oddsTracker.capture(odds, 'prediction', correlationId);

    const previous = await store.getLastPrediction();
    const snapshot = buildPredictionSnapshot({
      fixture,
      odds,
      versions,
      now: this.now().toISOString(),
      correlationId,
      previousSnapshot: previous ? { id: previous.id, chainHash: previous.chainHash } : null,
      minExpectedValue: config.minExpectedValue,
      schemaVersion: config.schemaVersion,
      idFactory: this.deps.idFactory,
    });

    await store.appendPrediction(snapshot);
  }
}
