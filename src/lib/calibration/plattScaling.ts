import { sigmoid } from './temperatureScaling';

export interface PlattParams {
  A: number;
  B: number;
}

export function fitPlattScaling(
  logits: number[],
  labels: number[],
  lr: number = 0.01,
  epochs: number = 500
): PlattParams {
  let A = 1.0;
  let B = 0.0;
  
  const N = logits.length;
  if (N === 0) return { A, B };

  for (let epoch = 0; epoch < epochs; epoch++) {
    let gradA = 0;
    let gradB = 0;

    for (let i = 0; i < N; i++) {
      const logit = logits[i];
      const y = labels[i];
      const p = sigmoid(A * logit + B);
      
      const error = p - y;
      gradA += error * logit;
      gradB += error;
    }

    A -= lr * (gradA / N);
    B -= lr * (gradB / N);
  }

  return { A, B };
}

export function applyPlattScaling(logit: number, params: PlattParams): number {
  return sigmoid(params.A * logit + params.B);
}
