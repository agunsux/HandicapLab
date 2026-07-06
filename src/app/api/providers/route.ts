// HandicapLab API - Get Registered Provider Adapters
// Location: src/app/api/providers/route.ts

import { NextResponse } from 'next/server';
import { ProviderRegistry } from '../../../lib/data-platform/providerRegistry';

export async function GET() {
  try {
    const list = ProviderRegistry.getAll();
    return NextResponse.json({
      providersCount: list.length,
      providers: list.map((p) => ({
        name: p.name,
        capabilities: p.getCapabilities()
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
