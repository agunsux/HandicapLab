import { NextRequest, NextResponse } from 'next/server';
import { JobRunner } from '../../../../live-validation/ops/job-runner';
import { supabase } from '../../../../lib/supabase.server';

export async function GET(req: NextRequest) {
  try {
    const health = await JobRunner.getOperationalHealth();

    let jobRuns: any[] = [];
    let dlqItems: any[] = [];

    try {
      const { data: runs } = await supabase
        .from('live_validation_job_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);
      jobRuns = runs || [];

      const { data: dlq } = await supabase
        .from('live_validation_dlq')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      dlqItems = dlq || [];
    } catch (e) {
      // Offline fallback
    }

    return NextResponse.json({
      success: true,
      data: {
        health,
        recentJobRuns: jobRuns,
        dlqItems,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
