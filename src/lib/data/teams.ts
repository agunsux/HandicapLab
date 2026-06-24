import { supabase } from '@/lib/supabase.server';
import { slugify } from './leagues';
import { getMatches as getMockMatches, getPredictionsForMatch as getMockPredictions } from '@/lib/mock-data';
import { MatchPrediction } from './leagues';

export interface TeamCache {
  api_id: number;
  name: string;
  slug: string;
  league_id: number;
  logo_url: string;
  form: ('W' | 'D' | 'L')[];
  stats: {
    xgHome: number;
    xgAway: number;
    goalsScored: number;
    goalsConceded: number;
    cleanSheets: number;
  };
}

export const STATIC_TEAMS: TeamCache[] = [
  {
    api_id: 40,
    name: 'Liverpool',
    slug: 'liverpool',
    league_id: 39,
    logo_url: 'https://media.api-sports.io/football/teams/40.png',
    form: ['W', 'W', 'D', 'W', 'W'],
    stats: { xgHome: 2.35, xgAway: 1.95, goalsScored: 72, goalsConceded: 32, cleanSheets: 14 }
  },
  {
    api_id: 50,
    name: 'Manchester City',
    slug: 'manchester-city',
    league_id: 39,
    logo_url: 'https://media.api-sports.io/football/teams/50.png',
    form: ['W', 'W', 'D', 'W', 'L'],
    stats: { xgHome: 2.65, xgAway: 2.10, goalsScored: 86, goalsConceded: 38, cleanSheets: 11 }
  },
  {
    api_id: 42,
    name: 'Arsenal',
    slug: 'arsenal',
    league_id: 39,
    logo_url: 'https://media.api-sports.io/football/teams/42.png',
    form: ['W', 'W', 'L', 'W', 'D'],
    stats: { xgHome: 2.20, xgAway: 1.85, goalsScored: 78, goalsConceded: 28, cleanSheets: 16 }
  },
  {
    api_id: 49,
    name: 'Chelsea',
    slug: 'chelsea',
    league_id: 39,
    logo_url: 'https://media.api-sports.io/football/teams/49.png',
    form: ['L', 'W', 'D', 'W', 'D'],
    stats: { xgHome: 1.85, xgAway: 1.45, goalsScored: 60, goalsConceded: 45, cleanSheets: 9 }
  },
  {
    api_id: 33,
    name: 'Manchester United',
    slug: 'manchester-united',
    league_id: 39,
    logo_url: 'https://media.api-sports.io/football/teams/33.png',
    form: ['W', 'L', 'D', 'L', 'W'],
    stats: { xgHome: 1.60, xgAway: 1.25, goalsScored: 52, goalsConceded: 48, cleanSheets: 8 }
  },
  {
    api_id: 529,
    name: 'Barcelona',
    slug: 'barcelona',
    league_id: 140,
    logo_url: 'https://media.api-sports.io/football/teams/529.png',
    form: ['W', 'W', 'W', 'D', 'W'],
    stats: { xgHome: 2.40, xgAway: 1.80, goalsScored: 80, goalsConceded: 34, cleanSheets: 13 }
  },
  {
    api_id: 541,
    name: 'Real Madrid',
    slug: 'real-madrid',
    league_id: 140,
    logo_url: 'https://media.api-sports.io/football/teams/541.png',
    form: ['W', 'W', 'D', 'W', 'W'],
    stats: { xgHome: 2.55, xgAway: 2.05, goalsScored: 84, goalsConceded: 26, cleanSheets: 17 }
  },
  {
    api_id: 157,
    name: 'Bayern Munich',
    slug: 'bayern-munich',
    league_id: 78,
    logo_url: 'https://media.api-sports.io/football/teams/157.png',
    form: ['W', 'D', 'W', 'W', 'W'],
    stats: { xgHome: 2.80, xgAway: 2.25, goalsScored: 90, goalsConceded: 38, cleanSheets: 10 }
  }
];

export async function getAllTeams(): Promise<TeamCache[]> {
  try {
    const { data, error } = await supabase
      .from('teams_cache')
      .select('*')
      .order('name');

    if (!error && data && data.length > 0) {
      return data.map(item => ({
        api_id: item.api_id,
        name: item.name,
        slug: item.slug,
        league_id: item.league_id,
        logo_url: item.logo_url,
        form: item.form_json,
        stats: item.stats_json
      }));
    }
  } catch (err) {
    console.warn('[Teams Service] DB query failed, using static fallback');
  }

  return STATIC_TEAMS;
}

export async function getTeamBySlug(slug: string): Promise<TeamCache | undefined> {
  try {
    const { data, error } = await supabase
      .from('teams_cache')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (!error && data) {
      return {
        api_id: data.api_id,
        name: data.name,
        slug: data.slug,
        league_id: data.league_id,
        logo_url: data.logo_url,
        form: data.form_json,
        stats: data.stats_json
      };
    }
  } catch (err) {
    console.warn('[Teams Service] DB query for slug failed, using static lookup');
  }

  return STATIC_TEAMS.find(t => t.slug === slug);
}

export async function getTeamMatches(teamApiId: number, slug: string): Promise<MatchPrediction[]> {
  try {
    const { data, error } = await supabase
      .from('matches_cache')
      .select(`
        id, kickoff, edge_pct, clv, prediction_json,
        home:teams_cache!home_team_id (name, logo_url, api_id),
        away:teams_cache!away_team_id (name, logo_url, api_id)
      `)
      .or(`home_team_id.eq.${teamApiId},away_team_id.eq.${teamApiId}`)
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
    console.warn('[Teams Service] DB match query failed, falling back to mock data');
  }

  // Fallback: Filter mock matches containing this team slug
  const mockMatches = getMockMatches().filter(m => {
    return (m.homeTeam && slugify(m.homeTeam.name) === slug) || 
           (m.awayTeam && slugify(m.awayTeam.name) === slug);
  });

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

