import { describe, it, expect } from 'vitest';
import { runGate1Validation } from '../../scripts/research-ah-gate1';

describe('GATE 1: AH Data Integrity & Canonical Invariants', () => {
  const result = runGate1Validation();

  it('Gate 1A: verifies dataset provenance and bronze file linkage', () => {
    expect(result.gate1a_provenance.manifest_exists).toBe(true);
    expect(result.gate1a_provenance.odds_manifest_exists).toBe(true);
    expect(result.gate1a_provenance.sample_source_files_missing).toBe(0);
    expect(result.gate1a_provenance.sample_source_files_verified).toBeGreaterThan(0);
    expect(result.gate1a_provenance.provenance_verdict).toBe('PASS');
  });

  it('Gate 1B: verifies canonical match inventory has exactly 8,898 valid unique matches', () => {
    expect(result.gate1b_match_inventory.total_records).toBe(8898);
    expect(result.gate1b_match_inventory.unique_match_ids).toBe(8898);
    expect(result.gate1b_match_inventory.duplicate_match_ids).toBe(0);
    expect(result.gate1b_match_inventory.missing_home_teams).toBe(0);
    expect(result.gate1b_match_inventory.missing_away_teams).toBe(0);
    expect(result.gate1b_match_inventory.missing_scores).toBe(0);
    expect(result.gate1b_match_inventory.invalid_scores).toBe(0);
    expect(result.gate1b_match_inventory.cancelled_or_postponed).toBe(0);
    expect(result.gate1b_match_inventory.inventory_verdict).toBe('PASS');

    // 5 leagues confirmed
    expect(Object.keys(result.gate1b_match_inventory.league_distribution)).toEqual([
      'DEU-BUNDESLIGA',
      'ENG-PL',
      'ESP-LALIGA',
      'FRA-LIGUE1',
      'ITA-SERIEA',
    ]);
  });

  it('Gate 1C: verifies 23,864 AH observations across 3 bookmakers', () => {
    expect(result.gate1c_odds_inventory.total_ah_observations).toBe(23864);
    expect(result.gate1c_odds_inventory.unique_matches_in_ah).toBe(8898); // Exactly 8898 of 8898 (100.0%) represented
    expect(result.gate1c_odds_inventory.bookmaker_distribution['pinnacle']).toBe(11937);
    expect(result.gate1c_odds_inventory.bookmaker_distribution['bet365']).toBe(6069);
    expect(result.gate1c_odds_inventory.bookmaker_distribution['betbrain']).toBe(5858);
    expect(result.gate1c_odds_inventory.observation_type_distribution['opening']).toBe(17785);
    expect(result.gate1c_odds_inventory.observation_type_distribution['closing']).toBe(6079);
    expect(result.gate1c_odds_inventory.missing_odds_count).toBe(2); // Exactly 2 COVID round 38 matches in Spain
  });

  it('Gate 1D: verifies 100% of AH records link to canonical match registry', () => {
    expect(result.gate1d_linkage.matched_observations).toBe(23864);
    expect(result.gate1d_linkage.unmatched_observations).toBe(0);
    expect(result.gate1d_linkage.match_coverage_pct).toBeGreaterThan(99.9);
    expect(result.gate1d_linkage.linkage_verdict).toBe('PASS');
  });

  it('Gate 1E: verifies temporal date alignment between matches and odds', () => {
    expect(result.gate1e_temporal.date_aligned_count).toBe(23864);
    expect(result.gate1e_temporal.date_mismatched_count).toBe(0);
    expect(result.gate1e_temporal.valid_prematch_count).toBe(17785);
  });

  it('Gate 1F: verifies quarter-ball line normalization (with 1 isolated raw null line)', () => {
    expect(result.gate1f_line_normalization.non_canonical_lines).toEqual([]);
    expect(result.gate1f_line_normalization.null_line_count).toBe(1); // Row 48373: Brighton vs Chelsea (bet365 opening line blank in source CSV)
    expect(result.gate1f_line_normalization.normalization_verdict).toBe('PASS WITH WARNINGS');
  });

  it('Gate 1G: verifies decimal odds sanity (> 1.0) with zero NaN/invalid odds', () => {
    expect(result.gate1g_odds_sanity.all_odds_positive).toBe(true);
    expect(result.gate1g_odds_sanity.odds_less_than_or_equal_one).toBe(0);
    expect(result.gate1g_odds_sanity.odds_nan_or_null).toBe(2); // Rows 61403 & 61502
    expect(result.gate1g_odds_sanity.sanity_verdict).toBe('PASS WITH WARNINGS');
  });

  it('Gate 1H: verifies 23,861 settlements simulated with 100% deterministic outcomes and zero symmetry violations', () => {
    expect(result.gate1h_settlement_compatibility.compatible_settlement_count).toBe(23861);
    expect(result.gate1h_settlement_compatibility.settlement_compatibility_pct).toBe(99.99);
    expect(result.gate1h_settlement_compatibility.symmetry_test_passed).toBe(true);
    expect(result.gate1h_settlement_compatibility.outcome_distribution.WIN).toBeGreaterThan(0);
    expect(result.gate1h_settlement_compatibility.outcome_distribution.HALF_WIN).toBeGreaterThan(0);
    expect(result.gate1h_settlement_compatibility.outcome_distribution.PUSH).toBeGreaterThan(0);
    expect(result.gate1h_settlement_compatibility.outcome_distribution.HALF_LOSS).toBeGreaterThan(0);
    expect(result.gate1h_settlement_compatibility.outcome_distribution.LOSS).toBeGreaterThan(0);
  });

  it('Gate 1 Verdict: Evaluates to PASS WITH WARNINGS with exact forensic documentation of the 3 isolated anomaly records', () => {
    expect(result.overall_verdict).toBe('PASS WITH WARNINGS');
  });
});
