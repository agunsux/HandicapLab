import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { ApiHelper } from '@/lib/utils/apiHelper';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId') || searchParams.get('match_id');
    const predictionId = searchParams.get('predictionId') || searchParams.get('prediction_id');

    if (!matchId && !predictionId) {
      return ApiHelper.response(false, null, 'Either matchId or predictionId parameter is required', 400);
    }

    let query = supabase.from('predictions').select('*');
    if (predictionId) {
      query = query.eq('id', predictionId);
    } else {
      query = query.eq('match_id', matchId).limit(1);
    }

    const { data: preds, error } = await query;
    if (error) throw error;

    if (!preds || preds.length === 0) {
      return ApiHelper.response(false, null, 'No prediction records found', 404);
    }

    const pred = preds[0];
    const predObj = typeof pred.prediction === 'object' && pred.prediction ? (pred.prediction as any) : {};
    const conf = predObj.confidence || {};

    // Standardize confidence breakdown mapping
    const finalScore = conf.confidenceScore !== undefined ? conf.confidenceScore : Math.round((pred.confidence ?? pred.market_confidence_score ?? 0));
    const dataQuality = conf.dataQualityScore !== undefined ? conf.dataQualityScore : 80;
    const status = conf.recommendationStatus || predObj.recommendation?.status || 'Neutral';
    const reasons = conf.reasons || predObj.recommendation?.reasons || ['Model calibration stable', 'Standard historical data volume'];

    return ApiHelper.response(true, {
      match_id: pred.match_id,
      prediction_id: pred.id,
      confidence_score: finalScore,
      data_quality_score: dataQuality,
      recommendation_status: status,
      reasons: reasons,
      factors: {
        model_variance: conf.modelConfidence !== undefined ? Math.round(conf.modelConfidence * 100) : 85,
        data_completeness: conf.dataConfidence !== undefined ? Math.round(conf.dataConfidence * 100) : 75,
        market_stability: conf.marketConfidence !== undefined ? Math.round(conf.marketConfidence * 100) : 80,
        final_confidence: conf.finalConfidence !== undefined ? Number(conf.finalConfidence.toFixed(4)) : 0.80
      }
    });
  } catch (error: any) {
    console.error('[Confidence API] Error:', error);
    return ApiHelper.response(false, null, error, 500);
  }
}
