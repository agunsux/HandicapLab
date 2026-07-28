// EPIC 52 Stage D — Rivalry Feature Query
// Looks up a (homeTeam, awayTeam) pair in the rivalry_pairs reference table.
// Returns rivalry data if found, or default (no rivalry) otherwise.
// This is an internal engineered feature, not an external API.

import { supabase } from '@/lib/supabase.server';

export interface RivalryResult {
  isDerby: boolean;
  intensity: number; // 0-3
  version: string | null;
}

export async function getRivalryData(homeTeam: string, awayTeam: string): Promise<RivalryResult> {
  try {
    // Check both directions since rivalry is symmetric
    const { data, error } = await supabase
      .from('rivalry_pairs')
      .select('is_derby, rivalry_intensity, version')
      .or(`and(team_a.eq.${homeTeam},team_b.eq.${awayTeam}),and(team_a.eq.${awayTeam},team_b.eq.${homeTeam})`)
      .maybeSingle();

    if (error || !data) {
      return { isDerby: false, intensity: 0, version: null };
    }

    return {
      isDerby: data.is_derby,
      intensity: data.rivalry_intensity,
      version: `v${data.version}`,
    };
  } catch (err) {
    console.warn('[Rivalry] Query failed:', err);
    return { isDerby: false, intensity: 0, version: null };
  }
}
