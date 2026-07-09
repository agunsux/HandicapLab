// Team Rating System — Elo-based, Deterministic
import { MatchRecord } from './loader';
import type { MatchInput } from '../../services/probability.engine';

export class TeamRatings {
  private elo: Map<string, number> = new Map();
  private goalsFor: Map<string, number[]> = new Map();
  private goalsAgainst: Map<string, number[]> = new Map();
  private static INITIAL_ELO = 1500;
  private static K_FACTOR = 32;

  getElo(team: string): number { return this.elo.get(team) || TeamRatings.INITIAL_ELO; }

  createMatchInput(match: MatchRecord): MatchInput {
    const eg = this.getExpectedGoals(match.homeTeam, match.awayTeam);
    return {
      odds_home: match.psch || match.psh || 2.0,
      odds_draw: match.pscd || match.psd || 3.5,
      odds_away: match.psca || match.psa || 3.8,
      ah_line: 0, ou_line: 2.5, btts_odds: 1.9,
      xg_home: eg.attack, xg_away: eg.defense,
      shots_home: Math.round(eg.attack * 4), shots_away: Math.round(eg.defense * 4),
      shots_on_target_home: Math.round(eg.attack * 1.5), shots_on_target_away: Math.round(eg.defense * 1.5),
      form_home: 3, form_away: 3,
      preMatchFeatures: {
        homeTeamStrength: this.getElo(match.homeTeam) / 1500,
        awayTeamStrength: this.getElo(match.awayTeam) / 1500,
        homeForm: 1.5, awayForm: 1.5,
        h2hHomeWinRate: 0.45, h2hAwayWinRate: 0.35, h2hDrawRate: 0.2,
      },
    };
  }

  getExpectedGoals(home: string, away: string): { attack: number; defense: number } {
    const gf = this.goalsFor.get(home) || [];
    const ga = this.goalsAgainst.get(home) || [];
    const oppGa = this.goalsAgainst.get(away) || [];
    const recentGf = gf.slice(-10);
    const recentGa = ga.slice(-10);
    const recentOppGa = oppGa.slice(-10);
    const avgGf = recentGf.length > 0 ? recentGf.reduce((a, b) => a + b, 0) / recentGf.length : 1.2;
    const avgOppGa = recentOppGa.length > 0 ? recentOppGa.reduce((a, b) => a + b, 0) / recentOppGa.length : 1.2;
    const leagueAvg = 1.35;
    const attackStrength = avgGf / leagueAvg;
    const defenseStrength = avgOppGa / leagueAvg;
    const expected = Math.max(0.3, Math.min(3.5, attackStrength * defenseStrength * leagueAvg));
    return { attack: expected, defense: expected * 0.95 };
  }

  update(match: MatchRecord) {
    const home = match.homeTeam, away = match.awayTeam;
    const homeElo = this.getElo(home), awayElo = this.getElo(away);
    const expectedHome = 1 / (1 + Math.pow(10, (awayElo - homeElo) / 400));
    let hs = 0.5, as = 0.5;
    if (match.ftr === 'H') { hs = 1; as = 0; }
    else if (match.ftr === 'A') { hs = 0; as = 1; }
    this.elo.set(home, homeElo + TeamRatings.K_FACTOR * (hs - expectedHome));
    this.elo.set(away, awayElo + TeamRatings.K_FACTOR * (as - (1 - expectedHome)));
    if (!this.goalsFor.has(home)) this.goalsFor.set(home, []);
    if (!this.goalsAgainst.has(home)) this.goalsAgainst.set(home, []);
    if (!this.goalsFor.has(away)) this.goalsFor.set(away, []);
    if (!this.goalsAgainst.has(away)) this.goalsAgainst.set(away, []);
    this.goalsFor.get(home)!.push(match.fthg);
    this.goalsAgainst.get(home)!.push(match.ftag);
    this.goalsFor.get(away)!.push(match.ftag);
    this.goalsAgainst.get(away)!.push(match.fthg);
  }
}
