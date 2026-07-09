// Shadow Evaluation API — Compute metrics across windows
import { NextRequest, NextResponse } from 'next/server';
import { MemoryEvidenceLedgerStore } from '@/lib/data/evidence/ledger';
import { evaluateWindows, DEFAULT_EVALUATION_WINDOWS } from '@/lib/data/evaluation/runner';

const evidenceStore = new MemoryEvidenceLedgerStore();

export async function GET() {
  try {
    const entries = await evidenceStore.getAll();
    const windows = evaluateWindows(entries, DEFAULT_EVALUATION_WINDOWS);

    // Also compute full (all-time) evaluation
    const fullEvaluation = evaluateWindows(entries, [
      { label: 'all', minDays: 0, minPredictions: 1 },
    ]);

    return NextResponse.json({
      windows,
      allTime: fullEvaluation[0] ?? null,
      totalPredictions: entries.length,
      settledPredictions: entries.filter(e => e.actualOutcome !== null).length,
    });
  } catch (error) {
    console.error('[EVALUATION API ERROR]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
