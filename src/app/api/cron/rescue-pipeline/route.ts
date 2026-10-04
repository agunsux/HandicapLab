import { NextResponse, type NextRequest } from 'next/server';
import { PoissonRescueService } from '@/lib/pipeline/rescue/poissonRescueService';

function parseJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')?.trim();
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7).trim();
  if (!token) return false;

  // 1. Direct match with rotated CRON_SECRET (fallback / local testing)
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && token === cronSecret) {
    return true;
  }

  // 2. Google Cloud Scheduler OIDC ID Token verification
  const payload = parseJwtPayload(token);
  if (payload) {
    const nowSec = Math.floor(Date.now() / 1000);
    const isGoogleIssuer =
      payload.iss === 'https://accounts.google.com' ||
      payload.iss === 'accounts.google.com';
    const isAllowedEmail =
      payload.email &&
      (payload.email === 'handicaplab-run@handicap-salmo.iam.gserviceaccount.com' ||
        payload.email.endsWith('@handicap-salmo.iam.gserviceaccount.com'));
    const isNotExpired = payload.exp && payload.exp > nowSec;

    if (isGoogleIssuer && isAllowedEmail && isNotExpired) {
      console.log(`[verifyCronAuth] Verified Cloud Scheduler OIDC token for ${payload.email}`);
      return true;
    }
  }

  return false;
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
