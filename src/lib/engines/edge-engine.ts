// HandicapLab Edge Engine
// Location: src/lib/engines/edge-engine.ts

export interface MarketOdds {
  opening?: number;
  current: number;
  closing?: number;
}

export interface BookmakerOddsSnapshot {
  bookmaker: string;
  moneyline?: {
    home: MarketOdds;
    draw: MarketOdds;
    away: MarketOdds;
  };
  asianHandicap?: Record<string, {
    home: MarketOdds;
    away: MarketOdds;
  }>;
  overUnder?: Record<string, {
    over: MarketOdds;
    under: MarketOdds;
  }>;
  btts?: {
    yes: MarketOdds;
    no: MarketOdds;
  };
  doubleChance?: {
    homeDraw: MarketOdds; // 1X
    awayDraw: MarketOdds; // X2
    homeAway: MarketOdds; // 12
  };
}

export interface EdgeOutput {
  market: string;          // e.g. "Moneyline Home", "AH -0.5 Home", "Over 2.5", "BTTS Yes", "Double Chance HomeDraw"
  bookmaker: string;
  opening_odds: number | null;
  current_odds: number;
  closing_odds: number | null;
  fair_odds: number;
  edge: number;            // edge percentage, e.g. 5.23 (%)
  EV: number;              // Expected Value, e.g. 8.42 (%)
  CLV_projection: number;  // Projected CLV, e.g. 2.10 (%)
  steam: boolean;
  reverse_line: boolean;
}

export class EdgeEngine {
  /**
   * Deterministically calculates edges across all markets for a single match prediction.
   */
  public static calculateEdges(
    probs: {
      pHome: number;
      pDraw: number;
      pAway: number;
      pOver: Record<string, number>;
      pUnder: Record<string, number>;
      pAhHome: Record<string, number>;
      pAhAway: Record<string, number>;
      pBttsYes?: number;
      pBttsNo?: number;
    },
    odds: BookmakerOddsSnapshot
  ): EdgeOutput[] {
    const edges: EdgeOutput[] = [];
    const bookmaker = odds.bookmaker;

    // Helper to evaluate a specific market choice
    const evaluate = (
      marketName: string,
      modelProb: number,
      marketOdds: MarketOdds | undefined
    ) => {
      if (!marketOdds || !marketOdds.current || marketOdds.current <= 1.0) return;

      const current = marketOdds.current;
      const opening = marketOdds.opening ?? null;
      const closing = marketOdds.closing ?? null;

      // Deterministic Fair Odds: 1 / Probability
      const fairOdds = modelProb > 0 ? Number((1 / modelProb).toFixed(4)) : 999.0;

      // Edge % = Model Prob - (1 / Bookmaker Odds)
      const impliedBookmakerProb = 1 / current;
      const edge = Number(((modelProb - impliedBookmakerProb) * 100).toFixed(2));

      // EV = (Model Prob * Bookmaker Odds - 1) * 100
      const ev = Number(((modelProb * current - 1) * 100).toFixed(2));

      // CLV Projection = Opening vs Current line shift
      let clvProjection = 0.0;
      if (opening && opening > 1.0) {
        clvProjection = Number(((opening / current - 1) * 100).toFixed(2));
      }

      // Steam detection (odds shortening significantly, e.g., drop > 5%)
      let steam = false;
      if (opening && opening > 1.0) {
        steam = (opening - current) / opening > 0.05;
      }

      // Reverse Line Movement: odds shift opposite to public consensus/probability model
      let reverseLine = false;
      if (opening && opening > 1.0) {
        // If model says Home is very strong but Home odds are drifting (increasing),
        // or model says Home is weak but Home odds are shortening (decreasing).
        const probImpliesShortening = modelProb > 0.5;
        const oddsShortened = current < opening;
        reverseLine = probImpliesShortening !== oddsShortened;
      }

      edges.push({
        market: marketName,
        bookmaker,
        opening_odds: opening ? Number(opening.toFixed(2)) : null,
        current_odds: Number(current.toFixed(2)),
        closing_odds: closing ? Number(closing.toFixed(2)) : null,
        fair_odds: Number(fairOdds.toFixed(2)),
        edge,
        EV: ev,
        CLV_projection: clvProjection,
        steam,
        reverse_line: reverseLine
      });
    };

    // 1. Moneyline
    if (odds.moneyline) {
      evaluate('Moneyline Home', probs.pHome, odds.moneyline.home);
      evaluate('Moneyline Draw', probs.pDraw, odds.moneyline.draw);
      evaluate('Moneyline Away', probs.pAway, odds.moneyline.away);
    }

    // 2. Asian Handicap
    if (odds.asianHandicap) {
      for (const [line, ahOdds] of Object.entries(odds.asianHandicap)) {
        const homeProb = probs.pAhHome[line];
        const awayProb = probs.pAhAway[line];
        if (homeProb !== undefined) {
          evaluate(`AH ${line} Home`, homeProb, ahOdds.home);
        }
        if (awayProb !== undefined) {
          evaluate(`AH ${line} Away`, awayProb, ahOdds.away);
        }
      }
    }

    // 3. Over / Under
    if (odds.overUnder) {
      for (const [line, ouOdds] of Object.entries(odds.overUnder)) {
        const overProb = probs.pOver[line];
        const underProb = probs.pUnder[line];
        if (overProb !== undefined) {
          evaluate(`Over ${line}`, overProb, ouOdds.over);
        }
        if (underProb !== undefined) {
          evaluate(`Under ${line}`, underProb, ouOdds.under);
        }
      }
    }

    // 4. BTTS
    if (odds.btts) {
      if (probs.pBttsYes !== undefined) {
        evaluate('BTTS Yes', probs.pBttsYes, odds.btts.yes);
      }
      if (probs.pBttsNo !== undefined) {
        evaluate('BTTS No', probs.pBttsNo, odds.btts.no);
      }
    }

    // 5. Double Chance
    if (odds.doubleChance) {
      const pHomeDraw = Number((probs.pHome + probs.pDraw).toFixed(4));
      const pAwayDraw = Number((probs.pAway + probs.pDraw).toFixed(4));
      const pHomeAway = Number((probs.pHome + probs.pAway).toFixed(4));

      evaluate('Double Chance HomeDraw', pHomeDraw, odds.doubleChance.homeDraw);
      evaluate('Double Chance AwayDraw', pAwayDraw, odds.doubleChance.awayDraw);
      evaluate('Double Chance HomeAway', pHomeAway, odds.doubleChance.homeAway);
    }

    return edges;
  }
}
