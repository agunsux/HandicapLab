import { IBenchmarkModel, PredictionVector } from './BaseModel';

export class ClosingOddsModel implements IBenchmarkModel {
  name = 'Closing Odds (Multiplicative De-vig)';

  async predict(match: any): Promise<PredictionVector | null> {
    const b365h = match.B365H;
    const b365d = match.B365D;
    const b365a = match.B365A;

    if (!b365h || !b365d || !b365a) return null;

    // Multiplicative Normalization (De-vig)
    // 1. Calculate implied probabilities
    const impliedH = 1 / b365h;
    const impliedD = 1 / b365d;
    const impliedA = 1 / b365a;

    // 2. Calculate overround (margin)
    const margin = impliedH + impliedD + impliedA;

    // 3. Normalize to sum to 1.0
    return {
      pHome: impliedH / margin,
      pDraw: impliedD / margin,
      pAway: impliedA / margin
    };
  }
}
