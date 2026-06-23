import { MatchFeatures } from '../engines/feature-engine/types';
import { ProbabilityEngine } from '../engines/probability-engine';
import { FeatureImportanceResult } from './types';

export class FeatureImportance {
  /**
   * Evaluates dataset-wide Brier score.
   */
  private static calculateDatasetBrier(
    dataset: Array<{ features: MatchFeatures; outcome: 'home' | 'draw' | 'away' }>
  ): number {
    if (dataset.length === 0) return 0.25;
    let sumError = 0;
    
    for (const item of dataset) {
      const pred = ProbabilityEngine.predict(item.features);
      const yHome = item.outcome === 'home' ? 1 : 0;
      const yDraw = item.outcome === 'draw' ? 1 : 0;
      const yAway = item.outcome === 'away' ? 1 : 0;
      
      sumError += Math.pow(pred.pHome - yHome, 2) + Math.pow(pred.pDraw - yDraw, 2) + Math.pow(pred.pAway - yAway, 2);
    }
    
    return sumError / (dataset.length * 3);
  }

  /**
   * Resets target feature sets to fallback values for ablation.
   */
  private static ablateFeature(features: MatchFeatures, featureName: string): MatchFeatures {
    const copy = { ...features };
    
    if (featureName === 'form') {
      copy.homeFormLast5 = [1.5, 1.5, 1.5, 1.5, 1.5];
      copy.awayFormLast5 = [1.5, 1.5, 1.5, 1.5, 1.5];
      copy.homeFormWeighted = 1.5;
      copy.awayFormWeighted = 1.5;
    } else if (featureName === 'fatigue') {
      copy.homeRestDays = 7;
      copy.awayRestDays = 7;
      copy.homeTravelKm = 0;
    } else if (featureName === 'strength') {
      copy.homeElo = 1500;
      copy.awayElo = 1500;
      copy.eloDelta = 0;
    } else if (featureName === 'xg') {
      copy.homeAttack = 1.0;
      copy.homeDefense = 1.0;
      copy.awayAttack = 1.0;
      copy.awayDefense = 1.0;
      copy.leagueAvgGoals = 2.5;
    }
    
    return copy;
  }

  /**
   * Performs leave-one-feature-out analysis.
   * Calculates how much the Brier score degrades when a feature set is ablated.
   * 
   * @param dataset Matches with features and true outcome labels
   */
  public static analyze(
    dataset: Array<{ features: MatchFeatures; outcome: 'home' | 'draw' | 'away' }>
  ): FeatureImportanceResult[] {
    const baselineBrier = this.calculateDatasetBrier(dataset);
    const featuresToAblate = ['form', 'fatigue', 'strength', 'xg'];
    const results: FeatureImportanceResult[] = [];

    for (const feature of featuresToAblate) {
      const ablatedDataset = dataset.map(item => ({
        features: this.ablateFeature(item.features, feature),
        outcome: item.outcome
      }));

      const ablatedBrier = this.calculateDatasetBrier(ablatedDataset);

      // Brier score: lower is better. If score increases when feature is missing,
      // it means the feature has a positive contribution.
      const importance = ablatedBrier - baselineBrier;
      
      let impact: 'positive' | 'negative' | 'neutral' = 'neutral';
      if (importance > 0.0001) {
        impact = 'positive';
      } else if (importance < -0.0001) {
        impact = 'negative';
      }

      results.push({
        feature,
        importance: Number(Math.abs(importance).toFixed(4)),
        impact,
        metricAffected: 'Brier Score'
      });
    }

    // Sort by importance descending
    return results.sort((a, b) => b.importance - a.importance);
  }
}
