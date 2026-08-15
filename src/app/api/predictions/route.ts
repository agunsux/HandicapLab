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

    // 3. Query ensembled predictions from the canonical ledger
    const { data: predictions, error: predsError } = await supabase
      .from('prediction_ledger_v3')
      .select('*, matches(home_team, away_team, league, tournament_stage)')
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
      const matchId = pred.match_id;
      const homeTeam = pred.matches?.home_team || pred.home_team || 'Home';
      const awayTeam = pred.matches?.away_team || pred.away_team || 'Away';
      const matchKey = `${homeTeam} vs ${awayTeam}`;
      const cohortTag = getCohortTag(pred.matches?.league || 39, pred.matches?.tournament_stage);
      
      if (!grouped[matchKey]) {
        grouped[matchKey] = {
          matchId,
          match: matchKey,
          kickoff: pred.prediction_timestamp,
          league: cohortTag || 'EPL',
          prediction: { home: null, draw: null, away: null },
          asianHandicap: { line: 'N/A', confidence: null, odds: 0.0, fairOdds: null, edge: 0.0 },
          overUnder: { line: 'N/A', over: null, under: null, odds: 0.0, fairOdds: null, edge: 0.0 },
          confidence: '⚪ Low',
          isLocked: false
        };
      }

      // Check if this match is locked for FREE user
      const isMatchLocked = !entitlements.hasFullEdgeData && !revealedMatches.includes(matchId);
      grouped[matchKey].isLocked = isMatchLocked;

      if (pred.market_type === 'ML') {
        const p = pred.calibrated_probability || 0;
        const probs = pred.probabilities || {};
        const homeP = probs.home !== undefined ? probs.home : (pred.selection === 'home' ? p : null);
        const drawP = probs.draw !== undefined ? probs.draw : (pred.selection === 'draw' ? p : null);
        const awayP = probs.away !== undefined ? probs.away : (pred.selection === 'away' ? p : null);

        const finalConf = pred.explainability_json?.modelInfo?.confidenceScore || 50;
        grouped[matchKey].confidence = finalConf >= 75 ? '🟢 High' : finalConf >= 60 ? '🟡 Medium' : '⚪ Low';

        grouped[matchKey].prediction = {
          home: isMatchLocked ? null : (homeP !== null ? Math.round(homeP * 100) : null),
          draw: isMatchLocked ? null : (drawP !== null ? Math.round(drawP * 100) : null),
          away: isMatchLocked ? null : (awayP !== null ? Math.round(awayP * 100) : null),
          homeOdds: pred.selection === 'home' ? (pred.market_odds || 0) : 0,
          drawOdds: pred.selection === 'draw' ? (pred.market_odds || 0) : 0,
          awayOdds: pred.selection === 'away' ? (pred.market_odds || 0) : 0,
        };
      } else if (pred.market_type === 'AH') {
        const lineStr = pred.line !== undefined && pred.line !== null ? (pred.line > 0 ? `+${pred.line}` : `${pred.line}`) : '';
        const ahProb = pred.calibrated_probability || 0;
        const ahOdds = pred.market_odds || 0;

        grouped[matchKey].asianHandicap = {
          line: lineStr ? `${homeTeam} ${lineStr}` : 'AH',
          confidence: isMatchLocked ? null : (ahProb > 0 ? Math.round(ahProb * 100) : null),
          odds: ahOdds,
          fairOdds: isMatchLocked ? null : (ahProb > 0 ? Number((1 / ahProb).toFixed(2)) : null),
          edge: isMatchLocked ? null : (ahOdds > 0 && ahProb > 0 ? Number(((ahOdds * ahProb - 1) * 100).toFixed(1)) : null)
        };
      } else if (pred.market_type === 'OU') {
        const line = pred.line !== undefined && pred.line !== null ? pred.line : 2.5;
        const overProb = pred.calibrated_probability || 0;
        const ouOdds = pred.market_odds || 0;

        grouped[matchKey].overUnder = {
          line: `O/U ${line}`,
          over: isMatchLocked ? null : (overProb > 0 ? Math.round(overProb * 100) : null),
          under: isMatchLocked ? null : (overProb > 0 ? Math.round((1 - overProb) * 100) : null),
          odds: ouOdds,
          fairOdds: isMatchLocked ? null : (overProb > 0 ? Number((1 / overProb).toFixed(2)) : null),
          edge: isMatchLocked ? null : (ouOdds > 0 && overProb > 0 ? Number(((ouOdds * overProb - 1) * 100).toFixed(1)) : null)
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
