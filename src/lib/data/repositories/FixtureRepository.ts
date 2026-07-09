// Fixture Repository — Persistence Layer for Fixtures
// Location: src/lib/data/repositories/FixtureRepository.ts
// Separates data access from provider logic.

import * as crypto from 'crypto';
import type { Fixture } from '../providers/types';

export interface FixtureRepository {
  /** Store a fixture, skipping duplicates by unique key */
  upsert(fixture: Fixture): Promise<Fixture>;
  /** Store multiple fixtures */
  upsertMany(fixtures: Fixture[]): Promise<Fixture[]>;
  /** Find fixture by ID */
  findById(id: string): Promise<Fixture | null>;
  /** Find fixtures by status */
  findByStatus(status: Fixture['status']): Promise<Fixture[]>;
  /** Find upcoming fixtures within a date range */
  findUpcoming(from: Date, to: Date): Promise<Fixture[]>;
  /** Update fixture status */
  updateStatus(id: string, status: Fixture['status'], homeScore?: number | null, awayScore?: number | null): Promise<void>;
}

export class MemoryFixtureRepository implements FixtureRepository {
  private fixtures: Map<string, Fixture> = new Map();
  private uniqueKeys: Set<string> = new Set();

  async upsert(fixture: Fixture): Promise<Fixture> {
    // Check for duplicate by unique key
    const key = `${fixture.league}:${fixture.season}:${fixture.homeTeam}:${fixture.awayTeam}:${fixture.kickoffTime.toISOString()}`;
    if (this.uniqueKeys.has(key)) {
      // Update existing
      for (const [id, existing] of this.fixtures) {
        const ek = `${existing.league}:${existing.season}:${existing.homeTeam}:${existing.awayTeam}:${existing.kickoffTime.toISOString()}`;
        if (ek === key) {
          this.fixtures.set(id, { ...existing, ...fixture, updatedAt: new Date() });
          return this.fixtures.get(id)!;
        }
      }
    }

    this.uniqueKeys.add(key);
    const stored = { ...fixture, fixtureId: fixture.fixtureId || crypto.randomUUID() };
    this.fixtures.set(stored.fixtureId, stored);
    return stored;
  }

  async upsertMany(fixtures: Fixture[]): Promise<Fixture[]> {
    const results: Fixture[] = [];
    for (const f of fixtures) {
      results.push(await this.upsert(f));
    }
    return results;
  }

  async findById(id: string): Promise<Fixture | null> {
    return this.fixtures.get(id) ?? null;
  }

  async findByStatus(status: Fixture['status']): Promise<Fixture[]> {
    return Array.from(this.fixtures.values()).filter(f => f.status === status);
  }

  async findUpcoming(from: Date, to: Date): Promise<Fixture[]> {
    return Array.from(this.fixtures.values()).filter(f => {
      if (f.status !== 'upcoming' && f.status !== undefined) return false;
      return f.kickoffTime >= from && f.kickoffTime <= to;
    });
  }

  async updateStatus(id: string, status: Fixture['status'], homeScore?: number | null, awayScore?: number | null): Promise<void> {
    const fixture = this.fixtures.get(id);
    if (!fixture) throw new Error(`Fixture ${id} not found`);
    this.fixtures.set(id, {
      ...fixture,
      status,
      homeScore: homeScore ?? fixture.homeScore,
      awayScore: awayScore ?? fixture.awayScore,
      updatedAt: new Date(),
    });
  }
}
