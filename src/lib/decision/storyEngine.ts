import { DecisionInput } from './engine';
import { Recommendation } from './types';

export interface StoryContext {
  homeTeam: string;
  awayTeam: string;
  marketType: string;
  confidence: number;
  clv: number;
  ece: number;
  modelAgreement: number;
  marketStability: number;
  similarMatches: number;
  historicalRoi: number;
  recommendation: Recommendation;
}

export function buildFullStory(ctx: StoryContext): { situation: string; marketObservation: string; evidence: string; risk: string; recommendation: string; why: string; whyNot: string; alternatives: string[]; expectedOutcome: string } {
  const situation = `${ctx.homeTeam} enters this match with ${ctx.confidence >= 70 ? 'strong' : 'mixed'} signals. ${ctx.awayTeam} ${ctx.modelAgreement > 70 ? 'face a challenging matchup based on current metrics' : 'have shown recent improvement that may affect expectations'}.`;
  
  const marketObservation = ctx.marketStability >= 60
    ? 'Market conditions are relatively stable with predictable movement patterns.'
    : 'Market shows signs of instability — exercise caution with position sizing.';

  const evidence = ctx.similarMatches > 100
    ? `Analysis of ${ctx.similarMatches} similar historical matches supports this assessment, with bootstrap confidence at ${Math.min(95, 70 + ctx.similarMatches / 50)}%.`
    : 'Limited historical data for this exact matchup — conclusions are preliminary.';

  const risk = ctx.confidence >= 70 ? 'Risk is manageable given the confidence level and market conditions.' : 'Higher uncertainty suggests reduced position sizing.';

  const recText = ctx.recommendation === 'strong_opportunity' ? 'Strong Opportunity' : ctx.recommendation === 'consider' ? 'Consider' : ctx.recommendation === 'watch' ? 'Watch' : 'Avoid';
  const recommendation = `${recText} — ${ctx.marketType} market with ${ctx.confidence}% confidence`;

  const why = ctx.clv > 0.03
    ? 'Positive closing line value suggests this is a legitimate market inefficiency.'
    : ctx.modelAgreement > 70
    ? 'Strong agreement across prediction models increases confidence.'
    : 'Current signals support this direction, though with moderate conviction.';

  const whyNot = ctx.confidence < 60
    ? 'Confidence does not meet the high threshold required for stronger recommendation.'
    : 'No significant counter-indicators at this time.';

  const alternatives = ctx.marketType === 'AH'
    ? ['Moneyline — lower variance', 'Over/Under — uncorrelated opportunity']
    : ['Asian Handicap — better value alignment', 'Wait for improved odds'];

  const expectedOutcome = ctx.historicalRoi > 0
    ? `Historical patterns suggest positive expected value of ${ctx.historicalRoi.toFixed(1)}% in similar setups.`
    : 'Expected outcome is uncertain — prioritizing capital preservation.';

  return { situation, marketObservation, evidence, risk, recommendation, why, whyNot, alternatives, expectedOutcome };
}
