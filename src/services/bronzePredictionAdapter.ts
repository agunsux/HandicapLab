import fs from 'fs/promises';
import path from 'path';
import { PredictionProvider, StandardPredictionOutput } from '../interfaces/PredictionProvider';
import { generatePrediction, MatchInput } from './probability.engine';

export interface BronzeMatch {
  fixtureId: string;
  fixtureNaturalKey: string;
  competitionId: string;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: { value: number };
  awayGoals: { value: number };
  homeXg: { value: number };
  awayXg: { value: number };
}

export class BronzePredictionAdapter implements PredictionProvider {
  /**
   * Generates a prediction based on a BronzeMatch input.
   */
  async predictMatch(input: BronzeMatch): Promise<StandardPredictionOutput> {
    // Construct MatchInput for the probability engine.
    // Since we only have xG from bronze (in this phase), we fill the rest with neutral values
    // to isolate the probability engine's ability to predict purely from xG/Poisson.
    const matchInput: MatchInput = {
      matchId: input.fixtureId,
      xg_home: input.homeXg.value,
      xg_away: input.awayXg.value,
      odds_home: 0, // No odds available in Understat bronze
      odds_draw: 0,
      odds_away: 0,
      ah_line: 0,
      ou_line: 2.5,
      btts_odds: 0,
      shots_home: 0, // We could extract from elsewhere if needed
      shots_away: 0,
      shots_on_target_home: 0,
      shots_on_target_away: 0,
      form_home: 1.5,
      form_away: 1.5,
    };

    const predictionOutput = generatePrediction(matchInput);

    return {
      fixtureId: input.fixtureId,
      season: input.seasonId,
      homeTeam: input.homeTeamId,
      awayTeam: input.awayTeamId,
      prediction: {
        homeWin: Number(predictionOutput.ml_home_prob.toFixed(4)),
        draw: Number(predictionOutput.ml_draw_prob.toFixed(4)),
        awayWin: Number(predictionOutput.ml_away_prob.toFixed(4)),
      },
      expectedGoals: {
        home: Number(predictionOutput.expected_goals_home.toFixed(2)),
        away: Number(predictionOutput.expected_goals_away.toFixed(2)),
      },
      model: 'poisson_xg',
      confidenceScore: predictionOutput.final_confidence,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Helper function to load bronze data for a specific season.
   */
  async loadBronzeData(competitionId: string, seasonId: string): Promise<BronzeMatch[]> {
    const filePath = path.join(process.cwd(), 'data', 'bronze', competitionId, `${seasonId}_understat.json`);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data) as BronzeMatch[];
    } catch (error) {
      console.error(`Failed to load bronze data for ${competitionId} ${seasonId}:`, error);
      return [];
    }
  }
}
