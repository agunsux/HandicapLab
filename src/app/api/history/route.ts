// HandicapLab API - Historical Fixtures Ingestion Log
// Location: src/app/api/history/route.ts

import { NextResponse } from 'next/server';
import { EventBus } from '../../../lib/data-platform/eventBus';

export async function GET() {
  try {
    const events = EventBus.getEventsHistory();
    const fixtures = events.filter((e) => e.eventType === 'FixtureCreated');

    return NextResponse.json({
      count: fixtures.length,
      fixtures: fixtures.map((f) => ({
        eventId: f.eventId,
        matchId: f.aggregateId,
        occurredAt: f.occurredAt,
        payload: f.payload
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
// 
