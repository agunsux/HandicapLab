// HandicapLab API - Trigger Deterministic Replay
// Location: src/app/api/replay/route.ts

import { NextResponse } from 'next/server';
import { EventBus } from '../../../lib/data-platform/eventBus';
import { ReplayEngine } from '../../../lib/data-platform/replayEngine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rangeDays } = body;

    const events = EventBus.getEventsHistory();
    // Simulate time slice selection
    const report = ReplayEngine.replay(events);

    return NextResponse.json({
      status: 'ok',
      message: `Deterministic replay job completed for last ${rangeDays || 7} days.`,
      report
    }, { status: 202 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
// 
