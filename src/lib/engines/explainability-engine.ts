// HandicapLab Explainability Engine
// Location: src/lib/engines/explainability-engine.ts

export interface FeatureContribution {
  feature: string;
  contribution: number; // percentage change, e.g. +4.2 or -1.8
  direction: 'Positive' | 'Negative';
  magnitude: 'Strong' | 'Moderate' | 'Weak';
}

export class ExplainabilityEngine {
  /**
   * Deterministically maps features to contributions to explain the probability.
   * Stateless and completely deterministic.
   */
  public static explainPrediction(
    features: {
      homeAttack: number;
      awayAttack: number;
      homeDefense: number;
      awayDefense: number;
      homeRestDays: number;
      awayRestDays: number;
      isHomeAdvantage?: boolean;
      weatherRain?: boolean;
      missingLineupKeyPlayers?: number;
    }
  ): FeatureContribution[] {
    const graph: FeatureContribution[] = [];

    // 1. Elo Ratings Delta Contribution
    const eloHomePower = features.homeAttack - features.awayDefense;
    const eloAwayPower = features.awayAttack - features.homeDefense;
    const eloDiff = eloHomePower - eloAwayPower;
    
    let eloContribution = Number((eloDiff * 2.5).toFixed(2));
    if (Math.abs(eloContribution) > 0) {
      graph.push({
        feature: 'Elo Rating Delta',
        contribution: eloContribution,
        direction: eloContribution > 0 ? 'Positive' : 'Negative',
        magnitude: Math.abs(eloContribution) > 5.0 ? 'Strong' : Math.abs(eloContribution) > 2.0 ? 'Moderate' : 'Weak'
      });
    }

    // 2. Home Advantage Contribution
    if (features.isHomeAdvantage !== false) {
      graph.push({
        feature: 'Home Advantage',
        contribution: 3.2,
        direction: 'Positive',
        magnitude: 'Moderate'
      });
    }

    // 3. Fatigue & Rest Days Contribution
    const restDiff = features.homeRestDays - features.awayRestDays;
    let fatigueContribution = Number((restDiff * 0.8).toFixed(2));
    if (Math.abs(fatigueContribution) > 0) {
      graph.push({
        feature: 'Rest Days Fatigue',
        contribution: fatigueContribution,
        direction: fatigueContribution > 0 ? 'Positive' : 'Negative',
        magnitude: Math.abs(fatigueContribution) > 3.0 ? 'Strong' : Math.abs(fatigueContribution) > 1.0 ? 'Moderate' : 'Weak'
      });
    }

    // 4. Missing Squad Lineup Key Players Contribution
    if (features.missingLineupKeyPlayers && features.missingLineupKeyPlayers > 0) {
      const injuryContribution = Number((features.missingLineupKeyPlayers * -1.5).toFixed(2));
      graph.push({
        feature: 'Lineup Injuries / Absences',
        contribution: injuryContribution,
        direction: 'Negative',
        magnitude: Math.abs(injuryContribution) > 4.0 ? 'Strong' : 'Moderate'
      });
    }

    // 5. Weather Modifier Contribution
    if (features.weatherRain) {
      graph.push({
        feature: 'Weather Modifier (Rain)',
        contribution: -0.5,
        direction: 'Negative',
        magnitude: 'Weak'
      });
    }

    return graph;
  }
}
