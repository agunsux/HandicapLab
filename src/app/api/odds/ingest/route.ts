// Ingest Odds Snapshot API Route
// Location: src/app/api/odds/ingest/route.ts

import { NextRequest } from 'next/server';
import { OddsIngestionService, OddsSnapshotInput } from '@/services/oddsIngestionService';
import { ApiHelper } from '@/lib/utils/apiHelper';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    const requiredFields = ['matchId', 'bookmaker', 'marketType', 'odds', 'source', 'timestamp'];
    for (const field of requiredFields) {
      if (!payload[field]) {
        return ApiHelper.response(false, null, `Missing required field: ${field}`, 400);
      }
    }

    const bookId = await OddsIngestionService.ingestSnapshot(payload as OddsSnapshotInput);
    if (!bookId) {
      return ApiHelper.response(false, null, 'Ingestion failed, database insert issue', 500);
    }

    return ApiHelper.response(true, { book_id: bookId, message: 'Odds snapshot ingested successfully' });
  } catch (error: any) {
    console.error('[Ingest Odds API] Error:', error);
    return ApiHelper.response(false, null, error.message, 500);
  }
}
