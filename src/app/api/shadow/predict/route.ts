// Shadow Predict API — Generate a shadow prediction for a fixture
// Uses the existing probability model (unchanged) via the shadow prediction engine.
import { NextRequest, NextResponse } from 'next/server';
import {
  createShadowPrediction,
} from '@/lib/data/prediction/engine';
import { MemoryOddsSnapshotStore } from '@/lib/data/snapshots/engine';
import { createEvidenceEntry, MemoryEvidenceLedgerStore } from '@/lib/data/evidence/ledger';
import type { Fixture, OddsSnapshot, MarketType } from '@/lib/data/providers/types';

// In-memory stores for development. Production should use DB-backed stores.
const oddsStore = new MemoryOddsSnapshotStore();
const evidenceStore = new MemoryEvidenceLedgerStore();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fixture,
      oddsSnapshot,
      marketType,
      line,
    } = body as {
      fixture: Fixture;
      oddsSnapshot: OddsSnapshot;
      marketType: MarketType;
      line: number;
    };

    // Validate required fields
    if (!fixture?.fixtureId || !oddsSnapshot?.capturedAt || !marketType) {
      return NextResponse.json(
        { error: 'Missing required fields: fixture, oddsSnapshot, marketType' },
        { status: 400 }
      );
    }

    // Store the odds snapshot
    await oddsStore.append({
      ...oddsSnapshot,
      id: oddsSnapshot.id ?? `odds_${Date.now()}`,
      chainHash: '',
      previousSnapshotId: null,
    });

    // Generate shadow prediction (uses existing model — no changes)
    const { prediction, settlement } = await createShadowPrediction(
      { fixture, oddsSnapshot, marketType, line },
      oddsStore
    );

    // Create evidence entry and store it
    const previousEntries = await evidenceStore.getAll();
    const previousEntryId = previousEntries.length > 0
      ? previousEntries[previousEntries.length - 1].id
      : null;

    const evidence = createEvidenceEntry(prediction, null, previousEntryId);
    await evidenceStore.append(evidence);

    return NextResponse.json({
      prediction,
      settlement,
      evidence,
    });
  } catch (error) {
    console.error('[SHADOW PREDICT ERROR]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return current evidence ledger status
  const allEvidence = await evidenceStore.getAll();
  const integrity = await evidenceStore.verifyChainIntegrity();
  return NextResponse.json({
    totalPredictions: allEvidence.length,
    settledPredictions: allEvidence.filter(e => e.actualOutcome !== null).length,
    chainIntegrity: integrity,
    lastEntry: allEvidence.length > 0 ? allEvidence[allEvidence.length - 1] : null,
  });
}
