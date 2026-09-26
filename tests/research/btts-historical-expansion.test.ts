import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  BttsBacktestEngine,
  HistoricalMatchRecord,
} from '@/lib/research/btts';
import { BttsHistoryService } from '@/lib/services/bttsHistoryService';

describe('BTTS Historical Odds Expansion v2 — Invariants & Backtest Certification', () => {
  const expandedFile = path.resolve('data/historical/btts_historical_odds_expanded.jsonl');
  const summaryFile = path.resolve('data/historical/btts_expansion_summary.json');
  const canonicalFile = path.resolve('data/golden/europe/canonical_matches.jsonl');

  it('INVARIANT 1: Expanded dataset exists and contains >= 100 verified canonical fixtures', () => {
    expect(fs.existsSync(expandedFile)).toBe(true);

    const lines = fs.readFileSync(expandedFile, 'utf-8').trim().split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(100);
    expect(lines.length).toBe(105);
  });

  it('INVARIANT 2: 100% canonical match linkage, zero duplicate matches, and ground truth results attached', () => {
    const lines = fs.readFileSync(expandedFile, 'utf-8').trim().split('\n').filter(Boolean);
    const records = lines.map((l) => JSON.parse(l));

    const canonicalIds = new Set<string>();
    for (const r of records) {
      expect(r.canonical_match_id).toBeDefined();
      expect(r.canonical_match_id.length).toBeGreaterThan(0);
      expect(canonicalIds.has(r.canonical_match_id)).toBe(false); // Zero duplicates
      canonicalIds.add(r.canonical_match_id);

      // Result linkage verification
      expect(r.result_linked).toBe(true);
      expect(r.result_btts).toMatch(/^(YES|NO)$/);
      expect(typeof r.home_goals).toBe('number');
      expect(typeof r.away_goals).toBe('number');
      expect(r.data_quality).toBe('VERIFIED');
      expect(r.provenance_status).toBe('PREMATCH_VERIFIED');
    }

    expect(canonicalIds.size).toBe(records.length);
  });

  it('INVARIANT 3: Anti-lookahead strictly enforced (odds timestamp < kickoff timestamp for all observations)', () => {
    const lines = fs.readFileSync(expandedFile, 'utf-8').trim().split('\n').filter(Boolean);
    const records = lines.map((l) => JSON.parse(l));

    for (const r of records) {
      const kickoff = new Date(r.kickoff_at).getTime();
      const oddsTime = new Date(r.odds_timestamp).getTime();
      const latestPreKickoff = new Date(r.latest_pre_kickoff_timestamp).getTime();
      const openingTime = new Date(r.opening_timestamp).getTime();

      expect(oddsTime).toBeLessThan(kickoff);
      expect(latestPreKickoff).toBeLessThan(kickoff);
      expect(openingTime).toBeLessThan(kickoff);
      expect(openingTime).toBeLessThanOrEqual(latestPreKickoff);

      // Verify decision intervals if present
      if (r.t24h_timestamp) {
        expect(new Date(r.t24h_timestamp).getTime()).toBeLessThan(kickoff);
      }
      if (r.t6h_timestamp) {
        expect(new Date(r.t6h_timestamp).getTime()).toBeLessThan(kickoff);
      }
      if (r.t1h_timestamp) {
        expect(new Date(r.t1h_timestamp).getTime()).toBeLessThan(kickoff);
      }
    }
  });

  it('INVARIANT 4: Unchanged BttsBacktestEngine runs and achieves sample size sufficiency', () => {
    const oddsRecords = fs
      .readFileSync(expandedFile, 'utf-8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    const canonicalMatches: HistoricalMatchRecord[] = fs
      .readFileSync(canonicalFile, 'utf-8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    const { evaluations, summary } = BttsBacktestEngine.runBacktest(oddsRecords, canonicalMatches);

    expect(evaluations).toHaveLength(105);
    expect(summary.totalMatches).toBe(105);
    expect(summary.lookaheadViolations).toBe(0);

    // Sample size is now >= 100, transitioning to SUFFICIENT_FOR_RESEARCH
    expect(summary.sampleSize).toBe(105);
    expect(summary.minSampleSizeRequired).toBe(100);
    expect(summary.isSampleSufficient).toBe(true);
    expect(summary.dataSufficiencyVerdict).toBe('SUFFICIENT_FOR_RESEARCH');

    // Strict safety invariant: zero VALUE signals without audited calibration curve
    expect(summary.statusCounts.VALUE).toBe(0);
    expect(summary.statusCounts.INSUFFICIENT_DATA).toBe(0);
    expect(summary.statusCounts.RESEARCH_ONLY).toBe(105);

    for (const ev of evaluations) {
      expect(ev.status).toBe('RESEARCH_ONLY');
      expect(ev.reason).toContain('RESEARCH ONLY');
      expect(ev.modelProbYes + ev.modelProbNo).toBeCloseTo(1.0, 4);
      expect(ev.noVigMarketProbYes + ev.noVigMarketProbNo).toBeCloseTo(1.0, 4);
      expect(ev.fairOddsYes).toBeCloseTo(1 / ev.modelProbYes, 3);
      expect(ev.fairOddsNo).toBeCloseTo(1 / ev.modelProbNo, 3);
    }
  });

  it('INVARIANT 5: Empirical Quota Audit confirmed zero billable requests and protected floor preserved', () => {
    expect(fs.existsSync(summaryFile)).toBe(true);
    const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf-8'));

    expect(summary.quotaAudit.quotaDelta).toBe(0);
    expect(summary.quotaAudit.isUnmetered).toBe(true);
    const remaining = summary.quotaAudit.accountAfter.requestLimit - summary.quotaAudit.accountAfter.requestCount;
    expect(remaining).toBeGreaterThanOrEqual(50); // Protected reserve floor
  });

  it('INVARIANT 6: BttsHistoryService seamlessly loads expanded records and summary', () => {
    const records = BttsHistoryService.getRecords();
    expect(records.length).toBe(105);

    const summary = BttsHistoryService.getSummary();
    expect(summary.bttsRecordsCount).toBe(105);
    expect(summary.dataset).toBe('BTTS_HISTORICAL_ODDS_2026');
    expect(summary.backtest?.isSampleSufficient).toBe(true);
    expect(summary.backtest?.dataSufficiencyVerdict).toBe('SUFFICIENT_FOR_RESEARCH');
  });
});
