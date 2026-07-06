// HandicapLab API - Get Locked Snapshot
// Location: src/app/api/snapshots/[id]/route.ts

import { NextResponse } from 'next/server';
import { SnapshotLocker } from '../../../../lib/paper-trading/snapshotLocker';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: matchId } = await params;
    const snapshot = SnapshotLocker.get(matchId);

    if (!snapshot) {
      return NextResponse.json({ error: `Snapshot for match ID ${matchId} not found.` }, { status: 404 });
    }

    return NextResponse.json({
      matchId: snapshot.matchId,
      timestamp: snapshot.timestamp,
      odds: snapshot.odds,
      probabilities: snapshot.probabilities,
      modelVersion: snapshot.modelVersion,
      calibrationVersion: snapshot.calibrationVersion,
      configHash: snapshot.configHash,
      featureHash: snapshot.featureHash,
      predictionHash: snapshot.predictionHash
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
