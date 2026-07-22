import { NextRequest, NextResponse } from 'next/server';
import { getLiveValidationStore } from '../../../../live-validation/store';

export async function GET(req: NextRequest) {
  try {
    const store = getLiveValidationStore();
    const reports = await store.listWeeklyReports();

    return NextResponse.json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
