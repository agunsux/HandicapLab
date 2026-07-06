// HandicapLab Live Data Platform - Replay Engine
// Location: src/lib/data-platform/replayEngine.ts

import { StandardEvent } from './eventBus';
import crypto from 'crypto';

export interface ReplayReport {
  jobId: string;
  processedCount: number;
  duplicateCount: number;
  outOfOrderCount: number;
  corruptedCount: number;
  anomalies: string[];
  reproducedHash: string;
}

export class ReplayEngine {
  private static calculateHash(events: StandardEvent[]): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(events.map((e) => e.eventId)))
      .digest('hex');
  }

  /**
   * Deterministically replays and checks event logs for validation errors.
   */
  public static replay(events: StandardEvent[]): ReplayReport {
    const jobId = crypto.randomUUID();
    const anomalies: string[] = [];
    
    let duplicateCount = 0;
    let outOfOrderCount = 0;
    let corruptedCount = 0;

    const seenIds = new Set<string>();
    let lastTime = 0;

    events.forEach((evt) => {
      // 1. Duplicate check
      if (seenIds.has(evt.eventId)) {
        duplicateCount++;
        anomalies.push(`Anomaly: Duplicate event ID detected: ${evt.eventId}`);
      } else {
        seenIds.add(evt.eventId);
      }

      // 2. Out of order check
      const current = new Date(evt.occurredAt).getTime();
      if (current < lastTime) {
        outOfOrderCount++;
        anomalies.push(`Anomaly: Out of order event detected: ${evt.eventId} occurred before previous event`);
      }
      lastTime = current;

      // 3. Corrupted payload check (re-verify checksum)
      const expectedChecksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(evt.payload))
        .digest('hex');

      if (evt.checksum !== expectedChecksum) {
        corruptedCount++;
        anomalies.push(`Anomaly: Corrupted payload checksum mismatch on event: ${evt.eventId}`);
      }
    });

    const reproducedHash = this.calculateHash(events);

    return {
      jobId,
      processedCount: events.length,
      duplicateCount,
      outOfOrderCount,
      corruptedCount,
      anomalies,
      reproducedHash
    };
  }
}
