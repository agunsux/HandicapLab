import { MarketMovement, OddsSnapshot } from './types';

export class MovementEngine {
  /**
   * Calculates movement properties between an opening snapshot and a current snapshot.
   */
  public static calculateMovement(
    openingSnapshot: OddsSnapshot,
    currentSnapshot: OddsSnapshot
  ): Partial<MarketMovement> {
    
    const openingOdds = openingSnapshot.decimal_odds;
    const currentOdds = currentSnapshot.decimal_odds;
    
    // Percentage drop/rise
    const movementPercentage = ((currentOdds - openingOdds) / openingOdds) * 100;
    
    // Odds Drift: raw decimal change
    const oddsDrift = currentOdds - openingOdds;
    
    // Price acceleration (movement per hour since opening)
    const tOpen = new Date(openingSnapshot.timestamp).getTime();
    const tCurrent = new Date(currentSnapshot.timestamp).getTime();
    const hoursElapsed = (tCurrent - tOpen) / (1000 * 60 * 60);
    
    let priceAcceleration = 0;
    let steamVelocity = 0;
    
    if (hoursElapsed > 0) {
      priceAcceleration = movementPercentage / hoursElapsed;
      
      // Steam velocity specifically tracks severe drops in short timeframes
      // If odds drop by more than 5% in less than 2 hours, it's considered steam
      if (movementPercentage < -5.0 && hoursElapsed < 2.0) {
        steamVelocity = Math.abs(movementPercentage) / hoursElapsed;
      }
    }
    
    return {
      opening_odds: openingOdds,
      current_odds: currentOdds,
      movement_percentage: Number(movementPercentage.toFixed(4)),
      odds_drift: Number(oddsDrift.toFixed(4)),
      price_acceleration: Number(priceAcceleration.toFixed(4)),
      steam_velocity: Number(steamVelocity.toFixed(4)),
      favourite_flip: (openingOdds >= 2.0 && currentOdds < 2.0) || (openingOdds < 2.0 && currentOdds >= 2.0)
    };
  }
}
