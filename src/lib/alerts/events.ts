import { supabase } from '@/lib/supabase.server';

export async function createSignalEvent(
  signalId: string,
  eventType: 'NEW_SIGNAL' | 'ODDS_MOVEMENT' | 'EDGE_CHANGED' | 'CONFIDENCE_CHANGED' | 'SIGNAL_CLOSED',
  metadata: any = {}
) {
  try {
    const { data, error } = await supabase
      .from('signal_events')
      .insert({
        signal_id: signalId,
        event_type: eventType,
        metadata,
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error(`[SignalEvent] Failed to save ${eventType} event for signal ${signalId}:`, error);
    }
    return data;
  } catch (err) {
    console.error(`[SignalEvent] Exception saving event:`, err);
    return null;
  }
}
