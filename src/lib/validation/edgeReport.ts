export interface EdgeReport {
  market: string;
  selection: string;
  modelProbability: number;
  impliedProbability: number;
  edge: number;
  sampleSize: number;
}

export function calculateMarketEdge(
  market: string,
  selection: string,
  modelProbability: number,
  impliedProbability: number,
  sampleSize: number
): EdgeReport {
  return {
    market,
    selection,
    modelProbability,
    impliedProbability,
    edge: modelProbability - impliedProbability,
    sampleSize
  };
}
