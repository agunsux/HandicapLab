import { NextRequest, NextResponse } from 'next/server';
import { PublicLedgerEngine } from '../../../../lib/public-ledger/ledger-engine';
import { PublicVerifierEngine } from '../../../../lib/public-ledger/verifier-engine';

export async function GET(req: NextRequest) {
  try {
    const mockPublicPredictions = [
      PublicLedgerEngine.appendSettlement(
        PublicLedgerEngine.createPublicRecord({
          predictionNumber: 1,
          fixtureId: 'pub-fix-101',
          league: 'Premier League',
          homeTeam: 'Arsenal',
          awayTeam: 'Chelsea',
          kickoff: new Date(Date.now() - 86400000).toISOString(),
          market: 'asian_handicap',
          selection: 'home',
          modelProb: 0.585,
          ciLower: 0.54,
          ciUpper: 0.62,
          modelFairOdds: 1.709,
          bookmakerOdds: 2.05,
          probEdge: 0.08,
          expectedValue: 0.199,
          recommendation: 'STRONG_VALUE',
          modelVersion: 'v1.40.0',
          featureVersion: 'f-v2.5',
        }),
        1.95,
        'WIN'
      ),
      PublicLedgerEngine.appendSettlement(
        PublicLedgerEngine.createPublicRecord({
          predictionNumber: 2,
          fixtureId: 'pub-fix-102',
          league: 'La Liga',
          homeTeam: 'Real Madrid',
          awayTeam: 'Barcelona',
          kickoff: new Date(Date.now() - 172800000).toISOString(),
          market: 'moneyline',
          selection: 'home',
          modelProb: 0.530,
          ciLower: 0.48,
          ciUpper: 0.58,
          modelFairOdds: 1.887,
          bookmakerOdds: 2.15,
          probEdge: 0.05,
          expectedValue: 0.139,
          recommendation: 'VALUE',
          modelVersion: 'v1.40.0',
          featureVersion: 'f-v2.5',
        }),
        2.10,
        'WIN'
      ),
    ];

    const recordsWithVerification = mockPublicPredictions.map(rec => ({
      ...rec,
      verificationCertificate: PublicVerifierEngine.verifyRecord(rec),
    }));

    return NextResponse.json({
      success: true,
      count: recordsWithVerification.length,
      data: recordsWithVerification,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
