import { NextRequest, NextResponse } from 'next/server';
import { getLiveValidationStore } from '../../../../../live-validation/store';
import { DeterministicReplayEngine } from '../../../../../live-validation/replay/replay-engine';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const predictionId = resolvedParams.id;

    const store = getLiveValidationStore();
    const engine = new DeterministicReplayEngine(store);
    const certificate = await engine.replayPrediction(predictionId);

    return NextResponse.json({
      success: true,
      data: certificate,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
