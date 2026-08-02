import { describe, it, expect } from 'vitest';
import { FootballDataCSVAdapter } from '../../src/lib/data-platform/footballDataCSVAdapter';
import { generatePrediction } from '../../src/services/probability.engine';
import { classifyRecommendation } from '../../src/lib/value-intelligence/recommendation-engine';

describe('Historical Pipeline E2E', () => {
  it('should successfully ingest, predict, and calculate EV for a historical row', () => {
    // 1. Mock Data Source (Historical CSV Row)
    const mockRow = {
      Div: 'E0',
      Date: '11/08/2023',
      Time: '20:00',
      HomeTeam: 'Burnley',
      AwayTeam: 'Man City',
      FTHG: '0',
      FTAG: '3',
      FTR: 'A',
      HS: '6',
      AS: '17',
      HST: '1',
      AST: '8',
      B365H: '8.50',
      B365D: '5.50',
      B365A: '1.33'
    };

    // 2. Normalization
    const parsed = FootballDataCSVAdapter.parseCSVRow(mockRow, 0, 'E0_2324.csv');
    
    expect(parsed.fixture.home_team_id).toBe('burnley');
    expect(parsed.fixture.away_team_id).toBe('mancity');
    
    // Extract odds
    const mlHomeOdds = parsed.oddsClose.find(o => o.selection === 'home' && o.marketType === 'ML')?.oddsDecimal || 2.0;

    // 3. Feature Engineering & Match Input
    const matchInput = {
      matchId: 'burnley-mancity-test',
      odds_home: mlHomeOdds,
      odds_draw: 5.50,
      odds_away: 1.33,
      ah_line: 0,
      ou_line: 2.5,
      btts_odds: 1.9,
      xg_home: (parsed.fixture.home_shots || 0) * 0.1 || 1.35,
      xg_away: (parsed.fixture.away_shots || 0) * 0.1 || 1.15,
      shots_home: parsed.fixture.home_shots || 10,
      shots_away: parsed.fixture.away_shots || 10,
      shots_on_target_home: parsed.fixture.home_shots_on_target || 4,
      shots_on_target_away: parsed.fixture.away_shots_on_target || 4,
      form_home: 1.5,
      form_away: 1.5,
    };

    // 4. Model Prediction
    const prediction = generatePrediction(matchInput);
    expect(prediction.ml_home_prob).toBeGreaterThan(0);
    expect(prediction.ml_home_prob).toBeLessThan(1);

    // 5. Fair Odds & EV & Value Bet Detection
    const valueAssessment = classifyRecommendation({
      fixtureId: matchInput.matchId,
      league: 'EPL',
      season: '2023-2024',
      homeTeam: mockRow.HomeTeam,
      awayTeam: mockRow.AwayTeam,
      kickoff: parsed.fixture.kickoff,
      quote: { market: 'moneyline', priceHome: mlHomeOdds, priceDraw: 5.50, priceAway: 1.33, bookmaker: 'Pinnacle', line: 0 },
      selection: 'home',
      modelProb: prediction.ml_home_prob,
      confidence: prediction.final_confidence
    });

    expect(valueAssessment.id).toBeDefined();
    expect(valueAssessment.category).toBeDefined();
    
    // Assert 1: Probability mathematically valid
    expect(valueAssessment.modelProb).toBeGreaterThan(0);
    expect(valueAssessment.modelProb).toBeLessThan(1);
    
    // Assert 2: Fair odds = 1 / probability (rounded)
    const expectedFairOdds = Number((1 / valueAssessment.modelProb).toFixed(3));
    expect(valueAssessment.modelFairOdds).toBeCloseTo(expectedFairOdds, 2);
    
    // Assert 3: Implied probability = 1 / market odds (for binary/AH, but here it's 3-way moneyline, so vig removed)
    // The exact formula for 3-way vig removal applies, but impliedProb should be > 0 and < 1.
    expect(valueAssessment.marketProb).toBeGreaterThan(0);
    expect(valueAssessment.marketProb).toBeLessThan(1);
    
    // Assert 4: Edge correctly calculated
    const expectedEdge = Number((valueAssessment.modelProb - valueAssessment.marketProb).toFixed(4));
    expect(valueAssessment.probEdge).toBeCloseTo(expectedEdge, 4);
    
    // Assert 5: EV correctly calculated (binary ML here, EV = prob * odds - 1)
    const expectedEV = Number((prediction.ml_home_prob * mlHomeOdds - 1).toFixed(4));
    expect(valueAssessment.expectedValue).toBeCloseTo(expectedEV, 3);

    // Assert 10/11: Qualification/rejection reason exists
    expect(typeof valueAssessment.reason).toBe('string');
    if (valueAssessment.expectedValue < 0) {
      expect(valueAssessment.category).toBe('NO_VALUE');
    }
  });

  it('should explicitly account for Asian Handicap push probability', () => {
    // Generate prediction and EV for AH with an integer line to test Push
    const matchInput = {
      matchId: 'ah-push-test',
      odds_home: 1.95, odds_draw: 3.50, odds_away: 4.0,
      ah_line: -1.0, ou_line: 2.5, btts_odds: 1.9,
      xg_home: 2.5, xg_away: 1.0,
      shots_home: 15, shots_away: 5,
      shots_on_target_home: 7, shots_on_target_away: 2,
      form_home: 1.8, form_away: 1.0,
    };
    const prediction = generatePrediction(matchInput);
    
    // Asserts that push probability is populated
    expect(prediction.ah_push_prob).toBeGreaterThan(0);
    
    const valueAssessment = classifyRecommendation({
      fixtureId: 'ah-push-test',
      league: 'EPL',
      season: '2023-2024',
      homeTeam: 'Home', awayTeam: 'Away', kickoff: new Date().toISOString(),
      quote: { market: 'asian_handicap', priceHome: 1.95, priceAway: 1.95, bookmaker: 'Pinnacle', line: -1.0 },
      selection: 'home',
      modelProb: prediction.ah_home_prob,
      modelPushProb: prediction.ah_push_prob,
      confidence: prediction.final_confidence
    });
    
    // Assert 6: AH push probability accounted for in EV calculation
    // EV = winProb * (odds - 1) - lossProb * 1
    const winProb = prediction.ah_home_prob;
    const pushProb = prediction.ah_push_prob!;
    const lossProb = 1 - winProb - pushProb;
    const manualEV = Number((winProb * (1.95 - 1) - lossProb).toFixed(4));
    
    expect(valueAssessment.expectedValue).toBeCloseTo(manualEV, 4);
    expect(valueAssessment.modelProb).toBeCloseTo(winProb + 0.5 * pushProb, 4); // Effective prob
  });
});
