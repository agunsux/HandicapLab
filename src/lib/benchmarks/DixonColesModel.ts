import { PredictionVector } from './BaseModel';
import { PoissonModel } from './PoissonModel';

export class DixonColesModel extends PoissonModel {
  name = 'Dixon-Coles Baseline';
  
  private readonly RHO = -0.13; // Empirical rho for EPL (draws are more common than pure Poisson expects)

  // We override the predict method to apply the bivariate correction factor
  async predict(match: Record<string, unknown>): Promise<PredictionVector | null> {
    const basePrediction = await super.predict(match);
    if (!basePrediction) return null;

    // We need the raw expected goals to apply the tau correction
    // We can recalculate them quickly since PoissonModel's logic is deterministic
    const home = match.HomeTeam as string;
    const away = match.AwayTeam as string;

    const self = this as unknown as {
      homeAttack: Record<string, number>;
      homeDefense: Record<string, number>;
      awayAttack: Record<string, number>;
      awayDefense: Record<string, number>;
      LEAGUE_AVG_HG: number;
      LEAGUE_AVG_AG: number;
      poisson: (k: number, lambda: number) => number;
    };
    const hAtt = self.homeAttack[home] || 1.0;
    const hDef = self.homeDefense[home] || 1.0;
    const aAtt = self.awayAttack[away] || 1.0;
    const aDef = self.awayDefense[away] || 1.0;

    const expHG = hAtt * aDef * self.LEAGUE_AVG_HG;
    const expAG = aAtt * hDef * self.LEAGUE_AVG_AG;

    // Calculate raw poisson matrix again
    let pHome = 0, pDraw = 0, pAway = 0;
    for (let h = 0; h <= 5; h++) {
      for (let a = 0; a <= 5; a++) {
        let prob = self.poisson(h, expHG) * self.poisson(a, expAG);
        
        // Apply Dixon-Coles Tau adjustment
        if (h === 0 && a === 0) {
          prob *= (1 - expHG * expAG * this.RHO);
        } else if (h === 0 && a === 1) {
          prob *= (1 + expHG * this.RHO);
        } else if (h === 1 && a === 0) {
          prob *= (1 + expAG * this.RHO);
        } else if (h === 1 && a === 1) {
          prob *= (1 - this.RHO);
        }

        prob = Math.max(0, prob); // Prevent negative probabilities if rho is extreme

        if (h > a) pHome += prob;
        else if (h === a) pDraw += prob;
        else pAway += prob;
      }
    }

    // Normalize
    const sum = pHome + pDraw + pAway;
    return { pHome: pHome/sum, pDraw: pDraw/sum, pAway: pAway/sum };
  }
}
