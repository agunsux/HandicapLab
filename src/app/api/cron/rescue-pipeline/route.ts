import { NextResponse, type NextRequest } from 'next/server';
import { PoissonRescueService } from '@/lib/pipeline/rescue/poissonRescueService';
import { verifyCronRequest } from '@/lib/auth/cronAuth';
import { DistributedCronLease } from '@/lib/crons/distributedCronLease';

export async function GET(request: NextRequest) {
  const auth = await verifyCronRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized', reason: auth.reason }, { status: 401 });
  }

  const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
  const targetDate = searchParams.get('targetDate') || undefined;

  let leaseId: string | undefined;
  let leaseGeneration: string | undefined;

  try {
    const lease = await DistributedCronLease.acquireLease('cron_rescue_pipeline', 5 * 60 * 1000);
    if (!lease.acquired) {
      return NextResponse.json({
        success: false,
        message: 'Concurrent cron execution skipped',
        reason: lease.reason,
      }, { status: 409 });
    }

    leaseId = lease.leaseId;
    leaseGeneration = lease.generation;

    const result = await PoissonRescueService.execute({ targetDate });
    return NextResponse.json({
      success: true,
      telemetry: result.telemetry,
      predictionsCount: result.predictions.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Rescue pipeline execution failed' },
      { status: 500 }
    );
  } finally {
    if (leaseId) {
      await DistributedCronLease.releaseLease('cron_rescue_pipeline', leaseId, leaseGeneration);
    }
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
