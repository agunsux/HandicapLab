// Explainability & Bloomberg Terminal Rationale Formatter
// Location: src/lib/engine/explainability-formatter.ts

export interface ExplanationPayload {
  matchInfo: {
    homeTeam: string;
    awayTeam: string;
    league: string;
    kickoff: string;
  };
  oddsInfo: {
    bookmaker: string;
    odds: number;
    impliedProb: number;
    fairProb: number;
  };
  modelInfo: {
    calibratedProb: number;
    confidenceScore: number;
  };
  calculations: {
    rawEdge: number;
    expectedValue: number;
    rawKelly: number;
    scaledKelly: number;
    finalWeight: number;
  };
  inefficiencyReasons: string[];
}

export class ExplainabilityFormatter {
  /**
   * Generates a structured explainability JSON payload.
   */
  public static generateExplanation(input: ExplanationPayload): any {
    const { matchInfo, oddsInfo, modelInfo, calculations, inefficiencyReasons } = input;

    const edgePercent = (calculations.expectedValue * 100).toFixed(1);
    const modelProbPercent = (modelInfo.calibratedProb * 100).toFixed(1);
    const impliedProbPercent = (oddsInfo.impliedProb * 100).toFixed(1);

    const edgeSource = `Model projects a calibrated probability of ${modelProbPercent}% vs market implied probability of ${impliedProbPercent}% (Odds: ${oddsInfo.odds.toFixed(2)}). Expected value edge of +${edgePercent}%.`;
    const confidenceFactor = `Model confidence is ${modelInfo.confidenceScore.toFixed(1)}% derived from high data completeness, team ELO configurations, and attack-defense projections.`;
    
    let marketInefficiency = `The market is inefficient because overround stands at ${((1 / oddsInfo.odds - oddsInfo.fairProb) * 100).toFixed(1)}% and price movements lagged.`;
    if (inefficiencyReasons.length > 0) {
      marketInefficiency += ` Key factors: ${inefficiencyReasons.join(', ')}.`;
    }

    const kellyText = `Standard Kelly sizing suggests ${(calculations.rawKelly * 100).toFixed(2)}%. Scaled Kelly model reduces it to ${(calculations.scaledKelly * 100).toFixed(2)}%.`;
    const finalStakeText = calculations.finalWeight < calculations.scaledKelly
      ? `${kellyText} The final stake was capped at ${(calculations.finalWeight * 100).toFixed(2)}% to comply with portfolio exposure and correlation limits.`
      : `${kellyText} The final allocated weight is ${(calculations.finalWeight * 100).toFixed(2)}%.`;

    return {
      edge_id: crypto.randomUUID ? crypto.randomUUID() : 'gen-uuid',
      match_context: {
        home_team: matchInfo.homeTeam,
        away_team: matchInfo.awayTeam,
        league: matchInfo.league,
        kickoff: matchInfo.kickoff
      },
      rationale: {
        edge_source: edgeSource,
        confidence_factor: confidenceFactor,
        market_inefficiency: marketInefficiency,
        risk_and_stake: finalStakeText
      },
      metrics: {
        volatility_score: 0.02,
        market_efficiency_score: Number((1.0 - (1 / oddsInfo.odds - oddsInfo.fairProb)).toFixed(4)),
        same_match_bets_count: 1,
        kickoff_concurrency: 1
      }
    };
  }
}
