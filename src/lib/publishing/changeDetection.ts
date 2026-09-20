// ============================================================================
// AUTOMATIC CHANGE DETECTION & PAYLOAD HASHING
// ============================================================================
// Location: src/lib/publishing/changeDetection.ts
//
// Invariant:
// Meaningful changes trigger automated reconciliation and updates.
// Redundant duplicate republishing is skipped when payload hash is identical.
// ============================================================================

import crypto from 'crypto';
import { ProductionSignalDTO } from './types';

export interface ChangeDetectionResult {
  hasChanged: boolean;
  isNew: boolean;
  reasons: string[];
  newPayloadHash: string;
  previousPayloadHash?: string;
}

export class ChangeDetectionEngine {
  /**
   * Generates a deterministic SHA-256 payload hash of all relevant values.
   */
  public static computePayloadHash(signal: Partial<ProductionSignalDTO>): string {
    const raw = JSON.stringify({
      canonicalMatchId: signal.canonicalMatchId,
      market: signal.market,
      selection: signal.selection,
      line: signal.line,
      kickoffUtc: signal.kickoffUtc,
      currentOdds: signal.currentOdds,
      modelProbability: Number((signal.modelProbability || 0).toFixed(4)),
      marketProbability: Number((signal.marketProbability || 0).toFixed(4)),
      edge: Number((signal.edge || 0).toFixed(4)),
      confidence: signal.confidence,
      publishState: signal.publishState,
      validityStatus: signal.validityStatus,
    });

    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Compares an incoming signal with an existing stored signal.
   */
  public static detectChanges(
    incoming: Partial<ProductionSignalDTO>,
    existing?: ProductionSignalDTO | null
  ): ChangeDetectionResult {
    const newHash = this.computePayloadHash(incoming);

    if (!existing) {
      return {
        hasChanged: true,
        isNew: true,
        reasons: ['NEW_SIGNAL_DISCOVERED'],
        newPayloadHash: newHash,
      };
    }

    if (existing.payloadHash === newHash) {
      return {
        hasChanged: false,
        isNew: false,
        reasons: [],
        newPayloadHash: newHash,
        previousPayloadHash: existing.payloadHash,
      };
    }

    const reasons: string[] = [];

    // Check individual attribute shifts
    if (existing.currentOdds !== incoming.currentOdds) {
      reasons.push(`ODDS_MOVEMENT: ${existing.currentOdds} -> ${incoming.currentOdds}`);
    }
    if (existing.line !== incoming.line) {
      reasons.push(`LINE_SHIFT: ${existing.line} -> ${incoming.line}`);
    }
    if (existing.kickoffUtc !== incoming.kickoffUtc) {
      reasons.push(`KICKOFF_RESCHEDULED: ${existing.kickoffUtc} -> ${incoming.kickoffUtc}`);
    }
    if (Math.abs((existing.modelProbability || 0) - (incoming.modelProbability || 0)) > 0.001) {
      reasons.push(`MODEL_PROBABILITY_UPDATE: ${existing.modelProbability} -> ${incoming.modelProbability}`);
    }
    if (Math.abs((existing.edge || 0) - (incoming.edge || 0)) > 0.001) {
      reasons.push(`EDGE_UPDATE: ${existing.edge} -> ${incoming.edge}`);
    }
    if (existing.confidence !== incoming.confidence) {
      reasons.push(`CONFIDENCE_SHIFT: ${existing.confidence} -> ${incoming.confidence}`);
    }
    if (existing.publishState !== incoming.publishState) {
      reasons.push(`STATE_TRANSITION: ${existing.publishState} -> ${incoming.publishState}`);
    }

    if (reasons.length === 0) {
      reasons.push('PAYLOAD_HASH_DIFFERENCE');
    }

    return {
      hasChanged: true,
      isNew: false,
      reasons,
      newPayloadHash: newHash,
      previousPayloadHash: existing.payloadHash,
    };
  }
}
