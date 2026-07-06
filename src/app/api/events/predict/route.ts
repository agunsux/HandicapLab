// HandicapLab API - Publish Predict Event
// Location: src/app/api/events/predict/route.ts

import { NextResponse } from 'next/server';
import { EventQueue } from '../../../../lib/paper-trading/eventSystem';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { matchId, features, marketFeatures, marketOdds, marketSelection, marketName, kellyMultiplier, idempotencyKey } = body;

    if (!matchId || !features || !marketFeatures || !marketSelection) {
      return NextResponse.json(
        { error: 'Missing required payload parameters (matchId, features, marketFeatures, marketSelection)' },
        { status: 400 }
      );
    }

    const key = idempotencyKey || `predict:${matchId}:${marketSelection}`;
    const correlationId = crypto.randomUUID();

    const job = await EventQueue.publish(
      'fixture.created',
      { matchId, features, marketFeatures, marketOdds: marketOdds || 1.95, marketSelection, marketName: marketName || 'Moneyline Home', kellyMultiplier },
      key,
      correlationId
    );

    return NextResponse.json({
      status: 'ok',
      jobId: job.id,
      correlationId: job.correlation_id,
      message: `Event fixture.created published for match ${matchId}.`
    }, { status: 202 });
  } catch (error: any) {
    console.error('[API Events Predict] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
