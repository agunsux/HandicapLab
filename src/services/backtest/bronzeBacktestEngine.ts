import fs from 'fs/promises';
import path from 'path';
import { BronzePredictionAdapter, BronzeMatch } from '../bronzePredictionAdapter';
import { StandardPredictionOutput } from '../../interfaces/PredictionProvider';

export interface BacktestSnapshot {
  fixtureId: string;
  modelVersion: string;
  prediction: StandardPredictionOutput['prediction'];
  actualResult: 'HOME_WIN' | 'DRAW' | 'AWAY_WIN';
  timestamp: string;
  dataCutoffDate: string; // simulate point-in-time
}

export class BronzeBacktestEngine {
  private adapter: BronzePredictionAdapter;
  private outputDir: string;

  constructor() {
    this.adapter = new BronzePredictionAdapter();
    this.outputDir = path.join(process.cwd(), 'data', 'research', 'predictions');
  }

  /**
   * Initializes the output directory.
   */
  async init(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
  }

  /**
   * Runs the backtest over a set of seasons for a given competition.
   */
  async runBacktest(competitionId: string, seasons: string[]): Promise<BacktestSnapshot[]> {
    await this.init();
    const allSnapshots: BacktestSnapshot[] = [];

    // Chronological order is assumed if seasons are sorted
    for (const season of seasons) {
      console.log(`Running backtest for ${competitionId} ${season}...`);
      const matches = await this.adapter.loadBronzeData(competitionId, season);
      
      // Sort matches by date if possible (fixtureNaturalKey usually ends with date: EPL|2015-2016|ARSENAL|CHELSEA|2015-09-11)
      matches.sort((a, b) => {
        const dateA = a.fixtureNaturalKey.split('|').pop() || '';
        const dateB = b.fixtureNaturalKey.split('|').pop() || '';
        return dateA.localeCompare(dateB);
      });

      const seasonSnapshots: BacktestSnapshot[] = [];

      for (const match of matches) {
        // Point in time simulation: in a real walk-forward, we'd only use data up to `dataCutoffDate`.
        // The BronzePredictionAdapter currently uses match-level xG directly as an abstraction 
        // representing the pre-match expected state (or simulating what a model trained *up to* this point would predict).
        
        const predictionOutput = await this.adapter.predictMatch(match);
        const matchDate = match.fixtureNaturalKey.split('|').pop() || '1970-01-01';

        const actualResult = this.getActualResult(match.homeGoals.value, match.awayGoals.value);

        const snapshot: BacktestSnapshot = {
          fixtureId: match.fixtureId,
          modelVersion: predictionOutput.model,
          prediction: predictionOutput.prediction,
          actualResult,
          timestamp: new Date().toISOString(),
          dataCutoffDate: matchDate, 
        };

        seasonSnapshots.push(snapshot);
      }

      allSnapshots.push(...seasonSnapshots);

      // Save season snapshot 
      const seasonFilePath = path.join(this.outputDir, `prediction_snapshot_${competitionId}_${season}.json`);
      await fs.writeFile(seasonFilePath, JSON.stringify(seasonSnapshots, null, 2), 'utf8');
      console.log(`Saved ${seasonSnapshots.length} predictions to ${seasonFilePath}`);
    }

    return allSnapshots;
  }

  private getActualResult(homeGoals: number, awayGoals: number): 'HOME_WIN' | 'DRAW' | 'AWAY_WIN' {
    if (homeGoals > awayGoals) return 'HOME_WIN';
    if (homeGoals < awayGoals) return 'AWAY_WIN';
    return 'DRAW';
  }
}
