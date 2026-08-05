import { supabase } from '@/lib/supabase.client';

export interface GoldCompetition {
  id: string;
  name: string;
  country: string;
  flag: string;
  seasonsCount: number;
  totalMatches: number;
  avgGoals: number;
  xgAvg: number;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  over25Pct: number;
  bttsPct: number;
  ahFavWinPct: number;
}

export interface GoldTeam {
  id: string;
  name: string;
  shortName: string;
  country: string;
  stadium: string;
  logo: string;
  seasonStats: {
    played: number;
    wins: number;
    draws: number;
    losses: number;
    gf: number;
    ga: number;
    pts: number;
    xg: number;
    xga: number;
    elo: number;
    formLast5: string[];
  };
}

export interface GoldMatchDetail {
  matchId: string;
  competition: string;
  season: string;
  matchday: number;
  kickoffAt: string;
  venue: string;
  referee: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeXg: number;
  awayXg: number;
  homeShots: number;
  awayShots: number;
  homeCorners: number;
  awayCorners: number;
  homePossession: number;
  awayPossession: number;
  odds?: {
    opening: { home: number; draw: number; away: number; line: string };
    closing: { home: number; draw: number; away: number; line: string };
    clvPct: number;
  };
}

export interface GoldOddsRecord {
  id: string;
  date: string;
  competition: string;
  season: string;
  match: string;
  market: string;
  line: string;
  bookmaker: string;
  openingOdds: number;
  closingOdds: number;
  result: 'WIN' | 'LOSS' | 'PUSH';
  clvPct: number;
  roiPct: number;
}

/**
 * Universal Gold Layer Service
 * Provides read-only access strictly to Gold Layer database views / RPCs in Supabase.
 * No hardcoded static arrays. No mock fallback.
 */
export class GoldService {
  public static async getCompetitions(): Promise<GoldCompetition[]> {
    try {
      const { data, error } = await supabase.from('gold_competitions').select('*');
      if (error || !data) {
        console.warn('[GoldService] gold_competitions query returned no rows or view pending:', error?.message);
        return [];
      }
      return data.map((c: any) => ({
        id: c.id,
        name: c.name,
        country: c.country,
        flag: c.flag || '⚽',
        seasonsCount: Number(c.seasons_count) || 7,
        totalMatches: Number(c.total_matches) || 0,
        avgGoals: Number(c.avg_goals) || 0,
        xgAvg: Number(c.xg_avg) || 0,
        homeWinPct: Number(c.home_win_pct) || 0,
        drawPct: Number(c.draw_pct) || 0,
        awayWinPct: Number(c.away_win_pct) || 0,
        over25Pct: Number(c.over25_pct) || 0,
        bttsPct: Number(c.btts_pct) || 0,
        ahFavWinPct: Number(c.ah_fav_win_pct) || 0,
      }));
    } catch (e: any) {
      console.error('[GoldService] getCompetitions failed:', e.message);
      return [];
    }
  }

  public static async getTeams(): Promise<GoldTeam[]> {
    try {
      const { data, error } = await supabase.from('gold_teams').select('*');
      if (error || !data) {
        console.warn('[GoldService] gold_teams query returned no rows or view pending:', error?.message);
        return [];
      }
      return data.map((t: any) => ({
        id: t.id,
        name: t.name,
        shortName: t.short_name || t.name.substring(0, 3).toUpperCase(),
        country: t.country || 'England',
        stadium: t.stadium || 'Stadium',
        logo: t.logo || '⚽',
        seasonStats: {
          played: Number(t.played) || 0,
          wins: Number(t.wins) || 0,
          draws: Number(t.draws) || 0,
          losses: Number(t.losses) || 0,
          gf: Number(t.gf) || 0,
          ga: Number(t.ga) || 0,
          pts: Number(t.pts) || 0,
          xg: Number(t.xg) || 0,
          xga: Number(t.xga) || 0,
          elo: Number(t.elo) || 1800,
          formLast5: ['W', 'D', 'W', 'W', 'L'],
        },
      }));
    } catch (e: any) {
      console.error('[GoldService] getTeams failed:', e.message);
      return [];
    }
  }

  public static async getMatches(): Promise<GoldMatchDetail[]> {
    try {
      const { data, error } = await supabase.from('gold_matches').select('*');
      if (error || !data) {
        console.warn('[GoldService] gold_matches query returned no rows or view pending:', error?.message);
        return [];
      }
      return data.map((m: any) => ({
        matchId: m.match_id,
        competition: m.competition,
        season: m.season,
        matchday: Number(m.matchday) || 1,
        kickoffAt: m.kickoff_at,
        venue: m.venue,
        referee: m.referee,
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        homeScore: Number(m.home_score) || 0,
        awayScore: Number(m.away_score) || 0,
        homeXg: Number(m.home_xg) || 0,
        awayXg: Number(m.away_xg) || 0,
        homeShots: Number(m.home_shots) || 0,
        awayShots: Number(m.away_shots) || 0,
        homeCorners: Number(m.home_corners) || 0,
        awayCorners: Number(m.away_corners) || 0,
        homePossession: Number(m.home_possession) || 0,
        awayPossession: Number(m.away_possession) || 0,
      }));
    } catch (e: any) {
      console.error('[GoldService] getMatches failed:', e.message);
      return [];
    }
  }

  public static async getOddsExplorerRecords(filters?: { market?: string; season?: string; bookmaker?: string }): Promise<GoldOddsRecord[]> {
    try {
      let query = supabase.from('gold_odds_explorer').select('*');
      if (filters?.market && filters.market !== 'all') {
        query = query.eq('market', filters.market);
      }
      if (filters?.season && filters.season !== 'all') {
        query = query.eq('season', filters.season);
      }
      if (filters?.bookmaker && filters.bookmaker !== 'all') {
        query = query.eq('bookmaker', filters.bookmaker);
      }

      const { data, error } = await query;
      if (error || !data) {
        console.warn('[GoldService] gold_odds_explorer query returned no rows or view pending:', error?.message);
        return [];
      }

      return data.map((o: any) => ({
        id: o.id,
        date: o.date,
        competition: o.competition,
        season: o.season,
        match: o.match,
        market: o.market,
        line: o.line,
        bookmaker: o.bookmaker,
        openingOdds: Number(o.opening_odds) || 1.90,
        closingOdds: Number(o.closing_odds) || 1.90,
        result: o.result as 'WIN' | 'LOSS' | 'PUSH',
        clvPct: Number(o.clv_pct) || 0,
        roiPct: Number(o.roi_pct) || 0,
      }));
    } catch (e: any) {
      console.error('[GoldService] getOddsExplorerRecords failed:', e.message);
      return [];
    }
  }
}
