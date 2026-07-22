import { NextRequest, NextResponse } from 'next/server';
import { FeatureSimilarityEngineV2, type MatchFeatureVector } from '../../../../lib/scientific-validation/feature-similarity-engine-v2';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fixtureId, vector, k = 100 } = body;

    const queryVector: MatchFeatureVector = vector || {
      xgDiff: 0.45,
      xgaDiff: -0.20,
      shotsDiff: 3.2,
      shotsOnTargetDiff: 1.8,
      ppdaDiff: -2.1,
      restDaysDiff: 1,
      travelKmDiff: -150,
      eloDiff: 85,
      openingOdds: 2.10,
      bookmakerMargin: 0.028,
    };

    // Mock historical feature vector pool
    const historicalPool = Array.from({ length: 450 }).map((_, i) => ({
      fixtureId: `hist-${i + 1}`,
      matchName: `Fixture ${i + 1}`,
      season: '2024-2025',
      vector: {
        xgDiff: queryVector.xgDiff + (Math.random() * 0.4 - 0.2),
        xgaDiff: queryVector.xgaDiff + (Math.random() * 0.4 - 0.2),
        shotsDiff: queryVector.shotsDiff + (Math.random() * 2 - 1),
        shotsOnTargetDiff: queryVector.shotsOnTargetDiff + (Math.random() * 1 - 0.5),
        ppdaDiff: queryVector.ppdaDiff + (Math.random() * 2 - 1),
        restDaysDiff: queryVector.restDaysDiff,
        travelKmDiff: queryVector.travelKmDiff,
        eloDiff: queryVector.eloDiff + (Math.random() * 40 - 20),
        openingOdds: queryVector.openingOdds + (Math.random() * 0.3 - 0.15),
        bookmakerMargin: 0.028,
      },
      result: Math.random() > 0.42 ? ('WIN' as const) : ('LOSS' as const),
      realizedRoi: Math.random() * 0.2 - 0.05,
      realizedClv: Math.random() * 0.08 - 0.01,
    }));

    const result = FeatureSimilarityEngineV2.findNearestNeighbors(
      fixtureId || 'fix-query-1',
      queryVector,
      historicalPool,
      k
    );

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
