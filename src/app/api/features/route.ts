// HandicapLab API - Get Feature Store Versions
// Location: src/app/api/features/route.ts

import { NextResponse } from 'next/server';
import { FeatureStore } from '../../../lib/data-platform/featureStore';

export async function GET() {
  try {
    const list = FeatureStore.getFeatures();
    return NextResponse.json({
      count: list.length,
      features: list
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
