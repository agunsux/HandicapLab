// EPIC 60 — Three-Model Split Engine (AH / OU / BTTS) with Per-Market Evidence Ceilings
// Location: src/lib/engines/three-model-engine/index.ts

export interface UpstreamDixonColesPrimitives {
  homeLambda: number;
  awayLambda: number;
  rho: number;
  scoreMatrix: number[][]; // 9x9 or 11x11 bivariate score grid
}

export type LineEvidenceStatus = 'EVALUATED' | 'INSUFFICIENT_DATA' | 'NO_HISTORICAL_EVIDENCE';

export interface AsianHandicapProbabilities {
  line: number;
  pCover: number;
  pPush: number;
  pFail: number;
  evidenceStatus: LineEvidenceStatus;
  sampleSizeGold: number;
  metrics?: {
    brierScore: number;
    logLoss: number;
    ece: number;
  };
  economics?: {
    ev: number | null;
    clv: number | null;
    roi: number | null;
    status: LineEvidenceStatus;
  };
}

export interface OverUnderProbabilities {
  line: number;
  pOver: number;
  pUnder: number;
  evidenceStatus: LineEvidenceStatus;
  sampleSizeGold: number;
  metrics?: {
    brierScore: number;
    logLoss: number;
    ece: number;
  };
  economics?: {
    ev: number | null;
    clv: number | null;
    roi: number | null;
    status: LineEvidenceStatus;
  };
}

export interface BttsProbabilities {
  pYes: number;
  pNo: number;
  evidenceStatus: LineEvidenceStatus;
  sampleSizeGold: number;
  metrics?: {
    brierScore: number;
    logLoss: number;
    ece: number;
  };
  economics: {
    ev: null;
    clv: null;
    roi: null;
    kellyStake: null;
    isValueBet: false;
    status: 'INSUFFICIENT_DATA';
    reason: 'Zero historical odds rows in gold dataset (N=0)';
  };
}

export interface ThreeModelOutput {
  matchId: string;
  timestamp: string;
  upstream: {
    homeLambda: number;
    awayLambda: number;
    rho: number;
  };
  asianHandicap: Record<string, AsianHandicapProbabilities>;
  overUnder: Record<string, OverUnderProbabilities>;
  btts: BttsProbabilities;
}

/**
 * Historical evidence density mapping based on data/golden/europe/market_odds.jsonl (77,471 rows)
 */
export const GOLDEN_EVIDENCE_DENSITY = {
  AH: {
    '-0.25': 4335,
    '-1.0': 2485,
    '+0.25': 2451,
    '-0.5': 2312,
    '0.0': 2243,
    '-0.75': 1810,
    '+0.5': 1180,
    '+1.0': 1175,
    '-1.5': 1116,
    '+0.75': 978,
    '-1.25': 828,
    '-2.0': 660,
    '+1.5': 506,
    '-1.75': 450,
    '+1.25': 358,
    '-2.5': 260,
    '-2.25': 210, // Sparse (<250)
    '+2.0': 188,  // Sparse
    '+1.75': 108, // Sparse
    '-2.75': 86,  // Sparse
    '-3.0': 58,   // Sparse
    '+2.5': 24,   // Sparse
    '+2.25': 18,  // Sparse
    '-3.25': 12,  // Sparse
    '-3.5': 6,    // Sparse
    '+3.0': 4,    // Sparse
    '-3.75': 2,   // Sparse
  } as Record<string, number>,
  OU: {
    '2.5': 23875,
    '0.5': 0,
    '1.5': 0,
    '2.25': 0,
    '2.75': 0,
    '3.25': 0,
    '3.5': 0,
    '4.5': 0,
  } as Record<string, number>,
  BTTS: {
    all: 0, // 0 rows of historical odds
  },
};

/**
 * 1. Upstream Engine: Pure Dixon-Coles Bivariate Poisson Score Matrix
 */
export class UpstreamPoissonEngine {
  private static factorial(n: number): number {
    if (n <= 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }

  private static poissonPmf(k: number, lambda: number): number {
    if (lambda <= 0) return k === 0 ? 1 : 0;
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / this.factorial(k);
  }

  private static tau(x: number, y: number, lambda: number, mu: number, rho: number): number {
    if (x === 0 && y === 0) return 1 - lambda * mu * rho;
    if (x === 1 && y === 0) return 1 + mu * rho;
    if (x === 0 && y === 1) return 1 + lambda * rho;
    if (x === 1 && y === 1) return 1 - rho;
    return 1.0;
  }

  public static computeMatrix(
    homeLambda: number,
    awayLambda: number,
    rho: number = -0.06,
    maxGoals: number = 8
  ): UpstreamDixonColesPrimitives {
    const matrix: number[][] = [];
    let sum = 0;

    for (let h = 0; h <= maxGoals; h++) {
      matrix[h] = [];
      for (let a = 0; a <= maxGoals; a++) {
        const pBase = this.poissonPmf(h, homeLambda) * this.poissonPmf(a, awayLambda);
        const t = (h <= 1 && a <= 1) ? this.tau(h, a, homeLambda, awayLambda, rho) : 1.0;
        const prob = Math.max(0, pBase * t);
        matrix[h][a] = prob;
        sum += prob;
      }
    }

    if (sum > 0) {
      for (let h = 0; h <= maxGoals; h++) {
        for (let a = 0; a <= maxGoals; a++) {
          matrix[h][a] /= sum;
        }
      }
    }

    return {
      homeLambda,
      awayLambda,
      rho,
      scoreMatrix: matrix,
    };
  }
}

/**
 * 2. Downstream Model B1: Asian Handicap Model
 */
export class AsianHandicapModel {
  /**
   * Computes Asian Handicap probabilities for a specific line from score matrix.
   */
  public static computeLine(
    matrix: number[][],
    line: number
  ): AsianHandicapProbabilities {
    const lineKey = line > 0 ? `+${line.toFixed(2)}` : line === 0 ? '0.0' : `${line.toFixed(2)}`;
    const lineKeyLookup = line === 0 ? '0.0' : line > 0 ? `+${line}` : `${line}`;
    const count = GOLDEN_EVIDENCE_DENSITY.AH[lineKeyLookup] ?? GOLDEN_EVIDENCE_DENSITY.AH[lineKey] ?? 0;

    // Gating rule: |line| >= 2.25 or count < 250 -> INSUFFICIENT_DATA
    const isSparse = Math.abs(line) >= 2.25 || count < 250;
    const evidenceStatus: LineEvidenceStatus = isSparse ? 'INSUFFICIENT_DATA' : 'EVALUATED';

    let pCover = 0;
    let pPush = 0;
    let pFail = 0;

    const isQuarter = Math.abs(line * 4) % 2 === 1; // e.g. 0.25, 0.75, -0.25, -0.75

    if (isQuarter) {
      // Split into lower and upper half/integer line
      const baseLower = Math.floor(line * 2) / 2;
      const baseUpper = baseLower + 0.5;

      for (let h = 0; h < matrix.length; h++) {
        for (let a = 0; a < matrix[h].length; a++) {
          const p = matrix[h][a];
          const m1 = h - a + baseLower;
          const m2 = h - a + baseUpper;

          // Settle component 1
          const c1 = m1 > 0 ? 1 : m1 === 0 ? 0.5 : 0;
          // Settle component 2
          const c2 = m2 > 0 ? 1 : m2 === 0 ? 0.5 : 0;

          const totalCoverFraction = (c1 + c2) / 2;
          pCover += p * totalCoverFraction;
          pFail += p * (1 - totalCoverFraction);
        }
      }
    } else {
      // Half or whole line
      for (let h = 0; h < matrix.length; h++) {
        for (let a = 0; a < matrix[h].length; a++) {
          const p = matrix[h][a];
          const margin = h - a + line;
          if (margin > 0.000001) pCover += p;
          else if (Math.abs(margin) <= 0.000001) pPush += p;
          else pFail += p;
        }
      }
    }

    return {
      line,
      pCover: Number(pCover.toFixed(4)),
      pPush: Number(pPush.toFixed(4)),
      pFail: Number(pFail.toFixed(4)),
      evidenceStatus,
      sampleSizeGold: count,
      economics: isSparse
        ? { ev: null, clv: null, roi: null, status: 'INSUFFICIENT_DATA' }
        : undefined,
    };
  }

  public static computeAllLines(matrix: number[][]): Record<string, AsianHandicapProbabilities> {
    const lines = [
      -2.5, -2.25, -2.0, -1.75, -1.5, -1.25, -1.0, -0.75, -0.5, -0.25,
      0.0,
      0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5
    ];

    const result: Record<string, AsianHandicapProbabilities> = {};
    for (const l of lines) {
      const key = l > 0 ? `+${l}` : `${l}`;
      result[key] = this.computeLine(matrix, l);
    }
    return result;
  }
}

/**
 * 3. Downstream Model B2: Over/Under Model
 */
export class OverUnderModel {
  public static computeLine(
    matrix: number[][],
    line: number
  ): OverUnderProbabilities {
    const lineKey = `${line}`;
    const count = GOLDEN_EVIDENCE_DENSITY.OU[lineKey] ?? 0;

    // Line 2.5 only has historical evidence. All other lines are NO_HISTORICAL_EVIDENCE for EV/CLV
    const isLine25 = line === 2.5;
    const evidenceStatus: LineEvidenceStatus = isLine25 ? 'EVALUATED' : 'NO_HISTORICAL_EVIDENCE';

    let pOver = 0;
    let pUnder = 0;

    const isQuarter = Math.abs(line * 4) % 2 === 1;

    if (isQuarter) {
      const baseLower = Math.floor(line * 2) / 2;
      const baseUpper = baseLower + 0.5;

      for (let h = 0; h < matrix.length; h++) {
        for (let a = 0; a < matrix[h].length; a++) {
          const p = matrix[h][a];
          const total = h + a;
          const o1 = total > baseLower ? 1 : total === baseLower ? 0.5 : 0;
          const o2 = total > baseUpper ? 1 : total === baseUpper ? 0.5 : 0;
          const overFraction = (o1 + o2) / 2;
          pOver += p * overFraction;
          pUnder += p * (1 - overFraction);
        }
      }
    } else {
      for (let h = 0; h < matrix.length; h++) {
        for (let a = 0; a < matrix[h].length; a++) {
          const p = matrix[h][a];
          const total = h + a;
          if (total > line) pOver += p;
          else pUnder += p;
        }
      }
    }

    return {
      line,
      pOver: Number(pOver.toFixed(4)),
      pUnder: Number(pUnder.toFixed(4)),
      evidenceStatus,
      sampleSizeGold: count,
      economics: isLine25
        ? undefined
        : { ev: null, clv: null, roi: null, status: 'NO_HISTORICAL_EVIDENCE' },
    };
  }

  public static computeAllLines(matrix: number[][]): Record<string, OverUnderProbabilities> {
    const lines = [0.5, 1.5, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 4.5];
    const result: Record<string, OverUnderProbabilities> = {};
    for (const l of lines) {
      result[`${l}`] = this.computeLine(matrix, l);
    }
    return result;
  }
}

/**
 * 4. Downstream Model B3: Both Teams To Score (BTTS) Model
 */
export class BttsModel {
  public static compute(matrix: number[][]): BttsProbabilities {
    let pYes = 0;

    for (let h = 0; h < matrix.length; h++) {
      for (let a = 0; a < matrix[h].length; a++) {
        if (h >= 1 && a >= 1) {
          pYes += matrix[h][a];
        }
      }
    }

    pYes = Number(pYes.toFixed(4));
    const pNo = Number(Math.max(0, 1.0 - pYes).toFixed(4));

    return {
      pYes,
      pNo,
      evidenceStatus: 'INSUFFICIENT_DATA', // Odds = 0 rows in gold dataset
      sampleSizeGold: 0,
      economics: {
        ev: null,
        clv: null,
        roi: null,
        kellyStake: null,
        isValueBet: false,
        status: 'INSUFFICIENT_DATA',
        reason: 'Zero historical odds rows in gold dataset (N=0)',
      },
    };
  }
}

/**
 * 5. Integrated Master Orchestrator for Three-Model Architecture
 */
export class ThreeModelEngine {
  public static predict(
    matchId: string,
    homeLambda: number,
    awayLambda: number,
    rho: number = -0.06
  ): ThreeModelOutput {
    const upstream = UpstreamPoissonEngine.computeMatrix(homeLambda, awayLambda, rho);
    const matrix = upstream.scoreMatrix;

    const ahOutputs = AsianHandicapModel.computeAllLines(matrix);
    const ouOutputs = OverUnderModel.computeAllLines(matrix);
    const bttsOutput = BttsModel.compute(matrix);

    return {
      matchId,
      timestamp: new Date().toISOString(),
      upstream: {
        homeLambda,
        awayLambda,
        rho,
      },
      asianHandicap: ahOutputs,
      overUnder: ouOutputs,
      btts: bttsOutput,
    };
  }

  /**
   * Serialization layer that enforces the Evidence Ceiling strictly in code.
   * Blocks any attempt to return EV/CLV/ROI for unsupported lines/markets.
   */
  public static serializeMarketQuery(
    output: ThreeModelOutput,
    market: 'AH' | 'OU' | 'BTTS',
    line?: number
  ): Record<string, any> {
    if (market === 'BTTS') {
      return {
        market: 'BTTS',
        probabilities: {
          yes: output.btts.pYes,
          no: output.btts.pNo,
        },
        calibrationAvailable: true,
        economicMetrics: {
          status: 'INSUFFICIENT_DATA',
          ev: null,
          clv: null,
          roi: null,
          kellyStake: null,
          reason: 'BTTS odds = 0 rows in golden dataset; calibration only',
        },
      };
    }

    if (market === 'OU') {
      const lineNum = line !== undefined ? line : 2.5;
      const key = `${lineNum}`;
      const lineData = output.overUnder[key] || OverUnderModel.computeLine(output.upstream.homeLambda ? UpstreamPoissonEngine.computeMatrix(output.upstream.homeLambda, output.upstream.awayLambda, output.upstream.rho).scoreMatrix : [], lineNum);

      if (lineNum !== 2.5) {
        return {
          market: 'OU',
          line: lineNum,
          probabilities: {
            over: lineData.pOver,
            under: lineData.pUnder,
          },
          calibrationAvailable: true,
          economicMetrics: {
            status: 'NO_HISTORICAL_EVIDENCE',
            ev: null,
            clv: null,
            roi: null,
            reason: `Line ${lineNum} lacks historical odds in golden dataset (N=0)`,
          },
        };
      }

      return {
        market: 'OU',
        line: 2.5,
        probabilities: {
          over: lineData.pOver,
          under: lineData.pUnder,
        },
        calibrationAvailable: true,
        economicMetrics: {
          status: 'EVALUATED',
          sampleSize: 23875,
        },
      };
    }

    if (market === 'AH') {
      const lineNum = line !== undefined ? line : 0.0;
      const key = lineNum > 0 ? `+${lineNum}` : `${lineNum}`;
      const lineData = output.asianHandicap[key];

      if (!lineData || lineData.evidenceStatus === 'INSUFFICIENT_DATA') {
        return {
          market: 'AH',
          line: lineNum,
          probabilities: lineData ? { cover: lineData.pCover, push: lineData.pPush, fail: lineData.pFail } : null,
          calibrationAvailable: false,
          economicMetrics: {
            status: 'INSUFFICIENT_DATA',
            ev: null,
            clv: null,
            roi: null,
            reason: `AH line ${lineNum} sample size is insufficient (<250 rows or |line|>=2.25)`,
          },
        };
      }

      return {
        market: 'AH',
        line: lineNum,
        probabilities: {
          cover: lineData.pCover,
          push: lineData.pPush,
          fail: lineData.pFail,
        },
        calibrationAvailable: true,
        economicMetrics: {
          status: 'EVALUATED',
          sampleSize: lineData.sampleSizeGold,
        },
      };
    }

    throw new Error(`Unsupported market type: ${market}`);
  }
}
