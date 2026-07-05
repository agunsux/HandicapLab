require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const csv = require('csv-parser')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BATCH_SIZE = 500

function toFloat(v) {
  return v === '' || v === undefined ? null : parseFloat(v)
}

function toInt(v) {
  return v === '' || v === undefined ? null : parseInt(v)
}

function parseDate(v) {
  if (!v) return null
  if (v.includes('-')) {
    const parts = v.split('-')
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return v
      }
      return `${parts[2]}-${parts[1]}-${parts[0]}`
    }
  }
  const parts = v.split('/')
  if (parts.length !== 3) return null
  let [d, m, y] = parts
  if (y.length === 2) {
    y = `20${y}`
  }
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

async function flush(batch) {
  try {
    const { error } = await supabase
      .from('raw_matches')
      .insert(batch)

    if (error) {
      console.error('INSERT ERROR:', error.message)
      return { success: false, failedCount: batch.length }
    } else {
      console.log(`Inserted batch: ${batch.length}`)
      return { success: true, failedCount: 0 }
    }
  } catch (err) {
    console.error('EXCEPTION DURING INSERT:', err.message)
    return { success: false, failedCount: batch.length }
  }
}

function processFile(filePath, league, season) {
  return new Promise((resolve) => {
    const batch = []
    let failedRows = 0
    let totalRows = 0

    const stream = fs.createReadStream(filePath).pipe(csv())

    stream.on('data', async (row) => {
      if (!row.Date || !row.HomeTeam) return;

      batch.push({
        league,
        league_code: league,
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

        result: row.FTR || 'D',
        source_file: filePath
      })

      totalRows++

      if (batch.length >= BATCH_SIZE) {
        stream.pause()
        const copy = [...batch]
        batch.length = 0
        const res = await flush(copy)
        if (!res.success) {
          failedRows += res.failedCount
        }
        stream.resume()
      }
    })

    stream.on('end', async () => {
      if (batch.length > 0) {
        const res = await flush(batch)
        if (!res.success) {
          failedRows += res.failedCount
        }
      }
      console.log(`Finished ${filePath} | Total Rows: ${totalRows} | Failed Rows: ${failedRows}`)
      resolve(failedRows)
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
