import { supabase } from '../lib/supabase.server';
import { STATIC_LEAGUES } from '../lib/data/leagues';
import { STATIC_TEAMS } from '../lib/data/teams';

async function seedData() {
  console.log('🌱 Seeding initial Programmatic SEO cache datasets for Competition Hub...');

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
    console.warn('⚠️ Seeding failed/skipped due to invalid database parameters.', err.message);
  }
  process.exit(0);
}

seedData();
