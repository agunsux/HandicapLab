import axios from 'axios';
import {
  Match,
  MatchOdds,
  Signal,
  MarketDepth,
  PerformanceStats,
  MarketType,
  SignalType,
} from '@/types';

// Axios Instance 1: football-data.org
const footballDataClient = axios.create({
  baseURL: 'https://api.football-data.org/v4',
  headers: {
    'X-Auth-Token':
      process.env.VITE_FOOTBALL_DATA_API_KEY ||
      process.env.NEXT_PUBLIC_FOOTBALL_DATA_API_KEY ||
      '',
  },
  timeout: 10000,
});

// Axios Instance 2: API-Football via RapidAPI
const rapidApiClient = axios.create({
  baseURL: 'https://api-football-v1.p.rapidapi.com/v3',
  headers: {
    'X-RapidAPI-Key':
      process.env.VITE_RAPIDAPI_KEY || process.env.NEXT_PUBLIC_RAPIDAPI_KEY || '',
    'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
  },
  timeout: 10000,
});

// Axios Instance 3: The Odds API
const oddsApiClient = axios.create({
  baseURL: 'https://api.the-odds-api.com/v4',
  timeout: 15000,
});

// Axios Instance 4: Internal Value Engine
const valueEngineClient = axios.create({
  baseURL:
    process.env.VITE_VALUE_ENGINE_URL ||
    process.env.NEXT_PUBLIC_VALUE_ENGINE_URL ||
    '/api/v1',
  timeout: 8000,
});

// Mock Generators
export function generateMockMatches(count: number = 12): Match[] {
  const teams = [
    { home: 'Man City', away: 'Liverpool', league: 'Premier League', country: 'England' },
    { home: 'Real Madrid', away: 'Barcelona', league: 'La Liga', country: 'Spain' },
    { home: 'Bayern Munich', away: 'Borussia Dortmund', league: 'Bundesliga', country: 'Germany' },
    { home: 'Juventus', away: 'Inter Milan', league: 'Serie A', country: 'Italy' },
    { home: 'PSG', away: 'Marseille', league: 'Ligue 1', country: 'France' },
    { home: 'Ajax', away: 'PSV Eindhoven', league: 'Eredivisie', country: 'Netherlands' },
    { home: 'Arsenal', away: 'Chelsea', league: 'Premier League', country: 'England' },
    { home: 'Atletico Madrid', away: 'Sevilla', league: 'La Liga', country: 'Spain' },
    { home: 'AC Milan', away: 'Napoli', league: 'Serie A', country: 'Italy' },
    { home: 'Leverkusen', away: 'RB Leipzig', league: 'Bundesliga', country: 'Germany' },
    { home: 'Lyon', away: 'Monaco', league: 'Ligue 1', country: 'France' },
    { home: 'Tottenham', away: 'Manchester United', league: 'Premier League', country: 'England' },
  ];

  return teams.slice(0, count).map((t, idx) => {
    const isLive = idx === 1 || idx === 3;
    const isFinished = idx === 5;
    return {
      id: `m-${101 + idx}`,
      homeTeam: t.home,
      awayTeam: t.away,
      league: t.league,
      country: t.country,
      kickoff: new Date(Date.now() + (idx - 2) * 3600000 * 6).toISOString(),
      status: isLive ? 'LIVE' : isFinished ? 'FINISHED' : 'SCHEDULED',
      minute: isLive ? 34 + idx * 12 : undefined,
      score: isLive || isFinished ? { home: 1 + (idx % 2), away: idx % 3 } : undefined,
    };
  });
}

export function generateMockOdds(matchId: string): MatchOdds[] {
  const bookies = ['Pinnacle', 'Bet365', 'Betfair', 'SBOBet', 'MaxBet', '188Bet'];
  const markets: MarketType[] = ['asian_handicap', 'over_under', 'moneyline', 'btts'];
  const result: MatchOdds[] = [];

  markets.forEach((market) => {
    bookies.forEach((b) => {
      const baseOdds = Number((1.75 + Math.random() * 1.4).toFixed(2));
      const change = Number(((Math.random() - 0.48) * 8).toFixed(1));
      result.push({
        matchId,
        bookmaker: b,
        market,
        selection: market === 'moneyline' ? 'Home Win' : market === 'over_under' ? 'Over 2.5' : market === 'btts' ? 'BTTS Yes' : 'Home -0.5',
        odds: baseOdds,
        line: market === 'asian_handicap' ? -0.5 : market === 'over_under' ? 2.5 : undefined,
        volume: Math.floor(Math.random() * 50000 + 5000),
        timestamp: new Date().toISOString(),
        previousOdds: Number((baseOdds - change * 0.02).toFixed(2)),
        changePercent: change,
      });
    });
  });

  return result;
}

export function generateMockSignals(count: number = 10): Signal[] {
  const matches = generateMockMatches(count);
  const signalTypes: SignalType[] = ['value', 'steam', 'drift', 'reverse_line', 'sharp'];
  const markets: MarketType[] = ['asian_handicap', 'over_under', 'moneyline', 'btts'];
  const bookies = ['Pinnacle', 'SBOBet', 'Bet365', 'Betfair'];

  return matches.map((m, idx) => {
    const market = markets[idx % markets.length];
    const type = signalTypes[idx % signalTypes.length];
    const odds = Number((1.85 + (idx % 4) * 0.15).toFixed(2));
    const fairOdds = Number((odds * 0.91).toFixed(2));
    const ev = Number(((1 / fairOdds - 1 / odds) * 100 * 1.8).toFixed(1));
    const confidence = 65 + (idx * 3) % 30;

    return {
      id: `sig-${101 + idx}`,
      matchId: m.id,
      type,
      market,
      selection: `${m.homeTeam} ${market === 'asian_handicap' ? '-0.75' : market === 'over_under' ? 'Over 2.5' : 'Win'}`,
      confidence,
      ev,
      odds,
      fairOdds,
      edge: Number((ev * 0.85).toFixed(1)),
      bookmaker: bookies[idx % bookies.length],
      timestamp: new Date().toISOString(),
      expiresAt: '2h 15m',
      reason: `Sharp volume surge detected on ${bookies[idx % bookies.length]} line. Model projected fair odds at ${fairOdds.toFixed(2)} vs market price ${odds.toFixed(2)}.`,
      sharpMoneyIndicator: 70 + (idx * 7) % 28,
      lineMovement: type === 'steam' ? 'steam' : type === 'drift' ? 'drift' : 'stable',
      publicMoneyPercent: 30 + (idx * 5) % 40,
      // Compatibility UI props
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      league: m.league,
      kickoff: m.kickoff,
      marketType: market === 'asian_handicap' ? 'AH' : market === 'over_under' ? 'OU' : market === 'moneyline' ? 'ML' : 'BTTS',
      signalCategory: type.toUpperCase().replace('_', ' '),
      isHighValue: ev > 8.0,
    };
  });
}

export function generateMockPerformance(days: number = 30): PerformanceStats[] {
  let cum = 0;
  return Array.from({ length: days }).map((_, idx) => {
    const date = new Date(Date.now() - (days - 1 - idx) * 86400000).toISOString().split('T')[0];
    const profit = Number(((Math.random() - 0.42) * 4.2).toFixed(2));
    cum += profit;
    return {
      date,
      profit,
      cumulative: Number(cum.toFixed(2)),
      bets: Math.floor(Math.random() * 6 + 1),
      winRate: Number((52 + Math.random() * 14).toFixed(1)),
    };
  });
}

// Service Functions (Real API Call with Fallback)

export async function fetchMatches(dateFrom?: string, dateTo?: string): Promise<Match[]> {
  try {
    const res = await footballDataClient.get('/matches', {
      params: { dateFrom, dateTo },
    });
    if (res.data?.matches?.length > 0) {
      return res.data.matches.map((m: any) => ({
        id: String(m.id),
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        league: m.competition.name,
        country: m.area?.name || 'Europe',
        kickoff: m.utcDate,
        status: m.status === 'IN_PLAY' || m.status === 'PAUSED' ? 'LIVE' : m.status,
        minute: m.minute,
        score: m.score?.fullTime?.home !== null ? { home: m.score.fullTime.home, away: m.score.fullTime.away } : undefined,
      }));
    }
  } catch (err) {
    console.warn('[API Service] fetchMatches failed, using fallback mock data:', err);
  }
  return generateMockMatches();
}

export async function fetchLiveMatches(): Promise<Match[]> {
  try {
    const res = await footballDataClient.get('/matches', {
      params: { status: 'LIVE,IN_PLAY' },
    });
    if (res.data?.matches?.length > 0) {
      return res.data.matches.map((m: any) => ({
        id: String(m.id),
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        league: m.competition.name,
        country: m.area?.name || 'Europe',
        kickoff: m.utcDate,
        status: 'LIVE',
        minute: m.minute || 45,
        score: { home: m.score?.fullTime?.home ?? 1, away: m.score?.fullTime?.away ?? 0 },
      }));
    }
  } catch (err) {
    console.warn('[API Service] fetchLiveMatches failed, using fallback mock data:', err);
  }
  return generateMockMatches().filter((m) => m.status === 'LIVE');
}

export async function fetchCompetitions(): Promise<any[]> {
  try {
    const res = await footballDataClient.get('/competitions');
    return res.data?.competitions || [];
  } catch {
    return [{ id: 2021, name: 'Premier League' }, { id: 2014, name: 'La Liga' }];
  }
}

export async function fetchMatchStats(fixtureId: number): Promise<any> {
  try {
    const res = await rapidApiClient.get('/fixtures/statistics', {
      params: { fixture: fixtureId },
    });
    return res.data?.response || null;
  } catch {
    return { xG: { home: 1.84, away: 0.92 } };
  }
}

export async function fetchTeamForm(teamId: number, last: number = 5): Promise<any> {
  try {
    const res = await rapidApiClient.get('/teams/statistics', {
      params: { team: teamId, last },
    });
    return res.data?.response || null;
  } catch {
    return { form: 'WWDLW' };
  }
}

export async function fetchPredictions(fixtureId: number): Promise<any> {
  try {
    const res = await rapidApiClient.get('/predictions', {
      params: { fixture: fixtureId },
    });
    return res.data?.response || null;
  } catch {
    return { advice: 'Combo Double chance : Home or Draw' };
  }
}

export async function fetchOdds(sport: string = 'soccer_epl', regions: string = 'eu'): Promise<MatchOdds[]> {
  try {
    const apiKey = process.env.VITE_ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
    if (apiKey) {
      const res = await oddsApiClient.get(`/sports/${sport}/odds`, {
        params: { apiKey, regions, markets: 'h2h,totals,spreads,btts', oddsFormat: 'decimal' },
      });
      if (res.data?.length > 0) {
        const result: MatchOdds[] = [];
        res.data.forEach((match: any) => {
          match.bookmakers?.forEach((b: any) => {
            b.markets?.forEach((m: any) => {
              m.outcomes?.forEach((o: any) => {
                result.push({
                  matchId: match.id,
                  bookmaker: b.title,
                  market: m.key === 'h2h' ? 'moneyline' : m.key === 'totals' ? 'over_under' : m.key === 'spreads' ? 'asian_handicap' : 'btts',
                  selection: o.name,
                  odds: o.price,
                  line: o.point,
                  timestamp: b.last_update,
                });
              });
            });
          });
        });
        if (result.length > 0) return result;
      }
    }
  } catch (err) {
    console.warn('[API Service] fetchOdds failed, using fallback mock data:', err);
  }
  return generateMockOdds('m-101');
}

export async function fetchOddsHistory(eventId: string): Promise<any> {
  try {
    const apiKey = process.env.VITE_ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
    const res = await oddsApiClient.get(`/historical/events/${eventId}/odds`, {
      params: { apiKey },
    });
    return res.data || null;
  } catch {
    return { history: [] };
  }
}

export async function fetchSignals(filters?: any): Promise<Signal[]> {
  try {
    const res = await valueEngineClient.get('/signals', { params: filters });
    if (res.data?.length > 0) {
      return res.data;
    }
  } catch (err) {
    console.warn('[API Service] fetchSignals failed, using fallback mock data:', err);
  }
  return generateMockSignals();
}

export async function fetchSignalDetails(signalId: string): Promise<Signal | null> {
  try {
    const res = await valueEngineClient.get(`/signals/${signalId}`);
    if (res.data) return res.data;
  } catch {}
  const signals = generateMockSignals();
  return signals.find((s) => s.id === signalId) || signals[0] || null;
}

export async function fetchMarketDepth(matchId: string, market: MarketType): Promise<MarketDepth> {
  try {
    const res = await valueEngineClient.get('/market-depth', {
      params: { matchId, market },
    });
    if (res.data) return res.data;
  } catch {}
  return {
    matchId,
    market,
    selections: [
      { name: 'Home Win', bestOdds: 2.05, bookmaker: 'Pinnacle', volumeWeightedOdds: 1.98, liquidityScore: 92 },
      { name: 'Draw', bestOdds: 3.40, bookmaker: 'Bet365', volumeWeightedOdds: 3.35, liquidityScore: 84 },
      { name: 'Away Win', bestOdds: 3.60, bookmaker: 'SBOBet', volumeWeightedOdds: 3.50, liquidityScore: 88 },
    ],
  };
}

export async function fetchPerformanceReport(days: number = 30): Promise<PerformanceStats[]> {
  try {
    const res = await valueEngineClient.get('/performance', {
      params: { days },
    });
    if (res.data?.length > 0) return res.data;
  } catch {}
  return generateMockPerformance(days);
}
