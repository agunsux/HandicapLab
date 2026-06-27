import { supabase } from '../../supabase.server';
import { NormalizedPaymentEvent } from './types';
import { grantEntitlement } from '../entitlement/grant';

export async function checkIdempotency(eventId: string, provider: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('webhook_events')
    .select('status')
    .eq('event_id', eventId)
    .eq('provider', provider)
    .maybeSingle();

  if (error) {
    console.error('[Payments IDEMPOTENCY] Error checking idempotency:', error);
    return false;
  }
  return data?.status === 'PROCESSED';
}

export async function logPaymentEvent(
  event: NormalizedPaymentEvent,
  status: 'PENDING' | 'PROCESSED' | 'FAILED'
): Promise<string> {
  const { data: existing } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('event_id', event.event_id)
    .eq('provider', event.provider)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('webhook_events')
      .update({
        status: status,
        transaction_id: event.transaction_id || null,
        processed_at: status === 'PROCESSED' ? new Date().toISOString() : null,
        payload: event.payload
      })
      .eq('id', existing.id);
    return existing.id;
  }

  const { data, error } = await supabase
    .from('webhook_events')
    .insert({
      gateway: event.provider.toUpperCase(),
      provider: event.provider,
      event_id: event.event_id,
      payload: event.payload,
      processed: status === 'PROCESSED',
      status: status,
      transaction_id: event.transaction_id || null,
      processed_at: status === 'PROCESSED' ? new Date().toISOString() : null
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Payments LogEvent] Error logging payment event:', error);
    throw error;
  }
  return data.id;
}

export async function markEventProcessed(eventId: string, provider: string, status: 'PROCESSED' | 'FAILED') {
  await supabase
    .from('webhook_events')
    .update({
      status: status,
      processed: status === 'PROCESSED',
      processed_at: new Date().toISOString()
    })
    .eq('event_id', eventId)
    .eq('provider', provider);
}

export async function paymentEventProcessor(event: NormalizedPaymentEvent): Promise<{ success: boolean; duplicated?: boolean }> {
  // 1. Check idempotency
  const isDuplicate = await checkIdempotency(event.event_id, event.provider);
  if (isDuplicate) {
    console.log(`[Payment Processor] Duplicate event skipped: ${event.event_id} for provider ${event.provider}`);
    return { success: true, duplicated: true };
  }

  // 2. Log event as PENDING
  await logPaymentEvent(event, 'PENDING');

  try {
    // 3. Process payment success
    if (event.event === 'payment.success') {
      let transactionId = event.transaction_id;
      let resolvedUserId = event.user_id;
      let resolvedProductId = event.product_id;

      // Try finding transaction in the database
      const { data: existingTx } = transactionId
        ? await supabase
            .from('transactions')
            .select('*')
            .eq('id', transactionId)
            .maybeSingle()
        : { data: null };

      if (existingTx) {
        resolvedUserId = existingTx.user_id || resolvedUserId;
        resolvedProductId = existingTx.product_id || resolvedProductId;

        // Update transaction status
        await supabase
          .from('transactions')
          .update({
            status: 'SUCCESS',
            provider: event.provider,
            provider_transaction_id: event.provider_transaction_id,
            amount: event.amount,
            currency: event.currency,
            updated_at: new Date().toISOString()
          })
          .eq('id', transactionId);

        // Update status history
        await supabase.from('payment_status_history').insert({
          transaction_id: transactionId,
          from_status: existingTx.status,
          to_status: 'SUCCESS'
        });
      } else {
        // Create new transaction if not exists (e.g. direct webhook without checkout pre-log)
        const { data: newTx, error: txError } = await supabase
          .from('transactions')
          .insert({
            user_id: resolvedUserId || null,
            product_id: resolvedProductId || null,
            provider: event.provider,
            provider_transaction_id: event.provider_transaction_id,
            amount: event.amount,
            currency: event.currency,
            status: 'SUCCESS',
            amount_usd: event.amount,
            payment_gateway: event.provider.toUpperCase(),
            ppp_tier: 'TIER_1'
          })
          .select('*')
          .single();

        if (txError) throw txError;
        transactionId = newTx.id;
      }

      if (!resolvedUserId) {
        throw new Error(`Missing user_id for payment event ${event.event_id}`);
      }
      if (!resolvedProductId) {
        throw new Error(`Missing product_id for payment event ${event.event_id}`);
      }

      // 4. Validate product type and claim campaign slot if lifetime_pro
      const { data: product } = await supabase
        .from('products')
        .select('slug')
        .eq('id', resolvedProductId)
        .maybeSingle();

      if (product?.slug === 'lifetime_pro') {
        const { data: campaign } = await supabase
          .from('founder_campaigns')
          .select('*')
          .eq('active', true)
          .maybeSingle();

        if (campaign) {
          if (campaign.claimed_slots >= campaign.max_slots) {
            throw new Error('Founder campaign slots are full');
          }
          await supabase.rpc('claim_founder_slot', {
            p_user_id: resolvedUserId,
            p_campaign_id: campaign.id
          });
        }
      }

      // 5. Grant entitlement
      await grantEntitlement(resolvedUserId, resolvedProductId, transactionId);
    }

    // 6. Mark event as PROCESSED
    await markEventProcessed(event.event_id, event.provider, 'PROCESSED');
    return { success: true };
  } catch (err) {
    console.error(`[Payment Processor] Failed to process event ${event.event_id}:`, err);
    await markEventProcessed(event.event_id, event.provider, 'FAILED');
    throw err;
  }
}
