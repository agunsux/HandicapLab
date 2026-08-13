import axios from 'axios';
import {
  Match,
  MatchOdds,
  Signal,
  MarketDepth,
  PerformanceStats,
  MarketType,
} from '@/types';

import {
  generateMockMatches,
  generateMockOdds,
  generateMockSignals,
  generateMockPerformance,
  generateMockMatchStats,
  generateMockPredictions,
  generateMockMarketDepth,
} from './mockEngine';

// Re-export mock functions for components or tests importing directly from api.ts
export {
  generateMockMatches,
  generateMockOdds,
  generateMockSignals,
  generateMockPerformance,
  generateMockMatchStats,
  generateMockPredictions,
  generateMockMarketDepth,
};

// ==========================================
// 1. API CLIENT DEFINITIONS (5 EXTERNAL PROVIDERS)
// ==========================================

import { globalGateway } from '@/lib/providers/providerGateway';
import { filterOddsPapiBookmakers } from '@/lib/providers/oddspapiFilter';

// API 1: football-data.org (Matches & Schedules) - DEPRECATED
export const footballDataClient = {
  async get(url: string, config?: any): Promise<any> {
    throw new Error('footballDataClient is disabled/dead.');
  }
};

// API 2: API-Football (API-Sports DIRECT)
export const apiFootball = {
  async get(url: string, config?: any) {
    const baseURL = 'https://v3.football.api-sports.io';
    const params = new URLSearchParams(config?.params || {});
    const fullUrl = `${baseURL}${url}${params.toString() ? '?' + params.toString() : ''}`;
    const headers = {
      'x-apisports-key':
        process.env.VITE_APIFOOTBALL_KEY ||
        process.env.NEXT_PUBLIC_APIFOOTBALL_KEY ||
        process.env.API_FOOTBALL_KEY ||
        '',
    };

    const response = await globalGateway.fetch('apifootball', url, fullUrl, {
      method: 'GET',
      headers,
      cacheTtlMs: config?.params?.live ? 60000 : 3600000, // 1 min for live, 1 hr otherwise
    });
    
    return {
      data: await response.json(),
      status: response.status,
      headers: response.headers
    };
  }
};

// API 3: TheStatsAPI (xG, Advanced Analytics, Form) - DEPRECATED
export const theStatsApi = {
  async get(url: string, config?: any): Promise<any> {
    throw new Error('theStatsApi is disabled/dead.');
  }
};

// API 4: The Odds API (Bookmaker Odds) - DEPRECATED
export const oddsApiClient = {
  async get(url: string, config?: any): Promise<any> {
    throw new Error('oddsApiClient is disabled/dead.');
  }
};

// API 5: OddsPAPI (Odds Comparison, Line Movements)
export const oddsPapi = {
  async get(url: string, config?: any) {
    const baseURL = 'https://api.oddspapi.com/v1';
    const params = new URLSearchParams(config?.params || {});
    const fullUrl = `${baseURL}${url}${params.toString() ? '?' + params.toString() : ''}`;
    const headers = {
      'x-api-key': process.env.ODDS_PAPI_KEY || process.env.ODDSPAPI_KEY || '',
    };

    const response = await globalGateway.fetch('oddspapi', url, fullUrl, {
      method: 'GET',
      headers,
      cacheTtlMs: 300000, // 5 min
    });

    const data = await response.json();
    return {
      data: filterOddsPapiBookmakers(data),
      status: response.status,
      headers: response.headers
    };
  }
};

// Internal Value Engine Client
export const valueEngineClient = axios.create({
  baseURL:
    process.env.VITE_VALUE_ENGINE_URL ||
    process.env.NEXT_PUBLIC_VALUE_ENGINE_URL ||
    '/api/v1',
  timeout: 8000,
});

// Helper to check if API key exists and is valid (not empty/placeholder)
function isKeyValid(key?: string): boolean {
  if (!key) return false;
  const k = key.trim().toLowerCase();
  return k.length > 5 && !k.includes('your_') && !k.includes('placeholder');
}

// ==========================================
// 2. TRANSFORMER FUNCTIONS
// ==========================================

export function transformFootballDataMatches(data: any): Match[] {
  if (!data?.matches?.length) return [];
  return data.matches.map((m: any) => ({
    id: String(m.id),
    homeTeam: m.homeTeam?.name || 'Home Team',
    awayTeam: m.awayTeam?.name || 'Away Team',
    league: m.competition?.name || 'Premier League',
    country: m.area?.name || 'Europe',
    kickoff: m.utcDate || new Date().toISOString(),
    status: m.status === 'IN_PLAY' || m.status === 'PAUSED' ? 'LIVE' : m.status || 'SCHEDULED',
    minute: m.minute,
    score: m.score?.fullTime?.home !== null ? { home: m.score.fullTime.home, away: m.score.fullTime.away } : undefined,
  }));
}

export function transformApiFootballFixtures(response: any[]): Match[] {
  if (!response?.length) return [];
  return response.map((item: any) => {
    const f = item.fixture || {};
    const t = item.teams || {};
    const g = item.goals || {};
    const l = item.league || {};
    const isLive = ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(f.status?.short);
    
    return {
      id: String(f.id),
      homeTeam: t.home?.name || 'Home',
      awayTeam: t.away?.name || 'Away',
      league: l.name || 'League',
      country: l.country || 'International',
      kickoff: f.date || new Date().toISOString(),
      status: isLive ? 'LIVE' : f.status?.short === 'FT' ? 'FINISHED' : 'SCHEDULED',
      minute: f.status?.elapsed || undefined,
      score: isLive || f.status?.short === 'FT' ? { home: g.home ?? 0, away: g.away ?? 0 } : undefined,
    };
  });
}

export function transformTheStatsMatches(data: any): Match[] {
  const matches = Array.isArray(data) ? data : data?.data || data?.matches || [];
  if (!matches.length) return [];
  return matches.map((m: any, idx: number) => ({
    id: String(m.id || `tsm-${idx}`),
    homeTeam: m.home_team?.name || m.homeTeam || 'Home',
    awayTeam: m.away_team?.name || m.awayTeam || 'Away',
    league: m.league_name || m.league || 'League',
    country: m.country || 'World',
    kickoff: m.match_time || m.kickoff || new Date().toISOString(),
    status: m.status === 'live' ? 'LIVE' : m.status === 'ended' ? 'FINISHED' : 'SCHEDULED',
    minute: m.minute,
    score: m.score ? { home: m.score.home, away: m.score.away } : undefined,
  }));
}

export function transformOddsApi(data: any[]): MatchOdds[] {
  if (!Array.isArray(data) || !data.length) return [];
  const result: MatchOdds[] = [];

  data.forEach((match: any) => {
    match.bookmakers?.forEach((b: any) => {
      b.markets?.forEach((m: any) => {
        m.outcomes?.forEach((o: any) => {
          result.push({
            matchId: match.id,
            bookmaker: b.title || b.key,
            market:
              m.key === 'h2h'
                ? 'moneyline'
                : m.key === 'totals'
                ? 'over_under'
                : m.key === 'spreads'
                ? 'asian_handicap'
                : 'btts',
            selection: o.name,
            odds: o.price,
            line: o.point,
            timestamp: b.last_update || new Date().toISOString(),
          });
        });
      });
    });
  });

  return result;
}

export function transformOddsPapi(data: any): MatchOdds[] {
  const items = Array.isArray(data) ? data : data?.odds || data?.data || [];
  if (!items.length) return [];
  return items.map((o: any, idx: number) => ({
    matchId: String(o.match_id || o.fixture_id || `op-${idx}`),
    bookmaker: o.bookmaker || 'Pinnacle',
    market: o.market || 'asian_handicap',
    selection: o.selection || 'Home Win',
    odds: Number(o.odds || o.price || 1.90),
    line: o.line,
    timestamp: o.timestamp || new Date().toISOString(),
  }));
}

export function transformApiFootballOdds(data: any[]): MatchOdds[] {
  if (!data?.length) return [];
  const result: MatchOdds[] = [];

  data.forEach((item: any) => {
    const fixtureId = String(item.fixture?.id);
    item.bookmakers?.forEach((b: any) => {
      b.bets?.forEach((bet: any) => {
        const market: MarketType =
          bet.name?.toLowerCase().includes('handicap')
            ? 'asian_handicap'
            : bet.name?.toLowerCase().includes('over/under')
            ? 'over_under'
            : bet.name?.toLowerCase().includes('both teams')
            ? 'btts'
            : 'moneyline';

        bet.values?.forEach((val: any) => {
          result.push({
            matchId: fixtureId,
            bookmaker: b.name,
            market,
            selection: val.value,
            odds: Number(val.odd),
            timestamp: new Date().toISOString(),
          });
        });
      });
    });
  });

  return result;
}

// ==========================================
// 3. SERVICE FUNCTIONS WITH FALLBACK CHAINS
// ==========================================

export async function fetchMatches(dateFrom?: string, dateTo?: string): Promise<Match[]> {
  // Try 1: football-data.org
  const fdKey = process.env.VITE_FOOTBALL_DATA_API_KEY || process.env.NEXT_PUBLIC_FOOTBALL_DATA_API_KEY;
  if (isKeyValid(fdKey)) {
    try {
      const res = await footballDataClient.get('/matches', { params: { dateFrom, dateTo } });
      const matches = transformFootballDataMatches(res.data);
      if (matches.length > 0) return matches;
    } catch (err) {
      console.warn('[API Service] football-data.org failed, trying API-Football:', err);
    }
  }

  // Try 2: API-Football (Direct API-Sports)
  const afKey =
    process.env.VITE_APIFOOTBALL_KEY ||
    process.env.NEXT_PUBLIC_APIFOOTBALL_KEY ||
    process.env.API_FOOTBALL_KEY;
  if (isKeyValid(afKey)) {
    try {
      const res = await apiFootball.get('/fixtures', {
        params: { date: dateFrom || new Date().toISOString().split('T')[0], timezone: 'Europe/London' },
      });
      const matches = transformApiFootballFixtures(res.data?.response);
      if (matches.length > 0) return matches;
    } catch (err) {
      console.warn('[API Service] API-Football failed, trying TheStatsAPI:', err);
    }
  }

  // Try 3: TheStatsAPI
  const tsKey = process.env.VITE_THESTATS_API_KEY || process.env.NEXT_PUBLIC_THESTATS_API_KEY;
  if (isKeyValid(tsKey)) {
    try {
      const res = await theStatsApi.get('/football/matches', {
        params: { date: dateFrom || new Date().toISOString().split('T')[0] },
      });
      const matches = transformTheStatsMatches(res.data);
      if (matches.length > 0) return matches;
    } catch (err) {
      console.warn('[API Service] TheStatsAPI failed:', err);
    }
  }

  // Final Fallback: Mock Engine (FAZE 1 Active)
  console.warn('[API Service] API key not configured — using mock data');
  return generateMockMatches(12, dateFrom || 'today');
}

export async function fetchLiveMatches(): Promise<Match[]> {
  // Try 1: football-data.org LIVE
  const fdKey = process.env.VITE_FOOTBALL_DATA_API_KEY || process.env.NEXT_PUBLIC_FOOTBALL_DATA_API_KEY;
  if (isKeyValid(fdKey)) {
    try {
      const res = await footballDataClient.get('/matches', { params: { status: 'LIVE,IN_PLAY' } });
      const matches = transformFootballDataMatches(res.data);
      if (matches.length > 0) return matches;
    } catch (err) {
      console.warn('[API Service] football-data.org live failed:', err);
    }
  }

  // Try 2: API-Football live
  const afKey = process.env.VITE_APIFOOTBALL_KEY || process.env.NEXT_PUBLIC_APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY;
  if (isKeyValid(afKey)) {
    try {
      const res = await apiFootball.get('/fixtures', { params: { live: 'all' } });
      const matches = transformApiFootballFixtures(res.data?.response);
      if (matches.length > 0) return matches;
    } catch (err) {
      console.warn('[API Service] API-Football live failed:', err);
    }
  }

  // Try 3: OddsPAPI live
  const opKey = process.env.ODDS_PAPI_KEY || process.env.ODDSPAPI_KEY;
  if (isKeyValid(opKey)) {
    try {
      const res = await oddsPapi.get('/matches/live');
      const matches = transformTheStatsMatches(res.data);
      if (matches.length > 0) return matches;
    } catch (err) {
      console.warn('[API Service] OddsPAPI live failed:', err);
    }
  }

  // Final Fallback: Mock Engine
  console.warn('[API Service] API key not configured — using mock data');
  return generateMockMatches(12).filter((m) => m.status === 'LIVE');
}

export async function fetchCompetitions(): Promise<any[]> {
  const fdKey = process.env.VITE_FOOTBALL_DATA_API_KEY || process.env.NEXT_PUBLIC_FOOTBALL_DATA_API_KEY;
  if (isKeyValid(fdKey)) {
    try {
      const res = await footballDataClient.get('/competitions');
      if (res.data?.competitions?.length > 0) return res.data.competitions;
    } catch (err) {
      console.warn('[API Service] fetchCompetitions failed:', err);
    }
  }
  return [
    { id: 2021, name: 'Premier League', code: 'PL' },
    { id: 2014, name: 'La Liga', code: 'PD' },
    { id: 2002, name: 'Bundesliga', code: 'BL1' },
    { id: 2019, name: 'Serie A', code: 'SA' },
    { id: 2015, name: 'Ligue 1', code: 'FL1' },
  ];
}

export async function fetchMatchStats(fixtureId: number | string): Promise<any> {
  const afKey = process.env.VITE_APIFOOTBALL_KEY || process.env.NEXT_PUBLIC_APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY;
  if (isKeyValid(afKey)) {
    try {
      const res = await apiFootball.get('/fixtures/statistics', { params: { fixture: fixtureId } });
      if (res.data?.response?.length > 0) return res.data.response;
    } catch (err) {
      console.warn('[API Service] fetchMatchStats API-Football failed:', err);
    }
  }

  const tsKey = process.env.VITE_THESTATS_API_KEY || process.env.NEXT_PUBLIC_THESTATS_API_KEY;
  if (isKeyValid(tsKey)) {
    try {
      const res = await theStatsApi.get(`/football/matches/${fixtureId}/stats`);
      if (res.data) return res.data;
    } catch (err) {
      console.warn('[API Service] fetchMatchStats TheStatsAPI failed:', err);
    }
  }

  console.warn('[API Service] API key not configured — using mock data');
  return generateMockMatchStats(fixtureId);
}

export async function fetchTeamForm(teamId: number | string, last: number = 5): Promise<any> {
  const afKey = process.env.VITE_APIFOOTBALL_KEY || process.env.NEXT_PUBLIC_APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY;
  if (isKeyValid(afKey)) {
    try {
      const res = await apiFootball.get('/teams/statistics', { params: { team: teamId, last, season: 2025 } });
      if (res.data?.response) return res.data.response;
    } catch (err) {
      console.warn('[API Service] fetchTeamForm API-Football failed:', err);
    }
  }

  const tsKey = process.env.VITE_THESTATS_API_KEY || process.env.NEXT_PUBLIC_THESTATS_API_KEY;
  if (isKeyValid(tsKey)) {
    try {
      const res = await theStatsApi.get(`/football/teams/${teamId}/form`);
      if (res.data) return res.data;
    } catch (err) {
      console.warn('[API Service] fetchTeamForm TheStatsAPI failed:', err);
    }
  }

  return { form: 'WWDLW', goalsScored: 2.1, goalsConceded: 0.8 };
}

export async function fetchPredictions(fixtureId: number | string): Promise<any> {
  const afKey = process.env.VITE_APIFOOTBALL_KEY || process.env.NEXT_PUBLIC_APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY;
  if (isKeyValid(afKey)) {
    try {
      const res = await apiFootball.get('/predictions', { params: { fixture: fixtureId } });
      if (res.data?.response?.length > 0) return res.data.response[0];
    } catch (err) {
      console.warn('[API Service] fetchPredictions API-Football failed:', err);
    }
  }

  const tsKey = process.env.VITE_THESTATS_API_KEY || process.env.NEXT_PUBLIC_THESTATS_API_KEY;
  if (isKeyValid(tsKey)) {
    try {
      const res = await theStatsApi.get('/football/predictions', { params: { match_id: fixtureId } });
      if (res.data) return res.data;
    } catch (err) {
      console.warn('[API Service] fetchPredictions TheStatsAPI failed:', err);
    }
  }

  console.warn('[API Service] API key not configured — using mock data');
  return generateMockPredictions(fixtureId);
}

export async function fetchOdds(
  sport: string = 'soccer_epl',
  regions: string = 'eu',
  tick: number = 0
): Promise<MatchOdds[]> {
  // Try 1: The Odds API
  const oddsKey =
    process.env.VITE_THE_ODDS_API_KEY ||
    process.env.VITE_ODDS_API_KEY ||
    process.env.NEXT_PUBLIC_ODDS_API_KEY;
  if (isKeyValid(oddsKey)) {
    try {
      const res = await oddsApiClient.get(`/sports/${sport}/odds`, {
        params: { apiKey: oddsKey, regions, markets: 'h2h,totals,spreads,btts', oddsFormat: 'decimal' },
      });
      const odds = transformOddsApi(res.data);
      if (odds.length > 0) return odds;
    } catch (err) {
      console.warn('[API Service] The Odds API failed, trying OddsPAPI:', err);
    }
  }

  // Try 2: OddsPAPI
  const opKey = process.env.ODDS_PAPI_KEY || process.env.ODDSPAPI_KEY;
  if (isKeyValid(opKey)) {
    try {
      const res = await oddsPapi.get('/odds');
      const odds = transformOddsPapi(res.data);
      if (odds.length > 0) return odds;
    } catch (err) {
      console.warn('[API Service] OddsPAPI failed, trying API-Football odds:', err);
    }
  }

  // Try 3: API-Football (odds)
  const afKey = process.env.VITE_APIFOOTBALL_KEY || process.env.NEXT_PUBLIC_APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY;
  if (isKeyValid(afKey)) {
    try {
      const res = await apiFootball.get('/odds', { params: { date: new Date().toISOString().split('T')[0] } });
      const odds = transformApiFootballOdds(res.data?.response);
      if (odds.length > 0) return odds;
    } catch (err) {
      console.warn('[API Service] API-Football odds failed:', err);
    }
  }

  // Final Fallback: Mock Engine
  console.warn('[API Service] API key not configured — using mock data');
  return generateMockOdds('m-101', tick);
}

export async function fetchOddsHistory(eventId: string): Promise<any> {
  const opKey = process.env.ODDS_PAPI_KEY || process.env.ODDSPAPI_KEY;
  if (isKeyValid(opKey)) {
    try {
      const res = await oddsPapi.get('/odds/movement', { params: { match_id: eventId } });
      if (res.data) return res.data;
    } catch (err) {
      console.warn('[API Service] OddsPAPI movement failed:', err);
    }
  }

  const oddsKey = process.env.VITE_THE_ODDS_API_KEY || process.env.VITE_ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
  if (isKeyValid(oddsKey)) {
    try {
      const res = await oddsApiClient.get(`/historical/sports/soccer_epl/odds`, {
        params: { apiKey: oddsKey, date: new Date().toISOString() },
      });
      if (res.data) return res.data;
    } catch (err) {
      console.warn('[API Service] The Odds API historical failed:', err);
    }
  }

  return { history: [] };
}

export async function fetchSignals(filters?: any): Promise<Signal[]> {
  try {
    const res = await valueEngineClient.get('/signals', { params: filters });
    if (res.data?.length > 0) return res.data;
  } catch (err) {
    console.warn('[API Service] fetchSignals failed, using mock engine:', err);
  }
  console.warn('[API Service] API key not configured — using mock data');
  return generateMockSignals(10);
}

export async function fetchSignalDetails(signalId: string): Promise<Signal | null> {
  try {
    const res = await valueEngineClient.get(`/signals/${signalId}`);
    if (res.data) return res.data;
  } catch {}
  const signals = generateMockSignals(10);
  return signals.find((s) => s.id === signalId) || signals[0] || null;
}

export async function fetchMarketDepth(matchId: string, market: MarketType): Promise<MarketDepth> {
  try {
    const res = await valueEngineClient.get('/market-depth', { params: { matchId, market } });
    if (res.data) return res.data;
  } catch {}
  console.warn('[API Service] API key not configured — using mock data');
  return generateMockMarketDepth(matchId, market);
}

export async function fetchPerformanceReport(days: number = 30): Promise<PerformanceStats[]> {
  try {
    const res = await valueEngineClient.get('/performance', { params: { days } });
    if (res.data?.length > 0) return res.data;
  } catch {}
  console.warn('[API Service] API key not configured — using mock data');
  return generateMockPerformance(days);
}
