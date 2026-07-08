// timeline API route
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

    let tier = 'free';
    if (userId) {
      const entitlements = await getUserEntitlements(userId);
      tier = entitlements.tier;
    }

    if (tier !== 'premium' && tier !== 'enterprise') {
      return ApiHelper.response(false, null, 'Access restricted to Premium or Enterprise subscribers.', 403);
    }

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const limitIdentifier = userId ? `user:${userId}` : `ip:${ip}`;
    const rateLimit = tier === 'enterprise' ? 1000 : 300;

    if (await isRateLimited(limitIdentifier, rateLimit)) {
      return ApiHelper.response(false, null, 'Rate limit exceeded.', 429);
    }

    const result = await FootballIntelligenceService.getMatchTimeline('match-1001');
    if (!result) {
      return ApiHelper.response(false, null, 'Failed to fetch timeline.', 500);
    }

    return NextResponse.json({
      metadata: result.metadata,
      data: result.data
    });
  } catch (err: any) {
    return ApiHelper.response(false, null, err.message, 500);
  }
}
