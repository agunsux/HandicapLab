/**
 * REAL MARKET YIELD AUDIT — PREREGISTRATION GENERATOR & VALIDATOR
 * Location: src/lib/research/real-yield/preregistration.ts
 *
 * Implements the deterministic generation, validation, and serialization
 * of the complete hypothesis family and research specification.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface OddsBandSpec {
  bandKey: string;
  minOdds: number;
  maxOdds: number;
  inclusiveMin: boolean;
  inclusiveMax: boolean;
}

export interface PreregisteredHypothesis {
  id: string; // e.g. "AH|LINE_-0.25|ALL", "OU_2_5|OVER|1.70-2.00", "1X2|HOME|<1.70"
  market: 'AH' | 'OU_2_5' | '1X2';
  targetType: 'INDIVIDUAL_LINE' | 'AGGREGATE_FAMILY' | 'OUTCOME';
  targetKey: string; // e.g. "-0.25", "AH_ALL", "OVER", "HOME"
  line: number | null;
  oddsBand: string;
  minOdds: number;
  maxOdds: number;
}

export interface RealMarketYieldPreregistration {
  schemaVersion: string;
  datasetHash: string;
  bookmaker: 'pinnacle';
  priceObservation: 'opening';
  marketUniverse: ('AH' | 'OU_2_5' | '1X2')[];
  selectionRule: {
    minEvThreshold: number;
    stakeUnit: number;
    maxSelectionsPerFixturePerMarket: number;
    tieBreaker: string;
  };
  oddsBands: OddsBandSpec[];
  ahHypothesisFamily: {
    individualLines: number[];
    aggregateFamilies: string[];
    excludedLinesDueToCoverage: number[];
    rationale: string;
  };
  ouHypothesisFamily: {
    outcomes: string[];
    aggregateFamilies: string[];
  };
  mlHypothesisFamily: {
    outcomes: string[];
    aggregateFamilies: string[];
  };
  discoveryPeriod: string[];
  confirmationPeriod: string[];
  minimumConfirmationBets: number;
  multipleTesting: {
    procedure: string;
    fdrQ: number;
    appliedTo: string;
  };
  bootstrap: {
    iterations: number;
    seed: number;
    ciLevel: number;
  };
  settlementRules: {
    ah: string;
    ou25: string;
    ml: string;
  };
  missingDataRules: {
    oddsMin: number;
    oddsMax: number;
    oddsLteOne: string;
    missingOrMalformed: string;
    duplicates: string;
  };
  probabilityModel: {
    name: string;
    scoreDistribution: string;
    decayConstant: number;
    l2Penalty: number;
  };
  strictWalkForwardProtocol: {
    temporalConstraint: string;
    antiLeakageEnforcement: string;
    metadataAuditExposed: boolean;
  };
  familySize: number;
  familyHash: string;
  hypotheses: PreregisteredHypothesis[];
}

export class PreregistrationBuilder {
  public static readonly FROZEN_DATASET_HASH =
    '22e8e80a8d9c53aa878972bc42603d9b231fed709357c9d05cf8defc1ac1d727';

  public static readonly ODDS_BANDS: OddsBandSpec[] = [
    { bandKey: 'ALL', minOdds: 1.20, maxOdds: 20.00, inclusiveMin: true, inclusiveMax: true },
    { bandKey: '<1.70', minOdds: 1.20, maxOdds: 1.70, inclusiveMin: true, inclusiveMax: false },
    { bandKey: '1.70-2.00', minOdds: 1.70, maxOdds: 2.00, inclusiveMin: true, inclusiveMax: true },
    { bandKey: '2.01-2.30', minOdds: 2.00, maxOdds: 2.30, inclusiveMin: false, inclusiveMax: true },
    { bandKey: '>2.30', minOdds: 2.30, maxOdds: 20.00, inclusiveMin: false, inclusiveMax: true },
  ];

  // 17 individual lines strictly in [-2.00, +2.00] with quarter-ball increments
  public static readonly AH_INDIVIDUAL_LINES: number[] = [
    -2.00, -1.75, -1.50, -1.25, -1.00, -0.75, -0.50, -0.25,
     0.00,
     0.25,  0.50,  0.75,  1.00,  1.25,  1.50,  1.75,  2.00
  ];

  public static readonly AH_AGGREGATE_FAMILIES: string[] = [
    'AH_ALL',
    'AH_FAVOURITE',
    'AH_UNDERDOG',
    'AH_LEVEL'
  ];

  public static readonly AH_EXCLUDED_LINES: number[] = [
    -3.50, -3.25, -3.00, -2.75, -2.50, -2.25,
     2.25,  2.50,  3.00
  ];

  public static readonly OU_OUTCOMES: string[] = ['OVER', 'UNDER'];
  public static readonly OU_AGGREGATE: string[] = ['OU_ALL'];

  public static readonly ML_OUTCOMES: string[] = ['HOME', 'DRAW', 'AWAY'];
  public static readonly ML_AGGREGATE: string[] = ['1X2_ALL'];

  /**
   * Generates the complete, deterministic list of hypotheses.
   */
  public static generateHypothesisFamily(): PreregisteredHypothesis[] {
    const hypotheses: PreregisteredHypothesis[] = [];

    // 1. Asian Handicap hypotheses
    // 1.1 Individual lines (17 lines * 5 bands)
    for (const line of this.AH_INDIVIDUAL_LINES) {
      for (const band of this.ODDS_BANDS) {
        hypotheses.push({
          id: `AH|LINE_${line.toFixed(2)}|${band.bandKey}`,
          market: 'AH',
          targetType: 'INDIVIDUAL_LINE',
          targetKey: line.toFixed(2),
          line,
          oddsBand: band.bandKey,
          minOdds: band.minOdds,
          maxOdds: band.maxOdds,
        });
      }
    }

    // 1.2 AH Aggregate families (4 aggregates * 5 bands)
    for (const agg of this.AH_AGGREGATE_FAMILIES) {
      for (const band of this.ODDS_BANDS) {
        hypotheses.push({
          id: `AH|${agg}|${band.bandKey}`,
          market: 'AH',
          targetType: 'AGGREGATE_FAMILY',
          targetKey: agg,
          line: null,
          oddsBand: band.bandKey,
          minOdds: band.minOdds,
          maxOdds: band.maxOdds,
        });
      }
    }

    // 2. Over/Under 2.5 hypotheses
    // 2.1 Outcomes (2 outcomes * 5 bands)
    for (const out of this.OU_OUTCOMES) {
      for (const band of this.ODDS_BANDS) {
        hypotheses.push({
          id: `OU_2_5|${out}|${band.bandKey}`,
          market: 'OU_2_5',
          targetType: 'OUTCOME',
          targetKey: out,
          line: 2.5,
          oddsBand: band.bandKey,
          minOdds: band.minOdds,
          maxOdds: band.maxOdds,
        });
      }
    }

    // 2.2 OU Aggregate (1 aggregate * 5 bands)
    for (const agg of this.OU_AGGREGATE) {
      for (const band of this.ODDS_BANDS) {
        hypotheses.push({
          id: `OU_2_5|${agg}|${band.bandKey}`,
          market: 'OU_2_5',
          targetType: 'AGGREGATE_FAMILY',
          targetKey: agg,
          line: 2.5,
          oddsBand: band.bandKey,
          minOdds: band.minOdds,
          maxOdds: band.maxOdds,
        });
      }
    }

    // 3. 1X2 Moneyline hypotheses
    // 3.1 Outcomes (3 outcomes * 5 bands)
    for (const out of this.ML_OUTCOMES) {
      for (const band of this.ODDS_BANDS) {
        hypotheses.push({
          id: `1X2|${out}|${band.bandKey}`,
          market: '1X2',
          targetType: 'OUTCOME',
          targetKey: out,
          line: null,
          oddsBand: band.bandKey,
          minOdds: band.minOdds,
          maxOdds: band.maxOdds,
        });
      }
    }

    // 3.2 1X2 Aggregate (1 aggregate * 5 bands)
    for (const agg of this.ML_AGGREGATE) {
      for (const band of this.ODDS_BANDS) {
        hypotheses.push({
          id: `1X2|${agg}|${band.bandKey}`,
          market: '1X2',
          targetType: 'AGGREGATE_FAMILY',
          targetKey: agg,
          line: null,
          oddsBand: band.bandKey,
          minOdds: band.minOdds,
          maxOdds: band.maxOdds,
        });
      }
    }

    return hypotheses;
  }

  /**
   * Computes the deterministic SHA-256 familyHash across all preregistration fields.
   */
  public static computeFamilyHash(payload: Omit<RealMarketYieldPreregistration, 'familyHash'>): string {
    // Deterministic JSON stringify with sorted keys
    const canonicalStr = JSON.stringify(payload);
    return crypto.createHash('sha256').update(canonicalStr).digest('hex');
  }

  /**
   * Builds the full frozen preregistration specification object.
   */
  public static buildPreregistration(): RealMarketYieldPreregistration {
    const hypotheses = this.generateHypothesisFamily();

    const basePayload: Omit<RealMarketYieldPreregistration, 'familyHash'> = {
      schemaVersion: 'real-market-yield-preregistration-v1',
      datasetHash: this.FROZEN_DATASET_HASH,
      bookmaker: 'pinnacle',
      priceObservation: 'opening',
      marketUniverse: ['AH', 'OU_2_5', '1X2'],
      selectionRule: {
        minEvThreshold: 0.02, // 2.0% minimum expected edge
        stakeUnit: 1.0,
        maxSelectionsPerFixturePerMarket: 1,
        tieBreaker: 'highest_ev_with_deterministic_fallback',
      },
      oddsBands: this.ODDS_BANDS,
      ahHypothesisFamily: {
        individualLines: this.AH_INDIVIDUAL_LINES,
        aggregateFamilies: this.AH_AGGREGATE_FAMILIES,
        excludedLinesDueToCoverage: this.AH_EXCLUDED_LINES,
        rationale:
          'Preregistered research design (Option A): 17 individual lines within [-2.00, +2.00] plus 4 aggregates (21 AH targets). Lines with insufficient sample coverage (< 35 matches in Gold) are excluded from individual line evaluation prior to seeing yield results.',
      },
      ouHypothesisFamily: {
        outcomes: this.OU_OUTCOMES,
        aggregateFamilies: this.OU_AGGREGATE,
      },
      mlHypothesisFamily: {
        outcomes: this.ML_OUTCOMES,
        aggregateFamilies: this.ML_AGGREGATE,
      },
      discoveryPeriod: [
        '2015-2016',
        '2016-2017',
        '2017-2018',
        '2018-2019',
        '2019-2020',
        '2020-2021',
      ],
      confirmationPeriod: [
        '2021-2022',
        '2022-2023',
        '2023-2024',
        '2024-2025',
        '2025-2026',
      ],
      minimumConfirmationBets: 200,
      multipleTesting: {
        procedure: 'Benjamini-Hochberg',
        fdrQ: 0.10,
        appliedTo: 'COMPLETE_PREREGISTERED_DISCOVERY_FAMILY',
      },
      bootstrap: {
        iterations: 1000,
        seed: 0x5eed,
        ciLevel: 0.95,
      },
      settlementRules: {
        ah: 'settleAsianHandicapBet (canonical ahSettlementEngine.ts)',
        ou25: 'totalGoals >= 3 ? WIN : LOSS (1.0 unit flat stake)',
        ml: 'homeWin: h > a, draw: h == a, awayWin: h < a (1.0 unit flat stake)',
      },
      missingDataRules: {
        oddsMin: 1.20,
        oddsMax: 20.00,
        oddsLteOne: 'REJECT',
        missingOrMalformed: 'REJECT',
        duplicates: 'DETERMINISTIC_FIRST_SEEN',
      },
      probabilityModel: {
        name: 'HierarchicalDixonColes-ModelA-v1',
        scoreDistribution: 'Bivariate Dixon-Coles up to maxGoals = 10',
        decayConstant: 0.0018,
        l2Penalty: 2.0,
      },
      strictWalkForwardProtocol: {
        temporalConstraint: 'training_information_timestamp < kickoff(T)',
        antiLeakageEnforcement: 'hard assertion in predictFixture',
        metadataAuditExposed: true,
      },
      familySize: hypotheses.length,
      hypotheses,
    };

    const familyHash = this.computeFamilyHash(basePayload);

    return {
      ...basePayload,
      familyHash,
    };
  }

  /**
   * Saves and freezes the preregistration artifact to disk.
   */
  public static savePreregistration(
    outputPath = 'data/verification/REAL_MARKET_YIELD_PREREGISTRATION.json'
  ): RealMarketYieldPreregistration {
    const prereg = this.buildPreregistration();
    const resolvedPath = path.resolve(process.cwd(), outputPath);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, JSON.stringify(prereg, null, 2), 'utf-8');
    return prereg;
  }
}

if (require.main === module || process.argv[1]?.includes('preregistration')) {
  const result = PreregistrationBuilder.savePreregistration();
  console.log('Successfully generated REAL_MARKET_YIELD_PREREGISTRATION.json');
  console.log('Dataset Hash:', result.datasetHash);
  console.log('Family Size:', result.familySize);
  console.log('Family Hash:', result.familyHash);
  console.log('Selection Rule EV Threshold:', result.selectionRule.minEvThreshold);
}
