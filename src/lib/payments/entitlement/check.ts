import { supabase } from '../../supabase.server';

export async function checkActiveEntitlement(
  userId: string,
  accessType: 'LIFETIME_PRO' | 'CREDITS' | 'TOURNAMENT_PASS'
): Promise<boolean> {
  const { data: entitlements, error } = await supabase
    .from('user_entitlements')
    .select('*')
    .eq('user_id', userId)
    .eq('access_type', accessType)
    .eq('status', 'ACTIVE');

  if (error || !entitlements || entitlements.length === 0) return false;

  const now = new Date();
  const activeEnt = entitlements.find(ent => {
    return !ent.expires_at || new Date(ent.expires_at) > now;
  });

  return !!activeEnt;
}
