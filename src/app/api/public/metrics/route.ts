import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { calculateQuantitativeMetrics } from '@/lib/validation/metricsCalculator';

export const revalidate = 0;

export async function GET() {
  try {
    const { data } = await supabase
      .from('prediction_ledger')
      .select('*')
      .order('published_at', { ascending: false });

    const metrics = calculateQuantitativeMetrics(data || []);

    return NextResponse.json({
      status: 'success',
      sample_size_n: metrics.settledCount,
      confidence_grade: metrics.confidenceGrade,
      confidence_grade_badge: metrics.confidenceGradeBadge,
      multi_factor_audit: metrics.gradeFactors,
      statistical_significance: {
        p_value_one_tailed: metrics.pValueRoi,
        p_value_status: metrics.pValueRoi < 0.05 ? 'STATISTICALLY_SIGNIFICANT (p < 0.05)' : 'NOT_SIGNIFICANT',
        prob_roi_greater_than_zero_pct: metrics.probRoiGreaterThanZeroPct,
        sharpe_ratio: metrics.sharpeRatio,
        bootstrap_resamples_n: 1000
      },
      metrics: {
        brier_score: {
          value: metrics.brierScore,
          ci_95_lower: metrics.brierCiLower,
          ci_95_upper: metrics.brierCiUpper,
          sample_size: metrics.settledCount
        },
        log_loss: {
          value: metrics.logLoss,
          ci_95_lower: metrics.logLossCiLower,
          ci_95_upper: metrics.logLossCiUpper,
          sample_size: metrics.settledCount
        },
        ece_score: {
          value: metrics.eceScore,
          status: metrics.calibrationStatus,
          sample_size: metrics.settledCount
        },
        roi_yield: {
          value_pct: metrics.roiYieldPct,
          ci_95_lower: metrics.roiCiLower,
          ci_95_upper: metrics.roiCiUpper,
          sample_size: metrics.settledCount
        },
        clv_alpha: {
          value_pct: metrics.clvAvgPct,
          benchmark: 'Pinnacle Closing Lines'
        }
      },
      three_timestamp_verified_pct: metrics.threeTimestampVerifiedPct,
      last_updated_utc: metrics.lastUpdatedUtc
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60, s-maxage=60'
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Error' }, { status: 500 });
  }
}
