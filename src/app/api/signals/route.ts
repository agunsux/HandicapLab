import { supabase } from '@/lib/supabase.server';
import { getUserEntitlements } from '@/lib/pricing/entitlement';
import { isRateLimited } from '@/lib/pricing/rate-limit';
import { hashString } from '@/lib/pricing/access-logs';
import { ApiHelper } from '@/lib/utils/apiHelper';
import { z } from 'zod';

const signalsQuerySchema = z.object({
  market: z.enum(['moneyline', 'asian_handicap', 'over_under']).optional(),
  minEdge: z.preprocess((val) => val ? parseFloat(val as string) : undefined, z.number().min(0).max(100)).optional(),
  limit: z.preprocess((val) => val ? parseInt(val as string, 10) : undefined, z.number().min(1).max(100)).default(50),
  page: z.preprocess((val) => val ? parseInt(val as string, 10) : undefined, z.number().min(1).max(1000)).default(1),
});

/**
 * GET handler for retrieving intelligence signals.
 * Supports filters:
 * - ?market=moneyline|asian_handicap|over_under
 * - ?minEdge=5.0 (percentage edge e.g. 5%)
 * - ?limit=20
 * - ?page=1
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validated = signalsQuerySchema.safeParse(queryParams);

    if (!validated.success) {
      return ApiHelper.response(
        false,
        null,
        'Invalid query parameters',
        422,
        validated.error.flatten().fieldErrors
      );
    }

    const { market, minEdge, limit, page } = validated.data;
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
    if (!entitlements.hasApiAccess) {
      return ApiHelper.response(
        false,
        null,
        'Forbidden. API access is restricted to the QUANT subscription tier.',
        403
      );
    }

    // Rate Limiting
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

    let query = supabase
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 1. Filter by market
    if (market) {
      query = query.eq('market', market);
    }

    // 2. Filter by minimum edge percentage
    if (minEdge !== undefined) {
      query = query.gte('edge_pct', minEdge);
    }

    const { data: signals, error } = await query;

    if (error) {
      console.error('Database query error in Signals API:', error);
      return ApiHelper.response(
        false,
        null,
        error.message,
        500
      );
    }

    return ApiHelper.response(
      true,
      {
        count: signals?.length || 0,
        signals: signals || []
      },
      null,
      200,
      undefined,
      { spread: true }
    );
  } catch (error: any) {
    console.error('Signals API Error:', error);
    return ApiHelper.response(
      false,
      null,
      error.message || 'Internal Server Error',
      500
    );
  }
}
