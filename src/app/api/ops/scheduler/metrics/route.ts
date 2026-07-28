import { NextResponse } from 'next/server';
import { getProviderHealth } from '@/lib/providers/quotaManager';
import { supabase } from '@/lib/supabase.server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Get Quota and Health Status
    const providerHealth = await getProviderHealth();

    // 2. Get Leagues Information
    const { data: leagues, error: leaguesError } = await supabase
      .from('league_efficiency')
      .select('*')
      .order('adaptive_priority', { ascending: false });

    if (leaguesError) {
      console.error('[DashboardAPI] Error fetching leagues:', leaguesError);
    }

    const activeLeagues = leagues?.filter(l => l.season_status === 'active') || [];
    
    // 3. Get Orchestrator Last Run Stats
    const { data: lastOrchestratorRun, error: auditError } = await supabase
      .from('audit_trail')
      .select('job_id, duration_ms, outcome, metadata, timestamp')
      .eq('trigger_source', 'orchestrator')
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (auditError) {
      console.error('[DashboardAPI] Error fetching audit trail:', auditError);
    }

    return NextResponse.json({
      success: true,
      data: {
        providers: providerHealth,
        leagues: {
          total: leagues?.length || 0,
          active: activeLeagues.length,
          list: leagues || [],
        },
        orchestrator: lastOrchestratorRun || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[DashboardAPI] Unhandled error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
