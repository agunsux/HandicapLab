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
  odds: {
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
 * Provides read-only access to Gold Layer views (with mockEngine fallback)
 */
export class GoldService {
  public static async getCompetitions(): Promise<GoldCompetition[]> {
    return [
      { id: 'EPL', name: 'Premier League', country: 'England', flag: '🏴', seasonsCount: 7, totalMatches: 2660, avgGoals: 2.81, xgAvg: 2.76, homeWinPct: 46.2, drawPct: 23.8, awayWinPct: 30.0, over25Pct: 55.4, bttsPct: 52.1, ahFavWinPct: 52.3 },
      { id: 'LALIGA', name: 'La Liga', country: 'Spain', flag: '🇪🇸', seasonsCount: 7, totalMatches: 2660, avgGoals: 2.65, xgAvg: 2.58, homeWinPct: 44.8, drawPct: 26.2, awayWinPct: 29.0, over25Pct: 49.2, bttsPct: 48.5, ahFavWinPct: 51.1 },
      { id: 'SERIEA', name: 'Serie A', country: 'Italy', flag: '🇮🇹', seasonsCount: 7, totalMatches: 2660, avgGoals: 2.72, xgAvg: 2.69, homeWinPct: 43.5, drawPct: 27.0, awayWinPct: 29.5, over25Pct: 52.0, bttsPct: 51.0, ahFavWinPct: 50.8 },
      { id: 'BUNDESLIGA', name: 'Bundesliga', country: 'Germany', flag: '🇩🇪', seasonsCount: 7, totalMatches: 2142, avgGoals: 3.12, xgAvg: 3.05, homeWinPct: 45.1, drawPct: 22.4, awayWinPct: 32.5, over25Pct: 61.2, bttsPct: 57.4, ahFavWinPct: 53.4 },
      { id: 'LIGUE1', name: 'Ligue 1', country: 'France', flag: '🇫🇷', seasonsCount: 7, totalMatches: 2420, avgGoals: 2.68, xgAvg: 2.60, homeWinPct: 44.0, drawPct: 25.5, awayWinPct: 30.5, over25Pct: 50.8, bttsPct: 49.2, ahFavWinPct: 49.8 },
      { id: 'EREDIVISIE', name: 'Eredivisie', country: 'Netherlands', flag: '🇳🇱', seasonsCount: 7, totalMatches: 2142, avgGoals: 3.18, xgAvg: 3.10, homeWinPct: 47.0, drawPct: 21.5, awayWinPct: 31.5, over25Pct: 63.5, bttsPct: 58.0, ahFavWinPct: 54.2 },
    ];
  }

  public static async getTeams(): Promise<GoldTeam[]> {
    return [
      { id: 'mancity', name: 'Manchester City', shortName: 'MCI', country: 'England', stadium: 'Etihad Stadium', logo: '⚽', seasonStats: { played: 38, wins: 28, draws: 7, losses: 3, gf: 94, ga: 33, pts: 91, xg: 88.4, xga: 32.1, elo: 1985, formLast5: ['W', 'W', 'W', 'W', 'D'] } },
      { id: 'arsenal', name: 'Arsenal', shortName: 'ARS', country: 'England', stadium: 'Emirates Stadium', logo: '🔴', seasonStats: { played: 38, wins: 26, draws: 6, losses: 6, gf: 88, ga: 42, pts: 84, xg: 81.2, xga: 36.5, elo: 1910, formLast5: ['W', 'L', 'W', 'D', 'W'] } },
      { id: 'liverpool', name: 'Liverpool', shortName: 'LIV', country: 'England', stadium: 'Anfield', logo: '🔴', seasonStats: { played: 38, wins: 24, draws: 8, losses: 6, gf: 86, ga: 41, pts: 80, xg: 84.6, xga: 39.2, elo: 1925, formLast5: ['W', 'W', 'W', 'L', 'W'] } },
      { id: 'villa', name: 'Aston Villa', shortName: 'AVL', country: 'England', stadium: 'Villa Park', logo: '🦁', seasonStats: { played: 38, wins: 20, draws: 8, losses: 10, gf: 76, ga: 61, pts: 68, xg: 69.1, xga: 58.4, elo: 1780, formLast5: ['L', 'W', 'D', 'W', 'W'] } },
      { id: 'tottenham', name: 'Tottenham Hotspur', shortName: 'TOT', country: 'England', stadium: 'Tottenham Hotspur Stadium', logo: '⚪', seasonStats: { played: 38, wins: 20, draws: 6, losses: 12, gf: 74, ga: 61, pts: 66, xg: 68.5, xga: 62.0, elo: 1765, formLast5: ['W', 'L', 'L', 'W', 'L'] } },
      { id: 'chelsea', name: 'Chelsea', shortName: 'CHE', country: 'England', stadium: 'Stamford Bridge', logo: '🔵', seasonStats: { played: 38, wins: 18, draws: 9, losses: 11, gf: 77, ga: 63, pts: 63, xg: 72.8, xga: 59.4, elo: 1750, formLast5: ['W', 'W', 'W', 'W', 'W'] } },
    ];
  }

  public static async getOddsExplorerRecords(filters?: { market?: string; season?: string }): Promise<GoldOddsRecord[]> {
    return [
      { id: 'odd-1', date: '2024-05-19', competition: 'Premier League', season: '2023-24', match: 'Man City vs West Ham', market: 'Asian Handicap', line: '-2.0', bookmaker: 'Pinnacle', openingOdds: 1.95, closingOdds: 1.88, result: 'WIN', clvPct: 3.7, roiPct: 95.0 },
      { id: 'odd-2', date: '2024-05-19', competition: 'Premier League', season: '2023-24', match: 'Arsenal vs Everton', market: 'Asian Handicap', line: '-1.75', bookmaker: 'Pinnacle', openingOdds: 1.92, closingOdds: 1.96, result: 'LOSS', clvPct: -2.0, roiPct: -100.0 },
      { id: 'odd-3', date: '2024-05-19', competition: 'Premier League', season: '2023-24', match: 'Liverpool vs Wolves', market: 'Over/Under', line: '3.5', bookmaker: 'Bet365', openingOdds: 2.05, closingOdds: 1.95, result: 'WIN', clvPct: 5.1, roiPct: 105.0 },
      { id: 'odd-4', date: '2024-05-19', competition: 'Premier League', season: '2023-24', match: 'Brighton vs Man Utd', market: 'Moneyline', line: 'Home', bookmaker: 'Pinnacle', openingOdds: 2.25, closingOdds: 2.15, result: 'LOSS', clvPct: 4.6, roiPct: -100.0 },
      { id: 'odd-5', date: '2024-05-19', competition: 'Premier League', season: '2023-24', match: 'Chelsea vs Bournemouth', market: 'BTTS', line: 'Yes', bookmaker: 'SBOBET', openingOdds: 1.65, closingOdds: 1.62, result: 'WIN', clvPct: 1.8, roiPct: 65.0 },
    ];
  }
}
