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
    // 1. Resolve team from STATIC_TEAMS or matches query
    const teamConfig = STATIC_TEAMS.find(t => t.api_id === teamApiId);
    const teamName = teamConfig ? teamConfig.name : null;

    if (!teamName) {
      console.warn(`[Teams Service] Team not found for API ID ${teamApiId}`);
      return [];
    }

    // 2. Query matches directly where home_team or away_team matches the team name
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('id, home_team, away_team, kickoff, status')
      .or(`home_team.eq."${teamName}",away_team.eq."${teamName}"`)
      .order('kickoff', { ascending: true });

    if (matchError) {
      console.error(`[Teams Service] DB matches query failed: ${matchError.message}`);
      return [];
    }

    if (!matches || matches.length === 0) {
      return [];
    }

    // 3. Query predictions for those matches
    const matchIds = matches.map((m: any) => m.id);
    const { data: preds, error: predError } = await supabase
      .from('predictions')
      .select('*')
      .in('match_id', matchIds);

    if (predError) {
      console.error(`[Teams Service] DB predictions query failed: ${predError.message}`);
    }

    // 4. Pivot predictions in-memory
    const matchPreds: Record<string, any> = {};
    if (preds && preds.length > 0) {
      for (const p of preds) {
        const mId = p.match_id;
        if (!matchPreds[mId]) {
          matchPreds[mId] = {
            handicapLine: 0,
            handicapProbability: 0,
            handicapFairOdds: 0,
            handicapMarketOdds: 0,
            handicapEdgePercent: 0,
            confidenceScore: 0,
            totalLine: 2.5,
            overProbability: 0,
            underProbability: 0,
            ouEdgePercent: 0,
            homeProbability: 0,
            drawProbability: 0,
            awayProbability: 0
          };
        }
        
        const predObj = p.prediction || {};
        const edge = typeof p.edge_pct === 'number' ? p.edge_pct * 100 : 0;
        
        if (p.market_type === 'ML') {
          matchPreds[mId].homeProbability = predObj.pHome || predObj.home_prob || 0;
          matchPreds[mId].drawProbability = predObj.pDraw || predObj.draw_prob || 0;
          matchPreds[mId].awayProbability = predObj.pAway || predObj.away_prob || 0;
        } else if (p.market_type === 'AH') {
          matchPreds[mId].handicapLine = predObj.ah_line || 0;
          matchPreds[mId].handicapProbability = predObj.ah_prob || 0;
          matchPreds[mId].handicapFairOdds = p.fair_odds || (predObj.ah_prob ? 1 / predObj.ah_prob : 0);
          matchPreds[mId].handicapMarketOdds = p.entry_odds || 0;
          matchPreds[mId].handicapEdgePercent = edge;
          matchPreds[mId].confidenceScore = p.market_confidence_score || 0;
        } else if (p.market_type === 'OU') {
          matchPreds[mId].totalLine = predObj.ou_line || 2.5;
          matchPreds[mId].overProbability = predObj.over_prob || 0;
          matchPreds[mId].underProbability = predObj.under_prob || (predObj.over_prob ? 1 - predObj.over_prob : 0);
          matchPreds[mId].ouEdgePercent = edge;
        }
      }
    }

    // 5. Map matches to MatchPrediction structure
    return matches.map((item: any) => {
      const pred = matchPreds[item.id] || {};
      return {
        matchId: item.id,
        kickoffTime: item.kickoff,
        homeTeamName: item.home_team || 'Home Team',
        awayTeamName: item.away_team || 'Away Team',
        homeTeamLogo: `https://media.api-sports.io/football/teams/placeholder.png`,
        awayTeamLogo: `https://media.api-sports.io/football/teams/placeholder.png`,
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

  } catch (err: any) {
    console.error('[Teams Service] Error in getTeamMatches:', err.message);
    return [];
  }
}

