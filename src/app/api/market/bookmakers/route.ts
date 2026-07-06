// HandicapLab Market Intelligence - Bookmakers Consensus API
// Location: src/app/api/market/bookmakers/route.ts

import { NextResponse } from 'next/server';
import { MockMarketDataProvider } from '../../../../lib/market/mockProvider';

export async function GET() {
  try {
    const provider = new MockMarketDataProvider();
    const books = ['Pinnacle', 'SBO', 'Bet365', 'Orbit', 'Betfair', 'PS3838'];
    
    const results = [];
    for (const book of books) {
      const metadata = await provider.getBookmakerMetadata(book);
      const sampleOdds = await provider.getCurrentOdds('sample-match', book, 'ML');
      results.push({
        bookmaker: book,
        metadata,
        currentOddsSample: sampleOdds
      });
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      bookmakers: results
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
// 
