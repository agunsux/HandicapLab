// Scheduler Tests — FixtureStateMachine, Scheduler
import { describe, it, expect, beforeEach } from 'vitest';
import { FixtureStateMachine } from '../src/lib/data/scheduler/FixtureStateMachine';
import { Scheduler } from '../src/lib/data/scheduler/Scheduler';
import { ProviderRegistry } from '../src/lib/data/providers/core/ProviderRegistry';
import { MemoryFixtureRepository } from '../src/lib/data/repositories/FixtureRepository';
import { MemoryOddsRepository } from '../src/lib/data/repositories/OddsRepository';
import { MemoryPayloadRepository } from '../src/lib/data/repositories/PayloadRepository';
import { MemoryProviderLogRepository } from '../src/lib/data/repositories/ProviderLogRepository';

describe('FixtureStateMachine', () => {
  let fsm: FixtureStateMachine;

  beforeEach(() => {
    fsm = new FixtureStateMachine();
  });

  it('registers fixture in SCHEDULED state', () => {
    const state = fsm.registerFixture('f1');
    expect(state.fixtureId).toBe('f1');
    expect(state.state).toBe('SCHEDULED');
    expect(fsm.size).toBe(1);
  });

  it('transitions SCHEDULED → LIVE', () => {
    fsm.registerFixture('f1');
    expect(fsm.transition('f1', 'LIVE')).toBe(true);
    expect(fsm.getState('f1')!.state).toBe('LIVE');
  });

  it('transitions LIVE → FINISHED', () => {
    fsm.registerFixture('f1');
    fsm.transition('f1', 'LIVE');
    expect(fsm.transition('f1', 'FINISHED')).toBe(true);
    expect(fsm.getState('f1')!.state).toBe('FINISHED');
  });

  it('prevents invalid transitions', () => {
    fsm.registerFixture('f1');
    // Can't go from SCHEDULED to FINISHED (skip LIVE)
    expect(fsm.transition('f1', 'FINISHED')).toBe(false);
    expect(fsm.getState('f1')!.state).toBe('SCHEDULED');
  });

  it('prevents SKIP transition SCHEDULED → SETTLED', () => {
    fsm.registerFixture('f1');
    expect(fsm.transition('f1', 'SETTLED')).toBe(false);
  });

  it('full lifecycle: SCHEDULED → LIVE → FINISHED → SETTLED → ARCHIVED', () => {
    fsm.registerFixture('f1');
    expect(fsm.transition('f1', 'LIVE')).toBe(true);
    expect(fsm.transition('f1', 'FINISHED')).toBe(true);
    expect(fsm.transition('f1', 'SETTLED')).toBe(true);
    expect(fsm.transition('f1', 'ARCHIVED')).toBe(true);
    expect(fsm.getState('f1')!.state).toBe('ARCHIVED');
  });

  it('ARCHIVED cannot transition further', () => {
    fsm.registerFixture('f1');
    fsm.transition('f1', 'LIVE');
    fsm.transition('f1', 'FINISHED');
    fsm.transition('f1', 'SETTLED');
    fsm.transition('f1', 'ARCHIVED');
    expect(fsm.transition('f1', 'LIVE')).toBe(false);
  });

  it('getStateCounts returns correct counts', () => {
    fsm.registerFixture('f1');
    fsm.registerFixture('f2');
    fsm.transition('f1', 'LIVE');
    const counts = fsm.getStateCounts();
    expect(counts.SCHEDULED).toBe(1);
    expect(counts.LIVE).toBe(1);
    expect(counts.FINISHED).toBe(0);
    expect(counts.SETTLED).toBe(0);
    expect(counts.ARCHIVED).toBe(0);
  });

  it('getEvents returns scheduled events', () => {
    fsm.registerFixture('f1');
    const events = fsm.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('STATE_TRANSITION');
    expect(events[0].toState).toBe('SCHEDULED');
  });

  it('incrementRetry increases retry count', () => {
    fsm.registerFixture('f1');
    expect(fsm.incrementRetry('f1')).toBe(1);
    expect(fsm.incrementRetry('f1')).toBe(2);
    expect(fsm.getState('f1')!.retryCount).toBe(2);
  });

  it('setError stores error message', () => {
    fsm.registerFixture('f1');
    fsm.setError('f1', 'Connection timeout');
    expect(fsm.getState('f1')!.error).toBe('Connection timeout');
  });

  it('reset clears everything', () => {
    fsm.registerFixture('f1');
    fsm.registerFixture('f2');
    expect(fsm.size).toBe(2);
    fsm.reset();
    expect(fsm.size).toBe(0);
  });
});

describe('Scheduler', () => {
  let registry: ProviderRegistry;
  let fsm: FixtureStateMachine;
  let fixtureRepo: MemoryFixtureRepository;
  let oddsRepo: MemoryOddsRepository;
  let payloadRepo: MemoryPayloadRepository;
  let logRepo: MemoryProviderLogRepository;

  beforeEach(() => {
    registry = ProviderRegistry.getInstance();
    fsm = new FixtureStateMachine();
    fixtureRepo = new MemoryFixtureRepository();
    oddsRepo = new MemoryOddsRepository();
    payloadRepo = new MemoryPayloadRepository();
    logRepo = new MemoryProviderLogRepository();
  });

  it('constructor creates valid scheduler', () => {
    const scheduler = new Scheduler({
      registry, stateMachine: fsm, fixtureRepo, oddsRepo, payloadRepo, logRepo,
      config: { pollIntervalMs: 5000 },
    });
    expect(scheduler.isRunning).toBe(false);
  });

  it('start and stop work correctly', () => {
    const scheduler = new Scheduler({
      registry, stateMachine: fsm, fixtureRepo, oddsRepo, payloadRepo, logRepo,
    });
    scheduler.start();
    expect(scheduler.isRunning).toBe(true);
    scheduler.stop();
    expect(scheduler.isRunning).toBe(false);
  });

  it('starting twice warns but still works', () => {
    const scheduler = new Scheduler({
      registry, stateMachine: fsm, fixtureRepo, oddsRepo, payloadRepo, logRepo,
    });
    scheduler.start();
    scheduler.start(); // Should not throw
    scheduler.stop();
  });
});
