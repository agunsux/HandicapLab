import { IBenchmarkModel, PredictionVector } from './BaseModel';

export class PoissonModel implements IBenchmarkModel {
  name = 'Poisson Baseline';

  // State trackers for EWMA
  private homeAttack: Record<string, number> = {};
  private homeDefense: Record<string, number> = {};
  private awayAttack: Record<string, number> = {};
  private awayDefense: Record<string, number> = {};
  
  private readonly LEAGUE_AVG_HG = 1.45;
  private readonly LEAGUE_AVG_AG = 1.20;
  private readonly ALPHA = 0.1; // Learning rate

  private poisson(k: number, lambda: number): number {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / this.factorial(k);
  }

  private factorial(n: number): number {
    if (n === 0 || n === 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }

  async predict(match: any): Promise<PredictionVector | null> {
    const home = match.HomeTeam;
    const away = match.AwayTeam;

    // 1. Get current strengths (default to 1.0)
    const hAtt = this.homeAttack[home] || 1.0;
    const hDef = this.homeDefense[home] || 1.0;
    const aAtt = this.awayAttack[away] || 1.0;
    const aDef = this.awayDefense[away] || 1.0;

    // 2. Calculate expected goals
    const expHG = hAtt * aDef * this.LEAGUE_AVG_HG;
    const expAG = aAtt * hDef * this.LEAGUE_AVG_AG;

    // 3. Calculate 1X2 probabilities (summing up to 5 goals)
    let pHome = 0, pDraw = 0, pAway = 0;
    for (let h = 0; h <= 5; h++) {
      for (let a = 0; a <= 5; a++) {
        const prob = this.poisson(h, expHG) * this.poisson(a, expAG);
        if (h > a) pHome += prob;
        else if (h === a) pDraw += prob;
        else pAway += prob;
      }
    }

    // Normalize (because we cut off at 5 goals, sum is ~0.99)
    const sum = pHome + pDraw + pAway;
    return { pHome: pHome/sum, pDraw: pDraw/sum, pAway: pAway/sum };
  }

  // Called after predict to update internal state
  update(match: any) {
    const home = match.HomeTeam;
    const away = match.AwayTeam;
    const hg = parseFloat(match.FTHG);
    const ag = parseFloat(match.FTAG);

    const hAtt = this.homeAttack[home] || 1.0;
    const hDef = this.homeDefense[home] || 1.0;
    const aAtt = this.awayAttack[away] || 1.0;
    const aDef = this.awayDefense[away] || 1.0;

    const expHG = hAtt * aDef * this.LEAGUE_AVG_HG;
    const expAG = aAtt * hDef * this.LEAGUE_AVG_AG;

    // Update strengths based on actual vs expected
    this.homeAttack[home] = hAtt + this.ALPHA * ((hg / this.LEAGUE_AVG_HG) - expHG);
    this.awayDefense[away] = aDef + this.ALPHA * ((hg / this.LEAGUE_AVG_HG) - expHG);
    
    this.awayAttack[away] = aAtt + this.ALPHA * ((ag / this.LEAGUE_AVG_AG) - expAG);
    this.homeDefense[home] = hDef + this.ALPHA * ((ag / this.LEAGUE_AVG_AG) - expAG);
    
    // Prevent negative strengths
    this.homeAttack[home] = Math.max(0.1, this.homeAttack[home]);
    this.awayDefense[away] = Math.max(0.1, this.awayDefense[away]);
    this.awayAttack[away] = Math.max(0.1, this.awayAttack[away]);
    this.homeDefense[home] = Math.max(0.1, this.homeDefense[home]);
  }
}
