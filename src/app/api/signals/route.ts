import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { getUserEntitlements } from '@/lib/pricing/entitlement';

/**
 * GET handler for retrieving intelligence signals.
 * Supports filters:
 * - ?market=moneyline|asian_handicap|over_under
 * - ?minEdge=5.0 (percentage edge e.g. 5%)
 * - ?limit=20
 */
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
    if (!entitlements.hasApiAccess) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden. API access is restricted to the QUANT subscription tier.'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market');
    const minEdge = searchParams.get('minEdge');
    const limit = searchParams.get('limit');

    let query = supabase
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false });

    // 1. Filter by market
    if (market) {
      query = query.eq('market', market);
    }

    // 2. Filter by minimum edge percentage
    if (minEdge) {
      const edgeVal = parseFloat(minEdge);
      if (!isNaN(edgeVal)) {
        query = query.gte('edge_pct', edgeVal);
      }
    }

    // 3. Apply limits (default 50)
    const limitVal = limit ? parseInt(limit, 10) : 50;
    if (!isNaN(limitVal)) {
      query = query.limit(limitVal);
    }

    const { data: signals, error } = await query;

    if (error) {
      console.error('Database query error in Signals API:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: signals?.length || 0,
      signals: signals || []
    });
  } catch (error: any) {
    console.error('Signals API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
