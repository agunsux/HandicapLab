// EPIC 38 — EV Decay Engine & Optimal Betting Window
// Tracks EV trajectory over time, producing EV Curves, Edge Curves, Steam & RLM alerts,
// and computing the Optimal Betting Window before kickoff.

export interface EVPoint {
  hoursBeforeKickoff: number;
  ev: number;
  odds: number;
}

export interface EVDecayAnalysis {
  fixtureId: string;
  market: string;
  openingEv: number;
  currentEv: number;
  evChangePct: number;
  optimalBettingWindow: 'IMMEDIATE' | 'T-12H' | 'T-2H_BEFORE_KICKOFF' | 'WAIT';
  steamAlert: boolean;
  rlmAlert: boolean;
  evCurve: EVPoint[];
  summaryText: string;
}

export class EVDecayEngine {
  /** Analyze EV decay trajectory and identify optimal execution window */
  static analyzeEVDecay(
    fixtureId: string,
    market: string,
    evTrajectory: EVPoint[]
  ): EVDecayAnalysis {
    if (evTrajectory.length === 0) {
      return {
        fixtureId,
        market,
        openingEv: 0,
        currentEv: 0,
        evChangePct: 0,
        optimalBettingWindow: 'IMMEDIATE',
        steamAlert: false,
        rlmAlert: false,
        evCurve: [],
        summaryText: 'Insufficient EV trajectory snapshots.',
      };
    }

    const sorted = [...evTrajectory].sort((a, b) => b.hoursBeforeKickoff - a.hoursBeforeKickoff);
    const openingEv = sorted[0].ev;
    const currentEv = sorted[sorted.length - 1].ev;
    const evChangePct = Number(((currentEv - openingEv) / Math.max(0.01, Math.abs(openingEv))).toFixed(4));

    const steamAlert = currentEv < openingEv * 0.7; // Odds shortened, EV decay occurred
    const rlmAlert = currentEv > openingEv * 1.2;  // Odds drifted, EV expanded

    let optimalBettingWindow: 'IMMEDIATE' | 'T-12H' | 'T-2H_BEFORE_KICKOFF' | 'WAIT' = 'IMMEDIATE';
    if (steamAlert) {
      optimalBettingWindow = 'IMMEDIATE';
    } else if (rlmAlert) {
      optimalBettingWindow = 'T-2H_BEFORE_KICKOFF';
    }

    return {
      fixtureId,
      market,
      openingEv,
      currentEv,
      evChangePct,
      optimalBettingWindow,
      steamAlert,
      rlmAlert,
      evCurve: sorted,
      summaryText: `EV Decay Analysis: Opening EV ${(openingEv * 100).toFixed(1)}% -> Current EV ${(currentEv * 100).toFixed(1)}%. Optimal Execution Window: ${optimalBettingWindow}.`,
    };
  }
}
