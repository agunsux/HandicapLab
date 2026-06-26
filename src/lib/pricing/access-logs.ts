import { supabase } from '../supabase.server';
import crypto from 'crypto';

/**
 * Hashes a string using SHA256 and the server secret salt.
 */
export function hashString(value: string): string {
  const salt = process.env.ACCESS_LOG_HASH_SECRET || 'fallback-secret-salt-key';
  return crypto.createHash('sha256').update(value + salt).digest('hex');
}

/**
 * Retrieves the signal IDs revealed by the user today.
 */
export async function getUserDailyReveals(userId: string): Promise<string[]> {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  try {
    const { data, error } = await supabase
      .from('signal_access_logs')
      .select('signal_id')
      .eq('user_id', userId)
      .eq('access_type', 'full')
      .gte('created_at', startOfToday.toISOString());

    if (!error && data) {
      return data.map((item) => item.signal_id);
    }
  } catch (err) {
    console.error('[AccessLogs] Failed to fetch user daily reveals:', err);
  }

  return [];
}

/**
 * Records a signal reveal for the user.
 */
export async function recordSignalReveal(
  userId: string,
  signalId: string,
  ip: string,
  userAgent: string
): Promise<boolean> {
  const ipHash = hashString(ip);
  const uaHash = hashString(userAgent);

  try {
    const { error } = await supabase
      .from('signal_access_logs')
      .insert({
        user_id: userId,
        signal_id: signalId,
        access_type: 'full',
        ip_hash: ipHash,
        user_agent_hash: uaHash
      });

    if (error) {
      console.error('[AccessLogs] Error saving reveal log:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[AccessLogs] Exception in recordSignalReveal:', err);
    return false;
  }
}
