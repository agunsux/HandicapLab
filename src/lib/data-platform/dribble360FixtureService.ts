/**
 * DRIBBLE360 FIXTURE SERVICE — Reliable Upcoming Fixture Indexing
 * 
 * Implements safe local indexing and validation for Dribble360 fixtures:
 * 1. Handles provider query parameter ignorance by performing strict local window filtering.
 * 2. Enforces a 7-day audit window (now -> now + 7 days, UTC).
 * 3. Rejects completed, cancelled, postponed, stale, or malformed fixtures.
 * 4. Normalizes teams and maps season IDs into SALMO canonical league identifiers.
 * 5. Deduplicates fixtures deterministically.
 * 6. Records full provenance and validation breakdown per competition.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Dribble360Adapter } from './dribble360Adapter';
import type { CanonicalFixture } from './canonicalModel';
import type { Dribble360Match } from '@/lib/providers/dribble360Provider';

export interface FixtureValidationReport {
  retrievedAt: string;
  auditWindow: {
    startUtc: string;
    endUtc: string;
    timezone: 'UTC';
    durationDays: number;
  };
  totalRecordsScanned: number;
  recordsInWindow: number;
  validUpcomingCount: number;
  rejectedCount: number;
  rejectedReasons: Record<string, number>;
  duplicateCount: number;
  perCompetition: Record<
    string,
    {
      leagueId: string;
      name: string;
      country: string;
      validCount: number;
      sampleFixtures: {
        id: string;
        kickoffUtc: string;
        match: string;
        canonicalId: string;
      }[];
    }
  >;
  canonicalFixtures: CanonicalFixture[];
}

export interface FixtureDiscoveryOptions {
  startDateIso?: string;
  endDateIso?: string;
  sourceFilePath?: string;
}

export class Dribble360FixtureService {
  public static readonly DEFAULT_HARVEST_PATH = path.resolve(
    'data/research/dribble360/harvest/matches_2025_2026.jsonl'
  );

  /**
   * Discovers and validates upcoming fixtures across target competitions in a strict UTC window.
   */
  public static async discoverUpcomingFixtures(
    options: FixtureDiscoveryOptions = {}
  ): Promise<FixtureValidationReport> {
    const now = new Date();
    const startUtc = options.startDateIso || now.toISOString().slice(0, 10) + 'T00:00:00.000Z';
    const endUtc =
      options.endDateIso ||
      new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10) + 'T23:59:59.999Z';

    const sourcePath = options.sourceFilePath || this.DEFAULT_HARVEST_PATH;

    const report: FixtureValidationReport = {
      retrievedAt: now.toISOString(),
      auditWindow: {
        startUtc,
        endUtc,
        timezone: 'UTC',
        durationDays: 7,
      },
      totalRecordsScanned: 0,
      recordsInWindow: 0,
      validUpcomingCount: 0,
      rejectedCount: 0,
      rejectedReasons: {},
      duplicateCount: 0,
      perCompetition: {},
      canonicalFixtures: [],
    };

    if (!fs.existsSync(sourcePath)) {
      console.warn(`[Dribble360FixtureService] Source file missing: ${sourcePath}`);
      return report;
    }

    const fileStream = fs.createReadStream(sourcePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const seenMatchIds = new Set<string>();
    const seenCanonicalKeys = new Set<string>();

    for await (const line of rl) {
      if (!line.trim()) continue;
      report.totalRecordsScanned++;

      let m: Dribble360Match;
      try {
        m = JSON.parse(line);
      } catch {
        report.rejectedCount++;
        report.rejectedReasons['JSON_PARSE_ERROR'] =
          (report.rejectedReasons['JSON_PARSE_ERROR'] || 0) + 1;
        continue;
      }

      const matchDate = m.date || m.kickoff || '';
      if (!matchDate) {
        report.rejectedCount++;
        report.rejectedReasons['MISSING_DATE'] = (report.rejectedReasons['MISSING_DATE'] || 0) + 1;
        continue;
      }

      // Check window boundary
      if (matchDate < startUtc || matchDate > endUtc) {
        continue; // Outside audit window
      }

      report.recordsInWindow++;

      // Provider ID deduplication
      const matchId = String(m.id || '');
      if (!matchId) {
        report.rejectedCount++;
        report.rejectedReasons['MISSING_PROVIDER_ID'] =
          (report.rejectedReasons['MISSING_PROVIDER_ID'] || 0) + 1;
        continue;
      }

      if (seenMatchIds.has(matchId)) {
        report.duplicateCount++;
        report.rejectedCount++;
        report.rejectedReasons['DUPLICATE_PROVIDER_ID'] =
          (report.rejectedReasons['DUPLICATE_PROVIDER_ID'] || 0) + 1;
        continue;
      }
      seenMatchIds.add(matchId);

      // Status check (must be upcoming FIXTURE)
      const rawStatus = (m.status || '').toUpperCase();
      if (rawStatus !== 'FIXTURE') {
        report.rejectedCount++;
        report.rejectedReasons[`NON_FIXTURE_STATUS_${rawStatus}`] =
          (report.rejectedReasons[`NON_FIXTURE_STATUS_${rawStatus}`] || 0) + 1;
        continue;
      }

      // Description / Team check
      if (!m.description || !m.description.includes(' vs ')) {
        report.rejectedCount++;
        report.rejectedReasons['MALFORMED_TEAM_DESCRIPTION'] =
          (report.rejectedReasons['MALFORMED_TEAM_DESCRIPTION'] || 0) + 1;
        continue;
      }

      // Canonical conversion
      const canonical = Dribble360Adapter.toCanonicalFixture(m);

      if (seenCanonicalKeys.has(canonical.match_id)) {
        report.duplicateCount++;
        report.rejectedCount++;
        report.rejectedReasons['DUPLICATE_CANONICAL_KEY'] =
          (report.rejectedReasons['DUPLICATE_CANONICAL_KEY'] || 0) + 1;
        continue;
      }
      seenCanonicalKeys.add(canonical.match_id);

      // Successfully validated
      report.validUpcomingCount++;
      report.canonicalFixtures.push(canonical);

      // Group by competition
      const compId = canonical.competition_id;
      if (!report.perCompetition[compId]) {
        report.perCompetition[compId] = {
          leagueId: compId,
          name: compId,
          country: compId.split('-')[0] || 'WORLD',
          validCount: 0,
          sampleFixtures: [],
        };
      }

      const compGroup = report.perCompetition[compId];
      compGroup.validCount++;
      if (compGroup.sampleFixtures.length < 3) {
        compGroup.sampleFixtures.push({
          id: matchId,
          kickoffUtc: canonical.kickoff,
          match: m.description,
          canonicalId: canonical.match_id,
        });
      }
    }

    return report;
  }
}
