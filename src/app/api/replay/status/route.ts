// HandicapLab API - Get Replay Job Status
// Location: src/app/api/replay/status/route.ts

import { NextResponse } from 'next/server';
import { EventBus } from '../../../../lib/data-platform/eventBus';
import { ReplayEngine } from '../../../../lib/data-platform/replayEngine';

export async function GET() {
  try {
    const events = EventBus.getEventsHistory();
    const report = ReplayEngine.replay(events);

    return NextResponse.json({
      status: 'idle',
      lastReport: report
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
// 
