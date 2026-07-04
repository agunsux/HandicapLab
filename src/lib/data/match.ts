import { supabase } from '@/lib/supabase.server';

export interface DbMatch {
  id: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  status: string;
  home_goals: number | null;
  away_goals: number | null;
  league: string;
  competition_type?: string | null;
  tournament_stage?: string | null;
  venue?: string | null;
  weather_condition?: string | null;
  attendance?: number | null;
}

export interface DbPrediction {
  id: string;
  match_id: string;
  market_type: string;
  prediction: any;
  odds_snapshot: any;
  closing_odds: any;
  model_version: string | null;
  generated_at: string | null;
  confidence: string | null;
  edge_pct: number | null;
  fair_odds: number | null;
  entry_odds: number | null;
  market_confidence_score: number | null;
  prediction_timestamp?: string | null;
}

export async function getMatchById(id: string): Promise<DbMatch | null> {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('id, home_team, away_team, kickoff, status, home_goals, away_goals, league, competition_type, tournament_stage, venue, weather_condition, attendance')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`[Data Service] getMatchById error for ID ${id}:`, error.message);
      return null;
    }
    return data;
  } catch (err: any) {
    console.error(`[Data Service] getMatchById catch error for ID ${id}:`, err.message);
    return null;
  }
}

export async function getPredictionsByMatchId(matchId: string): Promise<DbPrediction[]> {
  try {
    const { data, error } = await supabase
      .from('predictions')
      .select('id, match_id, market_type, prediction, odds_snapshot, closing_odds, model_version, generated_at, confidence, edge_pct, fair_odds, entry_odds, market_confidence_score, prediction_timestamp')
      .eq('match_id', matchId);

    if (error) {
      console.error(`[Data Service] getPredictionsByMatchId error for ID ${matchId}:`, error.message);
      return [];
    }
    return data || [];
  } catch (err: any) {
    console.error(`[Data Service] getPredictionsByMatchId catch error for ID ${matchId}:`, err.message);
    return [];
  }
}
