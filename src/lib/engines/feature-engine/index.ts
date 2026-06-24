import { supabase } from '../../supabase.server';
import { LeakageGuard } from '../../guards/leakage';
import { MatchFeatures } from './types';
import { FormExtractor } from './form';
import { FatigueExtractor } from './fatigue';
import { StrengthExtractor } from './strength';
import { XgExtractor } from './xg';
import { CompetitionProfileEngine } from './competition-profile';
import { InternationalContextExtractor } from './international-context';
import { LEAGUE_REGISTRY } from '../../crons/leagueRegistry';

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

    // 2. Fetch target match metadata including Sprint 6 international columns
    const { data: match, error } = await supabase
      .from('matches')
      .select(`
        home_team, 
        away_team, 
        league, 
        kickoff, 
        competition_type, 
        tournament_stage,
        fifa_ranking_home,
        fifa_ranking_away,
        squad_strength_home,
        squad_strength_away
      `)
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

    // Determine competition profile and type
    const config = LEAGUE_REGISTRY.find(
      l => l.name.toLowerCase() === (match.league || '').toLowerCase() ||
           l.id.toLowerCase() === (match.league || '').toLowerCase()
    );
    const profile = CompetitionProfileEngine.getProfileForLeague(match.league || 'EPL');
    const compType = profile.type;
    const familiarity = compType === 'international' ? 0.75 : 1.0;

    // Run international context extraction
    const intContext = InternationalContextExtractor.extract(match, fatigue);

    // Fetch historical match count for the league in database
    const { count: historicalCount, error: countErr } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'finished')
      .eq('league', match.league)
      .lt('kickoff', kickoffTime.toISOString());
    const historicalMatchesCount = countErr ? 0 : (historicalCount ?? 0);

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
      leagueAvgGoals: profile.goalEnvironment, // Integrate profile goals environment
      isHomeAdvantage: profile.homeAdvantageModifier > 1.0, 
      leagueId: config?.id || match.league || 'EPL',
      season: String(kickoffTime.getFullYear()),
      generatedAt: new Date(), // Will be set to <= kickoffAt during simulation
      competitionType: compType,
      squadFamiliarity: familiarity,
      tournamentStage: match.tournament_stage || undefined,
      fifaRankingHome: intContext.fifaRankingHome,
      fifaRankingAway: intContext.fifaRankingAway,
      squadContinuityHome: intContext.squadContinuityHome,
      squadContinuityAway: intContext.squadContinuityAway,
      knockoutPressure: intContext.knockoutPressure,
      internationalAdjustmentScore: intContext.internationalAdjustmentScore,
      historicalMatchesCount
    };
  }
}
