// HandicapLab Market Intelligence - Prematch Features (Odds Movement)
// Location: src/lib/market-intelligence/features/prematch/odds-movement.ts

import { OddsTimeline, OddsLine } from '../../types';

export class OddsMovementAnalyzer {
  
  /**
   * Converts decimal odds to implied probability (margin included).
   */
  public static toImpliedProbability(odds: number): number {
    if (!odds || odds <= 1.0) return 0;
    return 1 / odds;
  }

  /**
   * Calculates the delta in implied probability between opening and current.
   * Positive delta means probability increased (odds dropped).
   */
  public static calculateImpliedDelta(timeline: OddsTimeline): { home: number; draw: number; away: number } {
    const openH = this.toImpliedProbability(timeline.opening.moneyline.home);
    const openD = this.toImpliedProbability(timeline.opening.moneyline.draw);
    const openA = this.toImpliedProbability(timeline.opening.moneyline.away);

    const currH = this.toImpliedProbability(timeline.current.moneyline.home);
    const currD = this.toImpliedProbability(timeline.current.moneyline.draw);
    const currA = this.toImpliedProbability(timeline.current.moneyline.away);

    return {
      home: currH - openH,
      draw: currD - openD,
      away: currA - openA
    };
  }

  /**
   * Calculates the raw velocity (odds drop per hour) for a specific outcome.
   */
  public static calculateVelocity(timeline: OddsTimeline, selection: 'home' | 'draw' | 'away'): number {
    if (timeline.history.length < 2) return 0;
    
    const first = timeline.history[0];
    const last = timeline.history[timeline.history.length - 1];
    
    const timeDiffMs = last.timestamp.getTime() - first.timestamp.getTime();
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
    
    if (timeDiffHours <= 0) return 0;

    const probStart = this.toImpliedProbability(first.moneyline[selection]);
    const probEnd = this.toImpliedProbability(last.moneyline[selection]);
    
    const probDiff = probEnd - probStart;
    
    return probDiff / timeDiffHours;
  }
}
