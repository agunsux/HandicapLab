// Generate Portfolio API Route
// Location: src/app/api/portfolio/generate/route.ts

import { NextRequest } from 'next/server';
import { PortfolioService, PortfolioConfigInput } from '@/services/portfolioService';
import { ApiHelper } from '@/lib/utils/apiHelper';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    const config: PortfolioConfigInput = {
      bankroll: parseFloat(payload.bankroll || '10000'),
      riskTolerance: parseFloat(payload.riskTolerance || '0.02'),
      maxExposure: parseFloat(payload.maxExposure || '0.20'),
      maxLeagueExposure: parseFloat(payload.maxLeagueExposure || '0.10'),
      maxBookmakerExposure: parseFloat(payload.maxBookmakerExposure || '0.15'),
      minConfidence: parseFloat(payload.minConfidence || '60.0'),
      minEV: parseFloat(payload.minEV || '0.02'),
      stakingModel: payload.stakingModel || 'half_kelly'
    };

    const portfolio = await PortfolioService.generatePortfolio(config);
    if (!portfolio) {
      return ApiHelper.response(false, null, 'No portfolio generated, check available edges', 200);
    }

    return ApiHelper.response(true, portfolio);
  } catch (error: any) {
    console.error('[Generate Portfolio API] Error:', error);
    return ApiHelper.response(false, null, error.message, 500);
  }
}
