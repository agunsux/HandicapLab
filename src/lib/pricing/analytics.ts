import { supabase } from '../supabase.server';

/**
 * Logs a custom event to the database for tracking conversion funnels.
 */
export async function logEvent(
  userId: string | null,
  eventName: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    const { error } = await supabase
      .from('events')
      .insert({
        user_id: userId || null,
        event_name: eventName,
        metadata
      });

    if (error) {
      console.error('[Analytics] Failed to insert event:', error);
    }
  } catch (err) {
    console.error('[Analytics] Exception logging event:', err);
  }
}
