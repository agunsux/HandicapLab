import { supabase } from '@/lib/supabase.server';

export interface CalculatedFeatures {
  home_rolling_goals_scored_3: number;
  home_rolling_goals_scored_5: number;
  home_rolling_goals_scored_10: number;
  home_rolling_goals_scored_20: number;
  home_rolling_goals_conceded_3: number;
  home_rolling_goals_conceded_5: number;
  home_rolling_goals_conceded_10: number;
  home_rolling_goals_conceded_20: number;
  home_rolling_form_pts_5: number;

  away_rolling_goals_scored_3: number;
  away_rolling_goals_scored_5: number;
  away_rolling_goals_scored_10: number;
  away_rolling_goals_scored_20: number;
  away_rolling_goals_conceded_3: number;
  away_rolling_goals_conceded_5: number;
  away_rolling_goals_conceded_10: number;
  away_rolling_goals_conceded_20: number;
  away_rolling_form_pts_5: number;

  home_eloBefore: number;
  away_eloBefore: number;

  home_rest_days: number;
  away_rest_days: number;
  home_congestion_14d: number;
  away_congestion_14d: number;

  h2h_home_wins: number;
  h2h_draws: number;
  h2h_away_wins: number;
  h2h_avg_goals: number;

  market_opening_odds_home?: number;
  market_opening_odds_draw?: number;
  market_opening_odds_away?: number;
  market_closing_odds_home?: number;
  market_closing_odds_draw?: number;
  market_closing_odds_away?: number;
  market_home_steam_velocity?: number;
  market_home_movement_percentage?: number;
}

export class FeatureStore {
  /**
   * Fetches latest ELO rating for a team, fallback to 1500.
   */
  public static async getLatestElo(teamId: string, beforeTimestamp: string): Promise<number> {
    const { data, error } = await supabase
      .from('wh_team_elo_history')
      .select('elo')
      .eq('team_id', teamId)
      .lt('timestamp', beforeTimestamp)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[FeatureStore ELO] Error fetching latest ELO:', error);
    }
    return data?.elo ? Number(data.elo) : 1500.0;
  }

  /**
   * Updates ELO ratings for both teams following match settlement.
   */
  public static async processEloUpdate(
    fixtureId: string,
    homeTeamId: string,
    awayTeamId: string,
    homeGoals: number,
    awayGoals: number,
    kickoffTime: string
  ) {
    const homeElo = await this.getLatestElo(homeTeamId, kickoffTime);
    const awayElo = await this.getLatestElo(awayTeamId, kickoffTime);

    // ELO expected scores
    const expHome = 1 / (1 + Math.pow(10, (awayElo - homeElo) / 400));
    const expAway = 1 / (1 + Math.pow(10, (homeElo - awayElo) / 400));

    // Actual scores
    let actHome = 0.5;
    let actAway = 0.5;
    if (homeGoals > awayGoals) {
      actHome = 1.0;
      actAway = 0.0;
    } else if (homeGoals < awayGoals) {
      actHome = 0.0;
      actAway = 1.0;
    }

    // Goal difference multiplier
    const goalDiff = Math.abs(homeGoals - awayGoals);
    let kFactor = 32;
    if (goalDiff === 2) kFactor = 32 * 1.5;
    else if (goalDiff === 3) kFactor = 32 * 1.75;
    else if (goalDiff >= 4) kFactor = 32 * (1.75 + (goalDiff - 3) / 8);

    const deltaHome = kFactor * (actHome - expHome);
    const deltaAway = kFactor * (actAway - expAway);

    const nextHomeElo = Number((homeElo + deltaHome).toFixed(2));
    const nextAwayElo = Number((awayElo + deltaAway).toFixed(2));

    // Write to history
    await supabase.from('wh_team_elo_history').insert([
      { team_id: homeTeamId, elo: nextHomeElo, timestamp: kickoffTime, reason: `Match fixture ${fixtureId}` },
      { team_id: awayTeamId, elo: nextAwayElo, timestamp: kickoffTime, reason: `Match fixture ${fixtureId}` }
    ]);
  }

  /**
   * Computes all features for a future or past fixture.
   */
  public static async computeFixtureFeatures(
    fixtureId: string,
    homeTeamId: string,
    awayTeamId: string,
    kickoffTime: string
  ): Promise<CalculatedFeatures> {
    const kickoff = new Date(kickoffTime);

    // 1. Fetch ELO values prior to kickoff
    const homeElo = await this.getLatestElo(homeTeamId, kickoffTime);
    const awayElo = await this.getLatestElo(awayTeamId, kickoffTime);

    // 2. Fetch past fixtures for Home Team
    const { data: homePast } = await supabase
      .from('wh_fixtures')
      .select('id, home_team_id, away_team_id, home_goals, away_goals, kickoff_time')
      .eq('status', 'finished')
      .lt('kickoff_time', kickoffTime)
      .or(`home_team_id.eq.${homeTeamId},away_team_id.eq.${homeTeamId}`)
      .order('kickoff_time', { ascending: false })
      .limit(20);

    // 3. Fetch past fixtures for Away Team
    const { data: awayPast } = await supabase
      .from('wh_fixtures')
      .select('id, home_team_id, away_team_id, home_goals, away_goals, kickoff_time')
      .eq('status', 'finished')
      .lt('kickoff_time', kickoffTime)
      .or(`home_team_id.eq.${awayTeamId},away_team_id.eq.${awayTeamId}`)
      .order('kickoff_time', { ascending: false })
      .limit(20);

    // Calculate rolling features
    const homeFeatures = this.calcTeamRolling(homeTeamId, homePast || []);
    const awayFeatures = this.calcTeamRolling(awayTeamId, awayPast || []);

    // 4. Calculate rest days & congestion
    const homeRest = this.calcRestAndCongestion(kickoff, homePast || []);
    const awayRest = this.calcRestAndCongestion(kickoff, awayPast || []);

    // 5. Fetch Head-to-Head (H2H) fixtures
    const { data: h2hPast } = await supabase
      .from('wh_fixtures')
      .select('home_team_id, away_team_id, home_goals, away_goals')
      .eq('status', 'finished')
      .lt('kickoff_time', kickoffTime)
      .or(`and(home_team_id.eq.${homeTeamId},away_team_id.eq.${awayTeamId}),and(home_team_id.eq.${awayTeamId},away_team_id.eq.${homeTeamId})`)
      .order('kickoff_time', { ascending: false })
      .limit(10);

    const h2h = this.calcH2H(homeTeamId, h2hPast || []);

    return {
      home_rolling_goals_scored_3: homeFeatures.scored3,
      home_rolling_goals_scored_5: homeFeatures.scored5,
      home_rolling_goals_scored_10: homeFeatures.scored10,
      home_rolling_goals_scored_20: homeFeatures.scored20,
      home_rolling_goals_conceded_3: homeFeatures.conceded3,
      home_rolling_goals_conceded_5: homeFeatures.conceded5,
      home_rolling_goals_conceded_10: homeFeatures.conceded10,
      home_rolling_goals_conceded_20: homeFeatures.conceded20,
      home_rolling_form_pts_5: homeFeatures.formPts5,

      away_rolling_goals_scored_3: awayFeatures.scored3,
      away_rolling_goals_scored_5: awayFeatures.scored5,
      away_rolling_goals_scored_10: awayFeatures.scored10,
      away_rolling_goals_scored_20: awayFeatures.scored20,
      away_rolling_goals_conceded_3: awayFeatures.conceded3,
      away_rolling_goals_conceded_5: awayFeatures.conceded5,
      away_rolling_goals_conceded_10: awayFeatures.conceded10,
      away_rolling_goals_conceded_20: awayFeatures.conceded20,
      away_rolling_form_pts_5: awayFeatures.formPts5,

      home_eloBefore: homeElo,
      away_eloBefore: awayElo,

      home_rest_days: homeRest.restDays,
      away_rest_days: awayRest.restDays,
      home_congestion_14d: homeRest.congestion14d,
      away_congestion_14d: awayRest.congestion14d,

      h2h_home_wins: h2h.homeWins,
      h2h_draws: h2h.draws,
      h2h_away_wins: h2h.awayWins,
      h2h_avg_goals: h2h.avgGoals,

      // Market features will be hydrated by MarketEngine when requested.
      // Defaulting to 0 if market data is not available yet for this fixture.
      market_opening_odds_home: 0,
      market_opening_odds_draw: 0,
      market_opening_odds_away: 0,
      market_closing_odds_home: 0,
      market_closing_odds_draw: 0,
      market_closing_odds_away: 0,
      market_home_steam_velocity: 0,
      market_home_movement_percentage: 0
    };
  }

  private static calcTeamRolling(teamId: string, matches: any[]) {
    const result = {
      scored3: 0, scored5: 0, scored10: 0, scored20: 0,
      conceded3: 0, conceded5: 0, conceded10: 0, conceded20: 0,
      formPts5: 0
    };

    if (matches.length === 0) return result;

    const calcSlice = (sliceLen: number) => {
      const slice = matches.slice(0, sliceLen);
      let scored = 0;
      let conceded = 0;
      let formPts = 0;

      for (const m of slice) {
        const isHome = m.home_team_id === teamId;
        const gScored = isHome ? Number(m.home_goals || 0) : Number(m.away_goals || 0);
        const gConceded = isHome ? Number(m.away_goals || 0) : Number(m.home_goals || 0);

        scored += gScored;
        conceded += gConceded;

        if (sliceLen === 5) {
          if (gScored > gConceded) formPts += 3;
          else if (gScored === gConceded) formPts += 1;
        }
      }

      return {
        avgScored: Number((scored / slice.length).toFixed(2)),
        avgConceded: Number((conceded / slice.length).toFixed(2)),
        formPts: formPts
      };
    };

    const r3 = calcSlice(3);
    const r5 = calcSlice(5);
    const r10 = calcSlice(10);
    const r20 = calcSlice(20);

    return {
      scored3: r3.avgScored,
      scored5: r5.avgScored,
      scored10: r10.avgScored,
      scored20: r20.avgScored,
      conceded3: r3.avgConceded,
      conceded5: r5.avgConceded,
      conceded10: r10.avgConceded,
      conceded20: r20.avgConceded,
      formPts5: r5.formPts
    };
  }

  private static calcRestAndCongestion(kickoff: Date, matches: any[]) {
    if (matches.length === 0) {
      return { restDays: 7, congestion14d: 0 }; // Fallback defaults
    }

    const lastMatch = matches[0];
    const lastKickoff = new Date(lastMatch.kickoff_time);
    const diffMs = kickoff.getTime() - lastKickoff.getTime();
    const restDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));

    // Congestion: count finished matches within 14 days before current kickoff
    const limitDate = new Date(kickoff.getTime() - 14 * 24 * 60 * 60 * 1000);
    const congestion14d = matches.filter(m => new Date(m.kickoff_time) >= limitDate).length;

    return { restDays, congestion14d };
  }

  private static calcH2H(homeTeamId: string, matches: any[]) {
    const result = { homeWins: 0, draws: 0, awayWins: 0, avgGoals: 0 };
    if (matches.length === 0) return result;

    let totGoals = 0;
    for (const m of matches) {
      const hg = Number(m.home_goals || 0);
      const ag = Number(m.away_goals || 0);
      totGoals += (hg + ag);

      const isHomeHome = m.home_team_id === homeTeamId;
      if (hg === ag) {
        result.draws++;
      } else if ((hg > ag && isHomeHome) || (ag > hg && !isHomeHome)) {
        result.homeWins++;
      } else {
        result.awayWins++;
      }
    }

    result.avgGoals = Number((totGoals / matches.length).toFixed(2));
    return result;
  }
}
