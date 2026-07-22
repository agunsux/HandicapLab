import { NextRequest, NextResponse } from 'next/server';
import { LineageVisualizerEngine } from '../../../../lib/data-quality/lineage-visualizer';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fixtureId = searchParams.get('fixtureId') || 'f-dq-101';
    const lineage = LineageVisualizerEngine.getFixtureLineage(fixtureId);

    return NextResponse.json({
      success: true,
      data: lineage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
