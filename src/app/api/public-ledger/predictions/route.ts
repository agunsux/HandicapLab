import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { PublicLedgerEngine } from '../../../../lib/public-ledger/ledger-engine';
import { PublicVerifierEngine } from '../../../../lib/public-ledger/verifier-engine';

export async function GET(req: NextRequest) {
  try {
    const { data: dbRecords, error } = await supabase
      .from('prediction_ledger_v3')
      .select('*, matches!inner(id, home_team, away_team, league, kickoff, status)')
      .order('prediction_timestamp', { ascending: false })
      .limit(50);

    if (error) throw error;

    const records = (dbRecords || []).map((row: any, i: number) => {
      const match = row.matches;
      const p = row.calibrated_probability || 0.5;
      const odds = row.market_odds || 2.0;
      const ev = row.expected_value ?? (p * odds - 1);
      const fairOdds = p > 0 ? Number((1 / p).toFixed(3)) : 2.0;

      const baseRecord = PublicLedgerEngine.createPublicRecord({
        predictionNumber: i + 1,
        fixtureId: String(match?.id || row.match_id),
        league: match?.league || 'League',
        homeTeam: match?.home_team || 'Home',
        awayTeam: match?.away_team || 'Away',
        kickoff: match?.kickoff || row.prediction_timestamp,
        market: row.market_type,
        selection: row.selection || 'home',
        modelProb: p,
        ciLower: Math.max(0.01, p - 0.05),
        ciUpper: Math.min(0.99, p + 0.05),
        modelFairOdds: fairOdds,
        bookmakerOdds: odds,
        probEdge: Number((p - (1 / odds)).toFixed(3)),
        expectedValue: Number(ev.toFixed(3)),
        recommendation: ev > 0.05 ? 'STRONG_VALUE' : 'VALUE',
        modelVersion: row.model_id || 'v1.40.0',
        featureVersion: row.feature_version || 'f-v2.5',
      });

      return {
        ...baseRecord,
        verificationCertificate: PublicVerifierEngine.verifyRecord(baseRecord),
      };
    });

    return NextResponse.json({
      success: true,
      data: records,
      count: records.length,
    });
  } catch (error: any) {
    console.error('Public Ledger Predictions Route Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
