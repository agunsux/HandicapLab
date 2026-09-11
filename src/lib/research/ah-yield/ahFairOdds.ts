// AH YIELD ENGINE — Settlement-aware fair odds, expected value, and edge.
//
// Asian Handicap is NOT a binary win/loss instrument. For a 1-unit stake:
//   P&L(FULL_WIN)  = +(o − 1)
//   P&L(HALF_WIN)  = +0.5·(o − 1)
//   P&L(PUSH)      =  0
//   P&L(HALF_LOSS) = −0.5
//   P&L(FULL_LOSS) = −1
// Therefore:
//   EV(o)   = (pFW + 0.5·pHW)·(o − 1) − (0.5·pHL + pFL)
//   Fair odds solves EV(o*) = 0:
//   o*      = 1 + (0.5·pHL + pFL) / (pFW + 0.5·pHW)
// (undefined when pFW + 0.5·pHW = 0, i.e. no chance of any profit).
//
// Market implied return uses a proportional two-way devig of the paired
// opposite-side price at the same line/snapshot. That devig is binary by
// construction (two prices cannot identify a five-category distribution), so
// it is reported as an approximation and never used as the model probability.

export interface AhSettlementProbabilities {
  pFullWin: number;
  pHalfWin: number;
  pPush: number;
  pHalfLoss: number;
  pFullLoss: number;
}

export function ahExpectedValue(probs: AhSettlementProbabilities, odds: number): number {
  assertOdds(odds);
  const winCoefficient = probs.pFullWin + 0.5 * probs.pHalfWin;
  const lossCoefficient = 0.5 * probs.pHalfLoss + probs.pFullLoss;
  return winCoefficient * (odds - 1) - lossCoefficient;
}

export function ahFairOdds(probs: AhSettlementProbabilities): number | null {
  const winCoefficient = probs.pFullWin + 0.5 * probs.pHalfWin;
  const lossCoefficient = 0.5 * probs.pHalfLoss + probs.pFullLoss;
  if (winCoefficient <= 0) return null;
  return 1 + lossCoefficient / winCoefficient;
}

/** Relative price edge: (offered / fair) − 1. */
export function ahPriceEdge(odds: number, fairOdds: number | null): number | null {
  assertOdds(odds);
  if (fairOdds === null || fairOdds <= 0) return null;
  return odds / fairOdds - 1;
}

export interface TwoWayDevig {
  pA: number;
  pB: number;
  fairA: number;
  fairB: number;
  overround: number;
}

/** Proportional two-way devig (Joiner-style multiplicative): pA = (1/oA)/(1/oA + 1/oB). */
export function devigTwoWay(oddsA: number, oddsB: number): TwoWayDevig {
  assertOdds(oddsA);
  assertOdds(oddsB);
  const invA = 1 / oddsA;
  const invB = 1 / oddsB;
  const pA = invA / (invA + invB);
  const pB = invB / (invA + invB);
  return { pA, pB, fairA: 1 / pA, fairB: 1 / pB, overround: invA + invB - 1 };
}

export interface AhEvAssessment {
  modelEv: number;
  fairOdds: number | null;
  priceEdge: number | null;
  marketDevigProb: number | null;
  marketImpliedEv: number | null;
  /** modelEv − marketImpliedEv (null when the opposite price is unavailable). */
  edge: number | null;
}

export function assessAhBet(
  probs: AhSettlementProbabilities,
  offeredOdds: number,
  oppositeSideOdds?: number | null
): AhEvAssessment {
  const modelEv = ahExpectedValue(probs, offeredOdds);
  const fairOdds = ahFairOdds(probs);
  const priceEdge = ahPriceEdge(offeredOdds, fairOdds);

  let marketDevigProb: number | null = null;
  let marketImpliedEv: number | null = null;
  let edge: number | null = null;

  if (typeof oppositeSideOdds === 'number' && Number.isFinite(oppositeSideOdds) && oppositeSideOdds > 1) {
    const devig = devigTwoWay(offeredOdds, oppositeSideOdds);
    marketDevigProb = devig.pA;
    marketImpliedEv = devig.pA * (offeredOdds - 1) - (1 - devig.pA);
    edge = modelEv - marketImpliedEv;
  }

  return {
    modelEv: Number(modelEv.toFixed(6)),
    fairOdds: fairOdds === null ? null : Number(fairOdds.toFixed(6)),
    priceEdge: priceEdge === null ? null : Number(priceEdge.toFixed(6)),
    marketDevigProb: marketDevigProb === null ? null : Number(marketDevigProb.toFixed(6)),
    marketImpliedEv: marketImpliedEv === null ? null : Number(marketImpliedEv.toFixed(6)),
    edge: edge === null ? null : Number(edge.toFixed(6)),
  };
}

function assertOdds(odds: number): void {
  if (!Number.isFinite(odds) || odds <= 1) {
    throw new Error(`AH odds must be > 1.0, got ${String(odds)}`);
  }
}
