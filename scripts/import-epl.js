const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const csv = require('csv-parser')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

const BATCH_SIZE = 500

function toFloat(v) {
  return v === '' || v === undefined ? null : parseFloat(v)
}

function toInt(v) {
  return v === '' || v === undefined ? null : parseInt(v)
}

function parseDate(v) {
  const [d, m, y] = v.split('/')
  return new Date(`20${y}-${m}-${d}`)
}

async function flush(batch) {
  const { error } = await supabase
    .from('raw_matches')
    .insert(batch)

  if (error) {
    console.error('INSERT ERROR:', error.message)
  } else {
    console.log(`Inserted batch: ${batch.length}`)
  }
}

function processFile(filePath, league, season) {
  return new Promise((resolve) => {
    const batch = []

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', async (row) => {
        batch.push({
          league,
          season,
          match_date: parseDate(row.Date),

          home_team: row.HomeTeam,
          away_team: row.AwayTeam,

          full_time_home_goals: toInt(row.FTHG),
          full_time_away_goals: toInt(row.FTAG),

          home_odds: toFloat(row.B365H),
          draw_odds: toFloat(row.B365D),
          away_odds: toFloat(row.B365A),

          over25_odds: toFloat(row['B365>2.5']),
          under25_odds: toFloat(row['B365<2.5']),

          source_file: filePath
        })

        if (batch.length >= BATCH_SIZE) {
          const copy = batch.splice(0, batch.length)
          await flush(copy)
        }
      })
      .on('end', async () => {
        if (batch.length > 0) {
          await flush(batch)
        }
        resolve()
      })
  })
}

async function run() {
  const files = [
    { path: './data/EPL/2020-2021.csv', season: '2020-2021' },
    { path: './data/EPL/2021-2022.csv', season: '2021-2022' },
    { path: './data/EPL/2022-2023.csv', season: '2022-2023' },
    { path: './data/EPL/2023-2024.csv', season: '2023-2024' },
    { path: './data/EPL/2024-2025.csv', season: '2024-2025' },
    { path: './data/EPL/2025-2026.csv', season: '2025-2026' }
  ]

  for (const f of files) {
    console.log(`Processing ${f.path}`)
    await processFile(f.path, 'EPL', f.season)
  }

  console.log('DONE')
}

run()
