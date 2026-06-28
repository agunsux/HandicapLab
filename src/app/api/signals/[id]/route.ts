import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '../../../../lib/supabase.server';
import { determineUserAccess, maskSignalData } from '../../../../lib/signals/visibility';
import { calculateKelly } from '@/lib/engine/kelly';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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

    // Fetch non-sensitive audit events to display in the lifecycle visual timeline
    const { data: auditEvents } = await supabase
      .from('signal_audit_events')
      .select('event_type, created_at')
      .eq('signal_id', id)
      .order('created_at', { ascending: true });

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
        model_version: signal.model_version || 'rule_v1',
        probability: signal.probability ? Number(signal.probability) : null,
        recommended_stake: (() => {
          const maxStakePct = 5.0;
          const settledSignalCount = 250;
          const kellyRes = calculateKelly(
            Number(signal.odds || 1.0),
            Number(signal.probability || 0.5),
            maxStakePct,
            settledSignalCount
          );
          return kellyRes.stakeFraction;
        })(),
        explanation: `Model detected edge on ${signal.selection} for market ${signal.market} with Dixon-Coles parameters.`,
        general_explanation: `Standard Poisson-distributed team strength evaluation indicators.`
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
      audit_events: (auditEvents || []).map(ev => ({
        event_type: ev.event_type,
        created_at: ev.created_at
      })),
      status: (() => {
        const rawKickoff = signal.kickoff_utc || signal.kickoff_time || signal.created_at;
        const parseKickoff = rawKickoff ? new Date(rawKickoff) : new Date();
        const kickoffTime = isNaN(parseKickoff.getTime()) ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) : parseKickoff;

        const rawLastOdds = signal.last_odds_update || signal.updated_at || signal.created_at;
        const parseLastOdds = rawLastOdds ? new Date(rawLastOdds) : new Date();
        const lastOddsUpdate = isNaN(parseLastOdds.getTime()) ? new Date() : parseLastOdds;

        const now = new Date();
        const isKickoffPassed = now.getTime() >= kickoffTime.getTime();

        const oddsAgeMinutes = signal.odds_age_minutes !== undefined && signal.odds_age_minutes !== null
          ? signal.odds_age_minutes
          : Math.max(0, Math.floor((now.getTime() - lastOddsUpdate.getTime()) / (1000 * 60)));

        const isOddsStale = oddsAgeMinutes > 60;

        if ((signal.kickoff_utc || signal.kickoff_time) && ['PENDING', 'ACTIVE', 'OPEN', 'LOCKED', 'LIVE', 'STALE', 'pending', 'active', 'open', 'locked', 'live', 'stale'].includes(signal.status)) {
          if (isKickoffPassed) return 'CLOSED';
          if (isOddsStale) return 'STALE';
          return 'ACTIVE';
        }
        return signal.status;
      })(),
      last_odds_update: (() => {
        const rawLastOdds = signal.last_odds_update || signal.updated_at || signal.created_at;
        const parseLastOdds = rawLastOdds ? new Date(rawLastOdds) : new Date();
        const lastOddsUpdate = isNaN(parseLastOdds.getTime()) ? new Date() : parseLastOdds;
        return lastOddsUpdate.toISOString();
      })(),
      odds_age_minutes: (() => {
        const rawLastOdds = signal.last_odds_update || signal.updated_at || signal.created_at;
        const parseLastOdds = rawLastOdds ? new Date(rawLastOdds) : new Date();
        const lastOddsUpdate = isNaN(parseLastOdds.getTime()) ? new Date() : parseLastOdds;
        const now = new Date();
        return signal.odds_age_minutes !== undefined && signal.odds_age_minutes !== null
          ? signal.odds_age_minutes
          : Math.max(0, Math.floor((now.getTime() - lastOddsUpdate.getTime()) / (1000 * 60)));
      })(),
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
