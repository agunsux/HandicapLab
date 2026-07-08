import { IBenchmarkModel, PredictionVector } from './BaseModel';

export class EloModel implements IBenchmarkModel {
  name = 'Elo Baseline';

  private eloRatings: Record<string, number> = {};
  
  private readonly K_FACTOR = 20;
  private readonly HOME_ADVANTAGE = 100;
  private readonly DRAW_THRESHOLD = 50; 

  async predict(match: any): Promise<PredictionVector | null> {
    const home = match.HomeTeam;
    const away = match.AwayTeam;

    const hElo = this.eloRatings[home] || 1500;
    const aElo = this.eloRatings[away] || 1500;

    // Home advantage
    const adjustedHElo = hElo + this.HOME_ADVANTAGE;

    // Standard Elo win probability
    const expectedHomeWin = 1 / (1 + Math.pow(10, (aElo - adjustedHElo) / 400));
    const expectedAwayWin = 1 / (1 + Math.pow(10, (adjustedHElo - aElo) / 400));
    
    // Naive mapping to 1X2 using a draw heuristic
    // If teams are perfectly matched, draw is higher.
    const diff = Math.abs(adjustedHElo - aElo);
    const pDraw = 0.30 * Math.exp(-diff / 200); 
    
    // Distribute remaining probability proportionally
    const remaining = 1 - pDraw;
    const pHome = (expectedHomeWin / (expectedHomeWin + expectedAwayWin)) * remaining;
    const pAway = (expectedAwayWin / (expectedHomeWin + expectedAwayWin)) * remaining;

    return { pHome, pDraw, pAway };
  }

  update(match: any) {
    const home = match.HomeTeam;
    const away = match.AwayTeam;
    const hg = parseInt(match.FTHG, 10);
    const ag = parseInt(match.FTAG, 10);

    const hElo = this.eloRatings[home] || 1500;
    const aElo = this.eloRatings[away] || 1500;
    const adjustedHElo = hElo + this.HOME_ADVANTAGE;

    const expectedHomeWin = 1 / (1 + Math.pow(10, (aElo - adjustedHElo) / 400));
    const expectedAwayWin = 1 - expectedHomeWin; // simplified

    let actualH = 0.5;
    let actualA = 0.5;
    
    if (hg > ag) {
      actualH = 1;
      actualA = 0;
    } else if (hg < ag) {
      actualH = 0;
      actualA = 1;
    }

    this.eloRatings[home] = hElo + this.K_FACTOR * (actualH - expectedHomeWin);
    this.eloRatings[away] = aElo + this.K_FACTOR * (actualA - expectedAwayWin);
  }
}
