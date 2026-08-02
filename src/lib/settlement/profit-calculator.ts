export class ProfitCalculator {
  /**
   * Calculates profit/loss for a prediction based on the outcome of the pick.
   * Staking can follow the Kelly Criterion stake recommendation.
   * 
   * Formula: profit = stake * (odds - 1) if win, -stake if loss, 0 if push
   * 
   * @param outcome Pick's selection ('home' | 'draw' | 'away' | 'over' | 'under')
   * @param marketType Market type ('ML' | 'AH' | 'OU')
   * @param line Selection handicap or total line (e.g. "2.5", "-0.5")
   * @param stake Stake amount size (usually fractional Kelly e.g. 0.05 or 1 unit default)
   * @param odds Best odds at bet time
   * @param actualHome Actual goals scored by home team
   * @param actualAway Actual goals scored by away team
   */
  public static calculate(
    outcome: string,
    marketType: 'ML' | 'AH' | 'OU' | 'BTTS',
    line: string,
    stake: number,
    odds: number,
    actualHome: number,
    actualAway: number
  ): number {
    const totalGoals = actualHome + actualAway;
    const goalDiff = actualHome - actualAway;

    let result: 'win' | 'loss' | 'push' = 'loss';

    if (marketType === 'ML') {
      const actualOutcome = actualHome > actualAway ? 'home' : actualHome === actualAway ? 'draw' : 'away';
      result = outcome === actualOutcome ? 'win' : 'loss';
    } else if (marketType === 'AH') {
      const lineNum = parseFloat(line);
      // Net goal difference with handicap line applied for selected side
      const net = outcome === 'home' ? (goalDiff + lineNum) : (-goalDiff - lineNum);

      if (net > 0) result = 'win';
      else if (net < 0) result = 'loss';
      else result = 'push';
    } else if (marketType === 'OU') {
      const lineNum = parseFloat(line);
      if (totalGoals === lineNum) {
        result = 'push';
      } else {
        const isOver = totalGoals > lineNum;
        result = (outcome === 'over' && isOver) || (outcome === 'under' && !isOver) ? 'win' : 'loss';
      }
    } else if (marketType === 'BTTS') {
      const bothScored = actualHome > 0 && actualAway > 0;
      if (outcome === 'btts_yes' && bothScored) result = 'win';
      else if (outcome === 'btts_no' && !bothScored) result = 'win';
      else result = 'loss';
    }

    if (result === 'win') {
      return Number((stake * (odds - 1)).toFixed(4));
    } else if (result === 'loss') {
      return Number((-stake).toFixed(4));
    }
    return 0.0; // push
  }
}
