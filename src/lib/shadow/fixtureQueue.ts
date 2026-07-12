/**
 * 21.1 — Live Fixture Queue
 * Manages fixture lifecycle: scheduled → locked → prediction_generated → kickoff → finished
 */

import type { ShadowFixture, FixtureStatus, FixtureQueueState } from './types';
import { generateFixtureId } from './id';

export class FixtureQueue {
  private readonly fixtures = new Map<string, ShadowFixture>();

  add(input: { externalId: string; homeTeam: string; awayTeam: string; competition: string; season: string; kickoff: string; provider: string }): ShadowFixture {
    const now = new Date().toISOString();
    const fixture: ShadowFixture = Object.freeze({
      fixtureId: generateFixtureId(),
      externalId: input.externalId,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      competition: input.competition,
      season: input.season,
      kickoff: input.kickoff,
      status: 'scheduled',
      createdAt: now,
      updatedAt: now,
      provider: input.provider,
    });
    this.fixtures.set(fixture.fixtureId, fixture);
    return fixture;
  }

  updateStatus(fixtureId: string, status: FixtureStatus): ShadowFixture {
    const existing = this.fixtures.get(fixtureId);
    if (!existing) throw new Error(`Fixture ${fixtureId} not found`);
    const updated: ShadowFixture = Object.freeze({ ...existing, status, updatedAt: new Date().toISOString() });
    this.fixtures.set(fixtureId, updated);
    return updated;
  }

  get(fixtureId: string): ShadowFixture | undefined { return this.fixtures.get(fixtureId); }

  getByStatus(status: FixtureStatus): readonly ShadowFixture[] {
    return Array.from(this.fixtures.values()).filter((f) => f.status === status);
  }

  getAll(): readonly ShadowFixture[] { return Array.from(this.fixtures.values()); }

  getState(): FixtureQueueState {
    const all = this.getAll();
    return { fixtures: all, pendingCount: all.filter((f) => f.status === 'scheduled').length, lockedCount: all.filter((f) => f.status === 'locked').length, predictedCount: all.filter((f) => f.status === 'prediction_generated').length, finishedCount: all.filter((f) => f.status === 'finished').length };
  }

  count(): number { return this.fixtures.size; }
}

export const defaultFixtureQueue = new FixtureQueue();