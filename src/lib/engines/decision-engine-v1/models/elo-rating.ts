// HandicapLab Decision Engine v1 - Elo Rating Model
// Location: src/lib/engines/decision-engine-v1/models/elo-rating.ts

import { PredictionModel, OnlineModel, ModelMetadata, Prediction, ModelSnapshot } from './predictionModel';
import { MatchFeatures } from '../../feature-engine/types';
import { CanonicalFixture } from '../../../data-platform/canonicalModel';

export class EloRatingModel implements OnlineModel {
  private ratings: Record<string, number> = {};
  private kFactor = 20;

  public metadata(): ModelMetadata {
    return {
      name: 'Elo Rating Probability Model',
      version: '2.0.0',
      description: 'Online Elo rating model tracking team strengths incrementally.',
      isOnline: true
    };
  }

  public initialize(): void {
    this.ratings = {};
  }

  public update(match: CanonicalFixture, features?: MatchFeatures): void {
    const homeTeam = match.homeTeam.name;
    const awayTeam = match.awayTeam.name;
    const homeGoals = match.fullTimeHomeGoals ?? 0;
    const awayGoals = match.fullTimeAwayGoals ?? 0;

    const homeRating = this.ratings[homeTeam] ?? 1500;
    const awayRating = this.ratings[awayTeam] ?? 1500;
    const homeAdvantage = 90;

    const eloDifference = homeRating + homeAdvantage - awayRating;
    const expectedHomeScore = 1 / (1 + Math.pow(10, -eloDifference / 400));
    const expectedAwayScore = 1 - expectedHomeScore;

    let homeOutcome = 0.5;
    if (homeGoals > awayGoals) homeOutcome = 1.0;
    else if (homeGoals < awayGoals) homeOutcome = 0.0;

    const awayOutcome = 1.0 - homeOutcome;

    this.ratings[homeTeam] = homeRating + this.kFactor * (homeOutcome - expectedHomeScore);
    this.ratings[awayTeam] = awayRating + this.kFactor * (awayOutcome - expectedAwayScore);
  }

  public snapshot(): ModelSnapshot {
    return { ratings: { ...this.ratings } };
  }

  public restore(snapshot: ModelSnapshot): void {
    this.ratings = { ...snapshot.ratings };
  }

  public async train(trainData: any[]): Promise<void> {
    this.initialize();
    for (const match of trainData) {
      if (match.fullTimeHomeGoals !== null && match.fullTimeAwayGoals !== null && match.fullTimeHomeGoals !== undefined && match.fullTimeAwayGoals !== undefined) {
         this.update(match);
      }
    }
  }

  public async predict(features: MatchFeatures | any): Promise<Prediction> {
    const homeElo = this.ratings[features.homeTeam] ?? features.homeElo ?? 1500;
    const awayElo = this.ratings[features.awayTeam] ?? features.awayElo ?? 1500;
    
    const homeAdvantage = features.isHomeAdvantage !== false ? 90 : 0;
    const eloDifference = homeElo + homeAdvantage - awayElo;

    const expectedHomeScore = 1 / (1 + Math.pow(10, -eloDifference / 400));
    
    // Simple heuristic for draw probability based on Elo
    const drawProbability = 0.26;
    const homeProbability = expectedHomeScore * (1 - drawProbability);
    const awayProbability = Math.max(0, 1.0 - homeProbability - drawProbability);

    return {
      pHome: Number(homeProbability.toFixed(4)),
      pDraw: Number(drawProbability.toFixed(4)),
      pAway: Number(awayProbability.toFixed(4)),
      expectedGoalsHome: expectedHomeScore * 2, // very rough estimate
      expectedGoalsAway: (1 - expectedHomeScore) * 2
    };
  }

  public async predictProbability(features: MatchFeatures | any): Promise<{ pHome: number; pDraw: number; pAway: number }> {
    const p = await this.predict(features);
    return { pHome: p.pHome, pDraw: p.pDraw, pAway: p.pAway };
  }

  public async predictScore(features: MatchFeatures | any): Promise<{ home: number; away: number }> {
     const p = await this.predict(features);
     return { home: p.expectedGoalsHome || 0, away: p.expectedGoalsAway || 0 };
  }
}
