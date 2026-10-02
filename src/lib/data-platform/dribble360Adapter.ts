/**
 * DRIBBLE360 CANONICAL ADAPTER
 * 
 * Maps raw Dribble360 provider payloads to HandicapLab Canonical Data Models (CDM).
 * 
 * Architecture:
 *   Dribble360
 *        ↓
 *   Provider Adapter (this module)
 *        ↓
 *   Canonical DTO
 *        ↓
 *   Canonical Match Registry
 *        ↓
 *   Research Dataset
 * 
 * Critical Invariants:
 *   1. Zero leakage of Dribble-specific internal structures (Opta tags, raw field names) into research models.
 *   2. Strict UTC timestamps.
 *   3. Deterministic canonical match keying across providers.
 *   4. Zero odds fields processed (Dribble is football-data enrichment only).
 */

import * as crypto from 'crypto';
import type {
  CanonicalFixture,
  CanonicalTeam,
  CanonicalTeamStats,
  CanonicalPlayer,
} from './canonicalModel';
import type { Dribble360Match, Dribble360TeamMatch } from '@/lib/providers/dribble360Provider';

export class Dribble360Adapter {
  public static readonly VERSION = '1.0.0-canonical';

  /**
   * Normalize team name for cross-provider matching.
   */
  public static normalizeTeamName(raw: string): string {
    if (!raw) return '';
    return raw
      .toLowerCase()
      .replace(/\bc\.?\s*f\.?\b/gi, '')
      .replace(/\ba\.?\s*f\.?\s*c\.?\b/gi, '')
      .replace(/\bf\.?\s*c\.?\b/gi, '')
      .replace(/[\.\-_']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Deterministic canonical match key:
   * Format: `${COMPETITION}|${SEASON}|${DATE}|${HOME_NORM}|${AWAY_NORM}`
   */
  public static generateCanonicalKey(
    competition: string,
    season: string,
    dateStr: string,
    homeTeam: string,
    awayTeam: string
  ): string {
    const comp = competition.toUpperCase().replace(/\s+/g, '-');
    const date = (dateStr || '').split('T')[0] || '1970-01-01';
    const h = this.normalizeTeamName(homeTeam).replace(/\s+/g, '-');
    const a = this.normalizeTeamName(awayTeam).replace(/\s+/g, '-');
    return `${comp}|${season}|${date}|${h}|${a}`;
  }

  /**
   * Resolves competition ID from Dribble description / season / league.
   */
  public static resolveCompetitionId(match: Dribble360Match): string {
    if (match.league_name) {
      const ln = match.league_name.toLowerCase();
      if (ln.includes('premier league') || ln.includes('epl')) return 'ENG-PL';
      if (ln.includes('championship')) return 'ENG-CH';
      if (ln.includes('la liga') || ln.includes('primera')) return 'ESP-L1';
      if (ln.includes('bundesliga')) return 'GER-BL';
      if (ln.includes('serie a')) return 'ITA-SA';
      if (ln.includes('ligue 1')) return 'FRA-L1';
      if (ln.includes('eredivisie')) return 'NED-ED';
      if (ln.includes('j1')) return 'JPN-J1';
      if (ln.includes('k league')) return 'KOR-KL1';
      if (ln.includes('liga 1')) return 'IDN-L1';
    }

    // Fallback based on match description or slug
    const desc = (match.description || match.slug || '').toLowerCase();
    // Default to international or general if unmapped
    return match.league_id ? `DRIBBLE-${match.league_id}` : 'WORLD-GEN';
  }

  /**
   * Maps Dribble match status to Canonical status enum.
   */
  public static mapStatus(rawStatus?: string): 'SCHEDULED' | 'LIVE' | 'SUSPENDED' | 'FINISHED' {
    const s = (rawStatus || '').toUpperCase();
    if (s === 'FINISHED' || s === 'FT' || s === 'AET' || s === 'PEN') return 'FINISHED';
    if (s === 'LIVE' || s === 'HT' || s === '1H' || s === '2H' || s === 'IN_PLAY') return 'LIVE';
    if (s === 'SUSPENDED' || s === 'POSTPONED' || s === 'CANCELLED' || s === 'CANC') return 'SUSPENDED';
    return 'SCHEDULED';
  }

  /**
   * Transforms a Dribble360 match + optional team_matches into a CanonicalFixture DTO.
   */
  public static toCanonicalFixture(
    match: Dribble360Match,
    teamMatches: Dribble360TeamMatch[] = []
  ): CanonicalFixture {
    const competitionId = this.resolveCompetitionId(match);
    const season = String(match.season || match.season_id || 'unknown');
    const dateStr = match.date || match.kickoff || new Date().toISOString();
    
    // Parse team names from description ("Home vs Away") if fields missing
    let homeName = match.home_team || '';
    let awayName = match.away_team || '';
    if ((!homeName || !awayName) && match.description && match.description.includes(' vs ')) {
      const parts = match.description.split(' vs ');
      homeName = parts[0]?.trim() || '';
      awayName = parts[1]?.trim() || '';
    }

    const canonicalId = this.generateCanonicalKey(
      competitionId,
      season,
      dateStr,
      homeName,
      awayName
    );

    // Extract stats from team_matches if available
    let homeTm: Dribble360TeamMatch | undefined;
    let awayTm: Dribble360TeamMatch | undefined;
    if (teamMatches.length > 0) {
      homeTm = teamMatches.find(t => String(t.side).toUpperCase() === 'HOME');
      awayTm = teamMatches.find(t => String(t.side).toUpperCase() === 'AWAY');
    }

    const homeXg = homeTm?.expected_goals ?? match.expected_goals_home ?? null;
    const awayXg = awayTm?.expected_goals ?? match.expected_goals_away ?? null;
    const homeShots = homeTm?.shots ?? homeTm?.total_scoring_att ?? null;
    const awayShots = awayTm?.shots ?? awayTm?.total_scoring_att ?? null;
    const homeSot = homeTm?.shots_on_target ?? homeTm?.ontarget_scoring_att ?? null;
    const awaySot = awayTm?.shots_on_target ?? awayTm?.ontarget_scoring_att ?? null;

    const payloadToHash = `${canonicalId}|${match.home_score}|${match.away_score}|${homeXg}|${awayXg}`;
    const checksum = crypto.createHash('sha256').update(payloadToHash).digest('hex');

    return {
      match_id: canonicalId,
      provider_id: String(match.id),
      provider: 'dribble360',
      competition_id: competitionId,
      season,
      home_team_id: String(match.home_team_id || this.normalizeTeamName(homeName)),
      away_team_id: String(match.away_team_id || this.normalizeTeamName(awayName)),
      kickoff: new Date(dateStr).toISOString(),
      home_goals: match.home_score ?? null,
      away_goals: match.away_score ?? null,
      home_xg: homeXg != null ? Number(Number(homeXg).toFixed(4)) : null,
      away_xg: awayXg != null ? Number(Number(awayXg).toFixed(4)) : null,
      home_shots: homeShots != null ? Number(homeShots) : null,
      away_shots: awayShots != null ? Number(awayShots) : null,
      home_shots_on_target: homeSot != null ? Number(homeSot) : null,
      away_shots_on_target: awaySot != null ? Number(awaySot) : null,
      status: this.mapStatus(match.status),
      schema_version: this.VERSION,
      generated_at: new Date().toISOString(),
      checksum,
    };
  }

  /**
   * Transforms raw Dribble team payload into CanonicalTeam.
   */
  public static toCanonicalTeam(dribbleTeam: any): CanonicalTeam {
    return {
      id: String(dribbleTeam.id),
      name: dribbleTeam.name || dribbleTeam.official_name || 'Unknown Team',
      shortName: dribbleTeam.short_name || dribbleTeam.name || undefined,
    };
  }

  /**
   * Transforms raw Dribble team match into sanitized CanonicalTeamStats.
   * Isolates Opta raw internals so they NEVER leak downstream.
   */
  public static toCanonicalTeamStats(
    tm: Dribble360TeamMatch,
    fixtureId: string
  ): CanonicalTeamStats {
    return {
      fixtureId,
      teamName: tm.team_name || String(tm.team_id || 'unknown'),
      shots: Number(tm.shots ?? tm.total_scoring_att ?? 0),
      shotsOnTarget: Number(tm.shots_on_target ?? tm.ontarget_scoring_att ?? 0),
      corners: Number(tm.corner_taken ?? tm.won_corners ?? 0),
      fouls: Number(tm.fk_foul_lost ?? 0),
      yellowCards: Number(tm.yellow_cards ?? tm.total_yellow_card ?? 0),
      redCards: Number(tm.red_cards ?? tm.total_red_card ?? 0),
    };
  }

  /**
   * Transforms raw Dribble player payload into CanonicalPlayer.
   */
  public static toCanonicalPlayer(player: any): CanonicalPlayer {
    let pos: 'G' | 'D' | 'M' | 'F' = 'M';
    const rawPos = (player.position || '').toUpperCase();
    if (rawPos.startsWith('G')) pos = 'G';
    else if (rawPos.startsWith('D')) pos = 'D';
    else if (rawPos.startsWith('F')) pos = 'F';

    return {
      id: String(player.id),
      name: player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown Player',
      position: pos,
    };
  }
}

export default Dribble360Adapter;
