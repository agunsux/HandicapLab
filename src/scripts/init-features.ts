import { featureRegistry } from '../lib/feature-platform/registry';
import { FeatureDocGenerator } from '../lib/feature-platform/docGenerator';
import * as path from 'path';

export function initializeFeatures() {
  featureRegistry.register({
    id: 'match_xg',
    name: 'Match xG',
    category: 'xG',
    description: 'Total Expected Goals for a team in a single match.',
    formula: 'Sum of xG values for all shots taken by the team in the match',
    unit: 'xG',
    dataType: 'number',
    nullable: false,
    defaultValue: 0,
    source: ['Event Feed', 'Opta'],
    dependencies: [],
    lookbackWindow: 'N/A',
    timeTravelPolicy: 'live',
    updateFrequency: 'match',
    version: '1.0.0',
    formulaVersion: '1.0',
    dependencyVersion: '1.0',
    owner: 'Quant Team',
    qualityRules: { expectedMin: 0, expectedMax: 10, maxMissingRate: 0.05 },
    validationRules: ['non_negative'],
    minimumHistoryRequired: 0,
    expectedRange: [0, 10],
    missingValueStrategy: 'impute_zero',
    driftThreshold: 0.1,
    importance: 0,
    status: 'active',
    leakageClassification: 'Safe',
    leakageReasoning: 'Calculated from live match events, safely timestamped.',
    lineage: ['Event Feed', 'Match xG']
  });

  featureRegistry.register({
    id: 'rolling_xg_5',
    name: 'Rolling xG (5 Match)',
    category: 'Recent Form',
    description: 'Average xG over the last 5 matches.',
    formula: 'Moving average of match_xg over the previous 5 fixtures.',
    unit: 'xG',
    dataType: 'number',
    nullable: false,
    defaultValue: 1.0,
    source: ['Feature Store'],
    dependencies: ['match_xg'],
    lookbackWindow: '5 matches',
    timeTravelPolicy: 'pre_match_only',
    updateFrequency: 'match',
    version: '1.0.0',
    formulaVersion: '1.0',
    dependencyVersion: '1.0',
    owner: 'Quant Team',
    qualityRules: { expectedMin: 0, expectedMax: 5, maxMissingRate: 0.1 },
    validationRules: ['non_negative'],
    minimumHistoryRequired: 5,
    expectedRange: [0, 5],
    missingValueStrategy: 'impute_mean',
    driftThreshold: 0.1,
    importance: 0,
    status: 'active',
    leakageClassification: 'Safe',
    leakageReasoning: 'Strictly excludes the current match from the window.',
    lineage: ['Event Feed', 'Match xG', 'Rolling xG (5 Match)']
  });
  
  featureRegistry.register({
    id: 'team_attack_rating',
    name: 'Team Attack Rating',
    category: 'Team Strength',
    description: 'Derived attacking strength combining rolling xG and actual goals.',
    formula: '(rolling_xg_5 * 0.7) + (rolling_goals_5 * 0.3)',
    unit: 'Rating',
    dataType: 'number',
    nullable: false,
    defaultValue: 1.0,
    source: ['Feature Store'],
    dependencies: ['rolling_xg_5'], // Omitting rolling_goals_5 for brevity in mock
    lookbackWindow: '5 matches',
    timeTravelPolicy: 'pre_match_only',
    updateFrequency: 'match',
    version: '1.0.0',
    formulaVersion: '1.0',
    dependencyVersion: '1.0',
    owner: 'Quant Team',
    qualityRules: { expectedMin: 0, expectedMax: 5, maxMissingRate: 0.05 },
    validationRules: ['non_negative'],
    minimumHistoryRequired: 5,
    expectedRange: [0, 5],
    missingValueStrategy: 'impute_mean',
    driftThreshold: 0.1,
    importance: 0,
    status: 'active',
    leakageClassification: 'Safe',
    leakageReasoning: 'Relies purely on pre-match rolling aggregates.',
    lineage: ['Rolling xG (5 Match)', 'Team Attack Rating']
  });

  // Example of an unsafe feature (to test warnings)
  featureRegistry.register({
    id: 'closing_odds_home',
    name: 'Home Closing Odds',
    category: 'Market',
    description: 'Pinnacle closing odds for home win.',
    formula: 'Raw value at kickoff',
    unit: 'Decimal Odds',
    dataType: 'number',
    nullable: true,
    defaultValue: null,
    source: ['Odds API'],
    dependencies: [],
    lookbackWindow: 'N/A',
    timeTravelPolicy: 'live',
    updateFrequency: 'match',
    version: '1.0.0',
    formulaVersion: '1.0',
    dependencyVersion: '1.0',
    owner: 'Quant Team',
    qualityRules: { expectedMin: 1.01, expectedMax: 50, maxMissingRate: 0.01 },
    validationRules: ['greater_than_1'],
    minimumHistoryRequired: 0,
    expectedRange: [1.01, 50],
    missingValueStrategy: 'drop',
    driftThreshold: 0.2,
    importance: 0,
    status: 'active',
    leakageClassification: 'Unsafe',
    leakageReasoning: 'Using closing odds as a predictive feature introduces massive temporal leakage since they incorporate market knowledge right up to kickoff. Should only be used as a target/benchmark, never an input.',
    lineage: ['Odds API', 'Closing Odds']
  });
}

export function generateDocs() {
  initializeFeatures();
  const outputPath = path.join(process.cwd(), 'docs', 'feature_catalog.md');
  FeatureDocGenerator.generate(outputPath);
  console.log(`Generated feature catalog at ${outputPath}`);
}

if (require.main === module) {
  generateDocs();
}
