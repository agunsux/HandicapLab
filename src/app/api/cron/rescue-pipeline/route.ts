import { NextResponse, type NextRequest } from 'next/server';
import { PoissonRescueService } from '@/lib/pipeline/rescue/poissonRescueService';

function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return true;
  const token = request.nextUrl.searchParams.get('token');
  return token === cronSecret;
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const targetDate = searchParams.get('targetDate') || undefined;

  try {
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
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
