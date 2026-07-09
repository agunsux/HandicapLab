// Evidence API — Query the evidence ledger
import { NextRequest, NextResponse } from 'next/server';
import { MemoryEvidenceLedgerStore } from '@/lib/data/evidence/ledger';
import { evaluateEvidence, evaluateWindows } from '@/lib/data/evaluation/runner';

const evidenceStore = new MemoryEvidenceLedgerStore();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const window = searchParams.get('window'); // '30d','90d','180d','all'
  const fixtureId = searchParams.get('fixtureId');

  try {
    let entries = await evidenceStore.getAll();

    // Filter by fixture if requested
    if (fixtureId) {
      entries = entries.filter(e => e.fixtureId === fixtureId);
    }

    // Return evaluation results if window requested
    if (window) {
      if (window === 'all') {
        const results = evaluateWindows(entries);
        return NextResponse.json({ windows: results, totalEntries: entries.length });
      }
      const windows = evaluateWindows(entries);
      const match = windows.find(w => w.window === window);
      return NextResponse.json({
        evaluation: match ?? null,
        totalEntries: entries.length,
      });
    }

    // Default: return ledger summary
    const settled = entries.filter(e => e.actualOutcome !== null);
    const totalPredictions = entries.length;
    const totalSettled = settled.length;

    return NextResponse.json({
      totalPredictions,
      totalSettled,
      unsettled: totalPredictions - totalSettled,
      chainValid: (await evidenceStore.verifyChainIntegrity()).valid,
      lastEntry: entries.length > 0 ? entries[entries.length - 1] : null,
    });
  } catch (error) {
    console.error('[EVIDENCE API ERROR]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
