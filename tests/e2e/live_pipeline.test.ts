import { describe, it, expect } from 'vitest';
import { generatePrediction } from '../../src/services/probability.engine';
import { classifyRecommendation } from '../../src/lib/value-intelligence/recommendation-engine';
import { generateMockMatch } from '../../src/lib/simulation/mockMatchGenerator';

describe('Live Pipeline E2E', () => {
  it('should reject a value bet if the live data is stale', async () => {
    // 1. Generate live match simulation
    const mock = generateMockMatch();
    const matchInput = mock.input;

    const prediction = generatePrediction(matchInput);
    
    // Simulate odds received 6 minutes ago (Stale for Live)
    const staleTimestamp = new Date(Date.now() - 6 * 60 * 1000).toISOString();

    const valueAssessment = classifyRecommendation({
      fixtureId: 'live-test-1',
      league: 'EPL',
      season: '2023-2024',
      homeTeam: 'MockHome',
      awayTeam: 'MockAway',
      kickoff: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      quote: { market: 'moneyline', priceHome: matchInput.odds_home, priceDraw: matchInput.odds_draw, priceAway: matchInput.odds_away, bookmaker: 'Pinnacle', line: 0 },
      selection: 'home',
      modelProb: prediction.ml_home_prob,
      confidence: prediction.final_confidence,
      dataTimestamp: staleTimestamp,
      maxDataAgeMs: 5 * 60 * 1000 // 5 minutes max
    });

    // We expect it to be rejected because it is stale
    expect(valueAssessment.category).toBe('PASS');
    expect(valueAssessment.reason).toContain('STALE_DATA');
    expect(valueAssessment.actionable).toBe(false);
  });

  it('should accept a value bet if the live data is fresh', async () => {
    // 1. Generate live match simulation
    // We boost confidence and lambda to force a STRONG_VALUE
    const mock = generateMockMatch(2.5, 0.5);
    const matchInput = mock.input;

    const prediction = generatePrediction(matchInput);
    
    // Simulate fresh odds received 10 seconds ago
    const freshTimestamp = new Date(Date.now() - 10 * 1000).toISOString();

    const valueAssessment = classifyRecommendation({
      fixtureId: 'live-test-2',
      league: 'EPL',
      season: '2023-2024',
      homeTeam: 'MockHome',
      awayTeam: 'MockAway',
      kickoff: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      quote: { market: 'moneyline', priceHome: matchInput.odds_home + 0.5, priceDraw: matchInput.odds_draw, priceAway: matchInput.odds_away, bookmaker: 'Pinnacle', line: 0 },
      selection: 'home',
      modelProb: prediction.ml_home_prob,
      confidence: 0.90, // mock high confidence
      dataTimestamp: freshTimestamp,
      maxDataAgeMs: 5 * 60 * 1000 // 5 minutes max
    });

    expect(valueAssessment.category).not.toBe('PASS');
    if (valueAssessment.category === 'STRONG_VALUE') {
        expect(valueAssessment.actionable).toBe(true);
    }
  });

  it('should reject if odds are missing or invalid (probability > 1)', async () => {
    const mock = generateMockMatch();
    const prediction = generatePrediction(mock.input);
    const valueAssessment = classifyRecommendation({
      fixtureId: 'live-test-invalid',
      league: 'EPL', season: '2023-2024', homeTeam: 'MockHome', awayTeam: 'MockAway', kickoff: new Date().toISOString(),
      quote: { market: 'moneyline', priceHome: 0.5, priceDraw: 3.0, priceAway: 3.0, bookmaker: 'Pinnacle', line: 0 }, // Invalid Odds
      selection: 'home',
      modelProb: prediction.ml_home_prob,
      confidence: prediction.final_confidence
    });
    
    // Implied prob of 0.5 odds is 2.0 (invalid)
    expect(valueAssessment.category).toBe('PASS');
    expect(valueAssessment.reason).toContain('ODDS_INVALID');
  });

  it('should reject if EV is below the minimum threshold', async () => {
    const mock = generateMockMatch();
    const prediction = generatePrediction(mock.input);
    // Artificially low odds to ensure negative EV
    const valueAssessment = classifyRecommendation({
      fixtureId: 'live-test-low-ev',
      league: 'EPL', season: '2023-2024', homeTeam: 'MockHome', awayTeam: 'MockAway', kickoff: new Date().toISOString(),
      quote: { market: 'moneyline', priceHome: 1.01, priceDraw: 10.0, priceAway: 10.0, bookmaker: 'Pinnacle', line: 0 },
      selection: 'home',
      modelProb: 0.10, // low probability
      confidence: 0.90
    });
    
    expect(valueAssessment.expectedValue).toBeLessThan(0);
    expect(valueAssessment.category).toBe('NO_VALUE');
  });
});
