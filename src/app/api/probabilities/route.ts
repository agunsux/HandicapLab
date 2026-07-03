import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { ApiHelper } from '@/lib/utils/apiHelper';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId') || searchParams.get('match_id');

    if (!matchId) {
      return ApiHelper.response(false, null, 'matchId query parameter is required', 400);
    }

    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('match_id', matchId);

    if (error) throw error;

    if (!predictions || predictions.length === 0) {
      return ApiHelper.response(false, null, 'No predictions found for the specified match', 404);
    }

    const probs: any = {
      match_id: matchId,
      moneyline: null,
      asian_handicap: [],
      over_under: [],
      expected_goals: null,
      btts: null,
      calibration_applied: false
    };

    for (const pred of predictions) {
      const predObj = typeof pred.prediction === 'object' && pred.prediction ? (pred.prediction as any) : {};
      
      if (pred.market_type === 'ML') {
        probs.moneyline = {
          home: predObj.pHome || predObj.home_prob || 0,
          draw: predObj.pDraw || predObj.draw_prob || 0,
          away: predObj.pAway || predObj.away_prob || 0
        };
        probs.calibration_applied = predObj.calibrationApplied || false;
        probs.expected_goals = predObj.expected_goals || 2.5;
        if (predObj.pBttsYes !== undefined) {
          probs.btts = {
            yes: predObj.pBttsYes,
            no: predObj.pBttsNo ?? (1 - predObj.pBttsYes)
          };
        }
      } else if (pred.market_type === 'AH') {
        const line = predObj.ah_line !== undefined ? predObj.ah_line : 0;
        probs.asian_handicap.push({
          line: line,
          home: predObj.pAhHome?.[String(line)] || predObj.ah_prob || 0,
          away: predObj.pAhAway?.[String(line)] || (1 - (predObj.pAhHome?.[String(line)] || predObj.ah_prob || 0))
        });
      } else if (pred.market_type === 'OU') {
        const line = predObj.ou_line !== undefined ? predObj.ou_line : 2.5;
        probs.over_under.push({
          line: line,
          over: predObj.pOver?.[String(line)] || predObj.over_prob || 0,
          under: predObj.pUnder?.[String(line)] || (1 - (predObj.pOver?.[String(line)] || predObj.over_prob || 0))
        });
      }
    }

    return ApiHelper.response(true, probs);
  } catch (error: any) {
    console.error('[Probabilities API] Error:', error);
    return ApiHelper.response(false, null, error, 500);
  }
}
