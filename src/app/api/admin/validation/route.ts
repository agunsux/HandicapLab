import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase.server';
import { LEAGUE_REGISTRY } from '../../../../lib/crons/leagueRegistry';
import { requireAdmin } from '../../../../lib/auth/admin';

/**
 * Admin validation dashboard endpoint
 * Returns aggregated signal counts grouped by market type, league cohort,
 * confidence bucket, and premium eligibility.
 */
export async function GET(request: Request) {
  try {
    // Enforce admin authorization
    await requireAdmin(request);
    const url = new URL(request.url);
    const cohort = url.searchParams.get('cohort') || 'all';
    const market = url.searchParams.get('market') || 'all';

    // Fetch all settled signals
    const { data: signals, error } = await supabase
      .from('signals')
      .select('*')
      .not('settled_at', 'is', null);
    if (error) throw error;

    // Exclude signals that are rejected, have invalid odds, or missing reference book
    const filteredSignals = (signals ?? []).filter((s) => {
      const status = (s.status || '').toLowerCase();
      const oddsValid = s.odds !== null && s.odds !== undefined && Number(s.odds) > 0;
      const hasRef = s.reference_book && s.reference_book.trim().length > 0;
      return status !== 'rejected' && oddsValid && hasRef;
    });

    // Apply cohort/market filters on the already cleaned signal set
    const filtered = filteredSignals.filter((s) => {
      const matchesCohort = cohort === 'all' || s.league_cohort === cohort;
      const matchesMarket = market === 'all' || s.market === market;
      return matchesCohort && matchesMarket;
    });

    // Aggregation structures
    const result: any = {
      total: 0,
      settled: 0,
      pending: 0,
      rejected: 0,
      byMarket: {},
      byCohort: {},
      byConfidence: {},
      byPremium: { eligible: 0, ineligible: 0 },
    };

    filtered.forEach((sig) => {
      result.total++;
      // status categories (assuming status field exists)
      const st = (sig.status || 'pending').toLowerCase();
      if (st === 'settled') result.settled++;
      else if (st === 'rejected') result.rejected++;
      else result.pending++;

      // market grouping
      const mkt = sig.market || 'unknown';
      result.byMarket[mkt] = (result.byMarket[mkt] || 0) + 1;

      // cohort grouping
      const coh = sig.league_cohort || 'other';
      result.byCohort[coh] = (result.byCohort[coh] || 0) + 1;

      // confidence bucket (using sample_confidence_score already computed in performance route)
      const score = sig.sample_confidence_score ?? 0;
      let bucket = 'insufficient';
      if (score >= 85) bucket = 'validated';
      else if (score >= 70) bucket = 'strong';
      else if (score >= 40) bucket = 'developing';
      result.byConfidence[bucket] = (result.byConfidence[bucket] || 0) + 1;

      // premium eligibility flag (assumes column premium_eligible boolean exists)
      if (sig.premium_eligible) result.byPremium.eligible++;
      else result.byPremium.ineligible++;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
