import { NextRequest, NextResponse } from 'next/server';
import { HallEngine } from '../../../../lib/public-ledger/hall-engine';

export async function GET(req: NextRequest) {
  try {
    const hallOfFame = HallEngine.getHallOfFame();
    const hallOfShame = HallEngine.getHallOfShame();

    return NextResponse.json({
      success: true,
      data: {
        hallOfFame,
        hallOfShame,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
