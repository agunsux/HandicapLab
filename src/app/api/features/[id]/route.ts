// HandicapLab API - Get Feature Store Metadata by Version
// Location: src/app/api/features/[id]/route.ts

import { NextResponse } from 'next/server';
import { FeatureStore } from '../../../../lib/data-platform/featureStore';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: version } = await params;
    const all = FeatureStore.getFeatures();
    const versioned = all.filter((f) => f.version === version);

    if (versioned.length === 0) {
      return NextResponse.json({ error: `Feature version ${version} not found.` }, { status: 404 });
    }

    return NextResponse.json({
      version,
      featuresCount: versioned.length,
      features: versioned
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
// 
