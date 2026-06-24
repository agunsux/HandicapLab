import { supabase } from '@/lib/supabase.server';
import { getMatches as getMockMatches, getPredictionsForMatch as getMockPredictions } from '@/lib/mock-data';

export interface LeagueCache {
  api_id: number;
  name: string;
  slug: string;
  country: string;
  logo_url: string;
  season: string;
  stats: {
    avgGoals: number;
    bttsPercent: number;
    over25Percent: number;
    homeWinPercent: number;
    drawPercent: number;
    awayWinPercent: number;
  };
}

export interface MatchPrediction {
  matchId: string;
  kickoffTime: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  handicapLine: number;
  handicapProbability: number;
  handicapFairOdds: number;
  handicapMarketOdds: number;
  handicapEdgePercent: number;
  confidenceScore: number;
  totalLine: number;
  overProbability: number;
  underProbability: number;
  ouEdgePercent: number;
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
}

export const slugify = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
};

// Rich static leagues database for fallback pre-renders & offline validation
export const STATIC_LEAGUES: LeagueCache[] = [
  {
    api_id: 39,
    name: 'English Premier League',
    slug: 'english-premier-league',
    country: 'England',
    logo_url: 'https://media.api-sports.io/football/leagues/39.png',
    season: '2026',
    stats: { avgGoals: 2.85, bttsPercent: 54, over25Percent: 58, homeWinPercent: 46, drawPercent: 23, awayWinPercent: 31 }
  },
  {
    api_id: 140,
    name: 'La Liga',
    slug: 'la-liga',
    country: 'Spain',
    logo_url: 'https://media.api-sports.io/football/leagues/140.png',
    season: '2026',
    stats: { avgGoals: 2.58, bttsPercent: 49, over25Percent: 51, homeWinPercent: 44, drawPercent: 26, awayWinPercent: 30 }
  },
  {
    api_id: 78,
    name: 'Bundesliga',
    slug: 'bundesliga',
    country: 'Germany',
    logo_url: 'https://media.api-sports.io/football/leagues/78.png',
    season: '2026',
    stats: { avgGoals: 3.12, bttsPercent: 61, over25Percent: 64, homeWinPercent: 47, drawPercent: 22, awayWinPercent: 31 }
  },
  {
    api_id: 135,
    name: 'Serie A',
    slug: 'serie-a',
    country: 'Italy',
    logo_url: 'https://media.api-sports.io/football/leagues/135.png',
    season: '2026',
    stats: { avgGoals: 2.62, bttsPercent: 50, over25Percent: 48, homeWinPercent: 42, drawPercent: 29, awayWinPercent: 29 }
  },
  {
    api_id: 61,
    name: 'Ligue 1',
    slug: 'ligue-1',
    country: 'France',
    logo_url: 'https://media.api-sports.io/football/leagues/61.png',
    season: '2026',
    stats: { avgGoals: 2.70, bttsPercent: 52, over25Percent: 53, homeWinPercent: 43, drawPercent: 25, awayWinPercent: 32 }
  },
  {
    api_id: 88,
    name: 'Eredivisie',
    slug: 'eredivisie',
    country: 'Netherlands',
    logo_url: 'https://media.api-sports.io/football/leagues/88.png',
    season: '2026',
    stats: { avgGoals: 3.01, bttsPercent: 58, over25Percent: 60, homeWinPercent: 45, drawPercent: 24, awayWinPercent: 31 }
  },
  {
    api_id: 94,
    name: 'Primeira Liga',
    slug: 'primeira-liga',
    country: 'Portugal',
    logo_url: 'https://media.api-sports.io/football/leagues/94.png',
    season: '2026',
    stats: { avgGoals: 2.65, bttsPercent: 48, over25Percent: 50, homeWinPercent: 46, drawPercent: 25, awayWinPercent: 29 }
  },
  {
    api_id: 203,
    name: 'Super Lig',
    slug: 'super-lig',
    country: 'Turkey',
    logo_url: 'https://media.api-sports.io/football/leagues/203.png',
    season: '2026',
    stats: { avgGoals: 2.80, bttsPercent: 55, over25Percent: 56, homeWinPercent: 45, drawPercent: 24, awayWinPercent: 31 }
  },
  {
    api_id: 98,
    name: 'J1 League',
    slug: 'j1-league',
    country: 'Japan',
    logo_url: 'https://media.api-sports.io/football/leagues/98.png',
    season: '2026',
    stats: { avgGoals: 2.50, bttsPercent: 51, over25Percent: 46, homeWinPercent: 40, drawPercent: 27, awayWinPercent: 33 }
  },
  {
    api_id: 292,
    name: 'K League 1',
    slug: 'k-league-1',
    country: 'South Korea',
    logo_url: 'https://media.api-sports.io/football/leagues/292.png',
    season: '2026',
    stats: { avgGoals: 2.45, bttsPercent: 50, over25Percent: 45, homeWinPercent: 41, drawPercent: 28, awayWinPercent: 31 }
  }
];

export async function getTopLeagues(): Promise<LeagueCache[]> {
  try {
    const { data, error } = await supabase
      .from('leagues_cache')
      .select('*')
      .order('name');

    if (!error && data && data.length > 0) {
      return data.map(item => ({
        api_id: item.api_id,
        name: item.name,
        slug: item.slug,
        country: item.country,
        logo_url: item.logo_url,
        season: item.season,
        stats: item.stats_json
      }));
    }
  } catch (err) {
    console.warn('[Leagues Service] DB query failed, using static fallback');
  }

  return STATIC_LEAGUES;
}

export async function getLeagueBySlug(slug: string): Promise<LeagueCache | undefined> {
  try {
    const { data, error } = await supabase
      .from('leagues_cache')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (!error && data) {
      return {
        api_id: data.api_id,
        name: data.name,
        slug: data.slug,
        country: data.country,
        logo_url: data.logo_url,
        season: data.season,
        stats: data.stats_json
      };
    }
  } catch (err) {
    console.warn('[Leagues Service] DB query for slug failed, using static lookup');
  }

  return STATIC_LEAGUES.find(l => l.slug === slug);
}

export async function getLeagueMatches(leagueApiId: number, slug: string): Promise<MatchPrediction[]> {
  try {
    const { data, error } = await supabase
      .from('matches_cache')
      .select(`
        id, kickoff, edge_pct, clv, prediction_json,
        home:teams_cache!home_team_id (name, logo_url),
        away:teams_cache!away_team_id (name, logo_url)
      `)
      .eq('league_id', leagueApiId)
      .order('kickoff', { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map((item: any) => {
        const pred = item.prediction_json || {};
        return {
          matchId: item.id,
          kickoffTime: item.kickoff,
          homeTeamName: item.home?.name || 'Home Team',
          awayTeamName: item.away?.name || 'Away Team',
          homeTeamLogo: item.home?.logo_url,
          awayTeamLogo: item.away?.logo_url,
          handicapLine: pred.handicapLine || 0,
          handicapProbability: pred.handicapProbability || 0,
          handicapFairOdds: pred.handicapFairOdds || 0,
          handicapMarketOdds: pred.handicapMarketOdds || 0,
          handicapEdgePercent: pred.handicapEdgePercent || 0,
          confidenceScore: pred.confidenceScore || 0,
          totalLine: pred.totalLine || 2.5,
          overProbability: pred.overProbability || 0,
          underProbability: pred.underProbability || 0,
          ouEdgePercent: pred.ouEdgePercent || 0,
          homeProbability: pred.homeProbability || 0,
          drawProbability: pred.drawProbability || 0,
          awayProbability: pred.awayProbability || 0,
        };
      });
    }
  } catch (err) {
    console.warn('[Leagues Service] DB match query failed, falling back to mock data');
  }

  // Fallback to mock data matches matching the league slug
  const mockMatches = getMockMatches().filter(m => slugify(m.league) === slug);
  return mockMatches.map(m => {
    const pred = getMockPredictions(m.id) || {
      matchId: m.id,
      handicapLine: -0.25,
      handicapProbability: 0.5,
      handicapFairOdds: 2.0,
      handicapMarketOdds: 2.0,
      handicapEdgePercent: 0,
      confidenceScore: 50,
      totalLine: 2.5,
      overProbability: 0.5,
      underProbability: 0.5,
      ouEdgePercent: 0,
      homeProbability: 0.33,
      drawProbability: 0.33,
      awayProbability: 0.33
    };

    return {
      matchId: m.id,
      kickoffTime: m.kickoffTime.toISOString(),
      homeTeamName: m.homeTeam?.name || 'Home Team',
      awayTeamName: m.awayTeam?.name || 'Away Team',
      homeTeamLogo: `https://media.api-sports.io/football/teams/${m.homeTeamId}.png`,
      awayTeamLogo: `https://media.api-sports.io/football/teams/${m.awayTeamId}.png`,
      handicapLine: pred.handicapLine,
      handicapProbability: pred.handicapProbability,
      handicapFairOdds: pred.handicapFairOdds,
      handicapMarketOdds: pred.handicapMarketOdds,
      handicapEdgePercent: pred.handicapEdgePercent,
      confidenceScore: pred.confidenceScore,
      totalLine: pred.totalLine,
      overProbability: pred.overProbability,
      underProbability: pred.underProbability,
      ouEdgePercent: pred.ouEdgePercent,
      homeProbability: pred.homeProbability,
      drawProbability: pred.drawProbability,
      awayProbability: pred.awayProbability
    };
  });
}

