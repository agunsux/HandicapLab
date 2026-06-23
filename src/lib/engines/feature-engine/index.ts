import { supabase } from '../../supabase.server';
import { LeakageGuard } from '../../guards/leakage';
import { MatchFeatures } from './types';
import { FormExtractor } from './form';
import { FatigueExtractor } from './fatigue';
import { StrengthExtractor } from './strength';
import { XgExtractor } from './xg';

export class FeatureEngine {
  /**
   * Main feature builder orchestrator.
   * Asserts pre-kickoff data validity via LeakageGuard, aggregates stats, and maps features.
   */
  static async build(
    matchId: string,
    kickoffAt: Date,
    marketType: 'AH' | 'OU' | 'ML' = 'ML'
  ): Promise<MatchFeatures> {
    // 1. HARD GATE: Assert no future data leakage
    await LeakageGuard.assertNoFutureData(matchId, kickoffAt);

    // 2. Fetch target match metadata
    const { data: match, error } = await supabase
      .from('matches')
      .select('home_team, away_team, league, kickoff')
      .eq('id', matchId)
      .single();

    if (error || !match) {
      throw new Error(`[FeatureEngine] Match ${matchId} not found in database.`);
    }

    const homeTeam = match.home_team;
    const awayTeam = match.away_team;
    const kickoffTime = new Date(match.kickoff);

    // 3. Trigger extractors in parallel
    const [form, fatigue, strength, xg] = await Promise.all([
      FormExtractor.extract(homeTeam, awayTeam, kickoffAt),
      FatigueExtractor.extract(homeTeam, awayTeam, kickoffAt),
      StrengthExtractor.extract(homeTeam, awayTeam, kickoffAt),
      XgExtractor.extract(homeTeam, awayTeam, kickoffAt)
    ]);

    // 4. Map to unified MatchFeatures interface
    return {
      matchId,
      marketType,
      kickoffAt: kickoffTime,
      homeFormLast5: form.homeFormLast5,
      awayFormLast5: form.awayFormLast5,
      homeFormWeighted: form.homeFormWeighted,
      awayFormWeighted: form.awayFormWeighted,
      homeRestDays: fatigue.homeRestDays,
      awayRestDays: fatigue.awayRestDays,
      homeTravelKm: fatigue.homeTravelKm,
      homeElo: strength.homeElo,
      awayElo: strength.awayElo,
      eloDelta: strength.eloDelta,
      homeAttack: xg.homeAttack,
      homeDefense: xg.homeDefense,
      awayAttack: xg.awayAttack,
      awayDefense: xg.awayDefense,
      leagueAvgGoals: xg.leagueAvgGoals,
      isHomeAdvantage: true, // Baseline home field advantage coefficient indicator
      leagueId: match.league || 'EPL',
      season: String(kickoffTime.getFullYear()),
      generatedAt: new Date() // Will be set to <= kickoffAt during simulation
    };
  }
}
