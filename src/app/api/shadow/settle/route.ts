// Shadow Settlement API — Record actual outcomes and settle predictions
import { NextRequest, NextResponse } from 'next/server';
import { settlePrediction } from '@/lib/data/prediction/engine';
import { createEvidenceEntry, MemoryEvidenceLedgerStore } from '@/lib/data/evidence/ledger';

const evidenceStore = new MemoryEvidenceLedgerStore();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      predictionId,
      prediction,
      homeScore,
      awayScore,
      closingOddsProb,
      closingOdds,
    } = body;

    if (!predictionId || homeScore === undefined || awayScore === undefined || closingOddsProb === undefined || closingOdds === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: predictionId, homeScore, awayScore, closingOddsProb, closingOdds' },
        { status: 400 }
      );
    }

    // Settle the prediction
    const settlement = await settlePrediction(
      prediction,
      homeScore,
      awayScore,
      closingOddsProb,
      closingOdds
    );

    // Update evidence ledger with settlement data
    const allEvidence = await evidenceStore.getAll();
    const existingEvidence = allEvidence.find(e => e.predictionId === predictionId);
    if (existingEvidence) {
      const updatedEvidence = createEvidenceEntry(
        prediction,
        settlement,
        existingEvidence.previousEntryId,
        'MATCH_SETTLED'
      );
      await evidenceStore.append(updatedEvidence);
    }

    return NextResponse.json({
      settlement,
    });
  } catch (error) {
    console.error('[SHADOW SETTLE ERROR]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
