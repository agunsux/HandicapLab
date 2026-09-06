import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get('format') || 'csv';

  if (format !== 'csv') {
    return NextResponse.json({ error: 'Unsupported format. Only csv is supported.' }, { status: 400 });
  }

  // Query real records from active/historical ledger
  const { data, error } = await supabase
    .from('daily_picks')
    .select('id, kickoff_utc, league, home_team, away_team, market_type, prediction, model_probability, fair_odds, market_odds, closing_odds, clv_percentage, status, profit_loss, confidence')
    .order('kickoff_utc', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('[AuditExport] Query error:', error);
  }

  const csvHeader = 'ID,Kickoff,League,Match,Market,Prediction,Probability,FairOdds,MarketOdds,ClosingOdds,CLV_Pct,Result,ProfitUnits,Confidence\n';

  const rows = (data || []).map((row) => {
    const match = `"${(row.home_team || '').replace(/"/g, '""')} vs ${(row.away_team || '').replace(/"/g, '""')}"`;
    const league = `"${(row.league || '').replace(/"/g, '""')}"`;
    return [
      row.id,
      row.kickoff_utc,
      league,
      match,
      row.market_type,
      row.prediction,
      row.model_probability ? (row.model_probability * 100).toFixed(1) + '%' : '',
      row.fair_odds ?? '',
      row.market_odds ?? '',
      row.closing_odds ?? '',
      row.clv_percentage ?? '',
      row.status ?? 'PENDING',
      row.profit_loss ?? '',
      row.confidence ?? '',
    ].join(',');
  });

  const csvContent = csvHeader + (rows.length > 0 ? rows.join('\n') + '\n' : '');

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="handicaplab_audit_${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
