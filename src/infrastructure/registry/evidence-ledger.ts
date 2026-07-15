import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Registry, ValidationResult } from '../../domain/registry';
import type { EvidenceRecord } from '../../domain/evidence/types';

export class EvidenceLedger implements Registry<EvidenceRecord> {
  private projectRoot: string;
  private ledgerPath: string;
  private registeredItems: Map<string, EvidenceRecord> = new Map();

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.ledgerPath = path.join(this.projectRoot, 'artifacts', 'epic31b', 'evidence_ledger.json');
    this.loadLedger();
  }

  private loadLedger(): void {
    if (fs.existsSync(this.ledgerPath)) {
      try {
        const records: EvidenceRecord[] = JSON.parse(fs.readFileSync(this.ledgerPath, 'utf-8'));
        for (const record of records) {
          this.registeredItems.set(record.experimentId, record);
        }
      } catch {
        // Start fresh if file is corrupted
      }
    }
  }

  private saveLedger(): void {
    const dir = path.dirname(this.ledgerPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const records = Array.from(this.registeredItems.values());
    fs.writeFileSync(this.ledgerPath, JSON.stringify(records, null, 2), 'utf-8');
  }

  /**
   * Calculates the SHA-256 hash of record parameters.
   */
  public calculateHash(item: Omit<EvidenceRecord, 'evidenceHash' | 'evidenceSignature'>): string {
    const dataStr = JSON.stringify({
      experimentId: item.experimentId,
      datasetSha: item.datasetSha,
      gitCommitSha: item.gitCommitSha,
      featureVersion: item.featureVersion,
      calibrationVersion: item.calibrationVersion,
      modelVersion: item.modelVersion,
      randomSeed: item.randomSeed,
      validationMetrics: item.validationMetrics,
      confidenceIntervals: item.confidenceIntervals,
      bootstrapResults: item.bootstrapResults,
      timestamp: item.timestamp,
    });
    return crypto.createHash('sha256').update(dataStr).digest('hex');
  }

  /**
   * Signs the evidence hash.
   */
  public signHash(hash: string): string {
    return `signed_by_handicaplab_research_${hash.substring(0, 16)}`;
  }

  async register(item: EvidenceRecord): Promise<void> {
    this.registeredItems.set(item.experimentId, item);
    this.saveLedger();
  }

  async get(id: string): Promise<EvidenceRecord> {
    const item = this.registeredItems.get(id);
    if (!item) {
      throw new Error(`Evidence record for experiment ${id} not found in ledger.`);
    }
    return item;
  }

  async list(): Promise<EvidenceRecord[]> {
    return Array.from(this.registeredItems.values());
  }

  async validate(id: string): Promise<ValidationResult> {
    const item = await this.get(id);
    const errors: string[] = [];
    const warnings: string[] = [];

    const expectedHash = this.calculateHash(item);
    if (expectedHash !== item.evidenceHash) {
      errors.push(`Evidence record hash mismatch for experiment ${id}. Expected: ${expectedHash}, Got: ${item.evidenceHash}`);
    }

    const expectedSignature = this.signHash(item.evidenceHash);
    if (expectedSignature !== item.evidenceSignature) {
      errors.push(`Evidence signature is invalid or tampered with.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
