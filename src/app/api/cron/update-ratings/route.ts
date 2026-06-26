import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { calculateTeamRatings } from '@/lib/engine/ratings';
import { CronLogger } from '@/lib/services/cronLogger';
import { runHealthCheck } from '@/lib/services/healthChecker';

export async function GET(request: Request) {
  return handleUpdateRatings(request);
}

export async function POST(request: Request) {
  return handleUpdateRatings(request);
}

async function handleUpdateRatings(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const logId = await CronLogger.start('update-ratings');

  console.log('[UpdateRatings Cron] Initiating ratings recalculation pipeline...');

  try {
    // 1. Fetch the last 50 finished matches
    const { data: recentMatches, error: fetchErr } = await supabase
      .from('matches')
      .select('home_team, away_team, home_goals, away_goals, league, kickoff')
      .eq('status', 'finished')
      .order('kickoff', { ascending: false })
      .limit(50);

    if (fetchErr) {
      throw new Error(`Failed to fetch recent matches: ${fetchErr.message}`);
    }

    if (!recentMatches || recentMatches.length === 0) {
      console.log('[UpdateRatings Cron] No finished matches found to calculate ratings.');
      await CronLogger.end(logId, 0, null);
      try {
        await runHealthCheck();
      } catch (hcErr) {
        console.error('[UpdateRatings Cron] Health check audit failed:', hcErr);
      }
      return NextResponse.json({ success: true, message: 'No matches found.' });
    }

    console.log(`[UpdateRatings Cron] Running ratings calculations on ${recentMatches.length} recent matches.`);

    // 2. Run ratings engine calculations
    const ratingsMap = calculateTeamRatings(recentMatches);
    const ratingsArray = Object.values(ratingsMap);

    if (ratingsArray.length === 0) {
      await CronLogger.end(logId, 0, null);
      try {
        await runHealthCheck();
      } catch (hcErr) {
        console.error('[UpdateRatings Cron] Health check audit failed:', hcErr);
      }
      return NextResponse.json({ success: true, message: 'No ratings to update.' });
    }

    // 3. Batch upsert the ratings into team_ratings table
    const upsertData = ratingsArray.map(r => ({
      team_id: r.team_id,
      team_name: r.team_name,
      league_id: r.league_id,
      attack_strength: r.attack_strength,
      defense_strength: r.defense_strength,
      matches_played: r.matches_played,
      updated_at: new Date().toISOString()
    }));

    const { error: upsertErr } = await supabase
      .from('team_ratings')
      .upsert(upsertData, { onConflict: 'team_id' });

    if (upsertErr) {
      throw new Error(`Failed to upsert team ratings: ${upsertErr.message}`);
    }

    console.log(`[UpdateRatings Cron] Successfully updated strengths for ${upsertData.length} teams.`);
    await CronLogger.end(logId, upsertData.length, null);
    try {
      await runHealthCheck();
    } catch (hcErr) {
      console.error('[UpdateRatings Cron] Health check audit failed:', hcErr);
    }
    return NextResponse.json({
      success: true,
      teamsUpdated: upsertData.length,
      ratings: upsertData
    });
  } catch (error: any) {
    console.error('[UpdateRatings Cron Fatal Error]:', error);
    await CronLogger.end(logId, 0, error);
    try {
      await runHealthCheck();
    } catch (hcErr) {
      console.error('[UpdateRatings Cron] Health check audit failed:', hcErr);
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
