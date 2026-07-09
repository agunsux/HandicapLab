// HandicapLab Data Platform - Betting Performance Engine
export interface BetRecord {
  probability: number;
  impliedOdds: number;
  bookmakerOdds: number;
  outcome: number; // 1 for win, 0 for loss
}

export interface BettingStrategyResult {
  roi: number;
  yield: number;
  profit: number;
  maxDrawdown: number;
  longestLosingRun: number;
  volatility: number;
  finalBankroll: number;
  bankrollHistory: number[];
}

export class BettingPerformance {
  public static simulate(
    bets: BetRecord[],
    strategy: 'flat' | 'kelly' | 'fractional_kelly' | 'half_kelly' | 'quarter_kelly' | 'dynamic_kelly',
    initialBankroll = 10000,
    fraction = 1.0 // used if strategy is fractional_kelly
  ): BettingStrategyResult {
    let bankroll = initialBankroll;
    let peakBankroll = initialBankroll;
    let maxDrawdown = 0;
    
    let currentLosingRun = 0;
    let longestLosingRun = 0;
    
    let totalStaked = 0;
    const totalReturned = 0;

    const bankrollHistory = [initialBankroll];
    const returns: number[] = [];

    let appliedFraction = 1.0;
    if (strategy === 'half_kelly') appliedFraction = 0.5;
    if (strategy === 'quarter_kelly') appliedFraction = 0.25;
    if (strategy === 'fractional_kelly') appliedFraction = fraction;

    for (const bet of bets) {
      if (bet.bookmakerOdds <= 1.0) continue;
      
      const edge = bet.probability * bet.bookmakerOdds - 1.0;
      if (edge <= 0) continue; // no bet

      let stake = 0;

      if (strategy === 'flat') {
        stake = 100; // Flat 100 units
      } else {
        // Kelly variants
        const b = bet.bookmakerOdds - 1;
        const q = 1 - bet.probability;
        let k = (bet.probability * b - q) / b;
        k = Math.max(0, k);

        if (strategy === 'dynamic_kelly') {
            // Adjust fraction based on recent drawdown
            const currentDrawdown = (peakBankroll - bankroll) / peakBankroll;
            let dynamicFraction = 1.0;
            if (currentDrawdown > 0.2) dynamicFraction = 0.5;
            if (currentDrawdown > 0.4) dynamicFraction = 0.25;
            stake = k * dynamicFraction * bankroll;
        } else {
            stake = k * appliedFraction * bankroll;
        }
      }

      // Safeguard against bankruptcy
      stake = Math.min(stake, bankroll);
      
      totalStaked += stake;
      
      let betReturn = -stake; // default to loss
      if (bet.outcome === 1) {
        betReturn = stake * (bet.bookmakerOdds - 1);
        currentLosingRun = 0;
      } else {
        currentLosingRun++;
        if (currentLosingRun > longestLosingRun) longestLosingRun = currentLosingRun;
      }

      bankroll += betReturn;
      returns.push(betReturn / stake); // Simple return percentage for volatility calculation

      if (bankroll > peakBankroll) {
        peakBankroll = bankroll;
      }

      const currentDrawdown = (peakBankroll - bankroll) / peakBankroll;
      if (currentDrawdown > maxDrawdown) {
        maxDrawdown = currentDrawdown;
      }
      
      bankrollHistory.push(Number(bankroll.toFixed(2)));
    }

    const profit = bankroll - initialBankroll;
    const roi = initialBankroll > 0 ? profit / initialBankroll : 0;
    const yieldPercentage = totalStaked > 0 ? profit / totalStaked : 0;
    
    // Calculate volatility (std dev of returns)
    let volatility = 0;
    if (returns.length > 1) {
      const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / (returns.length - 1);
      volatility = Math.sqrt(variance);
    }

    return {
      roi,
      yield: yieldPercentage,
      profit,
      maxDrawdown,
      longestLosingRun,
      volatility,
      finalBankroll: bankroll,
      bankrollHistory
    };
  }
}
