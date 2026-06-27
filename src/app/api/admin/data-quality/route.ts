import { NextResponse } from 'next/server';
import { DataQualityEngine } from '../../../lib/analytics/data-quality';

export async function GET() {
  try {
    const report = await DataQualityEngine.evaluate();

    const payload = {
      success: true,
      status: report.status,
      score: report.score,
      quality_score: report.score,
      confidence_level: report.confidence_level,
      sample_size: report.sample_size,
      metrics: report.metrics,
      // Trace metrics exactly as requested
      'signal health': report.metrics.orphanSignals === 0 ? 'healthy' : 'warning',
      'odds freshness': report.metrics.staleOddsCount === 0 ? 'healthy' : 'warning',
      'settlement integrity': report.metrics.invalidSettlementStates === 0 ? 'healthy' : 'warning',
      'audit completeness': report.metrics.missingCorrelationIds === 0 && report.metrics.missingSettlementEvents === 0 ? 'healthy' : 'warning',
      summary: {
        signal_health: report.metrics.orphanSignals === 0 ? 'HEALTHY' : 'WARNING',
        odds_freshness: report.metrics.staleOddsCount === 0 ? 'HEALTHY' : 'WARNING',
        settlement_integrity: report.metrics.invalidSettlementStates === 0 ? 'HEALTHY' : 'WARNING',
        audit_completeness: report.metrics.missingCorrelationIds === 0 && report.metrics.missingSettlementEvents === 0 ? 'HEALTHY' : 'WARNING'
      }
    };

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error('[Admin Data Quality API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
