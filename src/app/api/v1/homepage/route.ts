import { NextRequest } from 'next/server';
import { ApiHelper } from '@/lib/utils/apiHelper';
import { HomepageService } from '@/lib/homepage/service';

// GET /api/v1/homepage
// Combined historical + live payload for the homepage dashboard.
export async function GET(request: NextRequest) {
  try {
    const data = await HomepageService.getHomepageData();
    return ApiHelper.response(true, data);
  } catch (error: any) {
    console.error('[Homepage API] Error:', error);
    return ApiHelper.response(false, null, error?.message || 'Unknown error', 500);
  }
}