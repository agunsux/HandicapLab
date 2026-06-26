import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { getUserEntitlements } from '@/lib/pricing/entitlement';
import { getUserDailyReveals, recordSignalReveal } from '@/lib/pricing/access-logs';
import { logEvent } from '@/lib/pricing/analytics';

export async function POST(request: Request) {
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

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Authenticated session required.' },
        { status: 401 }
      );
    }

    const { signalId } = await request.json();
    if (!signalId) {
      return NextResponse.json(
        { success: false, error: 'Missing signalId' },
        { status: 400 }
      );
    }

    const entitlements = await getUserEntitlements(userId);
    if (entitlements.hasFullEdgeData) {
      return NextResponse.json({ success: true, message: 'User tier has unlimited access.' });
    }

    const revealed = await getUserDailyReveals(userId);

    // If already revealed today, return success immediately
    if (revealed.includes(signalId)) {
      return NextResponse.json({ success: true, message: 'Signal already revealed.' });
    }

    if (revealed.length >= 3) {
      return NextResponse.json(
        { success: false, error: 'Daily reveal limit reached. Upgrade to unlock unlimited access.' },
        { status: 403 }
      );
    }

    // Log the reveal
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const success = await recordSignalReveal(userId, signalId, ip, userAgent);
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to record reveal log.' },
        { status: 500 }
      );
    }

    // Log analytics event
    if (revealed.length === 0) {
      await logEvent(userId, 'first_signal_opened', { signalId });
    } else {
      await logEvent(userId, 'signal_revealed', { signalId, count: revealed.length + 1 });
    }

    // Query prediction details to return
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .or(`match_id.eq.${signalId},id.eq.${signalId}`);

    if (error || !predictions) {
      return NextResponse.json({ success: true, details: null });
    }

    const formatted: Record<string, any> = {
      matchId: signalId,
      prediction: { home: 0, draw: 0, away: 0 },
      asianHandicap: { line: '', confidence: 0, odds: 0 },
      overUnder: { line: '', over: 0, under: 0, odds: 0 },
    };

    for (const pred of predictions) {
      const predObj = typeof pred.prediction === 'object' && pred.prediction ? (pred.prediction as any) : {};

      if (pred.market_type === 'ML') {
        const homeProb = predObj.pHome || predObj.home_prob || 0.4;
        const drawProb = predObj.pDraw || predObj.draw_prob || 0.25;
        const awayProb = predObj.pAway || predObj.away_prob || 0.35;

        formatted.prediction = {
          home: Math.round(homeProb * 100),
          draw: Math.round(drawProb * 100),
          away: Math.round(awayProb * 100),
          homeOdds: Number((1.1 / homeProb).toFixed(2)),
          drawOdds: Number((1.15 / drawProb).toFixed(2)),
          awayOdds: Number((1.1 / awayProb).toFixed(2))
        };
      } else if (pred.market_type === 'AH') {
        const line = predObj.ah_line !== undefined ? predObj.ah_line : -0.75;
        const lineStr = line > 0 ? `+${line}` : `${line}`;
        const ahProb = predObj.ah_prob ?? (predObj.pAhHome?.[String(line)] || 0.5);
        const ahOdds = predObj.ah_odds || 1.95;

        formatted.asianHandicap = {
          line: `${pred.home_team} ${lineStr}`,
          confidence: Math.round(ahProb * 100),
          odds: ahOdds,
          fairOdds: Number((1 / ahProb).toFixed(2)),
          edge: Number(((ahOdds * ahProb - 1) * 100).toFixed(1))
        };
      } else if (pred.market_type === 'OU') {
        const line = predObj.ou_line !== undefined ? predObj.ou_line : 2.5;
        const overProb = predObj.over_prob ?? (predObj.pOver?.[String(line)] || 0.5);
        const ouOdds = predObj.ou_odds || 1.91;

        formatted.overUnder = {
          line: `O/U ${line}`,
          over: Math.round(overProb * 100),
          under: Math.round((1 - overProb) * 100),
          odds: ouOdds,
          fairOdds: Number((1 / overProb).toFixed(2)),
          edge: Number(((ouOdds * overProb - 1) * 100).toFixed(1))
        };
      }
    }

    return NextResponse.json({
      success: true,
      details: formatted
    });
  } catch (error: any) {
    console.error('Reveal API Route Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
