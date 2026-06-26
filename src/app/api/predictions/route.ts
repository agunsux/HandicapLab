import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { getUserEntitlements } from '@/lib/pricing/entitlement';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    let userId: string | undefined;

    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
      }
    }

    const entitlements = await getUserEntitlements(userId);

    // Query ensembled predictions from the database
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .order('prediction_timestamp', { ascending: true })
      .limit(60);

    if (error) {
      throw error;
    }

    // Format response grouped by match to match original layout
    const grouped: Record<string, any> = {};

    for (const pred of predictions || []) {
      const matchKey = `${pred.home_team} vs ${pred.away_team}`;
      if (!grouped[matchKey]) {
        grouped[matchKey] = {
          match: matchKey,
          kickoff: pred.prediction_timestamp,
          league: pred.cohort_tag || 'EPL',
          prediction: { home: 0, draw: 0, away: 0 },
          asianHandicap: { line: '', confidence: 0 },
          overUnder: { line: '', over: 0, under: 0 },
          confidence: '⚪ Low'
        };
      }

      const predObj = typeof pred.prediction === 'object' && pred.prediction ? (pred.prediction as any) : {};

      if (pred.market_type === 'ML') {
        grouped[matchKey].prediction = {
          home: Math.round((predObj.pHome || predObj.home_prob || 0.4) * 100),
          draw: Math.round((predObj.pDraw || predObj.draw_prob || 0.25) * 100),
          away: Math.round((predObj.pAway || predObj.away_prob || 0.35) * 100),
        };
        
        // Map confidence object to color dot
        const finalConf = predObj.confidence?.finalConfidence;
        if (finalConf !== undefined) {
          grouped[matchKey].confidence = finalConf >= 0.75 ? '🟢 High' : finalConf >= 0.60 ? '🟡 Medium' : '⚪ Low';
        }
      } else if (pred.market_type === 'AH') {
        const line = predObj.ah_line !== undefined ? predObj.ah_line : -0.75;
        const lineStr = line > 0 ? `+${line}` : `${line}`;
        const ahProb = predObj.ah_prob ?? (predObj.pAhHome?.[String(line)] || 0.5);
        grouped[matchKey].asianHandicap = {
          line: `${pred.home_team} ${lineStr}`,
          confidence: Math.round(ahProb * 100),
        };
      } else if (pred.market_type === 'OU') {
        const line = predObj.ou_line !== undefined ? predObj.ou_line : 2.5;
        const overProb = predObj.over_prob ?? (predObj.pOver?.[String(line)] || 0.5);
        grouped[matchKey].overUnder = {
          line: `O/U ${line}`,
          over: Math.round(overProb * 100),
          under: Math.round((1 - overProb) * 100),
        };
      }
    }

    let response = Object.values(grouped);

    // Enforce entitlements server-side
    if (!entitlements.hasFullEdgeData) {
      // FREE / STARTER (limited scanner):
      // 1. Limit the returned matches to a maximum of 3 (3 signals/day)
      response = response.slice(0, entitlements.maxSignalsPerDay);

      // 2. Hide / truncate detailed probabilities or exact edge data
      for (const res of response) {
        // Redact exact market probabilities & lines
        res.prediction = { home: 0, draw: 0, away: 0 };
        res.asianHandicap = { line: 'Locked', confidence: 0 };
        res.overUnder = { line: 'Locked', over: 0, under: 0 };
        res.confidence = '🔒 Locked';
      }
    }

    return NextResponse.json({ success: true, predictions: response });
  } catch (error: any) {
    console.error('Predictions API Route Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
