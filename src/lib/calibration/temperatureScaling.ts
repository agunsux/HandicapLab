export function gridSearchTemperature(
  logits: number[],
  labels: number[],
  tempRange: [number, number] = [0.1, 10.0],
  steps: number = 50
): number {
  let bestTemp = 1.0;
  let bestLoss = Infinity;
  
  const [min, max] = tempRange;
  const stepSize = (max - min) / steps;
  
  for (let t = min; t <= max; t += stepSize) {
    const calibrated = logits.map(logit => sigmoid(logit / t));
    const loss = binaryCrossEntropy(calibrated, labels);
    
    if (loss < bestLoss) {
      bestLoss = loss;
      bestTemp = t;
    }
  }
  
  return bestTemp;
}

export function applyTemperature(
  rawProbability: number,
  temperature: number
): number {
  const p = Math.max(0.001, Math.min(0.999, rawProbability));
  const logit = Math.log(p / (1 - p));
  return sigmoid(logit / temperature);
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function binaryCrossEntropy(predictions: number[], labels: number[]): number {
  let loss = 0;
  for (let i = 0; i < predictions.length; i++) {
    const p = Math.max(0.001, Math.min(0.999, predictions[i]));
    loss -= labels[i] * Math.log(p) + (1 - labels[i]) * Math.log(1 - p);
  }
  return loss / predictions.length;
}
