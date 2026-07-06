// HandicapLab Decision Engine v1 - Explainability Engine
// Location: src/lib/engines/decision-engine-v1/explainability-engine.ts

import { MatchFeatures } from '../feature-engine/types';

export interface SHAPContribution {
  feature: string;
  contribution: number; // SHAP value (positive/negative probability offset)
}

export class ExplainabilityEngine {
  /**
   * Generates SHAP-compatible model explanations.
   * Completely stateless and deterministic.
   */
  public static explain(features: MatchFeatures): SHAPContribution[] {
    const shap: SHAPContribution[] = [];

    // 1. Elo Rating Delta contribution
    const homeElo = features.homeElo ?? 1500;
    const awayElo = features.awayElo ?? 1500;
    const eloDelta = homeElo - awayElo;
    shap.push({
      feature: 'elo_difference',
      contribution: Number((eloDelta * 0.0003).toFixed(4))
    });

    // 2. Schedule Congestion Rest Days contribution
    const restDelta = (features.homeRestDays ?? 4) - (features.awayRestDays ?? 4);
    shap.push({
      feature: 'rest_days_delta',
      contribution: Number((restDelta * 0.015).toFixed(4))
    });

    // 3. Squad Value contribution
    const squadAttackDelta = features.homeAttack - features.awayDefense;
    shap.push({
      feature: 'squad_strength_delta',
      contribution: Number((squadAttackDelta * 0.05).toFixed(4))
    });

    // 4. Squad continuity missing contribution
    if (features.squadContinuityHome !== undefined && features.squadContinuityHome < 1.0) {
      shap.push({
        feature: 'squad_continuity_home',
        contribution: Number(((features.squadContinuityHome - 1.0) * 0.1).toFixed(4))
      });
    }

    return shap;
  }
}
