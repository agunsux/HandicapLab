/**
 * Dynamic Team Ratings calculation engine.
 * Computes attack and defense strengths using time-weighted exponential decay.
 */

export interface MatchData {
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  league: string;
  kickoff: string;
}

export interface TeamRating {
  team_id: string;
  team_name: string;
  league_id: string;
  attack_strength: number;
  defense_strength: number;
  matches_played: number;
}

/**
 * Calculates updated team ratings from a list of recent matches.
 * Uses 5 iterative updates for Dixon-Coles-like convergence.
 * Applies exponential decay weighting where more recent matches matter more.
 */
export function calculateTeamRatings(recentMatches: MatchData[]): Record<string, TeamRating> {
  if (recentMatches.length === 0) {
    return {};
  }

  // Sort matches chronologically to apply time-based weights properly
  const sortedMatches = [...recentMatches].sort(
    (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
  );

  // 1. Identify all unique teams and group their matches
  const teamMatchesMap: Record<string, { isHome: boolean; matchIndex: number; opponent: string; scored: number; conceded: number }[]> = {};
  const teamNames: Record<string, string> = {};
  const teamLeagues: Record<string, string> = {};

  sortedMatches.forEach((m, idx) => {
    const home = m.home_team;
    const away = m.away_team;
    
    teamNames[home] = home;
    teamNames[away] = away;
    teamLeagues[home] = m.league;
    teamLeagues[away] = m.league;

    if (!teamMatchesMap[home]) teamMatchesMap[home] = [];
    if (!teamMatchesMap[away]) teamMatchesMap[away] = [];

    teamMatchesMap[home].push({ isHome: true, matchIndex: idx, opponent: away, scored: m.home_goals, conceded: m.away_goals });
    teamMatchesMap[away].push({ isHome: false, matchIndex: idx, opponent: home, scored: m.away_goals, conceded: m.home_goals });
  });

  // Calculate league average goals
  let totalGoals = 0;
  sortedMatches.forEach(m => {
    totalGoals += (m.home_goals + m.away_goals);
  });
  const avgGoalsPerTeam = sortedMatches.length > 0 ? totalGoals / (2 * sortedMatches.length) : 1.25;

  // Initialize strengths to 1.0
  const ratings: Record<string, TeamRating> = {};
  Object.keys(teamNames).forEach(team => {
    ratings[team] = {
      team_id: team,
      team_name: teamNames[team],
      league_id: teamLeagues[team],
      attack_strength: 1.0,
      defense_strength: 1.0,
      matches_played: teamMatchesMap[team].length
    };
  });

  // 2. Perform 5 iterations to converge team strengths relative to opponent strengths
  const decayRate = 0.90; // Decay factor per match (recent matches carry higher weight)

  for (let iter = 0; iter < 5; iter++) {
    const nextStrengths: Record<string, { attack: number; defense: number }> = {};

    Object.keys(teamNames).forEach(team => {
      const matches = teamMatchesMap[team];
      let weightedGoalsScored = 0;
      let weightedGoalsConceded = 0;
      let weightedOpponentDefense = 0;
      let weightedOpponentAttack = 0;
      let totalWeight = 0;

      matches.forEach((m, idx) => {
        // Exponent is the distance from the team's latest match
        const age = matches.length - 1 - idx;
        const weight = Math.pow(decayRate, age);

        const opponentRating = ratings[m.opponent] || { attack_strength: 1.0, defense_strength: 1.0 };

        weightedGoalsScored += m.scored * weight;
        weightedGoalsConceded += m.conceded * weight;
        weightedOpponentDefense += opponentRating.defense_strength * weight;
        weightedOpponentAttack += opponentRating.attack_strength * weight;
        totalWeight += weight;
      });

      if (totalWeight > 0) {
        // attack_strength = Actual weighted goals / (Expected goals against opponent defense)
        const expectedScoreDenom = weightedOpponentDefense * avgGoalsPerTeam;
        const attack = expectedScoreDenom > 0 ? (weightedGoalsScored / expectedScoreDenom) : 1.0;

        // defense_strength = Actual weighted goals conceded / (Expected goals from opponent attack)
        const expectedConcedeDenom = weightedOpponentAttack * avgGoalsPerTeam;
        const defense = expectedConcedeDenom > 0 ? (weightedGoalsConceded / expectedConcedeDenom) : 1.0;

        nextStrengths[team] = {
          attack: Math.max(0.2, Math.min(5.0, attack)),
          defense: Math.max(0.2, Math.min(5.0, defense))
        };
      } else {
        nextStrengths[team] = { attack: 1.0, defense: 1.0 };
      }
    });

    // Apply updated strengths to current ratings for next iteration
    Object.keys(teamNames).forEach(team => {
      ratings[team].attack_strength = nextStrengths[team].attack;
      ratings[team].defense_strength = nextStrengths[team].defense;
    });

    // Normalize ratings so average is 1.0 across the league/sample (prevents rating inflation)
    let sumAttack = 0;
    let sumDefense = 0;
    const teamCount = Object.keys(teamNames).length;

    Object.keys(teamNames).forEach(team => {
      sumAttack += ratings[team].attack_strength;
      sumDefense += ratings[team].defense_strength;
    });

    if (teamCount > 0) {
      const avgAttack = sumAttack / teamCount;
      const avgDefense = sumDefense / teamCount;

      Object.keys(teamNames).forEach(team => {
        ratings[team].attack_strength = Number((ratings[team].attack_strength / avgAttack).toFixed(4));
        ratings[team].defense_strength = Number((ratings[team].defense_strength / avgDefense).toFixed(4));
      });
    }
  }

  return ratings;
}
