import { IBenchmarkModel, PredictionVector } from './BaseModel';
import { PoissonModel } from './PoissonModel';

export class DixonColesModel extends PoissonModel {
  name = 'Dixon-Coles Baseline';
  
  private readonly RHO = -0.13; // Empirical rho for EPL (draws are more common than pure Poisson expects)

  // We override the predict method to apply the bivariate correction factor
  async predict(match: any): Promise<PredictionVector | null> {
    const basePrediction = await super.predict(match);
    if (!basePrediction) return null;

    // We need the raw expected goals to apply the tau correction
    // We can recalculate them quickly since PoissonModel's logic is deterministic
    const home = match.HomeTeam;
    const away = match.AwayTeam;

    const hAtt = (this as any).homeAttack[home] || 1.0;
    const hDef = (this as any).homeDefense[home] || 1.0;
    const aAtt = (this as any).awayAttack[away] || 1.0;
    const aDef = (this as any).awayDefense[away] || 1.0;

    const expHG = hAtt * aDef * (this as any).LEAGUE_AVG_HG;
    const expAG = aAtt * hDef * (this as any).LEAGUE_AVG_AG;

    // Calculate raw poisson matrix again
    let pHome = 0, pDraw = 0, pAway = 0;
    for (let h = 0; h <= 5; h++) {
      for (let a = 0; a <= 5; a++) {
        let prob = (this as any).poisson(h, expHG) * (this as any).poisson(a, expAG);
        
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
