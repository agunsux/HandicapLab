import { NextRequest, NextResponse } from 'next/server';
import { getLiveValidationStore } from '../../../../live-validation/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const league = searchParams.get('league') || undefined;
    const fixtureId = searchParams.get('fixtureId') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;

    const store = getLiveValidationStore();
    const predictions = await store.listPredictions({ league, fixtureId, from, to });

    return NextResponse.json({
      success: true,
      count: predictions.length,
      data: predictions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
