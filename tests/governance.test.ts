import { describe, it, expect, beforeEach } from 'vitest';
import { RuleBasedGovernance } from '../src/lib/governance/engines/GovernanceEngine';
import { GovernanceConfigProvider } from '../src/lib/governance/engines/GovernancePolicy';
import { EventSourcingLedger } from '../src/lib/governance/EventSourcingLedger';
import { CommandDispatcher } from '../src/lib/governance/CommandDispatcher';
import { DecisionProjection } from '../src/lib/governance/DecisionProjection';
import { HealthVetoRule } from '../src/lib/governance/engines/HealthVetoRule';
import { ReliabilityScoreRule } from '../src/lib/governance/engines/ReliabilityScoreRule';

describe('Module 7: Decision Governance Engine', () => {

  beforeEach(() => {
    EventSourcingLedger._clear();
    // Simulate truncating the projection
    DecisionProjection.rebuild([]); 
  });

  describe('Rule Engine Determinism (RuleBasedGovernance)', () => {
    const engine = new RuleBasedGovernance();
    
    it('always produces identical decisions over 100 replays (100% Deterministic)', () => {
      const mockHealth = { overallScore: 85 };
      const mockEvidence = { averageReliability: 75 };
      const prediction = { probability: 0.65 };
      
      const firstRun = engine.evaluate(prediction, mockHealth, mockEvidence, 'v1.0.0');
      
      for (let i = 0; i < 100; i++) {
        const replay = engine.evaluate(prediction, mockHealth, mockEvidence, 'v1.0.0');
        expect(replay.verdict).toBe(firstRun.verdict);
        expect(replay.decisionConfidence).toBe(firstRun.decisionConfidence);
        expect(replay.ruleResults.length).toBe(firstRun.ruleResults.length);
        
        // Ensure Rule Provenance matches perfectly
        expect(replay.ruleResults[0].provenance.rule_id).toBe(firstRun.ruleResults[0].provenance.rule_id);
      }
    });

    it('proves Monotonicity (Increasing Reliability never drops confidence)', () => {
      const prediction = { probability: 0.65 };
      const health = { overallScore: 85 }; // Fixed
      
      const lowReliability = engine.evaluate(prediction, health, { averageReliability: 60 }, 'v1.0.0');
      const midReliability = engine.evaluate(prediction, health, { averageReliability: 80 }, 'v1.0.0');
      const maxReliability = engine.evaluate(prediction, health, { averageReliability: 100 }, 'v1.0.0');

      expect(midReliability.decisionConfidence).toBeGreaterThanOrEqual(lowReliability.decisionConfidence);
      expect(maxReliability.decisionConfidence).toBeGreaterThanOrEqual(midReliability.decisionConfidence);
    });
  });

  describe('Rule Output Constraints (Explainability & Codes)', () => {
    const config = GovernanceConfigProvider.getActivePolicy('v1.0.0'); // min health 80

    it('emits exact Decision Codes for Explainability', () => {
      // Health is 60, should trigger GV001
      const res = HealthVetoRule.evaluate({ overallScore: 60 }, config);
      expect(res.status).toBe('VETO');
      expect(res.code).toBe('GV001_HEALTH_BELOW_THRESHOLD');
      
      // We can easily parse this string later for dashboard display
      expect(res.reason).toContain('below the required minimum');
      expect(res.provenance.rule_id).toBe('RULE_HEALTH_VETO');
    });

    it('emits SCORE adjustments when constraints are passed generously', () => {
      const res = ReliabilityScoreRule.evaluate({ averageReliability: 100 }, config);
      expect(res.status).toBe('SCORE');
      expect(res.code).toBe('GV201_SCORE_ADJUSTMENT');
      expect(res.scoreAdjustment).toBeGreaterThan(0);
    });
  });

  describe('Event Sourcing & Idempotency', () => {
    it('prevents duplicate commands via idempotency_key', () => {
      const command = {
        command_id: 'cmd-1',
        idempotency_key: 'idemp-xyz',
        correlation_id: 'match-1',
        actor: 'system',
        payload: { verdict: 'EXECUTE' }
      };

      // Dispatch twice
      CommandDispatcher.dispatch(command, (cmd) => [
        CommandDispatcher.createEnvelope('DecisionApproved', 'agg-1', cmd.correlation_id, cmd.command_id, cmd.actor, 1, cmd.payload)
      ]);
      CommandDispatcher.dispatch(command, (cmd) => [
        CommandDispatcher.createEnvelope('DecisionApproved', 'agg-1', cmd.correlation_id, cmd.command_id, cmd.actor, 1, cmd.payload)
      ]);

      const stream = EventSourcingLedger.getStream('agg-1');
      expect(stream.length).toBe(1); // Second dispatch was ignored
    });

    it('throws Optimistic Concurrency error if version is wrong', () => {
      const command = {
        command_id: 'cmd-2',
        idempotency_key: 'idemp-abc',
        correlation_id: 'match-2',
        actor: 'user-1',
        payload: { verdict: 'EXECUTE' }
      };

      expect(() => {
        CommandDispatcher.dispatch(command, (cmd) => [
          // Sending version 5 when current is 0
          CommandDispatcher.createEnvelope('DecisionApproved', 'agg-2', cmd.correlation_id, cmd.command_id, cmd.actor, 5, cmd.payload)
        ]);
      }).toThrow(/ConcurrencyConflictError/);
    });
  });

  describe('CQRS Projection & Replay Checksums', () => {
    it('disposable projection rebuilds identically and produces same hash', () => {
      const cmd1 = { command_id: 'c1', idempotency_key: 'k1', correlation_id: 'm1', actor: 'sys', payload: { probability: 0.8 } };
      const cmd2 = { command_id: 'c2', idempotency_key: 'k2', correlation_id: 'm1', actor: 'sys', payload: { decisionConfidence: 75 } };

      // Dispatch 2 commands
      CommandDispatcher.dispatch(cmd1, (c) => [CommandDispatcher.createEnvelope('PredictionCreated', 'agg-3', c.correlation_id, c.command_id, c.actor, 1, c.payload)]);
      CommandDispatcher.dispatch(cmd2, (c) => [CommandDispatcher.createEnvelope('GovernanceReviewed', 'agg-3', c.correlation_id, c.command_id, c.actor, 2, c.payload)]);

      // Read real-time projection hash
      const realTimeModel = DecisionProjection.get('agg-3');
      expect(realTimeModel).toBeDefined();
      expect(realTimeModel?.current_state).toBe('UNDER_REVIEW');
      const realTimeHash = realTimeModel?.projection_hash;

      // Wipe projection
      DecisionProjection.rebuild([]);
      expect(DecisionProjection.get('agg-3')).toBeUndefined();

      // Rebuild from Event Store
      const stream = EventSourcingLedger.getStream('agg-3');
      DecisionProjection.rebuild(stream);
      
      const rebuiltModel = DecisionProjection.get('agg-3');
      expect(rebuiltModel?.current_state).toBe('UNDER_REVIEW');
      
      // Proves Determinism!
      expect(rebuiltModel?.projection_hash).toBe(realTimeHash); 
    });
  });

});
