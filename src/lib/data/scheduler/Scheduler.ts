// Scheduler — Orchestrates Live Data Ingestion Pipeline
// Location: src/lib/data/scheduler/Scheduler.ts
// Provider does NOT know about scheduler. Scheduler calls providers.

import { logger } from '@/lib/logger';
import { ProviderRegistry } from '../providers/core/ProviderRegistry';
import { FixtureStateMachine } from './FixtureStateMachine';
import { MemoryPayloadRepository } from '../repositories/PayloadRepository';
import { MemoryProviderLogRepository } from '../repositories/ProviderLogRepository';
import { MemoryFixtureRepository } from '../repositories/FixtureRepository';
import { MemoryOddsRepository } from '../repositories/OddsRepository';
import type { FixtureLifecycleState, SchedulerConfig, SchedulerEvent } from './types';
import { DEFAULT_SCHEDULER_CONFIG } from './types';

export interface SchedulerDependencies {
  registry: ProviderRegistry;
  stateMachine: FixtureStateMachine;
  fixtureRepo: MemoryFixtureRepository;
  oddsRepo: MemoryOddsRepository;
  payloadRepo: MemoryPayloadRepository;
  logRepo: MemoryProviderLogRepository;
  config?: Partial<SchedulerConfig>;
}

export class Scheduler {
  private deps: Required<SchedulerDependencies>;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private log = logger.child('scheduler');

  constructor(deps: SchedulerDependencies) {
    this.deps = {
      registry: deps.registry,
      stateMachine: deps.stateMachine,
      fixtureRepo: deps.fixtureRepo,
      oddsRepo: deps.oddsRepo,
      payloadRepo: deps.payloadRepo,
      logRepo: deps.logRepo,
      config: { ...DEFAULT_SCHEDULER_CONFIG, ...deps.config },
    };
  }

  start(): void {
    if (this.running) { this.log.warn('scheduler_already_running'); return; }
    this.running = true;
    this.log.info('scheduler_started', { pollIntervalMs: this.deps.config.pollIntervalMs });
    this.tick();
    this.intervalId = setInterval(() => this.tick(), this.deps.config.pollIntervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    this.log.info('scheduler_stopped');
  }

  async tick(): Promise<void> {
    if (!this.running) return;
    const startTime = performance.now();
    try {
      await this.pollUpcomingFixtures();
      await this.pollLiveFixtures();
      await this.pollFinishedFixtures();
      await this.handleTimeouts();
      this.log.debug('tick_completed', {
        durationMs: Math.round(performance.now() - startTime),
        stateCounts: this.deps.stateMachine.getStateCounts(),
      });
    } catch (error: any) {
      this.log.error('tick_failed', { error: error.message });
    }
  }

  async pollOnce(): Promise<{
    fixturesFetched: number;
    oddsStored: number;
    stateCounts: Record<FixtureLifecycleState, number>;
    events: SchedulerEvent[];
  }> {
    const before = (await this.deps.fixtureRepo.findByStatus('upcoming')).length;
    await this.pollUpcomingFixtures();
    await this.pollLiveFixtures();
    await this.pollFinishedFixtures();
    await this.handleTimeouts();
    return {
      fixturesFetched: (await this.deps.fixtureRepo.findByStatus('upcoming')).length - before,
      oddsStored: 0,
      stateCounts: this.deps.stateMachine.getStateCounts(),
      events: this.deps.stateMachine.getEvents(10),
    };
  }

  get isRunning(): boolean { return this.running; }

  // Private: Poll upcoming fixtures from provider
  private async pollUpcomingFixtures(): Promise<void> {
    const p = this.deps.registry.resolveFixtures();
    const now = new Date();
    const lookAhead = new Date(now.getTime() + this.deps.config.lookAheadMs);
    try {
      const fixtures = await p.fetchFixtures({ fromDate: now, toDate: lookAhead, status: 'upcoming' });
      for (const f of fixtures) {
        await this.deps.fixtureRepo.upsert(f);
        if (!this.deps.stateMachine.getState(f.fixtureId)) {
          this.deps.stateMachine.registerFixture(f.fixtureId, 'SCHEDULED');
        }
      }
      this.log.debug('poll_upcoming', { count: fixtures.length });
    } catch (error: any) {
      this.log.error('poll_upcoming_failed', { error: error.message });
    }
  }

  // Private: Poll live fixtures and their odds
  private async pollLiveFixtures(): Promise<void> {
    const fp = this.deps.registry.resolveFixtures();
    const op = this.deps.registry.resolveOdds();
    try {
      const live = await fp.fetchFixtures({ status: 'live' });
      for (const fixture of live) {
        await this.deps.fixtureRepo.upsert(fixture);
        const state = this.deps.stateMachine.getState(fixture.fixtureId);
        if (state && state.state === 'SCHEDULED') {
          this.deps.stateMachine.transition(fixture.fixtureId, 'LIVE');
        } else if (!state) {
          this.deps.stateMachine.registerFixture(fixture.fixtureId, 'LIVE');
        }
        try {
          const odds = await op.fetchOdds({ fixtureIds: [fixture.fixtureId] });
          for (const odd of odds) {
            await this.deps.oddsRepo.append(odd, 'the-odds-api', 'v4', 'soccer');
          }
        } catch (e: any) {
          this.log.warn('fetch_live_odds_failed', { fixtureId: fixture.fixtureId, error: e.message });
        }
      }
    } catch (error: any) {
      this.log.error('poll_live_failed', { error: error.message });
    }
  }

  // Private: Poll finished fixtures
  private async pollFinishedFixtures(): Promise<void> {
    const p = this.deps.registry.resolveFixtures();
    try {
      const finished = await p.fetchFixtures({ status: 'finished' });
      for (const fixture of finished) {
        await this.deps.fixtureRepo.upsert(fixture);
        const state = this.deps.stateMachine.getState(fixture.fixtureId);
        if (state && (state.state === 'LIVE' || state.state === 'SCHEDULED')) {
          this.deps.stateMachine.transition(fixture.fixtureId, 'FINISHED');
        }
      }
    } catch (error: any) {
      this.log.error('poll_finished_failed', { error: error.message });
    }
  }

  // Private: Handle timeouts for auto-settle and auto-archive
  private async handleTimeouts(): Promise<void> {
    const now = new Date();
    for (const state of this.deps.stateMachine.getFixturesByState('FINISHED')) {
      if (now.getTime() - state.enteredAt.getTime() >= this.deps.config.autoSettleAfterMs) {
        this.deps.stateMachine.transition(state.fixtureId, 'SETTLED');
        this.log.info('auto_settle', { fixtureId: state.fixtureId });
      }
    }
    for (const state of this.deps.stateMachine.getFixturesByState('SETTLED')) {
      if (now.getTime() - state.enteredAt.getTime() >= this.deps.config.autoArchiveAfterMs) {
        this.deps.stateMachine.transition(state.fixtureId, 'ARCHIVED');
        this.log.info('auto_archive', { fixtureId: state.fixtureId });
      }
    }
  }
}

