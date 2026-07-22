import { NextRequest, NextResponse } from 'next/server';
import { ScientificReportGeneratorEngine } from '../../../../lib/public-ledger/report-generator';

export async function GET(req: NextRequest) {
  try {
    const weeklyReport = ScientificReportGeneratorEngine.generateWeeklyReport('2026-W31');
    return NextResponse.json({
      success: true,
      data: {
        weeklyReport,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
