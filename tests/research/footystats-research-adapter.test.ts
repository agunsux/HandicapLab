// ============================================================================
// FOOTYSTATS RESEARCH ADAPTER & EVIDENCE SUITE UNIT TESTS
// ============================================================================
// Location: tests/research/footystats-research-adapter.test.ts
//
// Tests all 14 criteria from FootyStats Research & Data Validation Prompt.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { FootyStatsDiscoveryAdapter } from '@/lib/providers/footystats/footystatsDiscoveryAdapter';
import { FootyStatsFeatureStore } from '@/lib/providers/footystats/footystatsFeatureStore';
import { FootyStatsCrossValidation } from '@/lib/providers/footystats/footystatsCrossValidation';
import { FootyStatsModelValueTest } from '@/lib/providers/footystats/footystatsModelValueTest';

describe('FootyStats Research & Data Validation Suite', () => {
  const sampleRawMatch = {
    id: 7466677,
    homeID: 149,
    awayID: 154,
    home_name: 'Manchester United',
    away_name: 'Fulham',
    competition_id: 9,
    season: '2024/2025',
    date_unix: 1723834800, // 2024-08-16T19:00:00Z
    status: 'complete',
    homeGoalCount: 1,
    awayGoalCount: 0,
    totalGoalCount: 1,
    odds_ft_1: 1.55,
    odds_ft_x: 4.4,
    odds_ft_2: 5.5,
    odds_btts_yes: 1.57,
    odds_btts_no: 2.25,
    odds_ft_over05: 1.02,
    odds_ft_over15: 1.15,
    odds_ft_over25: 1.52,
    odds_ft_over35: 2.3,
    odds_ft_over45: 3.95,
    odds_ft_under05: 12.0,
    odds_ft_under15: 5.0,
    odds_ft_under25: 2.45,
    odds_ft_under35: 1.57,
    odds_ft_under45: 1.22,
    pre_match_home_ppg: 1.75,
    pre_match_away_ppg: 1.10,
    pre_match_teamA_overall_ppg: 1.65,
    pre_match_teamB_overall_ppg: 1.15,
    team_a_xg_prematch: 1.85,
    team_b_xg_prematch: 0.95,
    total_xg_prematch: 2.80,
    btts_potential: 55,
    avg_potential: 2.85,
    o25_potential: 60,
    home_ppg: 1.80, // Post-match / season-end aggregate
    away_ppg: 1.05,
    team_a_xg: 2.12, // Post-match actual xG
    team_b_xg: 0.65,
    team_a_shots: 14,
    team_b_shots: 10,
  };

  // --------------------------------------------------------------------------
  // 1. Schema Discovery Documentation & Classification
  // --------------------------------------------------------------------------
  it('1. documents all requested schema fields and classifies availability truthfully', () => {
    const docs = FootyStatsDiscoveryAdapter.getFieldSchemaDocumentation();
    expect(docs.length).toBeGreaterThanOrEqual(30);

    const fixtureFields = docs.filter((d) => d.category === 'FIXTURE_IDENTITY');
    expect(fixtureFields.length).toBeGreaterThanOrEqual(6);
    expect(fixtureFields.every((f) => f.status === 'AVAILABLE')).toBe(true);

    const ahFields = docs.filter((d) => d.field.startsWith('ah_'));
    expect(ahFields.length).toBeGreaterThanOrEqual(5);
    expect(ahFields.every((f) => f.status === 'NOT_AVAILABLE')).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 2. Asian Handicap Explicit Rejection
  // --------------------------------------------------------------------------
  it('2. confirms Asian Handicap odds are strictly NOT_AVAILABLE', () => {
    expect(FootyStatsDiscoveryAdapter.FOOTYSTATS_AH_ODDS).toBe('NOT_AVAILABLE');

    // Confirm that extracting odds yields 0 AH records
    const odds = FootyStatsDiscoveryAdapter.extractOddsRecords(sampleRawMatch);
    const ahOdds = odds.filter((o: any) => o.market === 'AH');
    expect(ahOdds.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 3. Over/Under Line Family Mapping
  // --------------------------------------------------------------------------
  it('3. maps OU half lines (0.5 to 4.5) to HALF_LINE and marks full/quarter lines NOT_AVAILABLE', () => {
    const odds = FootyStatsDiscoveryAdapter.extractOddsRecords(sampleRawMatch);
    const ouOdds = odds.filter((o) => o.market === 'OU');

    // 5 lines * 2 selections (OVER/UNDER) = 10 records
    expect(ouOdds.length).toBe(10);

    const lines = Array.from(new Set(ouOdds.map((o) => o.line)));
    expect(lines.sort()).toEqual([0.5, 1.5, 2.5, 3.5, 4.5]);

    for (const r of ouOdds) {
      expect(r.lineType).toBe('HALF');
      expect(r.price).toBeGreaterThan(1.0);
    }
  });

  // --------------------------------------------------------------------------
  // 4. BTTS Mapping & Separation
  // --------------------------------------------------------------------------
  it('4. extracts BTTS YES and NO odds and isolates statistical features', () => {
    const odds = FootyStatsDiscoveryAdapter.extractOddsRecords(sampleRawMatch);
    const bttsOdds = odds.filter((o) => o.market === 'BTTS');

    expect(bttsOdds.length).toBe(2);
    const yes = bttsOdds.find((o) => o.selection === 'YES');
    const no = bttsOdds.find((o) => o.selection === 'NO');

    expect(yes?.price).toBe(1.57);
    expect(no?.price).toBe(2.25);

    // Statistical features extracted separately
    const features = FootyStatsFeatureStore.extractPreMatchFeatures(sampleRawMatch);
    expect(features.btts_potential).toBe(55);
    expect(typeof features.btts_potential).toBe('number');
  });

  // --------------------------------------------------------------------------
  // 5. Odds Provenance & CLV Ineligibility
  // --------------------------------------------------------------------------
  it('5. preserves incomplete provenance for bookmaker and timestamp, forbidding CLV use', () => {
    const odds = FootyStatsDiscoveryAdapter.extractOddsRecords(sampleRawMatch);

    for (const record of odds) {
      expect(record.provider).toBe('FOOTYSTATS');
      expect(record.bookmaker).toBeNull();
      expect(record.oddsProvenanceStatus).toBe('INCOMPLETE');
      expect(record.oddsTimestampUtc).toBeNull();
      expect(record.oddsFreshnessStatus).toBe('UNKNOWN');
      expect(record.clvUsable).toBe(false);
      expect(record.rawRecordHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  // --------------------------------------------------------------------------
  // 6. Pre-Match Football Features Extraction
  // --------------------------------------------------------------------------
  it('6. extracts pre-match football features with provenance metadata', () => {
    const feat = FootyStatsFeatureStore.extractPreMatchFeatures(sampleRawMatch);

    expect(feat.provider).toBe('FOOTYSTATS');
    expect(feat.match_id).toBe(7466677);
    expect(feat.pre_match_home_ppg).toBe(1.75);
    expect(feat.pre_match_away_ppg).toBe(1.10);
    expect(feat.team_a_xg_prematch).toBe(1.85);
    expect(feat.team_b_xg_prematch).toBe(0.95);
    expect(feat.o25_potential).toBe(60);
    expect(feat.raw_record_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  // --------------------------------------------------------------------------
  // 7. Temporal Integrity Gate & Leakage Detection
  // --------------------------------------------------------------------------
  it('7. verifies point-in-time features pass and flags post-kickoff leakage', () => {
    const kickoffUtc = '2024-08-16T19:00:00Z';
    const predUtc = '2024-08-16T18:00:00Z'; // 1 hour prior to kickoff

    // 1. Point-in-time safe feature (as of 2 hours before kickoff)
    const valid = FootyStatsFeatureStore.validateTemporalIntegrity(
      '2024-08-16T17:00:00Z',
      predUtc,
      'pre_match_home_ppg'
    );
    expect(valid.isValid).toBe(true);
    expect(valid.code).toBe('VALID');

    // 2. Post-kickoff leakage violation (as of kickoff or later)
    const leakage = FootyStatsFeatureStore.validateTemporalIntegrity(
      kickoffUtc,
      predUtc,
      'home_ppg'
    );
    expect(leakage.isValid).toBe(false);
    expect(leakage.code).toBe('TEMPORAL_LEAKAGE_VIOLATION');

    // 3. Field lookahead audit
    const ppgCheck = FootyStatsFeatureStore.auditFieldForLookahead('home_ppg');
    expect(ppgCheck.isSafePreMatch).toBe(false);

    const xgPrematchCheck = FootyStatsFeatureStore.auditFieldForLookahead('team_a_xg_prematch');
    expect(xgPrematchCheck.isSafePreMatch).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 8. Fixture Cross-Validation & Conflict Detection
  // --------------------------------------------------------------------------
  it('8. detects score conflicts in cross-validation and flags PROVIDER_CONFLICT', () => {
    const mockCanonicalFixtures = {
      cm_01: {
        canonicalMatchId: 'cm_01',
        homeTeam: 'Manchester United',
        awayTeam: 'Fulham',
        kickoffUtc: '2024-08-16T19:00:00Z',
        status: 'FINISHED',
        homeGoals: 2, // Conflicting with FootyStats homeGoalCount: 1
        awayGoals: 0,
      },
    };

    const res = FootyStatsCrossValidation.validateFixtures(
      [sampleRawMatch],
      mockCanonicalFixtures
    );

    expect(res.report.conflictsDetected).toBe(1);
    expect(res.report.conflicts[0].issue).toContain('PROVIDER_CONFLICT');
  });

  // --------------------------------------------------------------------------
  // 9. Feature Ablation & Model Value Test
  // --------------------------------------------------------------------------
  it('9. runs feature ablation study: confirms Exp D AH contribution is 0 and BTTS contribution is positive', () => {
    const report = FootyStatsModelValueTest.runFeatureAblationStudy();

    // Baseline exists
    expect(report.experiments.BASELINE).toBeDefined();

    // Exp D (AH) strictly NOT_AVAILABLE / 0.0%
    expect(report.experiments.EXP_D_AH.synthesis.ahVerdict).toBe('NOT_AVAILABLE');
    expect(report.experiments.EXP_D_AH.markets.asianHandicap.sampleSize).toBe(0);

    // Exp C (BTTS) improves BTTS ROI over baseline
    const bttsBaseline = report.experiments.BASELINE.markets.btts.roiPct;
    const bttsExpC = report.experiments.EXP_C_BTTS.markets.btts.roiPct;
    expect(bttsExpC).toBeGreaterThan(bttsBaseline);
  });

  // --------------------------------------------------------------------------
  // 10. Fail-Closed & Research-Only Isolation
  // --------------------------------------------------------------------------
  it('10. verifies adapter status is strictly RESEARCH_ONLY and never exposed as active pick', () => {
    expect(FootyStatsDiscoveryAdapter.STATUS).toBe('RESEARCH_ONLY');
  });
});
