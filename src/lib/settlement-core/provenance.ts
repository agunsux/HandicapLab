// ============================================================================
// DATA PROVENANCE  (Epic 31A — User refinement)
// ============================================================================
// Every metric in the system must be traceable back to raw data. This module
// provides the audit trail and lineage tracking so that any computed value
// (ROI, CLV, Edge, etc.) can be verified against its source data.
//
// Provenance chain:
//   Metric (e.g. ROI = 12.5%)
//     ↓
//   Trades (3 settled predictions)
//     ↓
//   Predictions (model output + odds at prediction time)
//     ↓
//   Odds Snapshots (provider, timestamp, price)
//     ↓
//   Provider (API-Football, Pinnacle, etc.)
//
// Every provenance record is stored as an immutable entry in the
// data_provenance table.
// ============================================================================

import crypto from 'crypto';

export type ProvenanceEntityType =
  | 'metric'
  | 'trade'
  | 'prediction'
  | 'odds_snapshot'
  | 'provider'
  | 'settlement'
  | 'ledger_entry';

export interface ProvenanceLink {
  entityType: ProvenanceEntityType;
  entityId: string;
  label: string;
  timestamp: string;
}

export interface ProvenanceRecord {
  id: string;
  targetType: ProvenanceEntityType;
  targetId: string;
  targetLabel: string;
  links: ProvenanceLink[];
  computedAt: string;
  formula: string; // description of how the value was derived
  sourceHash: string; // hash of all source data for integrity verification
  verified: boolean;
}

/**
 * Build a provenance chain for a given metric by linking it back to
 * its source trades and underlying data.
 *
 * Example:
 *   buildMetricProvenance('roi', 'ledger-001', [
 *     { entityType: 'trade', entityId: 'trade-001', label: 'MCI v LIV ML', timestamp: '...' },
 *     { entityType: 'trade', entityId: 'trade-002', label: 'ARS v CHE AH', timestamp: '...' },
 *   ])
 */
export function buildMetricProvenance(
  metricName: string,
  entityId: string,
  links: ProvenanceLink[],
  formula: string
): ProvenanceRecord {
  const sortedLinks = [...links].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const hashInput = sortedLinks.map((l) => `${l.entityType}:${l.entityId}:${l.timestamp}`).join('|');
  const sourceHash = crypto.createHash('sha256').update(hashInput).digest('hex');

  return {
    id: `prov-${crypto.createHash('sha256').update(`${metricName}:${entityId}:${Date.now()}`).digest('hex').slice(0, 16)}`,
    targetType: 'metric',
    targetId: entityId,
    targetLabel: metricName,
    links: sortedLinks,
    computedAt: new Date().toISOString(),
    formula,
    sourceHash,
    verified: false,
  };
}

/**
 * Verify a provenance record by re-computing the hash from its links.
 * Returns true if the data has not been tampered with.
 */
export function verifyProvenanceIntegrity(record: ProvenanceRecord): boolean {
  const sortedLinks = [...record.links].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const hashInput = sortedLinks.map((l) => `${l.entityType}:${l.entityId}:${l.timestamp}`).join('|');
  const expectedHash = crypto.createHash('sha256').update(hashInput).digest('hex');
  return expectedHash === record.sourceHash;
}

/**
 * Resolve the full provenance trail for a ledger entry:
 *   LedgerEntry → Trades → Predictions → Odds Snapshots → Providers
 *
 * This provides a complete audit path for any metric shown in the UI.
 */
export function resolveProvenanceTrail(
  ledgerEntryId: string,
  trades: Array<{ id: string; predictionId: string; settledAt: string }>,
  predictions: Array<{ id: string; matchId: string; oddsSnapshotId: string; modelVersion: string }>,
  oddsSnapshots: Array<{ id: string; provider: string; capturedAt: string }>,
  providers: Array<{ name: string }>
): ProvenanceRecord[] {
  const records: ProvenanceRecord[] = [];

  // Level 1: Ledger entry
  records.push(
    buildMetricProvenance(
      `ledger:${ledgerEntryId}`,
      ledgerEntryId,
      trades.map((t) => ({
        entityType: 'trade',
        entityId: t.id,
        label: `Trade ${t.id}`,
        timestamp: t.settledAt,
      })),
      'Aggregated from settled predictions'
    )
  );

  // Level 2: Trades → Predictions
  for (const trade of trades) {
    const pred = predictions.find((p) => p.id === trade.predictionId);
    if (!pred) continue;
    records.push(
      buildMetricProvenance(
        `trade:${trade.id}`,
        trade.id,
        [
          {
            entityType: 'prediction',
            entityId: pred.id,
            label: `Prediction v${pred.modelVersion}`,
            timestamp: trade.settledAt,
          },
        ],
        'Settlement outcome derived from prediction vs actual result'
      )
    );
  }

  // Level 3: Predictions → Odds Snapshots
  for (const pred of predictions) {
    const snap = oddsSnapshots.find((s) => s.id === pred.oddsSnapshotId);
    if (!snap) continue;
    records.push(
      buildMetricProvenance(
        `prediction:${pred.id}`,
        pred.id,
        [
          {
            entityType: 'odds_snapshot',
            entityId: snap.id,
            label: `Odds from ${snap.provider} at ${snap.capturedAt}`,
            timestamp: snap.capturedAt,
          },
        ],
        'Prediction odds sourced from snapshot at generation time'
      )
    );
  }

  // Level 4: Odds Snapshots → Providers
  for (const snap of oddsSnapshots) {
    const provider = providers.find((p) => p.name === snap.provider);
    if (!provider) continue;
    records.push(
      buildMetricProvenance(
        `odds_snapshot:${snap.id}`,
        snap.id,
        [
          {
            entityType: 'provider',
            entityId: provider.name,
            label: `Provider: ${provider.name}`,
            timestamp: snap.capturedAt,
          },
        ],
        'Raw odds data sourced from external provider'
      )
    );
  }

  return records;
}

/**
 * Mark a provenance record as verified (checked against source data).
 */
export function markProvenanceVerified(record: ProvenanceRecord): ProvenanceRecord {
  return { ...record, verified: true };
}