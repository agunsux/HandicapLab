import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import crypto from 'crypto';
import { PPP_TIERS } from '@/lib/monetization/gating';
import { ProductService } from '@/lib/payments/productService';

export async function POST(req: Request) {
  try {
    const { product_type, ppp_tier, idempotency_key } = await req.json();

    // 1. Get current auth user
    const { data: { user } } = await supabase.auth.getUser();
    
    // Fallback user if not logged in (to support local sandbox test flow)
    const userId = user?.id || '00000000-0000-0000-0000-000000000000';

    // Validate product type and load from database
    if (product_type !== 'LIFETIME' && product_type !== 'CREDITS') {
      return NextResponse.json({ error: 'Invalid product type' }, { status: 400 });
    }

    const slug = product_type === 'LIFETIME' ? 'lifetime_pro' : 'credit_pack_10';
    const product = await ProductService.getProductBySlug(slug);
    if (!product) {
      return NextResponse.json({ error: 'Product not found in database' }, { status: 404 });
    }

    // Check founder slots availability if lifetime product is requested
    if (slug === 'lifetime_pro') {
      const { data: campaign } = await supabase
        .from('founder_campaigns')
        .select('*')
        .eq('active', true)
        .maybeSingle();

      if (campaign && campaign.claimed_slots >= campaign.max_slots) {
        return NextResponse.json({ error: 'Founder slots are full' }, { status: 400 });
      }
    }

    // Generate/Validate idempotency key (prevent duplicate fulfillment)
    const ikey = idempotency_key || `pt_chk_${crypto.randomUUID()}`;

    // 2. Check if a transaction with the same idempotency key already exists
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('*')
      .eq('idempotency_key', ikey)
      .maybeSingle();

    if (existingTx) {
      console.log(`[Checkout] Duplicate request intercepted for idempotency_key: ${ikey}`);
      return NextResponse.json({ 
        url: `/checkout/mock-success?session_id=${existingTx.gateway_session_id}`, 
        gateway_session_id: existingTx.gateway_session_id 
      });
    }

    // 3. Resolve localized pricing based on PPP Tiers
    const config = PPP_TIERS[ppp_tier] || PPP_TIERS.TIER_1;
    const priceStr = product_type === 'LIFETIME' ? config.founderPrice : config.creditsPrice;
    
    // Strip dollar signs to get numeric value
    const amount = Number(priceStr.replace(/[^0-9.]/g, ''));

    const mockSessionId = `cs_${crypto.randomUUID().replace(/-/g, '')}`;

    // 4. Log transaction intent to database
    const { data: newTx, error: txErr } = await supabase
      .from('transactions')
      .insert({
        user_id: userId === '00000000-0000-0000-0000-000000000000' ? null : userId,
        product_id: product.id,
        amount: amount,
        currency: 'USD',
        provider: 'STRIPE',
        amount_usd: amount,
        ppp_tier: ppp_tier || 'TIER_1',
        payment_gateway: 'STRIPE',
        gateway_session_id: mockSessionId,
        status: 'PENDING',
        idempotency_key: ikey
      })
      .select('*')
      .maybeSingle();

    if (txErr || !newTx) {
      console.error('[Checkout] Failed to log transaction:', txErr);
      return NextResponse.json({ error: 'Failed to record transaction' }, { status: 500 });
    }

    // 5. Audit logs for state updates
    await supabase.from('payment_status_history').insert({
      transaction_id: newTx.id,
      from_status: 'NONE',
      to_status: 'PENDING'
    });

    // 6. Log checkout attempt event for observability
    await supabase.from('paywall_events').insert({
      user_id: userId === '00000000-0000-0000-0000-000000000000' ? null : userId,
      event_type: 'CHECKOUT_ATTEMPT',
      product_type: product_type,
      ppp_tier: ppp_tier || 'TIER_1',
      amount_usd: amount
    });

    // Return redirect success URL
    const successUrl = `/checkout/mock-success?session_id=${mockSessionId}&transaction_id=${newTx.id}`;

    return NextResponse.json({ url: successUrl, gateway_session_id: mockSessionId });
  } catch (err: any) {
    console.error('[Checkout API Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

