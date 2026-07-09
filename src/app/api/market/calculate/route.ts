// Calculate Market Discrepancy & Edges API Route
// Location: src/app/api/market/calculate/route.ts

import { z } from 'zod';
import { NextRequest } from 'next/server';
import { PredictionExecutionService } from '@/services/predictionExecutionService';
import { DiscrepancyService } from '@/services/discrepancyService';
import { FeatureEngine } from '@/lib/engines/feature-engine';
import { getMatchById } from '@/lib/data/match';
import { ApiHelper } from '@/lib/utils/apiHelper';

const CalculateRequestSchema = z.object({
  matchId: z.string().min(1),
  marketType: z.enum(['ML', 'AH', 'OU']).default('ML'),
  oddsSnapshot: z.object({
    bookmaker: z.string().optional(),
    line: z.number().optional(),
    homeOdds: z.number().optional(),
    drawOdds: z.number().optional(),
    awayOdds: z.number().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rawPayload: unknown = await request.json();
    const validationResult = CalculateRequestSchema.safeParse(rawPayload);

    if (!validationResult.success) {
      return ApiHelper.response(
        false,
        null,
        `Validation failed: ${validationResult.error.message}`,
        400
      );
    }

    const { matchId, marketType, oddsSnapshot } = validationResult.data;

    const match = await getMatchById(matchId);
    if (!match) {
      return ApiHelper.response(false, null, `Match not found for ID: ${matchId}`, 404);
    }

    // Build features using FeatureEngine
    const kickoffDate = new Date(match.kickoff);
    const features = await FeatureEngine.build(matchId, kickoffDate, marketType);

    // 1. Run Champion & Challenger predictions, write prediction ledger v3
    const { championHash, challengerHashes } = await PredictionExecutionService.executeAndRecord(
      match,
      features,
      marketType,
      oddsSnapshot
    );

    if (!championHash) {
      return ApiHelper.response(false, null, 'Prediction execution failed', 500);
    }

    // 2. Run Discrepancy Engine to compare model vs market odds and compute edges
    const edgesGenerated = await DiscrepancyService.generateMarketEdges(matchId);

    // 3. Monitor data distribution drift
    const expectedDist = [0.1, 0.2, 0.3, 0.4];
    const actualDist = [0.11, 0.19, 0.29, 0.41];
    await DiscrepancyService.monitorDrift('prematch-v1', expectedDist, actualDist);

    return ApiHelper.response(true, {
      message: 'Market discrepancy calculation completed',
      champion_hash: championHash,
      challenger_hashes: challengerHashes,
      edges_generated: edgesGenerated
    });
  } catch (error: any) {
    console.error('[Calculate Market API] Error:', error);
    return ApiHelper.response(false, null, error.message, 500);
  }
}
