/**
 * 21.12 — Artifact Integration
 * Every artifact linked to all previous research platforms.
 * No orphan artifact allowed.
 */

import type { ShadowArtifact } from './types';
import { generateSHArtifactId } from './id';

export class ShadowArtifactIntegration {
  create(params: {
    fixtureId: string; snapshotId: string; evaluationId?: string;
    ledgerEntryId?: string;
  }): ShadowArtifact {
    return Object.freeze({
      artifactId: generateSHArtifactId(),
      fixtureId: params.fixtureId,
      snapshotId: params.snapshotId,
      evaluationId: params.evaluationId ?? null,
      ledgerEntryId: params.ledgerEntryId ?? null,
      evidenceLink: `evidence://shadow/${params.fixtureId}`,
      replayLink: `replay://shadow/${params.fixtureId}`,
      baselineLink: `baseline://shadow/${params.fixtureId}`,
      probabilityLink: `probability://shadow/${params.fixtureId}`,
      featureLink: `feature://shadow/${params.fixtureId}`,
      decisionLink: `decision://shadow/${params.fixtureId}`,
      timestamp: new Date().toISOString(),
      immutable: true as const,
    });
  }
}

export const defaultShadowArtifactIntegration = new ShadowArtifactIntegration();