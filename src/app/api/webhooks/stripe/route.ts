import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    const eventId = payload.id;
    const eventType = payload.type;
    const sessionId = payload.data?.object?.id || '';
    const transactionId = payload.data?.object?.metadata?.transaction_id || '';

    if (!eventId || !eventType) {
      return NextResponse.json({ error: 'Missing webhook event metadata' }, { status: 400 });
    }

    console.log(`[Stripe Webhook] Received event ${eventId} of type ${eventType}`);

    // 1. Log webhook event and check idempotency (event_id unique constraint)
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      console.log(`[Stripe Webhook] Duplicate webhook event intercepted: ${eventId}`);
      return NextResponse.json({ success: true, duplicated: true });
    }

    const { data: loggedEvent, error: logErr } = await supabase
      .from('webhook_events')
      .insert({
        gateway: 'STRIPE',
        event_id: eventId,
        payload: payload,
        processed: false
      })
      .select('*')
      .maybeSingle();

    if (logErr || !loggedEvent) {
      console.error('[Stripe Webhook] Failed to log webhook event:', logErr);
      return NextResponse.json({ error: 'Failed to record event log' }, { status: 500 });
    }

    // 2. Fulfill entitlement only on checkout.session.completed
    if (eventType === 'checkout.session.completed') {
      // Find transaction
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('gateway_session_id', sessionId)
        .maybeSingle();

      if (txError || !tx) {
        console.error(`[Stripe Webhook] Transaction not found for session: ${sessionId}`);
        return NextResponse.json({ error: 'Transaction matching session not found' }, { status: 404 });
      }

      if (tx.status !== 'SUCCESS') {
        // Update transaction status to SUCCESS
        await supabase
          .from('transactions')
          .update({ status: 'SUCCESS' })
          .eq('id', tx.id);

        // Update payment status history
        await supabase.from('payment_status_history').insert({
          transaction_id: tx.id,
          from_status: tx.status,
          to_status: 'SUCCESS'
        });

        const userId = tx.user_id || '00000000-0000-0000-0000-000000000000';
        const isLifetime = tx.amount_usd >= 9.0;

        let entitlementId = '';
        let beforeVal = 0;
        let afterVal = 0;
        let accessType = '';

        if (isLifetime) {
          accessType = 'LIFETIME_PRO';
          const { data: existingEnt } = await supabase
            .from('user_entitlements')
            .select('*')
            .eq('user_id', userId)
            .eq('access_type', 'LIFETIME_PRO')
            .maybeSingle();

          if (!existingEnt) {
            const { data: newEnt } = await supabase
              .from('user_entitlements')
              .insert({
                user_id: userId,
                access_type: 'LIFETIME_PRO',
                is_active: true
              })
              .select('*')
              .single();
            entitlementId = newEnt?.id || '';
          } else {
            entitlementId = existingEnt.id;
          }
        } else {
          accessType = 'CREDITS';
          const { data: existingCredits } = await supabase
            .from('user_entitlements')
            .select('*')
            .eq('user_id', userId)
            .eq('access_type', 'CREDITS')
            .maybeSingle();

          if (existingCredits) {
            beforeVal = existingCredits.credits_balance || 0;
            afterVal = beforeVal + 10;
            entitlementId = existingCredits.id;

            await supabase
              .from('user_entitlements')
              .update({ credits_balance: afterVal })
              .eq('id', existingCredits.id);
          } else {
            beforeVal = 0;
            afterVal = 10;
            
            const { data: newCredits } = await supabase
              .from('user_entitlements')
              .insert({
                user_id: userId,
                access_type: 'CREDITS',
                credits_balance: 10,
                is_active: true
              })
              .select('*')
              .single();
            entitlementId = newCredits?.id || '';
          }
        }

        // 3. Log entitlement audit trail (observability requirement)
        await supabase.from('entitlement_audit_log').insert({
          user_id: userId,
          entitlement_id: entitlementId || null,
          action: 'GRANTED',
          access_type: accessType,
          credits_balance_before: isLifetime ? null : beforeVal,
          credits_balance_after: isLifetime ? null : afterVal,
          reason: `Stripe webhook checkout completed for session: ${sessionId}`
        });

        console.log(`[Stripe Webhook] Entitlements successfully granted to user: ${userId}`);
      }
    }

    // 4. Mark webhook event as processed
    await supabase
      .from('webhook_events')
      .update({ processed: true })
      .eq('id', loggedEvent.id);

    return NextResponse.json({ success: true, processed: true });
  } catch (err: any) {
    console.error('[Stripe Webhook API Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
