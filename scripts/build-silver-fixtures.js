/**
 * Silver Canonical Fixture Store — Merge Engine
 *
 * Reads directly from stable source files:
 *   - data/bronze/EPL/{season}_understat.json (git-tracked Understat match data)
 *   - data/bronze/football_data/{season}.csv      (Football-Data results + odds)
 *
 * Output: data/silver/fixtures/epl/{season}/fixtures.json
 */

const fs = require('fs');
const crypto = require('crypto');

const SEASONS = ['2015-2016','2016-2017','2017-2018','2018-2019','2019-2020',
                 '2020-2021','2021-2022','2022-2023','2023-2024','2024-2025','2025-2026'];

function parseCsv(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((h, j) => { row[h] = (values[j] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

function readUnderstatMatches(filepath) {
  if (!fs.existsSync(filepath)) return null;
  let raw = fs.readFileSync(filepath, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); // Strip BOM
  return JSON.parse(raw);
}

async function run() {
  console.log('=== Silver Canonical Fixture Store ===\n');
  let totalMerged = 0;

  for (const season of SEASONS) {
    // Read Understat from stable source file (git-tracked)
    const usFile = `data/bronze/EPL/${season}_understat.json`;
    const us = readUnderstatMatches(usFile);
    if (!us) { console.log(`  SKIP ${season}: no Understat source`); continue; }

    // Read Football-Data CSV
    const csvFile = `data/bronze/football_data/${season}.csv`;
    if (!fs.existsSync(csvFile)) { console.log(`  SKIP ${season}: no CSV`); continue; }
    const csv = parseCsv(fs.readFileSync(csvFile, 'utf8'));

    // Index Understat by (date, home, away)
    const usIndex = {};
    for (const m of us) {
      const d = m.datetime?.substring(0, 10);
      const h = m.h?.title?.trim();
      const a = m.a?.title?.trim();
      if (!d || !h || !a) continue;
      usIndex[`${d}|${h}|${a}`] = {
        d, h, a, hx: m.h?.xG, ax: m.a?.xG,
        hg: m.goals?.h, ag: m.goals?.a,
        id: m.id, dt: m.datetime
      };
    }

    // Index Football-Data by (date, home, away)
    const fdIndex = {};
    for (const r of csv) {
      if (!r.Date || !r.HomeTeam) continue;
      const p = r.Date.split('/');
      if (p.length !== 3) continue;
      let y = p[2];
      if (y.length === 2) y = '20' + y;
      const d = `${y}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
      const h = r.HomeTeam.trim();
      const a = r.AwayTeam.trim();
      fdIndex[`${d}|${h}|${a}`] = {
        d, h, a,
        hg: r.FTHG === '' ? null : +r.FTHG,
        ag: r.FTAG === '' ? null : +r.FTAG,
        res: r.FTR, oH: r.B365H === '' ? null : +r.B365H,
        oD: r.B365D === '' ? null : +r.B365D,
        oA: r.B365A === '' ? null : +r.B365A,
        o25: r['B365>2.5'] === '' ? null : +r['B365>2.5'],
        u25: r['B365<2.5'] === '' ? null : +r['B365<2.5']
      };
    }

    // Merge
    const fixtures = [];
    const matchedKeys = new Set();
    let merged = 0, usOnly = 0, fdOnly = 0, mismatches = 0;

    for (const [key, u] of Object.entries(usIndex)) {
      const fr = fdIndex[key];
      if (fr) {
        matchedKeys.add(key);
        merged++;
        const scoreMatch = (u.hg === null || fr.hg === null || u.hg === fr.hg) &&
                          (u.ag === null || fr.ag === null || u.ag === fr.ag);
        if (!scoreMatch) mismatches++;

        fixtures.push({
          fixture_id: `epl_${season}_${u.id || crypto.randomBytes(4).toString('hex')}`,
          season, league: 'EPL', date: u.d, datetime: u.dt || null,
          home_team: u.h, away_team: u.a,
          home_goals: fr.hg !== null ? fr.hg : u.hg,
          away_goals: fr.ag !== null ? fr.ag : u.ag,
          result: fr.res || null,
          home_xg: u.hx, away_xg: u.ax,
          odds_home: fr.oH, odds_draw: fr.oD, odds_away: fr.oA,
          odds_over25: fr.o25, odds_under25: fr.u25,
          lineage: {
            understat: { id: u.id, source: `bronze/EPL/${season}_understat.json` },
            football_data: { source: `bronze/football_data/${season}.csv` },
            ingested_at: new Date().toISOString()
          },
          confidence: scoreMatch ? 1.0 : 0.8
        });
      } else usOnly++;
    }

    for (const key of Object.keys(fdIndex)) {
      if (!matchedKeys.has(key)) fdOnly++;
    }

    // Write
    const outDir = `data/silver/fixtures/epl/${season}`;
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(`${outDir}/fixtures.json`, JSON.stringify(fixtures, null, 2) + '\n', 'utf8');
    fs.writeFileSync(`${outDir}/metadata.json`, JSON.stringify({
      season, league: 'EPL',
      total_fixtures: fixtures.length,
      understat_rows: Object.keys(usIndex).length,
      football_data_rows: Object.keys(fdIndex).length,
      matches_merged: merged,
      us_only: usOnly, fd_only: fdOnly,
      score_mismatches: mismatches,
      generated_at: new Date().toISOString()
    }, null, 2) + '\n', 'utf8');

    totalMerged += fixtures.length;
    const sz = fs.statSync(`${outDir}/fixtures.json`).size;
    console.log(`${season}: merged=${fixtures.length} US=${Object.keys(usIndex).length} FD=${Object.keys(fdIndex).length} US-only=${usOnly} FD-only=${fdOnly} mismatches=${mismatches} size=${(sz/1024).toFixed(0)}KB ${fixtures.length === 380 ? '✓' : '⚠'}`);
  }

  console.log(`\nTOTAL: ${totalMerged} fixtures (expected 4,180) ${totalMerged === 4180 ? '✅ ALL PERFECT' : '⚠ NEEDS REVIEW'}`);
  console.log(`Output: data/silver/fixtures/epl/{season}/fixtures.json`);
}

run().catch(err => { console.error(err); process.exit(1); });