import { supabase } from '../supabase.server';

export async function runOddsSnapshotCron(): Promise<any> {
  // Fetch upcoming matches to record odds snapshots for
  const { data: matches, error: fetchErr } = await supabase
    .from('matches')
    .select('id, home_team, away_team, kickoff')
    .eq('status', 'upcoming');

  if (fetchErr) {
    throw new Error(`Failed to fetch matches for odds snapshot: ${fetchErr.message}`);
  }

  if (!matches || matches.length === 0) {
    return { success: true, message: 'No upcoming matches to snapshot' };
  }

  let count = 0;
  const timestamp = new Date().toISOString();

  for (const match of matches) {
    // NO REAL ODDS implementation yet in this cron -> FAIL CLOSED
    // Do not create synthetic odds.
    // In a full implementation, we would query fetchSharpOdds(sportKey) here.
    console.warn(`[OddsSnapshot] No real odds provider connected for match ${match.id}. Failing closed.`);
    // We do NOT insert Math.random() into odds_history.
  }

  return { success: true, snapshotsStored: count };
}
