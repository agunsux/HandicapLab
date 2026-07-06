// HandicapLab API - Get Event Job Status
// Location: src/app/api/jobs/[id]/route.ts

import { NextResponse } from 'next/server';
import { EventQueue } from '../../../../lib/paper-trading/eventSystem';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = EventQueue.getJob(id);

    if (!job) {
      return NextResponse.json({ error: `Job with ID ${id} not found.` }, { status: 404 });
    }

    return NextResponse.json({
      jobId: job.id,
      eventType: job.event_type,
      status: job.status,
      retryCount: job.retry_count,
      createdAt: job.created_at,
      correlationId: job.correlation_id,
      errorMessage: job.error_message
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
