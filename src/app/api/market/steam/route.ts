// HandicapLab Market Intelligence - Steam Moves Alerts API
// Location: src/app/api/market/steam/route.ts

import { NextResponse } from 'next/server';
import { SteamMoveDetector } from '../../../../lib/market/steamDetector';
import { VolatilityEngine } from '../../../../lib/market/volatilityEngine';

export async function GET() {
  try {
    const { MarketLogRepository } = await import('../../../../lib/data/marketLogRepository.runtime');
    const clvList = await MarketLogRepository.getCLVResults();
    
    const alerts = [];

    for (const record of clvList) {
      const history = await MarketLogRepository.getMovements(record.matchId);
      const events = (history || []).map((m, i) => ({
        id: `${record.matchId}-m-${i}`,
        eventType: 'OddsUpdated' as const,
        timestamp: m.timestamp,
        bookmaker: m.bookmaker,
        market: m.market,
        selection: (m.selection?.toLowerCase() || 'home') as any,
        oldOdds: m.oldOdds,
        newOdds: m.newOdds,
        impliedProbability: m.newOdds > 0 ? 1 / m.newOdds : 0.5,
        movementMagnitude: m.movementMagnitude || Math.abs(m.newOdds - m.oldOdds),
        movementDirection: m.movementDirection || (m.newOdds > m.oldOdds ? 'up' : m.newOdds < m.oldOdds ? 'down' : 'neutral'),
      }));

      const detection = SteamMoveDetector.detect(events, record.predictedSelection as any, record.openingOdds, record.closingOdds);
      const volatility = VolatilityEngine.calculate(events);

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
