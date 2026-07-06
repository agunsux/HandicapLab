// HandicapLab API - Publish Settle Event
// Location: src/app/api/events/settle/route.ts

import { NextResponse } from 'next/server';
import { EventQueue } from '../../../../lib/paper-trading/eventSystem';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { matchId, homeGoals, awayGoals, closingOdds, idempotencyKey } = body;

    if (matchId === undefined || homeGoals === undefined || awayGoals === undefined) {
      return NextResponse.json(
        { error: 'Missing required payload parameters (matchId, homeGoals, awayGoals)' },
        { status: 400 }
      );
    }

    const key = idempotencyKey || `settle:${matchId}:${homeGoals}:${awayGoals}`;
    const correlationId = crypto.randomUUID();

    const job = await EventQueue.publish(
      'match.finished',
      { matchId, homeGoals, awayGoals, closingOdds },
      key,
      correlationId
    );

    return NextResponse.json({
      status: 'ok',
      jobId: job.id,
      correlationId: job.correlation_id,
      message: `Event match.finished published for match ${matchId}.`
    }, { status: 202 });
  } catch (error: any) {
    console.error('[API Events Settle] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
// 
