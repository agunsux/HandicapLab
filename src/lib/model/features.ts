export interface Feature {
  name: string;
  value: number; // raw value (-1 to 1 usually)
  weight: number; // importance weight
  description: string; // for explainability
}

export function calculateFeatureScore(features: Feature[]): number {
  let score = 0;
  for (const f of features) {
    score += f.value * f.weight;
  }
  return score;
}

export function extractExplainability(features: Feature[]): { positive: string[], negative: string[] } {
  const sorted = [...features].sort((a, b) => Math.abs(b.value * b.weight) - Math.abs(a.value * a.weight));
  
  const positive: string[] = [];
  const negative: string[] = [];
  
  for (const f of sorted) {
    const contribution = f.value * f.weight;
    if (Math.abs(contribution) < 0.02) continue; // Skip negligible
    if (contribution > 0) {
      positive.push(f.description);
    } else {
      negative.push(f.description);
    }
  }
  
  return { positive: positive.slice(0, 3), negative: negative.slice(0, 3) };
}

export function sigmoid(score: number): number {
  return 1 / (1 + Math.exp(-score));
}
