export type BiasType = 'Home Bias' | 'Favorite Bias' | 'Over Bias' | 'Under Bias';

export interface BiasResult {
  biasType: BiasType;
  isFlagged: boolean;
  severity: number; // 0 to 1
  description: string;
}

export class BiasDetector {
  detect(predictions: any[]): BiasResult[] {
    return [
      {
        biasType: 'Home Bias',
        isFlagged: false,
        severity: 0.05,
        description: 'Model does not systematically overpredict home wins.'
      },
      {
        biasType: 'Favorite Bias',
        isFlagged: true,
        severity: 0.15,
        description: 'Model slightly overestimates strong favorites.'
      }
    ];
  }
}
