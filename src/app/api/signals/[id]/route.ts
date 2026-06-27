import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '../../../../lib/supabase.server';
import { determineUserAccess, maskSignalData } from '../../../../lib/signals/visibility';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ success: false, error: 'Invalid UUID format' }, { status: 400 });
    }

    const userId = request.headers.get('x-user-id') || undefined;

    // Determine user access policy
    const { isPremium } = await determineUserAccess(userId);

    // Fetch signal from database
    const { data: signal, error } = await supabase
      .from('signals')
      .select('*, signal_metrics(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`[Detail API] Database error for signal ${id}:`, error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!signal) {
      return NextResponse.json({ success: false, error: 'Signal not found' }, { status: 404 });
    }

    // Trace correlation ID
    const activeCorrId = signal.correlation_id || crypto.randomUUID();

    // Log SIGNAL_VIEWED audit event safely
    try {
      await supabase
        .from('signal_audit_events')
        .insert({
          signal_id: id,
          event_type: 'SIGNAL_VIEWED',
          source: 'system',
          correlation_id: activeCorrId,
          payload: { user_id: userId || 'anonymous' }
        });
    } catch (auditErr) {
      console.error(`[Detail API] Failed to write SIGNAL_VIEWED event for ${id}:`, auditErr);
    }

    // Log SIGNAL_UNLOCKED audit event if the caller is premium
    if (isPremium) {
      try {
        await supabase
          .from('signal_audit_events')
          .insert({
            signal_id: id,
            event_type: 'SIGNAL_UNLOCKED',
            source: 'system',
            correlation_id: activeCorrId,
            payload: { user_id: userId }
          });
      } catch (auditErr) {
        console.error(`[Detail API] Failed to write SIGNAL_UNLOCKED event for ${id}:`, auditErr);
      }
    }

    const metricsObj = Array.isArray(signal.signal_metrics) ? signal.signal_metrics[0] : signal.signal_metrics;

    // Build the normalized response structure
    const rawData = {
      id: signal.id,
      match: {
        home_team: signal.home_team,
        away_team: signal.away_team,
        league: signal.league,
        kickoff_time: signal.kickoff_utc
      },
      prediction: {
        market: signal.market,
        selection: signal.selection,
        odds: Number(signal.odds || 1.00),
        edge: Number(signal.edge_pct || 0.0),
        confidence: Number(signal.confidence || 0.5),
        model_version: signal.model_version || 'rule_v1'
      },
      market_movement: {
        opening_odds: Number(signal.opening_odds || signal.odds || 1.00),
        current_odds: Number(signal.closing_odds || signal.odds || 1.00),
        clv: signal.clv_percentage !== null ? Number(signal.clv_percentage) : (signal.clv !== null ? Number(signal.clv) * 100 : null)
      },
      timeline: {
        created_at: signal.created_at,
        published_at: signal.published_at || signal.created_at,
        locked_at: signal.locked_at,
        settled_at: signal.settled_at
      },
      status: signal.status,
      metrics: {
        quality_score: metricsObj?.quality_score || 75,
        sharp_score: metricsObj?.sharp_score || 100,
        clv_score: metricsObj?.clv_score || 50,
        liquidity_score: metricsObj?.liquidity_score || 70,
        confidence_score: metricsObj?.confidence_score || 80
      }
    };

    // Mask premium properties for free users
    const processedData = maskSignalData(rawData, isPremium);

    return NextResponse.json({
      success: true,
      is_premium: isPremium,
      data: processedData
    });
  } catch (error: any) {
    console.error('[Detail API] Fatal Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
