import { NextRequest } from 'next/server';
import { ApiHelper } from '@/lib/utils/apiHelper';
import { OpportunitiesService } from '@/lib/homepage/opportunities/service';

// GET /api/v1/opportunities
// Returns real database-backed upcoming value opportunities.
export async function GET(request: NextRequest) {
  try {
    const result = await OpportunitiesService.getOpportunities();
    return ApiHelper.response(true, result);
  } catch (error: any) {
    console.error('[Opportunities API] Error:', error);
    return ApiHelper.response(false, null, error?.message || 'Unknown error', 500);
  }
}