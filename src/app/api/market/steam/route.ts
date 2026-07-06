// HandicapLab Market Intelligence - Steam Moves Alerts API
// Location: src/app/api/market/steam/route.ts

import { NextResponse } from 'next/server';
import { MarketLogRepository } from '../../../../lib/data/marketLogRepository';
import { SteamMoveDetector } from '../../../../lib/market/steamDetector';
import { VolatilityEngine } from '../../../../lib/market/volatilityEngine';
import { MockMarketDataProvider } from '../../../../lib/market/mockProvider';

export async function GET() {
  try {
    const clvList = MarketLogRepository.getCLVResults();
    const provider = new MockMarketDataProvider();
    
    const alerts = [];

    for (const record of clvList) {
      const history = await provider.getMarketHistory(record.matchId, 'Pinnacle', 'ML');
      const detection = SteamMoveDetector.detect(history, record.predictedSelection as any, record.openingOdds, record.closingOdds);
      const volatility = VolatilityEngine.calculate(history);

      if (detection.steamScore >= 40 || volatility.volatilityScore >= 40) {
        alerts.push({
          matchId: record.matchId,
          predictedSelection: record.predictedSelection,
          steamScore: detection.steamScore,
          volatilityScore: volatility.volatilityScore,
          isSharpSteam: detection.isSharpSteam,
          isPublicSteam: detection.isPublicSteam,
          isReverseLine: detection.isReverseLineMovement,
          timestamp: new Date().toISOString()
        });
      }
    }

    return NextResponse.json({
      alertsCount: alerts.length,
      alerts
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
