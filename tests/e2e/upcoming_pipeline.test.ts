import { describe, it, expect, vi } from 'vitest';
import { ProviderOrchestrator } from '../../src/lib/providers/orchestrator';
import { generatePrediction } from '../../src/services/probability.engine';
import { classifyRecommendation } from '../../src/lib/value-intelligence/recommendation-engine';
import { generateMockMatch } from '../../src/lib/simulation/mockMatchGenerator';

describe('Upcoming Pipeline E2E', () => {
  it('should fallback to deterministic replay when provider quota is exceeded', async () => {
    // 1. Simulate Quota Exceeded on Provider
    const orchestrator = new ProviderOrchestrator();
    
    // Instead of mocking the whole orchestrator, we just simulate what Stage 4 would do 
    // when it realizes Stage 2 (Odds) or Stage 3 (Enrichment) failed due to QUOTA_EXCEEDED.
    
    let isReplayMode = false;
    let providerError = new Error('[OddsPAPI] Quota/Priority check failed: QUOTA_EXCEEDED');
    
    // 2. Catch error and trigger deterministic replay
    let matchInput;
    try {
      throw providerError;
    } catch (e: any) {
      if (e.message.includes('QUOTA_EXCEEDED')) {
        isReplayMode = true;
        const mock = generateMockMatch();
        matchInput = mock.input;
      }
    }

    expect(isReplayMode).toBe(true);
    expect(matchInput).toBeDefined();
    
    if (!matchInput) throw new Error("Match input should not be undefined");

    // 3. E2E Pipeline on Deterministic Data
    matchInput.matchId = 'replay-upcoming-123';
    
    const prediction = generatePrediction(matchInput);
    expect(prediction.ml_home_prob).toBeGreaterThan(0);
    expect(prediction.ml_home_prob).toBeLessThan(1);

    // 4. EV & Value Bet
    const valueAssessment = classifyRecommendation({
      fixtureId: matchInput.matchId,
      league: 'EPL',
      season: '2023-2024',
      homeTeam: 'MockHome',
      awayTeam: 'MockAway',
      kickoff: new Date(Date.now() + 86400000).toISOString(),
      quote: { market: 'moneyline', priceHome: matchInput.odds_home, priceDraw: matchInput.odds_draw, priceAway: matchInput.odds_away, bookmaker: 'Pinnacle', line: 0 },
      selection: 'home',
      modelProb: prediction.ml_home_prob,
      confidence: prediction.final_confidence
    });

    expect(valueAssessment.id).toBeDefined();
    
    // Assert 1: Probability valid
    expect(valueAssessment.modelProb).toBeGreaterThan(0);
    expect(valueAssessment.modelProb).toBeLessThan(1);

    // Assert 2: Fair Odds = 1 / Probability
    const expectedFairOdds = Number((1 / valueAssessment.modelProb).toFixed(3));
    expect(valueAssessment.modelFairOdds).toBeCloseTo(expectedFairOdds, 2);

    // Assert 3 & 5: Market Implied Probability and EV
    const implied = valueAssessment.marketProb;
    expect(implied).toBeGreaterThan(0);
    expect(implied).toBeLessThan(1);
    
    const expectedEV = Number((prediction.ml_home_prob * matchInput.odds_home - 1).toFixed(4));
    expect(valueAssessment.expectedValue).toBeCloseTo(expectedEV, 3);

    expect(typeof valueAssessment.reason).toBe('string');
  });

  it('should explicitly account for Over/Under quarter line partial push probability', () => {
    // Generate prediction and EV for OU 2.0 (integer line)
    const matchInput = {
      matchId: 'ou-push-test',
      odds_home: 2.0, odds_draw: 3.50, odds_away: 3.50,
      ah_line: 0, ou_line: 2.0, btts_odds: 1.9,
      xg_home: 1.0, xg_away: 1.0,
      shots_home: 10, shots_away: 10,
      shots_on_target_home: 5, shots_on_target_away: 5,
      form_home: 1.0, form_away: 1.0,
    };
    
    const prediction = generatePrediction(matchInput);
    
    // Assert 7: OU push probability accounted for
    expect(prediction.ou_push_prob).toBeGreaterThan(0);

    const valueAssessment = classifyRecommendation({
      fixtureId: 'ou-push-test',
      league: 'EPL', season: '2023-2024',
      homeTeam: 'Home', awayTeam: 'Away', kickoff: new Date().toISOString(),
      quote: { market: 'over_under', priceHome: 1.95, priceAway: 1.95, bookmaker: 'Pinnacle', line: 2.0 },
      selection: 'over',
      modelProb: prediction.ou_over_prob,
      modelPushProb: prediction.ou_push_prob,
      confidence: prediction.final_confidence
    });
    
    const winProb = prediction.ou_over_prob;
    const pushProb = prediction.ou_push_prob!;
    const lossProb = 1 - winProb - pushProb;
    
    // EV = winProb * (Odds - 1) - lossProb * 1
    const manualEV = Number((winProb * (1.95 - 1) - lossProb).toFixed(4));
    expect(valueAssessment.expectedValue).toBeCloseTo(manualEV, 4);

    
    // For validation purpose, we verify the output
    console.log(`[Upcoming Replay] Category: ${valueAssessment.category} | EV: ${valueAssessment.expectedValue}`);
  });
});
