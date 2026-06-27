import { supabase } from '../lib/supabase.server';
import { STATIC_LEAGUES } from '../lib/data/leagues';
import { STATIC_TEAMS } from '../lib/data/teams';

async function seedData() {
  console.log('🌱 Seeding initial Programmatic SEO cache datasets for Competition Hub & Calibration Ledger...');

  try {
    // 1. Seed Leagues/Competitions
    for (const league of STATIC_LEAGUES) {
      console.log(`Seeding competition: ${league.name} (${league.competition_type})`);
      await supabase.from('leagues_cache').upsert({
        api_id: league.api_id,
        name: league.name,
        slug: league.slug,
        country: league.country,
        logo_url: league.logo_url,
        season: league.season,
        stats_json: league.stats,
        competition_type: league.competition_type,
        format: league.format,
        region: league.region,
        priority: league.priority,
        featured: league.featured,
        
        // Quality metrics
        market_efficiency_score: league.market_efficiency_score,
        sample_size_score: league.sample_size_score,
        data_quality_score: league.data_quality_score,
        edge_potential_score: league.edge_potential_score,
        model_confidence_score: league.model_confidence_score,
        historical_accuracy: league.historical_accuracy,
        
        // Active season
        season_status: league.season_status,
        current_season: league.current_season,
        is_currently_active: league.is_currently_active,
        featured_calibration: league.featured_calibration,
        
        // Future weights
        home_advantage: league.home_advantage,
        season_xg: league.season_xg,
        form_weight: league.form_weight,
        rotation_risk: league.rotation_risk,
        two_leg_factor: league.two_leg_factor,
        aggregate_score: league.aggregate_score,
        neutral_venue: league.neutral_venue,
        knockout_pressure: league.knockout_pressure,
        fatigue_factor: league.fatigue_factor,
        updated_at: new Date()
      }, { onConflict: 'api_id' });

      // Upsert metrics to competition_metrics
      const hasMetrics = league.matches_count > 0 || league.prediction_accuracy !== null;
      if (hasMetrics) {
        console.log(`Seeding calibration metrics for: ${league.name}`);
        await supabase.from('competition_metrics').upsert({
          competition_id: league.api_id,
          matches_count: league.matches_count,
          prediction_accuracy: league.prediction_accuracy,
          roi_simulation: league.roi_simulation,
          closing_line_accuracy: league.closing_line_accuracy,
          over25_accuracy: league.over25_accuracy,
          btts_accuracy: league.btts_accuracy,
          handicap_accuracy: league.handicap_accuracy,
          sample_confidence: league.sample_confidence,
          last_calculated_at: new Date(),
          updated_at: new Date()
        }, { onConflict: 'competition_id' });
      }
    }

    // 2. Seed Teams
    for (const team of STATIC_TEAMS) {
      console.log(`Seeding team: ${team.name}`);
      await supabase.from('teams_cache').upsert({
        api_id: team.api_id,
        name: team.name,
        slug: team.slug,
        league_id: team.league_id,
        logo_url: team.logo_url,
        form_json: team.form,
        stats_json: team.stats,
        updated_at: new Date()
      }, { onConflict: 'api_id' });
    }

    console.log('🎉 Seeding successfully executed!');
  } catch (err: any) {
    console.warn('⚠️ Seeding failed/skipped due to database connection constraints.', err.message);
  }
  process.exit(0);
}

seedData();
