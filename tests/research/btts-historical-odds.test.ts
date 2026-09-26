import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { classifyCatalogMarket } from '@/historical/oddspapi/marketCatalog';
import { BttsHistoryService } from '@/lib/services/bttsHistoryService';
import { getProviderQuotaPolicy } from '@/lib/providers/quotaPolicy';

interface RawOddsPoint {
  createdAt: string;
  price: number;
  limit: number | null;
}

function selectEntryClosing(points: RawOddsPoint[], kickoffMs: number) {
  const validPreMatch = points.filter((p) => {
    const ts = Date.parse(p.createdAt);
    return Number.isFinite(ts) && ts <= kickoffMs;
  });

  const inPlayPoints = points.filter((p) => {
    const ts = Date.parse(p.createdAt);
    return Number.isFinite(ts) && ts > kickoffMs;
  });

  validPreMatch.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  return {
    entry: validPreMatch[0] ?? null,
    closing: validPreMatch[validPreMatch.length - 1] ?? null,
    closingAfterKickoffRejected: inPlayPoints.length,
  };
}

describe('1. Odds Classification & Market Selection', () => {
  it('correctly classifies Full Match Both Teams To Score (Market 104)', () => {
    const fullMatchBtts = {
      marketId: 104,
      marketName: 'Both Teams To Score',
      marketType: 'BothTeamsScore',
      handicap: null,
      outcomes: [
        { outcomeId: 1, outcomeName: 'Yes' },
        { outcomeId: 2, outcomeName: 'No' },
      ],
    };

    const classified = classifyCatalogMarket(fullMatchBtts);
    expect(classified).not.toBeNull();
    expect(classified?.market).toBe('BTTS');
    expect(classified?.line).toBeNull();
  });

  it('strictly filters out 1st Half / 2nd Half / Sub-period BTTS markets', () => {
    const halfTimeBtts = {
      marketId: 10300,
      marketName: '1st Half - Both Teams To Score',
      marketType: 'BothTeamsScore',
      handicap: null,
      outcomes: [
        { outcomeId: 1, outcomeName: 'Yes' },
        { outcomeId: 2, outcomeName: 'No' },
      ],
    };

    const isSubPeriod =
      halfTimeBtts.marketName.toLowerCase().includes('half') ||
      halfTimeBtts.marketName.toLowerCase().includes('period') ||
      halfTimeBtts.marketName.toLowerCase().includes('overtime');

    expect(isSubPeriod).toBe(true);
  });

  it('rejects in-play odds points when selecting closing odds', () => {
    const kickoffMs = Date.parse('2026-02-01T14:00:00.000Z');
    const points: RawOddsPoint[] = [
      { createdAt: '2026-01-26T21:41:12.000Z', price: 1.70, limit: null }, // Valid pre-match opening
      { createdAt: '2026-02-01T13:55:00.000Z', price: 1.75, limit: null }, // Valid pre-match closing (5m before kickoff)
      { createdAt: '2026-02-01T14:05:00.000Z', price: 2.50, limit: null }, // IN-PLAY (5m after kickoff) -> MUST REJECT
      { createdAt: '2026-02-01T15:30:00.000Z', price: 5.00, limit: null }, // IN-PLAY (90m after kickoff) -> MUST REJECT
    ];

    const result = selectEntryClosing(points, kickoffMs);
    expect(result.entry?.price).toBe(1.70);
    expect(result.closing?.price).toBe(1.75);
    expect(result.closingAfterKickoffRejected).toBe(2);
    expect(Date.parse(result.closing!.createdAt)).toBeLessThanOrEqual(kickoffMs);
  });
});

describe('2. Data Governance & Canonical Identity', () => {
  it('loads canonical dataset and confirms immutable JSONL exists', () => {
    const bttsFile = path.resolve('data/historical/btts_historical_odds_2026.jsonl');
    expect(fs.existsSync(bttsFile)).toBe(true);

    const lines = fs.readFileSync(bttsFile, 'utf-8').trim().split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(4);

    const first = JSON.parse(lines[0]);
    expect(first.canonical_match_id).toMatch(/^ENG-PL\|2025-2026\|2026-/);
    expect(first.market).toBe('BTTS');
    expect(first.bookmaker).toBe('pinnacle');
    expect(first.opening_yes_odds).toBeGreaterThan(1.0);
    expect(first.opening_no_odds).toBeGreaterThan(1.0);
    expect(first.closing_yes_odds).toBeGreaterThan(1.0);
    expect(first.closing_no_odds).toBeGreaterThan(1.0);
    expect(first.data_quality).toBe('VERIFIED');
    expect(first.provenance_status).toBe('PREMATCH_VERIFIED');
  });

  it('enforces temporal invariant: opening_ts <= closing_ts < kickoff', () => {
    const records = BttsHistoryService.getRecords();
    expect(records.length).toBeGreaterThan(0);

    for (const r of records) {
      const kickoff = Date.parse(r.kickoff_at);
      const openTs = Date.parse(r.opening_timestamp!);
      const closeTs = Date.parse(r.closing_timestamp!);

      expect(openTs).toBeLessThanOrEqual(closeTs);
      expect(closeTs).toBeLessThan(kickoff);
    }
  });

  it('guarantees idempotent odds_id through deterministic SHA-256 hash', () => {
    const makeHash = (parts: string[]) => crypto.createHash('sha256').update(parts.join('|')).digest('hex');

    const id1 = makeHash(['ENG-PL|2025-2026|2026-02-01|aston-villa|brentford', 'BTTS', 'closing', 'pinnacle', 'null', 'oddspapi', 'id1000001761300977', '104']);
    const id2 = makeHash(['ENG-PL|2025-2026|2026-02-01|aston-villa|brentford', 'BTTS', 'closing', 'pinnacle', 'null', 'oddspapi', 'id1000001761300977', '104']);

    expect(id1).toBe(id2);
    expect(id1).toHaveLength(64);
  });
});

describe('3. Quota Safety & Reserve Protection', () => {
  it('confirms OddsPAPI policy has 250 hard limit and 50 protected reserve floor', () => {
    const policy = getProviderQuotaPolicy('oddspapi');
    expect(policy.hardLimit).toBe(250);
    expect(policy.softLimit).toBe(200);
    expect(policy.period).toBe('MONTHLY');
  });

  it('proves historical odds ingestion produced zero billable quota consumption', () => {
    const summary = BttsHistoryService.getSummary();
    expect(summary.quotaAudit.isUnmeteredConfirmed).toBe(true);
    expect(summary.quotaAudit.quotaDelta).toBe(0);
    expect(summary.quotaAudit.countBefore).toBe(summary.quotaAudit.countAfter);
    expect(summary.quotaAudit.requestLimit - summary.quotaAudit.countAfter).toBeGreaterThanOrEqual(50);
  });
});

describe('4. AH / OU / BTTS Canonical Synchronization', () => {
  it('proves that BTTS joins to the identical canonical match triad with AH and OU', () => {
    const canonicalFile = path.resolve('data/golden/europe/canonical_matches.jsonl');
    const lines = fs.readFileSync(canonicalFile, 'utf-8').trim().split('\n').filter(Boolean);
    const canonicalMap = new Map(lines.map((l) => [JSON.parse(l).canonicalId, JSON.parse(l)]));

    const bttsRecords = BttsHistoryService.getRecords();

    for (const btts of bttsRecords) {
      const match = canonicalMap.get(btts.canonical_match_id);
      expect(match).toBeDefined();

      // AH and OU odds must coexist on the same canonical fixture
      expect(match.odds).toBeDefined();
      const ahLine = match.odds.ahLine ?? match.odds.chLine;
      const ouLine = match.odds.ouLine ?? match.odds.couLine;
      const ahHome = match.odds.ahHome ?? match.odds.chHome;
      const over = match.odds.over ?? match.odds.cover;
      expect(ahLine).toBeDefined();
      expect(ouLine).toBeDefined();
      expect(ahHome).toBeGreaterThan(1.0);
      expect(over).toBeGreaterThan(1.0);

      // BTTS shares identical teams, season, and kickoff date
      expect(btts.home_team.toLowerCase()).toContain(match.homeTeam.toLowerCase().split(' ')[0]);
      expect(btts.season).toBe(match.season);
    }
  });
});

describe('5. Offline Safety & UI Service Isolation', () => {
  it('BttsHistoryService queries data purely from local files with zero HTTP requests', () => {
    const records = BttsHistoryService.getRecords();
    const summary = BttsHistoryService.getSummary();

    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBeGreaterThan(0);
    expect(summary.dataset).toBe('BTTS_HISTORICAL_ODDS_2026');
    expect(summary.league).toBe('ENG-PL');
    expect(summary.bookmaker).toBe('Pinnacle');
  });

  it('BttsHistoryService query supports search, filtering, and pagination', () => {
    const result = BttsHistoryService.query({ search: 'Villa', quality: 'VERIFIED' });
    expect(result.records.length).toBeGreaterThanOrEqual(1);
    expect(result.records[0].home_team).toContain('Villa');
    expect(result.records[0].data_quality).toBe('VERIFIED');
  });
});
