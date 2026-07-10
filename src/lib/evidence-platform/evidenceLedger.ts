/**
 * Sprint A11 — Evidence Ledger Integration
 * =========================================
 * Every imported dataset becomes a permanent, append-only Evidence Artifact.
 *
 * Generates: artifact id, checksum, dataset fingerprint, integrity score,
 * validation result, timestamp, commit hash, architecture version.
 *
 * The ledger is append-only (ARCHITECTURE_INVARIANTS §14) and every artifact
 * is frozen on append.
 */

import { generateId, ID_PREFIX } from '../registry/identifiers';
import { ARCHITECTURE_VERSION } from './types';
import type { EvidenceArtifact, IntegrityReport, ValidationSummary } from './types';

export interface EvidenceArtifactInput {
  readonly datasetId: string;
  readonly checksum: string;
  readonly fingerprint: string;
  readonly integrityScore: number;
  readonly validationResult: ValidationSummary;
  readonly commitHash?: string;
  readonly architectureVersion?: string;
}

/** Resolve the current git commit hash, defaulting to "unknown". */
function resolveCommitHash(explicit?: string): string {
  if (explicit) return explicit;
  const fromEnv = process.env.GIT_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA;
  return fromEnv ?? 'unknown';
}

export class DatasetEvidenceLedger {
  private readonly artifacts: EvidenceArtifact[] = [];

  /** Append a new frozen evidence artifact and return it. */
  append(input: EvidenceArtifactInput): EvidenceArtifact {
    const artifact: EvidenceArtifact = Object.freeze({
      artifactId: generateId(ID_PREFIX.EVIDENCE),
      datasetId: input.datasetId,
      checksum: input.checksum,
      fingerprint: input.fingerprint,
      integrityScore: input.integrityScore,
      validationResult: Object.freeze({ ...input.validationResult }),
      timestamp: new Date().toISOString(),
      commitHash: resolveCommitHash(input.commitHash),
      architectureVersion: input.architectureVersion ?? ARCHITECTURE_VERSION,
    });
    this.artifacts.push(artifact);
    return artifact;
  }

  /** Convenience: build an artifact from an integrity report + fingerprint. */
  appendFromIntegrity(
    integrity: IntegrityReport,
    fingerprint: string,
    checksum: string,
    validationResult: ValidationSummary,
    commitHash?: string
  ): EvidenceArtifact {
    return this.append({
      datasetId: integrity.datasetId,
      checksum,
      fingerprint,
      integrityScore: integrity.score,
      validationResult,
      commitHash,
    });
  }

  get(artifactId: string): EvidenceArtifact | undefined {
    return this.artifacts.find((a) => a.artifactId === artifactId);
  }

  getByDataset(datasetId: string): readonly EvidenceArtifact[] {
    return this.artifacts.filter((a) => a.datasetId === datasetId);
  }

  getAll(): readonly EvidenceArtifact[] {
    return [...this.artifacts];
  }

  count(): number {
    return this.artifacts.length;
  }
}

export const defaultEvidenceLedger = new DatasetEvidenceLedger();
