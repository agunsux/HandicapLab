import { ProbabilityEngine } from '../lib/engines/probability-engine';
import { MatchFeatures } from '../lib/engines/feature-engine/types';
import { CompetitionProfileEngine } from '../lib/engines/feature-engine/competition-profile';
import { InternationalContextExtractor } from '../lib/engines/feature-engine/international-context';
import { EdgeScanner } from '../lib/engines/edge-scanner';
import { runBacktest, HistoricalPrediction } from '../lib/engine/backtest-engine';

// No Supabase queries are performed because we pass custom weights directly in options.


// Actual match results from World Cup 2018 and 2022
const WORLD_CUP_HISTORICAL = [
  // 2022 World Cup
  { home: 'Argentina', away: 'France', homeGoals: 3, awayGoals: 3, stage: 'Final', year: 2022, homeElo: 2100, awayElo: 2150, homeFifa: 3, awayFifa: 4, homeRest: 4, awayRest: 3 },
  { home: 'Argentina', away: 'Croatia', homeGoals: 3, awayGoals: 0, stage: 'Semi-Final', year: 2022, homeElo: 2050, awayElo: 1950, homeFifa: 3, awayFifa: 12, homeRest: 4, awayRest: 4 },
  { home: 'France', away: 'Morocco', homeGoals: 2, awayGoals: 0, stage: 'Semi-Final', year: 2022, homeElo: 2120, awayElo: 1880, homeFifa: 4, awayFifa: 22, homeRest: 4, awayRest: 4 },
  { home: 'Croatia', away: 'Brazil', homeGoals: 1, awayGoals: 1, stage: 'Quarter-Final', year: 2022, homeElo: 1930, awayElo: 2160, homeFifa: 12, awayFifa: 1, homeRest: 4, awayRest: 4 },
  { home: 'Netherlands', away: 'Argentina', homeGoals: 2, awayGoals: 2, stage: 'Quarter-Final', year: 2022, homeElo: 1980, awayElo: 2040, homeFifa: 8, awayFifa: 3, homeRest: 4, awayRest: 4 },
  { home: 'Morocco', away: 'Portugal', homeGoals: 1, awayGoals: 0, stage: 'Quarter-Final', year: 2022, homeElo: 1850, awayElo: 2010, homeFifa: 22, awayFifa: 9, homeRest: 4, awayRest: 4 },
  { home: 'England', away: 'France', homeGoals: 1, awayGoals: 2, stage: 'Quarter-Final', year: 2022, homeElo: 2030, awayElo: 2110, homeFifa: 5, awayFifa: 4, homeRest: 4, awayRest: 4 },
  // 2018 World Cup
  { home: 'France', away: 'Croatia', homeGoals: 4, awayGoals: 2, stage: 'Final', year: 2018, homeElo: 2080, awayElo: 1950, homeFifa: 7, awayFifa: 20, homeRest: 4, awayRest: 4 },
  { home: 'France', away: 'Belgium', homeGoals: 1, awayGoals: 0, stage: 'Semi-Final', year: 2018, homeElo: 2060, awayElo: 2080, homeFifa: 7, awayFifa: 3, homeRest: 4, awayRest: 4 },
  { home: 'Croatia', away: 'England', homeGoals: 2, awayGoals: 1, stage: 'Semi-Final', year: 2018, homeElo: 1920, awayElo: 1990, homeFifa: 20, awayFifa: 12, homeRest: 4, awayRest: 4 },
  { home: 'Uruguay', away: 'France', homeGoals: 0, awayGoals: 2, stage: 'Quarter-Final', year: 2018, homeElo: 1960, awayElo: 2020, homeFifa: 14, awayFifa: 7, homeRest: 4, awayRest: 4 },
  { home: 'Brazil', away: 'Belgium', homeGoals: 1, awayGoals: 2, stage: 'Quarter-Final', year: 2018, homeElo: 2110, awayElo: 2050, homeFifa: 2, awayFifa: 3, homeRest: 4, awayRest: 4 },
  { home: 'Sweden', away: 'England', homeGoals: 0, awayGoals: 2, stage: 'Quarter-Final', year: 2018, homeElo: 1880, awayElo: 1970, homeFifa: 24, awayFifa: 12, homeRest: 4, awayRest: 4 },
  { home: 'Russia', away: 'Croatia', homeGoals: 2, awayGoals: 2, stage: 'Quarter-Final', year: 2018, homeElo: 1800, awayElo: 1910, homeFifa: 70, awayFifa: 20, homeRest: 4, awayRest: 4 }
];

async function run() {
  console.log('🏆 Starting World Cup Historical Backtest (2018 & 2022)...');
  const historicalPredictions: HistoricalPrediction[] = [];

  for (let i = 0; i < WORLD_CUP_HISTORICAL.length; i++) {
    const m = WORLD_CUP_HISTORICAL[i];
    const profile = CompetitionProfileEngine.getProfile('international');
    const fatigue = { homeRestDays: m.homeRest, awayRestDays: m.awayRest, homeTravelKm: 800 };
    
    const intContext = InternationalContextExtractor.extract(
      {
        fifa_ranking_home: m.homeFifa,
        fifa_ranking_away: m.awayFifa,
        squad_strength_home: 0.85,
        squad_strength_away: 0.80,
        tournament_stage: m.stage
      },
      fatigue
    );

    // Derive inputs relative to ELO strengths
    const homeAttack = Number((m.homeElo / 1550).toFixed(2));
    const homeDefense = Number((1550 / m.homeElo).toFixed(2));
    const awayAttack = Number((m.awayElo / 1550).toFixed(2));
    const awayDefense = Number((1550 / m.awayElo).toFixed(2));

    const features: MatchFeatures = {
      matchId: `hist-wc-${m.year}-${i}`,
      marketType: 'ML',
      kickoffAt: new Date(`${m.year}-12-18`),
      homeFormLast5: [3, 1, 3, 3, 3],
      awayFormLast5: [3, 3, 1, 3, 1],
      homeFormWeighted: 2.1,
      awayFormWeighted: 1.9,
      homeRestDays: m.homeRest,
      awayRestDays: m.awayRest,
      homeTravelKm: 800,
      homeElo: m.homeElo,
      awayElo: m.awayElo,
      eloDelta: m.homeElo - m.awayElo,
      homeAttack,
      homeDefense,
      awayAttack,
      awayDefense,
      leagueAvgGoals: profile.goalEnvironment,
      isHomeAdvantage: false, // neutral venue
      leagueId: 'WORLD_CUP',
      season: String(m.year),
      generatedAt: new Date(`${m.year}-12-17`),
      competitionType: 'international',
      squadFamiliarity: 0.75,
      tournamentStage: m.stage,
      fifaRankingHome: intContext.fifaRankingHome,
      fifaRankingAway: intContext.fifaRankingAway,
      squadContinuityHome: intContext.squadContinuityHome,
      squadContinuityAway: intContext.squadContinuityAway,
      knockoutPressure: intContext.knockoutPressure,
      internationalAdjustmentScore: intContext.internationalAdjustmentScore
    };

    // Run prediction using the actual model engine (using static equal weights mock fallback)
    const probOutput = await ProbabilityEngine.predict(features, {
      weights: { poisson: 0.5, dixonColes: 0.5 }
    });

    // Mock bookmaker market odds for Moneyline
    // Stronger ELO team is favorite, but odds have standard margin
    const homeFav = m.homeElo >= m.awayElo;
    const oddsHome = homeFav ? 1.85 : 3.40;
    const oddsAway = homeFav ? 3.40 : 1.85;
    const oddsDraw = 3.10;

    const oddsSnap = {
      market: 'ML' as const,
      homeOdds: oddsHome,
      drawOdds: oddsDraw,
      awayOdds: oddsAway
    };

    // Run scanner
    const picks = EdgeScanner.scan(features.matchId, 'ML', probOutput, oddsSnap);
    if (picks.length > 0) {
      const topPick = picks[0];
      const outcome = m.homeGoals > m.awayGoals ? 'home' : m.homeGoals === m.awayGoals ? 'draw' : 'away';
      const correct = topPick.outcome === outcome;

      historicalPredictions.push({
        matchId: features.matchId,
        predictionType: 'moneyline',
        predictedValue: topPick.outcome,
        probability: topPick.modelProbability,
        fairOdds: 1 / topPick.modelProbability,
        marketOdds: topPick.marketOdds,
        edgePercent: topPick.expectedValue,
        actualResult: `${m.homeGoals}-${m.awayGoals}`,
        correct,
        competitionType: 'international',
        leagueId: 'WORLD_CUP',
        clv: Number((topPick.marketOdds / (topPick.marketOdds * 0.98) - 1).toFixed(4)) // mock slight positive CLV
      });
    }
  }

  // Execute backtest
  const metrics = runBacktest({ predictions: historicalPredictions });

  console.log('\n==================================================');
  console.log(`📈 Backtest Results for World Cup 2018 & 2022 Matches (${historicalPredictions.length} bets matched)`);
  console.log('==================================================');
  console.log(`Total Bets:         ${metrics.totalBets}`);
  console.log(`Wins / Losses:      ${metrics.winningBets} W / ${metrics.losingBets} L`);
  console.log(`Hit Rate:           ${metrics.winRate}%`);
  console.log(`Yield / ROI:        ${metrics.yieldPercent}%`);
  console.log(`Profit (Units):     ${metrics.totalProfitUnits} units`);
  console.log(`Brier Score:        ${metrics.brierScore}`);
  console.log(`Avg CLV:            ${(metrics.averageClv * 100).toFixed(2)}%`);
  console.log(`Max Drawdown:       ${metrics.maxDrawdown} units`);
  console.log(`Sharpe Ratio:       ${metrics.sharpeRatio}`);
  console.log('==================================================\n');
}

run().catch(console.error);
