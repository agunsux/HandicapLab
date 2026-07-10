/**
 * Decision Layer — Unit Tests
 * =============================
 * Tests for Decision Engine, Serializer, Story Engine,
 * Alternative Engine, and Risk Layer.
 *
 * All outputs must be deterministic.
 */

import { describe, it, expect } from 'vitest';
import { makeDecision, DecisionSerializer, buildFullStory, getAlternatives, assessRisk } from '../src/lib/decision/index';
import type { DecisionInput } from '../src/lib/decision/index';

function makeInput(overrides?: Partial<DecisionInput>): DecisionInput {
  return {
    confidence: 84,
    ece: 0.021,
    clv: 0.035,
    historicalRoi: 8.2,
    volatility: 0.12,
    sampleSize: 1200,
    similarMatches: 182,
    walkForwardSeasons: 5,
    dataQualityScore: 88,
    marketStability: 75,
    modelAgreement: 82,
    homeTeam: 'Manchester City',
    awayTeam: 'Arsenal',
    marketType: 'AH',
    expectedValue: 8.7,
    ...overrides,
  };
}

describe('Decision Engine', () => {
  it('produces strong_opportunity for high-quality input', () => {
    const d = makeDecision(makeInput());
    expect(d.recommendation).toBe('strong_opportunity');
    expect(d.confidence).toBe(84);
    expect(d.trustScore).toBeGreaterThan(70);
    expect(d.marketQuality).toBe('good');
    expect(d.riskLevel).toBe('low');
  });

  it('produces consider for moderate input', () => {
    const d = makeDecision(makeInput({ confidence: 65, ece: 0.03, clv: 0.015 }));
    expect(d.recommendation).toBe('consider');
  });

  it('produces avoid for poor calibration', () => {
    const d = makeDecision(makeInput({ ece: 0.08, confidence: 30 }));
    expect(d.recommendation).toBe('avoid');
  });

  it('produces no_edge for very low confidence', () => {
    const d = makeDecision(makeInput({ confidence: 20, ece: 0.04 }));
    expect(d.recommendation).toBe('no_edge');
  });

  it('generates deterministic output', () => {
    const input = makeInput();
    const d1 = makeDecision(input);
    const d2 = makeDecision(input);
    expect(d1.story).toBe(d2.story);
    expect(d1.recommendation).toBe(d2.recommendation);
    expect(d1.trustScore).toBe(d2.trustScore);
  });

  it('includes evidence card with grade A', () => {
    const d = makeDecision(makeInput({ sampleSize: 1200 }));
    expect(d.evidence.researchGrade).toBe('A');
    expect(d.evidence.similarMatches).toBe(182);
    expect(d.evidence.bootstrapConfidence).toBeGreaterThan(80);
  });

  it('includes evidence card with grade D for small samples', () => {
    const d = makeDecision(makeInput({ sampleSize: 30 }));
    expect(d.evidence.researchGrade).toBe('Insufficient');
  });

  it('includes trust breakdown', () => {
    const d = makeDecision(makeInput());
    expect(d.trust.calibrationScore).toBeGreaterThan(0);
    expect(d.trust.clvScore).toBeGreaterThan(0);
    expect(d.trust.dataQualityScore).toBeGreaterThan(0);
  });

  it('includes story and reason', () => {
    const d = makeDecision(makeInput());
    expect(d.story).toContain('Manchester City');
    expect(d.story).toContain('Arsenal');
    expect(d.reason.length).toBeGreaterThan(10);
    expect(d.whyNot.length).toBeGreaterThan(0);
  });

  it('includes alternatives', () => {
    const d = makeDecision(makeInput());
    expect(d.alternatives.length).toBeGreaterThan(0);
  });

  it('includes tags for positive signals', () => {
    const d = makeDecision(makeInput());
    expect(d.tags).toContain('positive_clv');
    expect(d.tags).toContain('high_agreement');
  });
});

describe('DecisionSerializer', () => {
  it('serializes to JSON', () => {
    const d = makeDecision(makeInput());
    const json = DecisionSerializer.toJSON(d);
    expect(json.decision.recommendation).toBe('strong_opportunity');
    expect(json.evidence.similarMatches).toBe(182);
    expect(json.trust.trustScore).toBeGreaterThan(0);
  });

  it('serializes to Markdown', () => {
    const d = makeDecision(makeInput());
    const md = DecisionSerializer.toMarkdown(d);
    expect(md).toContain('# Decision Report');
    expect(md).toContain('strong_opportunity');
    expect(md).toContain('Recommendation');
  });

  it('serializes to CSV', () => {
    const d = makeDecision(makeInput());
    const csv = DecisionSerializer.toCSV(d);
    expect(csv).toContain('recommendation,strong_opportunity');
    expect(csv).toContain('confidence,84');
  });
});

describe('Story Engine', () => {
  it('builds full story', () => {
    const story = buildFullStory({
      homeTeam: 'Liverpool', awayTeam: 'Chelsea', marketType: 'AH',
      confidence: 78, clv: 0.025, ece: 0.028, modelAgreement: 75,
      marketStability: 70, similarMatches: 150, historicalRoi: 5.2,
      recommendation: 'consider',
    });
    expect(story.situation).toContain('Liverpool');
    expect(story.evidence).toContain('150');
    expect(story.recommendation).toContain('Consider');
    expect(story.why.length).toBeGreaterThan(10);
  });

  it('generates deterministic stories', () => {
    const ctx = { homeTeam: 'A', awayTeam: 'B', marketType: 'ML', confidence: 60, clv: 0.01, ece: 0.03, modelAgreement: 60, marketStability: 50, similarMatches: 50, historicalRoi: 2, recommendation: 'watch' as const };
    const s1 = buildFullStory(ctx);
    const s2 = buildFullStory(ctx);
    expect(s1.situation).toBe(s2.situation);
  });
});

describe('Alternative Engine', () => {
  it('returns AH alternatives', () => {
    const alts = getAlternatives('AH', 80);
    expect(alts.length).toBeGreaterThanOrEqual(2);
    expect(alts.some((a) => a.title.includes('Moneyline'))).toBe(true);
  });

  it('returns no-bet option for low confidence', () => {
    const alts = getAlternatives('ML', 40);
    expect(alts.some((a) => a.title === 'No bet')).toBe(true);
  });
});

describe('Risk Layer', () => {
  it('assesses low risk for high-quality input', () => {
    const risk = assessRisk(84, 0.12, 75, 1200, 0.021);
    expect(risk.level).toBe('low');
    expect(risk.factors.length).toBe(5);
  });

  it('assesses extreme risk for poor input', () => {
    const risk = assessRisk(20, 0.5, 20, 30, 0.1);
    expect(risk.level).toBe('extreme');
  });

  it('includes factor breakdown', () => {
    const risk = assessRisk(60, 0.2, 50, 500, 0.04);
    expect(risk.factors[0].name).toBe('Confidence');
    expect(risk.factors[1].impact).toBeDefined();
  });
});