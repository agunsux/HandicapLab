import { supabase } from '../../supabase.server';

export async function revokeEntitlement(
  userId: string,
  productId: string,
  reason: string
): Promise<void> {
  const { data: entitlements, error } = await supabase
    .from('user_entitlements')
    .select('*')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .eq('status', 'ACTIVE');

  if (error || !entitlements || entitlements.length === 0) return;

  for (const ent of entitlements) {
    await supabase
      .from('user_entitlements')
      .update({
        status: 'REVOKED',
        is_active: false // legacy compatibility
      })
      .eq('id', ent.id);

    // Log to entitlement audit log for tracing
    await supabase.from('entitlement_audit_log').insert({
      user_id: userId,
      entitlement_id: ent.id,
      action: 'REVOKED',
      access_type: ent.access_type,
      reason: reason
    });
  }
}
