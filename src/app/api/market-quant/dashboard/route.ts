import { NextRequest, NextResponse } from 'next/server';
import { MarketQualityEngine } from '../../../../lib/quant-market/market-quality-score';
import { MetaValueEngine } from '../../../../lib/quant-market/meta-value-score';
import { ClosingLineIntelligenceEngine } from '../../../../lib/quant-market/closing-line-intelligence';

export async function GET(req: NextRequest) {
  try {
    const mqReport = MarketQualityEngine.computeMarketQuality({
      overround: 0.024,
      volatility: 0.015,
      booksAvailable: 8,
      consensusDeviation: 0.008,
      leagueEfficiency: 0.94,
    });

    const metaReport = MetaValueEngine.computeMetaScore({
      expectedValue: 0.084,
      probEdge: 0.052,
      calibrationEce: 0.016,
      historicalRoi: 0.087,
      marketQualityScore: mqReport.score,
      leagueTrustScore: 92.5,
      predictedClv: 0.041,
      ciWidth: 0.08,
    });

    const closingLineProj = ClosingLineIntelligenceEngine.predictClosingLine(
      'fix-qm-101',
      'asian_handicap',
      2.05,
      0.58
    );

    return NextResponse.json({
      success: true,
      data: {
        marketQuality: mqReport,
        metaValueScore: metaReport,
        closingLineProjection: closingLineProj,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
