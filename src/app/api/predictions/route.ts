import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { getUserEntitlements } from '@/lib/pricing/entitlement';
import { isRateLimited } from '@/lib/pricing/rate-limit';
import { getUserDailyReveals, hashString } from '@/lib/pricing/access-logs';
import { getCohortTag } from '@/lib/crons/cohortTag';
import { ApiHelper } from '@/lib/utils/apiHelper';
import { z } from 'zod';

const predictionsQuerySchema = z.object({
  limit: z.preprocess((val) => val ? parseInt(val as string, 10) : undefined, z.number().min(1).max(100)).default(60),
  page: z.preprocess((val) => val ? parseInt(val as string, 10) : undefined, z.number().min(1).max(1000)).default(1),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validated = predictionsQuerySchema.safeParse(queryParams);

    if (!validated.success) {
      return ApiHelper.response(
        false,
        null,
        'Invalid query parameters',
        422,
        validated.error.flatten().fieldErrors
      );
    }

    const { limit, page } = validated.data;
    const offset = (page - 1) * limit;

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

    // 1. Enforce distributed rate limiting
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const limitIdentifier = userId ? `user:${userId}` : `ip:${hashString(ip)}`;
    const rateLimitLimit = (entitlements.tier === 'free' || entitlements.tier === 'starter') ? 60 : 300;

    if (await isRateLimited(limitIdentifier, rateLimitLimit)) {
      return ApiHelper.response(
        false,
        null,
        'Rate limit exceeded. Try again in a minute.',
        429
      );
    }

    // 2. Fetch upcoming matches
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('*')
      .in('status', ['upcoming', 'live'])
      .order('kickoff', { ascending: true })
      .range(offset, offset + limit - 1);

    if (matchesError) {
      throw matchesError;
    }

    // 3. Query ensembled predictions from the database
    const { data: predictions, error: predsError } = await supabase
      .from('predictions')
      .select('*')
      .order('prediction_timestamp', { ascending: true })
      .range(offset, offset + limit - 1);

    if (predsError) {
      throw predsError;
    }

    // Resolve daily reveals for FREE tier users
    let revealedMatches: string[] = [];
    if (userId && !entitlements.hasFullEdgeData) {
      revealedMatches = await getUserDailyReveals(userId);
    }

    // Format response grouped by match to match original layout
    const grouped: Record<string, any> = {};

    // Initialize with upcoming matches first so they appear even if signals are not generated yet
    for (const match of matches || []) {
      const matchKey = `${match.home_team} vs ${match.away_team}`;
      const cohortTag = getCohortTag(match.league, match.tournament_stage);
      
      grouped[matchKey] = {
        matchId: match.id,
        match: matchKey,
        kickoff: match.kickoff,
        league: cohortTag || 'EPL',
        prediction: { home: null, draw: null, away: null },
        asianHandicap: { line: 'N/A', confidence: null, odds: 0.0, fairOdds: null, edge: 0.0 },
        overUnder: { line: 'N/A', over: null, under: null, odds: 0.0, fairOdds: null, edge: 0.0 },
        confidence: '⚪ Low',
        isLocked: false
      };
    }

    for (const pred of predictions || []) {
      const matchId = pred.match_id || pred.id; // Fallback to prediction ID if match_id is null
      const matchKey = `${pred.home_team} vs ${pred.away_team}`;
      if (!grouped[matchKey]) {
        grouped[matchKey] = {
          matchId,
          match: matchKey,
          kickoff: pred.prediction_timestamp,
          league: pred.cohort_tag || 'EPL',
          prediction: { home: null, draw: null, away: null },
          asianHandicap: { line: 'N/A', confidence: null, odds: 0.0, fairOdds: null, edge: 0.0 },
          overUnder: { line: 'N/A', over: null, under: null, odds: 0.0, fairOdds: null, edge: 0.0 },
          confidence: '⚪ Low',
          isLocked: false
        };
      }

      const predObj = typeof pred.prediction === 'object' && pred.prediction ? (pred.prediction as any) : {};

      // Check if this match is locked for FREE user
      const isMatchLocked = !entitlements.hasFullEdgeData && !revealedMatches.includes(matchId);
      grouped[matchKey].isLocked = isMatchLocked;

      if (pred.market_type === 'ML') {
        const homeProb = predObj.pHome || predObj.home_prob || 0.4;
        const drawProb = predObj.pDraw || predObj.draw_prob || 0.25;
        const awayProb = predObj.pAway || predObj.away_prob || 0.35;

        // Keep odds calculation public, but mask probability
        grouped[matchKey].prediction = {
          home: isMatchLocked ? null : Math.round(homeProb * 100),
          draw: isMatchLocked ? null : Math.round(drawProb * 100),
          away: isMatchLocked ? null : Math.round(awayProb * 100),
          homeOdds: Number((1.1 / homeProb).toFixed(2)),
          drawOdds: Number((1.15 / drawProb).toFixed(2)),
          awayOdds: Number((1.1 / awayProb).toFixed(2))
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
        const ahOdds = predObj.ah_odds || 1.95;

        grouped[matchKey].asianHandicap = {
          line: `${pred.home_team} ${lineStr}`,
          confidence: isMatchLocked ? null : Math.round(ahProb * 100),
          odds: ahOdds,
          fairOdds: isMatchLocked ? null : Number((1 / ahProb).toFixed(2)),
          edge: isMatchLocked ? null : Number(((ahOdds * ahProb - 1) * 100).toFixed(1))
        };
      } else if (pred.market_type === 'OU') {
        const line = predObj.ou_line !== undefined ? predObj.ou_line : 2.5;
        const overProb = predObj.over_prob ?? (predObj.pOver?.[String(line)] || 0.5);
        const ouOdds = predObj.ou_odds || 1.91;

        grouped[matchKey].overUnder = {
          line: `O/U ${line}`,
          over: isMatchLocked ? null : Math.round(overProb * 100),
          under: isMatchLocked ? null : Math.round((1 - overProb) * 100),
          odds: ouOdds,
          fairOdds: isMatchLocked ? null : Number((1 / overProb).toFixed(2)),
          edge: isMatchLocked ? null : Number(((ouOdds * overProb - 1) * 100).toFixed(1))
        };
      }
    }

    const response = Object.values(grouped);

    return ApiHelper.response(
      true,
      {
        predictions: response,
        revealedCount: revealedMatches.length,
        maxReveals: 3
      },
      null,
      200,
      undefined,
      { spread: true }
    );
  } catch (error: any) {
    console.error('Predictions API Route Error:', error);
    return ApiHelper.response(
      false,
      null,
      error.message || 'Internal Server Error',
      500
    );
  }
}
