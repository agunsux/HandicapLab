// features API route
// Location: src/app/api/v1/features/route.ts

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    metadata: {
      model_version: 'ensemble-platt-v1',
      dataset_version: 'Gold_v1',
      prediction_timestamp: new Date().toISOString(),
      generated_at: new Date().toISOString(),
      processing_time_ms: 1.5,
      metrics: {
        prediction_latency_ms: 0.2,
        edge_latency_ms: 0.1,
        decision_latency_ms: 0.1,
        cache_hit: true,
        cache_miss: false,
        feature_age_hours: 1.2
      }
    },
    data: [
      { feature: 'homeAttack', description: 'Home team offensive rating', type: 'decimal', age_hours: 1.2 },
      { feature: 'awayAttack', description: 'Away team offensive rating', type: 'decimal', age_hours: 1.2 },
      { feature: 'homeDefense', description: 'Home team defensive rating', type: 'decimal', age_hours: 1.2 },
      { feature: 'awayDefense', description: 'Away team defensive rating', type: 'decimal', age_hours: 1.2 },
      { feature: 'homeRestDays', description: 'Number of rest days for home team', type: 'integer', age_hours: 0.0 }
    ]
  });
}
