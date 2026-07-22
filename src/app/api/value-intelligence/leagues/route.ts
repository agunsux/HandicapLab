import { NextRequest, NextResponse } from 'next/server';
import { LeagueIntelligenceEngine } from '../../../../lib/value-intelligence/league-intelligence';

export async function GET(req: NextRequest) {
  try {
    const ranked = LeagueIntelligenceEngine.getRankedLeagues();
    return NextResponse.json({
      success: true,
      count: ranked.length,
      data: ranked,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
