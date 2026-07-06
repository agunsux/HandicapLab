// HandicapLab API - Historical Odds Movement Logs by Match
// Location: src/app/api/history/[id]/route.ts

import { NextResponse } from 'next/server';
import { EventBus } from '../../../../lib/data-platform/eventBus';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: matchId } = await params;
    const all = EventBus.getEventsHistory();
    const matchEvents = all.filter((e) => e.aggregateId === matchId);

    return NextResponse.json({
      matchId,
      eventsCount: matchEvents.length,
      events: matchEvents.map((e) => ({
        eventId: e.eventId,
        eventType: e.eventType,
        occurredAt: e.occurredAt,
        payload: e.payload,
        checksum: e.checksum
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
