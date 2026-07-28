import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get('format') || 'csv';

  // In a real implementation, we would query the `prediction_audits` table here.
  // We would use a streaming cursor if the dataset is large.
  
  if (format === 'csv') {
    const csvHeader = 'ID,Kickoff,League,Match,Market,Prediction,Probability,FairOdds,BookmakerOdds,ClosingOdds,CLV,Result,Profit,Confidence\n';
    const csvRow = 'pred-001,2026-07-28T14:00:00Z,Premier League,Arsenal vs Brighton,Moneyline,Arsenal,63,1.59,1.92,1.83,0.09,WIN,0.92,81\n';
    const csvContent = csvHeader + csvRow;

    // Create a stream or just send text for small sets
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="prediction_audit.csv"',
      },
    });
  }

  return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
}
