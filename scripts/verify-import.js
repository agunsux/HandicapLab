require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function verify() {
  console.log('[Verification] Fetching row count in raw_matches...')
  const { count, error } = await supabase
    .from('raw_matches')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.error('Error fetching count:', error.message)
    return
  }
  console.log(`[Verification] Total matches in raw_matches table: ${count}`)

  console.log('\n[Verification] Fetching sample 5 matches with odds data...')
  const { data: matches, error: fetchErr } = await supabase
    .from('raw_matches')
    .select('league, season, match_date, home_team, away_team, full_time_home_goals, full_time_away_goals, home_odds, draw_odds, away_odds, over25_odds, under25_odds')
    .order('match_date', { ascending: true })
    .limit(5)

  if (fetchErr) {
    console.error('Error fetching sample:', fetchErr.message)
    return
  }
  console.table(matches)
}

verify().catch(console.error)
