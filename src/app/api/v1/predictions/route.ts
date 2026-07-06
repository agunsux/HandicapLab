// predictions API route
// Location: src/app/api/v1/predictions/route.ts

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { getUserEntitlements } from '@/lib/pricing/entitlement';
import { isRateLimited } from '@/lib/pricing/rate-limit';
import { ApiHelper } from '@/lib/utils/apiHelper';
import { FootballIntelligenceService } from '@/services/football-intelligence.service';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    let userId: string | undefined;

    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    // Auth token premium bypass for testing
    let tier = 'free';
    if (token === 'mock-premium-token') {
      tier = 'premium';
    } else if (userId) {
      const entitlements = await getUserEntitlements(userId);
      tier = entitlements.tier;
    }

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const limitIdentifier = userId ? `user:${userId}` : `ip:${ip}`;
    const rateLimit = tier === 'enterprise' ? 1000 : tier === 'premium' ? 300 : 60;

    if (await isRateLimited(limitIdentifier, rateLimit)) {
      return ApiHelper.response(false, null, 'Rate limit exceeded.', 429);
    }

    // Call service layer for a sample match
    const result = await FootballIntelligenceService.getMatchIntelligence('match-1001');
    if (!result) {
      return ApiHelper.response(false, null, 'Failed to fetch predictions.', 500);
    }

    // Format output specifically for predictions
    const predictionsData = result.data.map(r => ({
      match_id: r.match_id,
      market: r.market,
      probability: r.probability,
      calibrated_probability: r.calibrated_probability,
      fair_odds: r.fair_odds,
      generated_at: result.metadata.generated_at
    }));

    return NextResponse.json({
      metadata: result.metadata,
      data: predictionsData
    });
  } catch (err: any) {
    return ApiHelper.response(false, null, err.message, 500);
  }
}
