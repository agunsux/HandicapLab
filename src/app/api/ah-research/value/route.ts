import { NextResponse } from 'next/server';
import { loadAhResearchViewModel } from '@/lib/research/ah-yield/ahViewModel';

export const dynamic = 'force-dynamic';

/**
 * Real AH yield research payload, derived from real historical odds/results.
 * Fails closed with 503 + DATA_NOT_AVAILABLE when the report artifact does not exist.
 */
export async function GET() {
  const view = loadAhResearchViewModel();
  if (!view) {
    return NextResponse.json(
      {
        status: 'DATA_NOT_AVAILABLE',
        message: 'AH yield report artifact missing; no synthetic data is served.',
        requiredCommand: 'npm run ah:yield',
      },
      { status: 503 }
    );
  }
  return NextResponse.json({ status: 'OK', data: view });
}
