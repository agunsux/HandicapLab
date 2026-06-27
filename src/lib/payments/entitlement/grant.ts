import { supabase } from '../../supabase.server';
import { ProductService } from '../productService';

export async function grantEntitlement(
  userId: string,
  productId: string,
  transactionId: string
): Promise<void> {
  const product = await ProductService.getProductById(productId);
  if (!product) {
    throw new Error(`Product not found for ID: ${productId}`);
  }

  console.log(`[Entitlement] Granting entitlement to user ${userId} for product ${product.slug}`);

  let entitlementId = '';
  let beforeVal: number | null = null;
  let afterVal: number | null = null;
  let accessType = '';

  if (product.slug === 'lifetime_pro') {
    accessType = 'LIFETIME_PRO';
    // Check if user already has an active lifetime entitlement
    const { data: existing } = await supabase
      .from('user_entitlements')
      .select('*')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (existing) {
      entitlementId = existing.id;
    } else {
      const { data: newEnt, error } = await supabase
        .from('user_entitlements')
        .insert({
          user_id: userId,
          product_id: productId,
          access_type: accessType,
          status: 'ACTIVE',
          is_active: true, // legacy compatibility
          source_transaction_id: transactionId,
          granted_at: new Date().toISOString(),
          expires_at: null
        })
        .select('*')
        .single();

      if (error) throw error;
      entitlementId = newEnt.id;
    }
  } else if (product.slug === 'credit_pack_10') {
    accessType = 'CREDITS';
    // Find active credits entitlement
    const { data: existing } = await supabase
      .from('user_entitlements')
      .select('*')
      .eq('user_id', userId)
      .eq('access_type', 'CREDITS')
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (existing) {
      beforeVal = existing.credits_balance || 0;
      afterVal = (beforeVal || 0) + 10;
      entitlementId = existing.id;

      const { error } = await supabase
        .from('user_entitlements')
        .update({
          credits_balance: afterVal,
          source_transaction_id: transactionId,
          is_active: true // legacy compatibility
        })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      beforeVal = 0;
      afterVal = 10;

      const { data: newEnt, error } = await supabase
        .from('user_entitlements')
        .insert({
          user_id: userId,
          product_id: productId,
          access_type: accessType,
          status: 'ACTIVE',
          is_active: true, // legacy compatibility
          credits_balance: 10,
          source_transaction_id: transactionId,
          granted_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (error) throw error;
      entitlementId = newEnt.id;
    }
  } else if (product.slug === 'tournament_pass') {
    accessType = 'TOURNAMENT_PASS';
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days default
    const { data: newEnt, error } = await supabase
      .from('user_entitlements')
      .insert({
        user_id: userId,
        product_id: productId,
        access_type: accessType,
        status: 'ACTIVE',
        is_active: true, // legacy compatibility
        source_transaction_id: transactionId,
        granted_at: new Date().toISOString(),
        expires_at: expiresAt
      })
      .select('*')
      .single();

    if (error) throw error;
    entitlementId = newEnt.id;
  } else {
    throw new Error(`Unsupported product slug: ${product.slug}`);
  }

  // Log to entitlement audit log for compliance & observability
  await supabase.from('entitlement_audit_log').insert({
    user_id: userId,
    entitlement_id: entitlementId || null,
    action: 'GRANTED',
    access_type: accessType,
    credits_balance_before: beforeVal,
    credits_balance_after: afterVal,
    reason: `Payment success for product ${product.slug} via transaction ${transactionId}`
  });
}
