import { supabase } from '@/lib/supabase.server';

export interface FeatureRecord {
  fixtureId: number;
  featureName: string;
  featureValue: number;
  source: string;
}

export class FeatureAssembler {
  /**
   * Validates calculated feature values to guarantee they lie within mathematical bounds.
   */
  public validateFeature(name: string, val: number): boolean {
    if (isNaN(val) || !isFinite(val)) return false;

    // Rates must reside between 0.0 and 1.0 inclusive
    if (name.includes('_rate') || name.startsWith('btts_') || name.startsWith('implied_')) {
      if (val < 0.0 || val > 1.0) return false;
    }

    // Counts/Averages/Differences/Rest Days bounds
    if (name.includes('avg') || name.includes('average') || name.includes('rest_days')) {
      if (val < 0.0) return false;
    }

    return true;
  }

  /**
   * Fetches historical fixtures happening strictly prior to target match kickoff time.
   */
  private async getPastFixtures(teamId: number, kickoffBefore: string, limitCount: number) {
    const { data } = await supabase
      .from('wh_fixtures')
      .select('id, home_team_id, away_team_id, home_goals, away_goals, kickoff_time')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .lt('kickoff_time', kickoffBefore)
      .order('kickoff_time', { ascending: false })
      .limit(limitCount);

    return data || [];
  }

  /**
   * Assembles and commits feature store entries for a target fixture.
   */
  public async assembleFeaturesForFixture(fixtureId: number): Promise<FeatureRecord[]> {
    const { data: fixture, error } = await supabase
      .from('wh_fixtures')
      .select('id, home_team_id, away_team_id, kickoff_time')
      .eq('id', fixtureId)
      .single();

    if (error || !fixture) {
      throw new Error(`[FeatureAssembler] Target fixture ${fixtureId} not found`);
    }

    const homeId = Number(fixture.home_team_id);
    const awayId = Number(fixture.away_team_id);
    const kickoff = fixture.kickoff_time;

    // Fetch past matches for rolling form computations
    const pastHome = await this.getPastFixtures(homeId, kickoff, 10);
    const pastAway = await this.getPastFixtures(awayId, kickoff, 10);

    const features: FeatureRecord[] = [];

    // 1. HOME/AWAY Rolling Win Rates (last 3, 5, 10 matches)
    const computeWinRate = (past: any[], teamId: number, count: number): number => {
      const slice = past.slice(0, count);
      if (slice.length === 0) return 0.5; // default fallback value
      let wins = 0;
      for (const f of slice) {
        const isHome = Number(f.home_team_id) === teamId;
        const gf = isHome ? f.home_goals : f.away_goals;
        const ga = isHome ? f.away_goals : f.home_goals;
        if (gf > ga) wins++;
      }
      return wins / slice.length;
    };

    features.push({ fixtureId, featureName: 'home_win_rate_3', featureValue: computeWinRate(pastHome, homeId, 3), source: 'rolling' });
    features.push({ fixtureId, featureName: 'home_win_rate_5', featureValue: computeWinRate(pastHome, homeId, 5), source: 'rolling' });
    features.push({ fixtureId, featureName: 'home_win_rate_10', featureValue: computeWinRate(pastHome, homeId, 10), source: 'rolling' });
    features.push({ fixtureId, featureName: 'away_win_rate_3', featureValue: computeWinRate(pastAway, awayId, 3), source: 'rolling' });
    features.push({ fixtureId, featureName: 'away_win_rate_5', featureValue: computeWinRate(pastAway, awayId, 5), source: 'rolling' });
    features.push({ fixtureId, featureName: 'away_win_rate_10', featureValue: computeWinRate(pastAway, awayId, 10), source: 'rolling' });

    // 2. Goals average (last 5 matches)
    const computeGoalsAvg = (past: any[], teamId: number): number => {
      const slice = past.slice(0, 5);
      if (slice.length === 0) return 0;
      let totalScored = 0;
      for (const f of slice) {
        totalScored += Number(f.home_team_id) === teamId ? f.home_goals : f.away_goals;
      }
      return totalScored / slice.length;
    };
    features.push({ fixtureId, featureName: 'home_goals_scored_avg_5', featureValue: computeGoalsAvg(pastHome, homeId), source: 'goals' });
    features.push({ fixtureId, featureName: 'away_goals_scored_avg_5', featureValue: computeGoalsAvg(pastAway, awayId), source: 'goals' });

    // 3. Over 2.5 Rate (last 5 matches)
    const computeOverRate = (past: any[]): number => {
      const slice = past.slice(0, 5);
      if (slice.length === 0) return 0;
      let overs = 0;
      for (const f of slice) {
        if ((f.home_goals + f.away_goals) > 2.5) overs++;
      }
      return overs / slice.length;
    };
    features.push({ fixtureId, featureName: 'home_over_2_5_rate_5', featureValue: computeOverRate(pastHome), source: 'over_under' });
    features.push({ fixtureId, featureName: 'away_over_2_5_rate_5', featureValue: computeOverRate(pastAway), source: 'over_under' });

    // 4. BTTS (Both Teams to Score) Rate (last 5 matches)
    const computeBttsRate = (past: any[]): number => {
      const slice = past.slice(0, 5);
      if (slice.length === 0) return 0;
      let btts = 0;
      for (const f of slice) {
        if (f.home_goals > 0 && f.away_goals > 0) btts++;
      }
      return btts / slice.length;
    };
    features.push({ fixtureId, featureName: 'home_btts_rate_5', featureValue: computeBttsRate(pastHome), source: 'btts' });
    features.push({ fixtureId, featureName: 'away_btts_rate_5', featureValue: computeBttsRate(pastAway), source: 'btts' });

    // 5. Rest Days computation
    const getRestDays = (past: any[], currentKickoff: string): number => {
      if (past.length === 0) return 7; // Default rest duration (1 week)
      const prevDate = new Date(past[0].kickoff_time);
      const currDate = new Date(currentKickoff);
      const diffTime = Math.abs(currDate.getTime() - prevDate.getTime());
      return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    };
    features.push({ fixtureId, featureName: 'home_rest_days', featureValue: getRestDays(pastHome, kickoff), source: 'rest' });
    features.push({ fixtureId, featureName: 'away_rest_days', featureValue: getRestDays(pastAway, kickoff), source: 'rest' });

    // Save and commit validated features to DB
    for (const feat of features) {
      if (this.validateFeature(feat.featureName, feat.featureValue)) {
        await supabase.from('wh_feature_values').upsert({
          fixture_id: feat.fixtureId,
          feature_name: feat.featureName,
          feature_value: feat.featureValue,
          source: feat.source
        }, { onConflict: 'fixture_id,feature_name' });
      }
    }

    return features;
  }
}
