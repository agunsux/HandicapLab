/**
 * Sprint A9 — Dataset Diff Engine
 * ================================
 * Compares two canonical datasets and produces a machine-readable diff.
 *
 * Reports: added fixtures, removed fixtures, changed odds, changed
 * timestamps (kickoff / odds), and changed metadata.
 *
 * Pure function: deterministic for identical inputs.
 */

import type { CanonicalDataset, CanonicalMatch, CanonicalOdds } from '../dataset/types';
import type { DatasetDiff, MetadataChange, OddsChange, TimestampChange } from './types';

function oddsKey(o: CanonicalOdds): string {
  return `${o.market}:${o.line ?? 'na'}`;
}

function indexOdds(match: CanonicalMatch): Map<string, CanonicalOdds> {
  const map = new Map<string, CanonicalOdds>();
  for (const o of match.odds) map.set(oddsKey(o), o);
  return map;
}

export class DiffEngine {
  diff(from: CanonicalDataset, to: CanonicalDataset): DatasetDiff {
    const fromMatches = new Map(from.matches.map((m) => [m.fixture.id, m]));
    const toMatches = new Map(to.matches.map((m) => [m.fixture.id, m]));

    const addedFixtures: string[] = [];
    const removedFixtures: string[] = [];
    const changedOdds: OddsChange[] = [];
    const changedTimestamps: TimestampChange[] = [];

    for (const id of toMatches.keys()) {
      if (!fromMatches.has(id)) addedFixtures.push(id);
    }
    for (const id of fromMatches.keys()) {
      if (!toMatches.has(id)) removedFixtures.push(id);
    }

    // Compare shared fixtures
    for (const [id, toMatch] of toMatches) {
      const fromMatch = fromMatches.get(id);
      if (!fromMatch) continue;

      // kickoff timestamp change
      if (fromMatch.fixture.kickoff !== toMatch.fixture.kickoff) {
        changedTimestamps.push({
          fixtureId: id,
          field: 'kickoff',
          before: fromMatch.fixture.kickoff,
          after: toMatch.fixture.kickoff,
        });
      }

      // odds changes
      const fromOdds = indexOdds(fromMatch);
      const toOdds = indexOdds(toMatch);
      for (const [key, toO] of toOdds) {
        const fromO = fromOdds.get(key);
        if (!fromO) {
          changedOdds.push({ fixtureId: id, market: key, field: 'added', before: null, after: toO.homeOdds });
          continue;
        }
        for (const field of ['homeOdds', 'drawOdds', 'awayOdds'] as const) {
          const b = fromO[field];
          const a = toO[field];
          if (b !== a) {
            changedOdds.push({ fixtureId: id, market: key, field, before: b ?? null, after: a ?? null });
          }
        }
        // odds timestamp change
        if (fromO.timestamp !== toO.timestamp) {
          changedTimestamps.push({ fixtureId: id, field: `odds.${key}.timestamp`, before: fromO.timestamp, after: toO.timestamp });
        }
      }
      for (const [key, fromO] of fromOdds) {
        if (!toOdds.has(key)) {
          changedOdds.push({ fixtureId: id, market: key, field: 'removed', before: fromO.homeOdds, after: null });
        }
      }
    }

    const changedMetadata = this.diffMetadata(from, to);

    addedFixtures.sort();
    removedFixtures.sort();

    const identical =
      addedFixtures.length === 0 &&
      removedFixtures.length === 0 &&
      changedOdds.length === 0 &&
      changedTimestamps.length === 0 &&
      changedMetadata.length === 0;

    return {
      fromDatasetId: from.manifest.id,
      toDatasetId: to.manifest.id,
      addedFixtures,
      removedFixtures,
      changedOdds,
      changedTimestamps,
      changedMetadata,
      identical,
    };
  }

  private diffMetadata(from: CanonicalDataset, to: CanonicalDataset): MetadataChange[] {
    const changes: MetadataChange[] = [];
    const fields: ReadonlyArray<keyof CanonicalDataset['manifest']> = [
      'version',
      'name',
      'provenance',
      'schema',
    ];
    for (const field of fields) {
      const b = String(from.manifest[field] ?? '');
      const a = String(to.manifest[field] ?? '');
      if (b !== a) changes.push({ field, before: b, after: a });
    }
    if (from.manifest.fixtureCount !== to.manifest.fixtureCount) {
      changes.push({
        field: 'fixtureCount',
        before: String(from.manifest.fixtureCount),
        after: String(to.manifest.fixtureCount),
      });
    }
    return changes;
  }
}

export const defaultDiffEngine = new DiffEngine();
