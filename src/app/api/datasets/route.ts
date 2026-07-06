// HandicapLab API - Get Compiled Dataset Manifests
// Location: src/app/api/datasets/route.ts

import { NextResponse } from 'next/server';
import { DatasetBuilder } from '../../../lib/data-platform/datasetBuilder';

export async function GET() {
  try {
    const list = DatasetBuilder.getDatasets();
    return NextResponse.json({
      count: list.length,
      datasets: list
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
