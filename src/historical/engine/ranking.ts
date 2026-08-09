export type OpportunityGrade = 'A' | 'B' | 'C' | 'NONE';

export interface RankingInput {
  evCalibrated: number | null;
  marketEceAfter: number;
  featureCompleteness: 'FULL' | 'PARTIAL';
  oddsMargin: number | null;
}

export interface RankingResult {
  score: number | null;
  grade: OpportunityGrade;
  rationale: string;
}

export const RANKING_WEIGHTS = {
  ev: 1.0,
  ece_penalty_high: 0.15,
  ece_penalty_medium: 0.08,
  margin_penalty: 0.2,
};

export function gradeOpportunity(input: RankingInput): OpportunityGrade {
  if (input.evCalibrated === null || input.evCalibrated <= 0) return 'NONE';
  if (input.marketEceAfter <= 0.10 && input.featureCompleteness === 'FULL' && (input.oddsMargin === null || input.oddsMargin <= 0.04)) return 'A';
  if (input.marketEceAfter <= 0.20 && input.featureCompleteness === 'FULL') return 'B';
  return 'C';
}

export function rankOpportunity(input: RankingInput): RankingResult {
  if (input.evCalibrated === null) {
    return { score: null, grade: 'NONE', rationale: 'no calibrated EV' };
  }
  let score = input.evCalibrated * RANKING_WEIGHTS.ev;
  if (input.marketEceAfter > 0.20) score -= RANKING_WEIGHTS.ece_penalty_high;
  else if (input.marketEceAfter > 0.10) score -= RANKING_WEIGHTS.ece_penalty_medium;
  if (input.oddsMargin !== null && input.oddsMargin > 0.06) score -= RANKING_WEIGHTS.margin_penalty * (input.oddsMargin - 0.06);
  const grade = gradeOpportunity(input);
  return {
    score: Number(score.toFixed(4)),
    grade,
    rationale: `score = EV_calibrated(${input.evCalibrated.toFixed(4)}) - calibration penalties - margin penalty; grade from ECE(=${input.marketEceAfter.toFixed(3)}), completeness, margin`,
  };
}

export function oddsMargin1x2(home: number, draw: number, away: number): number {
  return 1 / home + 1 / draw + 1 / away - 1;
}

export function oddsMarginBinary(over: number, under: number): number {
  return 1 / over + 1 / under - 1;
}
