// HandicapLab API - Canonical Provider Health Status Overview
// Location: src/app/api/providers/health/route.ts

import { NextResponse } from 'next/server';
import { evaluateCanonicalProviderHealth } from '@/lib/providers/canonicalHealth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const report = await evaluateCanonicalProviderHealth();
    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
