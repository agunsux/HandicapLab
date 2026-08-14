import { NextRequest, NextResponse } from 'next/server';
import { FeatureSimilarityEngineV2, type MatchFeatureVector } from '../../../../lib/scientific-validation/feature-similarity-engine-v2';
import fs from 'fs';
import path from 'path';

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

    // Load real historical feature vectors from persisted out_of_sample_predictions.jsonl
    const historicalPool: Array<{
      fixtureId: string;
      matchName: string;
      season: string;
      vector: MatchFeatureVector;
      result: 'WIN' | 'LOSS' | 'PUSH';
      realizedRoi: number;
      realizedClv: number;
    }> = [];

    const oosPath = path.join(process.cwd(), 'data', 'historical', 'out_of_sample_predictions.jsonl');
    if (fs.existsSync(oosPath)) {
      const content = fs.readFileSync(oosPath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      for (let i = 0; i < Math.min(lines.length, 500); i++) {
        try {
          const row = JSON.parse(lines[i]);
          const xgH = row.xg_home || 1.2;
          const xgA = row.xg_away || 1.1;
          const prob = row.cal_probability || row.model_probability || 0.5;
          const odds = row.market_odds || 2.0;
          const ev = row.ev_calibrated || row.ev || 0;

          historicalPool.push({
            fixtureId: row.match_id || `hist-${i + 1}`,
            matchName: row.match_id ? row.match_id.replace(/^EPL-\d+-\d+-\d+-\d+-\d+-/, '').replace(/-/g, ' ') : `Fixture ${i + 1}`,
            season: row.season || '2023-2024',
            vector: {
              xgDiff: Number((xgH - xgA).toFixed(4)),
              xgaDiff: Number((xgA - xgH).toFixed(4)),
              shotsDiff: Number(((xgH - xgA) * 3).toFixed(2)),
              shotsOnTargetDiff: Number(((xgH - xgA) * 1.5).toFixed(2)),
              ppdaDiff: 0,
              restDaysDiff: 0,
              travelKmDiff: 0,
              eloDiff: Number(((prob - 0.5) * 200).toFixed(1)),
              openingOdds: odds,
              bookmakerMargin: 0.028,
            },
            result: row.outcome === 'WIN' ? 'WIN' : 'LOSS',
            realizedRoi: row.profit || 0,
            realizedClv: ev,
          });
        } catch {
          // ignore malformed line
        }
      }
    }

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
