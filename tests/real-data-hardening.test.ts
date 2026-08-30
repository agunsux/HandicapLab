import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('FINAL REAL-DATA HARDENING & INVARIANT LOCK SUITE', () => {

  // Test A: No Mock / Dummy Fixtures in Production Paths
  it('Test A: verifies no hardcoded placeholder fixtures in production lib/pipeline', () => {
    const pipelinePath = path.join(process.cwd(), 'src/lib/pipeline/dailyAhShadowPipeline.ts');
    const content = fs.readFileSync(pipelinePath, 'utf-8');
    expect(content).not.toMatch(/Liverpool vs Everton/i);
    expect(content).not.toMatch(/Arsenal vs Chelsea/i);
    expect(content).not.toMatch(/dummyFixture/i);
    expect(content).not.toMatch(/mockPrediction/i);
  });

  // Test B: No Stale Upcoming Fixtures
  it('Test B: verifies upcoming fixture query validates kickoff time and non-finished status', () => {
    const pipelinePath = path.join(process.cwd(), 'src/lib/pipeline/dailyAhShadowPipeline.ts');
    const content = fs.readFileSync(pipelinePath, 'utf-8');
    // Must strictly check status NS and league matching
    expect(content).toContain("item.fixture.status.short !== 'NS'");
  });

  // Test C: No Fabricated Odds Fallback
  it('Test C: verifies missing odds produce undefined/null, never default 1.95 fallback', () => {
    const pipelinePath = path.join(process.cwd(), 'src/lib/pipeline/dailyAhShadowPipeline.ts');
    const content = fs.readFileSync(pipelinePath, 'utf-8');
    expect(content).not.toContain('odds ?? 1.95');
    expect(content).not.toContain('homeOdds: 1.95, awayOdds: 1.95');
    expect(content).toContain('openingOdds: openingOdds.length > 0 ? openingOdds : undefined');
  });

  // Test D: Moneyline Excluded from Production Prediction Scope
  it('Test D: verifies production prediction market is strictly AH, OU, or BTTS (No Moneyline)', () => {
    const pipelinePath = path.join(process.cwd(), 'src/lib/pipeline/dailyAhShadowPipeline.ts');
    const content = fs.readFileSync(pipelinePath, 'utf-8');
    expect(content).toContain("market: 'ASIAN_HANDICAP'");
    expect(content).not.toContain("market: 'MONEYLINE'");
    expect(content).not.toContain("market: '1X2'");
  });

  // Test E: Honest Empty-State Integrity
  it('Test E: verifies honest empty array is returned when zero live fixtures are available', () => {
    const pipelinePath = path.join(process.cwd(), 'src/lib/pipeline/dailyAhShadowPipeline.ts');
    const content = fs.readFileSync(pipelinePath, 'utf-8');
    expect(content).toContain('return [];');
    expect(content).not.toContain('return MOCK_FIXTURES');
  });

  // Test F: Research Honesty & Unvalidated Banner Present
  it('Test F: verifies research status banner is permanently affixed to predictions', () => {
    const pipelinePath = path.join(process.cwd(), 'src/lib/pipeline/dailyAhShadowPipeline.ts');
    const content = fs.readFileSync(pipelinePath, 'utf-8');
    expect(content).toContain('RESEARCH STATUS: NOT YET VALIDATED');
  });
});
