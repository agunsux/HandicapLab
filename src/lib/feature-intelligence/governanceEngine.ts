/**
 * EPIC 19.9 — Feature Governance
 */

import type { GovernanceRecord, FeatureApprovalStatus } from './types';
import { generateGovernanceId } from './id';

export class GovernanceEngine {
  private readonly records = new Map<string, GovernanceRecord>();

  create(featureId: string, owner: string): GovernanceRecord {
    const record: GovernanceRecord = {
      featureId,
      owner,
      approvalStatus: 'draft',
      validationHistory: [],
      researchStatus: 'pending',
      deprecationDate: null,
      replacementFeatureId: null,
      versionHistory: ['1.0.0'],
    };
    this.records.set(featureId, record);
    return record;
  }

  updateStatus(featureId: string, status: FeatureApprovalStatus): GovernanceRecord {
    const existing = this.records.get(featureId);
    if (!existing) throw new Error(`Feature ${featureId} not found`);
    const updated: GovernanceRecord = { ...existing, approvalStatus: status, validationHistory: [...existing.validationHistory, `status->${status}`] };
    this.records.set(featureId, updated);
    return updated;
  }

  get(featureId: string): GovernanceRecord | undefined {
    return this.records.get(featureId);
  }

  getAll(): readonly GovernanceRecord[] {
    return Array.from(this.records.values());
  }
}

export const defaultGovernanceEngine = new GovernanceEngine();