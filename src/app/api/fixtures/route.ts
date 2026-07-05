import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { ApiHelper } from '@/lib/utils/apiHelper';
import { getUserEntitlements } from '@/lib/pricing/entitlement';
import { isRateLimited } from '@/lib/pricing/rate-limit';
import { hashString } from '@/lib/pricing/access-logs';
import { z } from 'zod';

const fixturesQuerySchema = z.object({
  limit: z.preprocess((val) => val ? parseInt(val as string, 10) : undefined, z.number().min(1).max(100)).default(50),
  page: z.preprocess((val) => val ? parseInt(val as string, 10) : undefined, z.number().min(1).max(1000)).default(1),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validated = fixturesQuerySchema.safeParse(queryParams);

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

    const { data: matches, error } = await supabase
      .from('matches')
      .select('*')
      .in('status', ['upcoming', 'live'])
      .order('kickoff', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return ApiHelper.response(true, {
      count: matches?.length ?? 0,
      fixtures: matches ?? []
    });
  } catch (error: any) {
    console.error('[Fixtures API] Error:', error);
    return ApiHelper.response(false, null, error, 500);
  }
}
