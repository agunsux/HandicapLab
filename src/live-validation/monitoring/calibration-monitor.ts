// EPIC 35.6 — Calibration Monitor
// Tracks reliability diagrams, probability buckets, expected vs observed,
// ECE, MCE and calibration drift over the live validation window.
// Detection only — never adjusts probabilities.

import * as crypto from 'crypto';
import type {
  CalibrationBucketLV,
  CalibrationHistoryRecord,
  PredictionSnapshotRecord,
  SettlementRecordLV,
} from '../types';
import type { LiveValidationStore } from '../store/types';
import type { Clock } from '../scheduler/prediction-scheduler';

export interface CalibrationSample {
  probability: number;
  actual: 0 | 1;
}

export interface CalibrationComputation {
  ece: number;
  mce: number;
  buckets: CalibrationBucketLV[];
  sampleSize: number;
}

/** Compute reliability buckets, ECE and MCE from probability samples. */
export function computeCalibration(samples: CalibrationSample[]): CalibrationComputation {
  const bucketCount = 10;
  const raw = Array.from({ length: bucketCount }, (_, i) => ({
    range: `${i * 10}-${(i + 1) * 10}%`,
    pSum: 0,
    aSum: 0,
    n: 0,
  }));

  for (const s of samples) {
    const p = Math.max(0, Math.min(1, s.probability));
    const idx = Math.min(bucketCount - 1, Math.floor(p * 10));
    raw[idx].pSum += p;
    raw[idx].aSum += s.actual;
    raw[idx].n++;
  }

  let ece = 0;
  let mce = 0;
  const buckets: CalibrationBucketLV[] = raw.map(b => {
    const expected = b.n > 0 ? b.pSum / b.n : 0;
    const observed = b.n > 0 ? b.aSum / b.n : 0;
    const gap = Math.abs(expected - observed);
    if (b.n > 0) {
      ece += (b.n / samples.length) * gap;
      if (gap > mce) mce = gap;
    }
    return {
      range: b.range,
      expected: Number(expected.toFixed(4)),
      observed: Number(observed.toFixed(4)),
      sampleSize: b.n,
    };
  });

  return {
    ece: Number(ece.toFixed(4)),
    mce: Number(mce.toFixed(4)),
    buckets,
    sampleSize: samples.length,
  };
}

/** Build 1X2 calibration samples by joining predictions to settled scores. */
export function buildCalibrationSamples(
  predictions: PredictionSnapshotRecord[],
  settlements: SettlementRecordLV[]
): CalibrationSample[] {
  const scoreByFixture = new Map<string, { home: number; away: number }>();
  for (const s of settlements) {
    scoreByFixture.set(s.fixtureId, { home: s.homeScore, away: s.awayScore });
  }

  const samples: CalibrationSample[] = [];
  for (const p of predictions) {
    const score = scoreByFixture.get(p.fixture.fixtureId);
    if (!score) continue;
    const outcome =
      score.home > score.away ? 'home' : score.home < score.away ? 'away' : 'draw';
    // Every class contributes a sample — richer reliability signal
    samples.push({ probability: p.prediction.homeProb, actual: outcome === 'home' ? 1 : 0 });
    samples.push({ probability: p.prediction.drawProb, actual: outcome === 'draw' ? 1 : 0 });
    samples.push({ probability: p.prediction.awayProb, actual: outcome === 'away' ? 1 : 0 });
  }
  return samples;
}

export class CalibrationMonitor {
  constructor(
    private deps: {
      store: LiveValidationStore;
      schemaVersion: string;
      clock?: Clock;
      idFactory?: () => string;
    }
  ) {}

  /** Compute and append a calibration history record for a window. */
  async run(windowDays = 30, correlationId = 'calibration-monitor'): Promise<CalibrationHistoryRecord> {
    const asOf = (this.deps.clock ? this.deps.clock() : new Date()).toISOString();
    const from = new Date(new Date(asOf).getTime() - windowDays * 86_400_000).toISOString();

    const predictions = await this.deps.store.listPredictions({ from, to: asOf });
    const settlements = await this.deps.store.listSettlements({ from, to: asOf });
    const samples = buildCalibrationSamples(predictions, settlements);
    const computed = computeCalibration(samples);

    const previous = await this.deps.store.getLatestCalibration();
    const eceDrift =
      previous !== null ? Number((computed.ece - previous.ece).toFixed(4)) : null;

    const idFactory = this.deps.idFactory ?? (() => crypto.randomUUID());
    const record: CalibrationHistoryRecord = {
      id: idFactory(),
      asOf,
      windowDays,
      sampleSize: computed.sampleSize,
      ece: computed.ece,
      mce: computed.mce,
      buckets: computed.buckets,
      eceDrift,
      createdAt: asOf,
      createdBy: 'calibration-monitor',
      schemaVersion: this.deps.schemaVersion,
      correlationId,
    };

    await this.deps.store.appendCalibrationRecord(record);
    return record;
  }
}
