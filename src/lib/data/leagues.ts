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
  // Competition Hub fields
  competition_type: 'league' | 'cup' | 'tournament';
  format: 'round_robin' | 'knockout' | 'group_knockout' | 'two_legged' | 'mixed';
  region: string;
  priority: number;
  featured: boolean;
  
  // Future model fields
  home_advantage?: number;
  season_xg?: number;
  form_weight?: number;
  rotation_risk?: number;
  two_leg_factor?: number;
  aggregate_score?: number;
  neutral_venue?: boolean;
  knockout_pressure?: number;
  fatigue_factor?: number;
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
    api_id: 1,
    name: 'FIFA World Cup 2026',
    slug: 'world-cup-2026',
    country: 'World',
    logo_url: 'https://media.api-sports.io/football/leagues/1.png',
    season: '2026',
    stats: { avgGoals: 2.75, bttsPercent: 50, over25Percent: 52, homeWinPercent: 40, drawPercent: 25, awayWinPercent: 35 },
    competition_type: 'tournament',
    format: 'group_knockout',
    region: 'World',
    priority: 1,
    featured: true,
    neutral_venue: true,
    knockout_pressure: 1.5,
    fatigue_factor: 1.2
  },
  {
    api_id: 39,
    name: 'English Premier League',
    slug: 'english-premier-league',
    country: 'England',
    logo_url: 'https://media.api-sports.io/football/leagues/39.png',
    season: '2026',
    stats: { avgGoals: 2.85, bttsPercent: 54, over25Percent: 58, homeWinPercent: 46, drawPercent: 23, awayWinPercent: 31 },
    competition_type: 'league',
    format: 'round_robin',
    region: 'England',
    priority: 2,
    featured: false,
    home_advantage: 1.12,
    season_xg: 1.45,
    form_weight: 1.0
  },
  {
    api_id: 140,
    name: 'La Liga',
    slug: 'la-liga',
    country: 'Spain',
    logo_url: 'https://media.api-sports.io/football/leagues/140.png',
    season: '2026',
    stats: { avgGoals: 2.58, bttsPercent: 49, over25Percent: 51, homeWinPercent: 44, drawPercent: 26, awayWinPercent: 30 },
    competition_type: 'league',
    format: 'round_robin',
    region: 'Spain',
    priority: 2,
    featured: false,
    home_advantage: 1.12,
    season_xg: 1.35,
    form_weight: 1.0
  },
  {
    api_id: 78,
    name: 'Bundesliga',
    slug: 'bundesliga',
    country: 'Germany',
    logo_url: 'https://media.api-sports.io/football/leagues/78.png',
    season: '2026',
    stats: { avgGoals: 3.12, bttsPercent: 61, over25Percent: 64, homeWinPercent: 47, drawPercent: 22, awayWinPercent: 31 },
    competition_type: 'league',
    format: 'round_robin',
    region: 'Germany',
    priority: 2,
    featured: false,
    home_advantage: 1.12,
    season_xg: 1.60,
    form_weight: 1.0
  },
  {
    api_id: 135,
    name: 'Serie A',
    slug: 'serie-a',
    country: 'Italy',
    logo_url: 'https://media.api-sports.io/football/leagues/135.png',
    season: '2026',
    stats: { avgGoals: 2.62, bttsPercent: 50, over25Percent: 48, homeWinPercent: 42, drawPercent: 29, awayWinPercent: 29 },
    competition_type: 'league',
    format: 'round_robin',
    region: 'Italy',
    priority: 2,
    featured: false,
    home_advantage: 1.12,
    season_xg: 1.38,
    form_weight: 1.0
  },
  {
    api_id: 61,
    name: 'Ligue 1',
    slug: 'ligue-1',
    country: 'France',
    logo_url: 'https://media.api-sports.io/football/leagues/61.png',
    season: '2026',
    stats: { avgGoals: 2.70, bttsPercent: 52, over25Percent: 53, homeWinPercent: 43, drawPercent: 25, awayWinPercent: 32 },
    competition_type: 'league',
    format: 'round_robin',
    region: 'France',
    priority: 2,
    featured: false,
    home_advantage: 1.12,
    season_xg: 1.40,
    form_weight: 1.0
  },
  {
    api_id: 88,
    name: 'Eredivisie',
    slug: 'eredivisie',
    country: 'Netherlands',
    logo_url: 'https://media.api-sports.io/football/leagues/88.png',
    season: '2026',
    stats: { avgGoals: 3.01, bttsPercent: 58, over25Percent: 60, homeWinPercent: 45, drawPercent: 24, awayWinPercent: 31 },
    competition_type: 'league',
    format: 'round_robin',
    region: 'Europe',
    priority: 3,
    featured: false,
    home_advantage: 1.10,
    season_xg: 1.50,
    form_weight: 0.9
  },
  {
    api_id: 94,
    name: 'Primeira Liga',
    slug: 'primeira-liga',
    country: 'Portugal',
    logo_url: 'https://media.api-sports.io/football/leagues/94.png',
    season: '2026',
    stats: { avgGoals: 2.65, bttsPercent: 48, over25Percent: 50, homeWinPercent: 46, drawPercent: 25, awayWinPercent: 29 },
    competition_type: 'league',
    format: 'round_robin',
    region: 'Europe',
    priority: 3,
    featured: false,
    home_advantage: 1.10,
    season_xg: 1.32,
    form_weight: 0.9
  },
  {
    api_id: 203,
    name: 'Super Lig',
    slug: 'super-lig',
    country: 'Turkey',
    logo_url: 'https://media.api-sports.io/football/leagues/203.png',
    season: '2026',
    stats: { avgGoals: 2.80, bttsPercent: 55, over25Percent: 56, homeWinPercent: 45, drawPercent: 24, awayWinPercent: 31 },
    competition_type: 'league',
    format: 'round_robin',
    region: 'Europe',
    priority: 3,
    featured: false,
    home_advantage: 1.10,
    season_xg: 1.42,
    form_weight: 0.9
  },
  {
    api_id: 2,
    name: 'UEFA Champions League',
    slug: 'uefa-champions-league',
    country: 'Europe',
    logo_url: 'https://media.api-sports.io/football/leagues/2.png',
    season: '2026',
    stats: { avgGoals: 2.93, bttsPercent: 52, over25Percent: 57, homeWinPercent: 47, drawPercent: 21, awayWinPercent: 32 },
    competition_type: 'tournament',
    format: 'group_knockout',
    region: 'Europe',
    priority: 2,
    featured: false,
    neutral_venue: false,
    knockout_pressure: 1.3,
    fatigue_factor: 1.1
  },
  {
    api_id: 3,
    name: 'UEFA Europa League',
    slug: 'uefa-europa-league',
    country: 'Europe',
    logo_url: 'https://media.api-sports.io/football/leagues/3.png',
    season: '2026',
    stats: { avgGoals: 2.81, bttsPercent: 54, over25Percent: 54, homeWinPercent: 43, drawPercent: 24, awayWinPercent: 33 },
    competition_type: 'tournament',
    format: 'group_knockout',
    region: 'Europe',
    priority: 3,
    featured: false,
    neutral_venue: false,
    knockout_pressure: 1.1,
    fatigue_factor: 1.1
  },
  {
    api_id: 844,
    name: 'UEFA Conference League',
    slug: 'uefa-conference-league',
    country: 'Europe',
    logo_url: 'https://media.api-sports.io/football/leagues/844.png',
    season: '2026',
    stats: { avgGoals: 2.80, bttsPercent: 53, over25Percent: 53, homeWinPercent: 45, drawPercent: 23, awayWinPercent: 32 },
    competition_type: 'tournament',
    format: 'group_knockout',
    region: 'Europe',
    priority: 3,
    featured: false,
    neutral_venue: false,
    knockout_pressure: 1.0,
    fatigue_factor: 1.1
  },
  {
    api_id: 45,
    name: 'Copa America',
    slug: 'copa-america',
    country: 'South America',
    logo_url: 'https://media.api-sports.io/football/leagues/45.png',
    season: '2026',
    stats: { avgGoals: 2.38, bttsPercent: 45, over25Percent: 42, homeWinPercent: 42, drawPercent: 28, awayWinPercent: 30 },
    competition_type: 'tournament',
    format: 'group_knockout',
    region: 'South America',
    priority: 2,
    featured: false,
    neutral_venue: true,
    knockout_pressure: 1.4,
    fatigue_factor: 1.2
  },
  {
    api_id: 4,
    name: 'UEFA European Championship',
    slug: 'euro',
    country: 'Europe',
    logo_url: 'https://media.api-sports.io/football/leagues/4.png',
    season: '2026',
    stats: { avgGoals: 2.52, bttsPercent: 48, over25Percent: 48, homeWinPercent: 41, drawPercent: 27, awayWinPercent: 32 },
    competition_type: 'tournament',
    format: 'group_knockout',
    region: 'Europe',
    priority: 2,
    featured: false,
    neutral_venue: true,
    knockout_pressure: 1.4,
    fatigue_factor: 1.2
  },
  {
    api_id: 98,
    name: 'J1 League',
    slug: 'j1-league',
    country: 'Japan',
    logo_url: 'https://media.api-sports.io/football/leagues/98.png',
    season: '2026',
    stats: { avgGoals: 2.50, bttsPercent: 51, over25Percent: 46, homeWinPercent: 40, drawPercent: 27, awayWinPercent: 33 },
    competition_type: 'league',
    format: 'round_robin',
    region: 'Asia',
    priority: 3,
    featured: false,
    home_advantage: 1.08,
    season_xg: 1.28,
    form_weight: 0.8
  },
  {
    api_id: 292,
    name: 'K League 1',
    slug: 'k-league-1',
    country: 'South Korea',
    logo_url: 'https://media.api-sports.io/football/leagues/292.png',
    season: '2026',
    stats: { avgGoals: 2.45, bttsPercent: 50, over25Percent: 45, homeWinPercent: 41, drawPercent: 28, awayWinPercent: 31 },
    competition_type: 'league',
    format: 'round_robin',
    region: 'Asia',
    priority: 3,
    featured: false,
    home_advantage: 1.08,
    season_xg: 1.25,
    form_weight: 0.8
  },
  {
    api_id: 253,
    name: 'Major League Soccer',
    slug: 'mls',
    country: 'USA',
    logo_url: 'https://media.api-sports.io/football/leagues/253.png',
    season: '2026',
    stats: { avgGoals: 2.92, bttsPercent: 57, over25Percent: 58, homeWinPercent: 48, drawPercent: 24, awayWinPercent: 28 },
    competition_type: 'league',
    format: 'mixed',
    region: 'North America',
    priority: 3,
    featured: false,
    home_advantage: 1.15,
    season_xg: 1.48,
    form_weight: 0.9
  },
  {
    api_id: 262,
    name: 'Liga MX',
    slug: 'liga-mx',
    country: 'Mexico',
    logo_url: 'https://media.api-sports.io/football/leagues/262.png',
    season: '2026',
    stats: { avgGoals: 2.70, bttsPercent: 54, over25Percent: 52, homeWinPercent: 45, drawPercent: 25, awayWinPercent: 30 },
    competition_type: 'league',
    format: 'mixed',
    region: 'North America',
    priority: 3,
    featured: false,
    home_advantage: 1.12,
    season_xg: 1.38,
    form_weight: 0.9
  },
  {
    api_id: 307,
    name: 'Saudi Pro League',
    slug: 'saudi-pro-league',
    country: 'Saudi Arabia',
    logo_url: 'https://media.api-sports.io/football/leagues/307.png',
    season: '2026',
    stats: { avgGoals: 2.88, bttsPercent: 54, over25Percent: 57, homeWinPercent: 43, drawPercent: 25, awayWinPercent: 32 },
    competition_type: 'league',
    format: 'round_robin',
    region: 'Asia',
    priority: 3,
    featured: false,
    home_advantage: 1.10,
    season_xg: 1.46,
    form_weight: 0.9
  },
  {
    api_id: 42,
    name: 'FA Cup',
    slug: 'fa-cup',
    country: 'England',
    logo_url: 'https://media.api-sports.io/football/leagues/42.png',
    season: '2026',
    stats: { avgGoals: 2.90, bttsPercent: 52, over25Percent: 58, homeWinPercent: 44, drawPercent: 24, awayWinPercent: 32 },
    competition_type: 'cup',
    format: 'knockout',
    region: 'England',
    priority: 3,
    featured: false,
    rotation_risk: 1.4,
    two_leg_factor: 1.0,
    aggregate_score: 0
  },
  {
    api_id: 43,
    name: 'Copa del Rey',
    slug: 'copa-del-rey',
    country: 'Spain',
    logo_url: 'https://media.api-sports.io/football/leagues/43.png',
    season: '2026',
    stats: { avgGoals: 2.65, bttsPercent: 48, over25Percent: 49, homeWinPercent: 43, drawPercent: 25, awayWinPercent: 32 },
    competition_type: 'cup',
    format: 'knockout',
    region: 'Spain',
    priority: 3,
    featured: false,
    rotation_risk: 1.3,
    two_leg_factor: 1.2,
    aggregate_score: 0
  }
];

export async function getTopLeagues(): Promise<LeagueCache[]> {
  try {
    const { data, error } = await supabase
      .from('leagues_cache')
      .select('*');

    if (!error && data && data.length > 0) {
      // Map new columns and return
      return data.map(item => ({
        api_id: item.api_id,
        name: item.name,
        slug: item.slug,
        country: item.country,
        logo_url: item.logo_url,
        season: item.season,
        stats: item.stats_json || {},
        competition_type: item.competition_type || 'league',
        format: item.format || 'round_robin',
        region: item.region || item.country,
        priority: item.priority || 3,
        featured: item.featured || false,
        home_advantage: item.home_advantage,
        season_xg: item.season_xg,
        form_weight: item.form_weight,
        rotation_risk: item.rotation_risk,
        two_leg_factor: item.two_leg_factor,
        aggregate_score: item.aggregate_score,
        neutral_venue: item.neutral_venue,
        knockout_pressure: item.knockout_pressure,
        fatigue_factor: item.fatigue_factor
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
        stats: data.stats_json || {},
        competition_type: data.competition_type || 'league',
        format: data.format || 'round_robin',
        region: data.region || data.country,
        priority: data.priority || 3,
        featured: data.featured || false,
        home_advantage: data.home_advantage,
        season_xg: data.season_xg,
        form_weight: data.form_weight,
        rotation_risk: data.rotation_risk,
        two_leg_factor: data.two_leg_factor,
        aggregate_score: data.aggregate_score,
        neutral_venue: data.neutral_venue,
        knockout_pressure: data.knockout_pressure,
        fatigue_factor: data.fatigue_factor
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
