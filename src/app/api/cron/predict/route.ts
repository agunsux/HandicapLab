import { NextResponse } from 'next/server';
import { runPredictionCron } from '@/lib/crons/prediction';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runPredictionCron();
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Prediction cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runPredictionCron();
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Prediction cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
