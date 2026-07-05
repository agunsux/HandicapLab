require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BATCH_SIZE = 500

async function run() {
  console.log('[ETL] Starting match features build pipeline...')

  // Step 1: Truncate existing match features
  const { error: truncateErr } = await supabase
    .from('match_features')
    .delete()
    .neq('id', 0) // Truncate equivalent in Supabase REST client

  if (truncateErr) {
    console.error('[ETL] Truncate failed:', truncateErr.message)
    process.exit(1)
  }
  console.log('[ETL] Cleared existing match_features records.')

  // Step 2: Fetch all raw matches using pagination loop
  console.log('[ETL] Fetching all raw_matches records...')
  let rawMatches = []
  let from = 0
  let to = 999
  let hasMore = true

  while (hasMore) {
    const { data, error: fetchErr } = await supabase
      .from('raw_matches')
      .select('*')
      .range(from, to)

    if (fetchErr) {
      console.error('[ETL] Fetching raw matches failed:', fetchErr.message)
      process.exit(1)
    }

    rawMatches = rawMatches.concat(data)
    if (data.length < 1000) {
      hasMore = false
    } else {
      from += 1000
      to += 1000
    }
  }

  const totalRows = rawMatches.length
  let insertedCount = 0
  let skippedCount = 0
  const batch = []

  // Step 3: Transformation loop
  for (const row of rawMatches) {
    const ho = row.home_odds
    const do_odds = row.draw_odds
    const ao = row.away_odds

    // Skip row if moneyline odds are missing
    if (ho === null || do_odds === null || ao === null || ho <= 1 || do_odds <= 1 || ao <= 1) {
      skippedCount++
      continue
    }

    const homeProb = 1.0 / ho
    const drawProb = 1.0 / do_odds
    const awayProb = 1.0 / ao
    const overround = (homeProb + drawProb + awayProb) - 1.0

    const goalsHome = row.full_time_home_goals !== null ? row.full_time_home_goals : 0
    const goalsAway = row.full_time_away_goals !== null ? row.full_time_away_goals : 0
    const goalTotal = goalsHome + goalsAway

    batch.push({
      match_id: row.id,
      league: row.league || 'EPL',
      season: row.season,
      match_date: row.match_date,
      home_team: row.home_team,
      away_team: row.away_team,
      home_odds: ho,
      draw_odds: do_odds,
      away_odds: ao,
      over25_odds: row.over25_odds,
      under25_odds: row.under25_odds,
      home_implied_prob: homeProb,
      draw_implied_prob: drawProb,
      away_implied_prob: awayProb,
      market_overround: overround,
      goal_total: goalTotal
    })

    if (batch.length >= BATCH_SIZE) {
      const { error: insertErr } = await supabase
        .from('match_features')
        .insert(batch)

      if (insertErr) {
        console.error('[ETL] Ingest batch failed:', insertErr.message)
      } else {
        insertedCount += batch.length
        console.log(`Inserted batch: ${batch.length} rows`)
      }
      batch.length = 0
    }
  }

  // Insert remaining rows
  if (batch.length > 0) {
    const { error: insertErr } = await supabase
      .from('match_features')
      .insert(batch)

    if (insertErr) {
      console.error('[ETL] Ingest batch failed:', insertErr.message)
    } else {
      insertedCount += batch.length
      console.log(`Inserted final batch: ${batch.length} rows`)
    }
  }

  console.log(`
Processed: ${totalRows} rows
Inserted: ${insertedCount} rows
Skipped: ${skippedCount} rows (missing odds)
DONE
  `)
}

run().catch(console.error)
