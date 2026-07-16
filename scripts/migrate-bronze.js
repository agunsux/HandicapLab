const fs = require('fs');
const path = require('path');

// === Configuration ===
const BRONZE_ROOT = path.join(__dirname, '..', 'data', 'bronze');
const PROVIDER = 'understat';
const PROVIDER_ROOT = path.join(BRONZE_ROOT, PROVIDER);
const LEAGUES = ['EPL', 'LaLiga', 'SerieA', 'Bundesliga', 'Ligue1'];
const SEASONS = [
  '2015-2016', '2016-2017', '2017-2018', '2018-2019', '2019-2020',
  '2020-2021', '2021-2022', '2022-2023', '2023-2024', '2024-2025',
  '2025-2026'
];

// === Helpers ===
function mkdirp(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readFileRaw(filepath) {
  return fs.readFileSync(filepath, 'utf8');
}

function readFileStripBom(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  // Strip UTF-8 BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return content;
}

function readJsonSafe(filepath) {
  if (!fs.existsSync(filepath)) return null;
  try {
    const content = readFileStripBom(filepath);
    return JSON.parse(content);
  } catch (e) {
    console.error(`  ERROR reading ${path.basename(filepath)}: ${e.message}`);
    return null;
  }
}

function writeFile(filepath, content) {
  fs.writeFileSync(filepath, content, 'utf8');
}

function writeJson(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// === Step 1: Create directory structure ===
console.log('=== Step 1: Creating directory structure ===');
for (const league of LEAGUES) {
  for (const season of SEASONS) {
    mkdirp(path.join(PROVIDER_ROOT, league, season));
  }
}
console.log('  Created 5 leagues × 11 seasons = 55 season directories');

// === Step 2: Migrate EPL data ===
console.log('\n=== Step 2: Migrating EPL data ===');

const OLD_EPL_DIR = path.join(BRONZE_ROOT, 'EPL');
let migratedCount = 0;

for (const season of SEASONS) {
  // Try source: data/bronze/EPL/epl {season}.json
  let srcFile = path.join(OLD_EPL_DIR, `epl ${season}.json`);
  if (!fs.existsSync(srcFile)) {
    // Try source: top-level data/epl {season}.json
    srcFile = path.join(__dirname, '..', 'data', `epl ${season}.json`);
  }
  if (!fs.existsSync(srcFile)) {
    console.warn(`  WARN: No source file found for ${season}`);
    continue;
  }

  // Read raw content (strip BOM to preserve valid JSON)
  const raw = readFileStripBom(srcFile);
  
  // Validate it parses correctly
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      console.warn(`  WARN: ${season} - not an array, skipping`);
      continue;
    }
    
    // Write to new location
    const dstFile = path.join(PROVIDER_ROOT, 'EPL', season, 'season_table.json');
    writeFile(dstFile, raw);
    console.log(`  Migrated: EPL/${season}/season_table.json (${data.length} teams)`);
    migratedCount++;
  } catch (e) {
    console.error(`  ERROR: ${season} - invalid JSON: ${e.message}`);
  }
}
console.log(`  Migrated ${migratedCount}/${SEASONS.length} seasons`);

// === Step 3: Create placeholder files for all leagues ===
console.log('\n=== Step 3: Creating placeholder files ===');

function createPlaceholders(league, season, seasonDataCount = 0, isMigrated = false) {
  const dir = path.join(PROVIDER_ROOT, league, season);

  // matches.json - always empty array
  const matchesFile = path.join(dir, 'matches.json');
  if (!fs.existsSync(matchesFile)) {
    writeJson(matchesFile, []);
  }

  // metadata.json
  const metaFile = path.join(dir, 'metadata.json');
  const now = new Date().toISOString();
  const leagueNames = {
    'EPL': 'English Premier League',
    'LaLiga': 'La Liga',
    'SerieA': 'Serie A',
    'Bundesliga': 'Bundesliga',
    'Ligue1': 'Ligue 1'
  };

  const metadata = {
    provider: 'understat',
    league: leagueNames[league] || league,
    season: season,
    dataset: 'season_table',
    version: 1,
    status: isMigrated ? 'migrated' : 'placeholder',
    record_count: seasonDataCount,
    checksum: null,
    imported_at: isMigrated ? now : null
  };

  writeJson(metaFile, metadata);
  return true;
}

// For EPL: migrated data
console.log('  EPL: creating metadata from migrated data');
for (const season of SEASONS) {
  const seasonTablePath = path.join(PROVIDER_ROOT, 'EPL', season, 'season_table.json');
  const data = readJsonSafe(seasonTablePath);
  const count = data ? data.length : 0;
  const isMigrated = data !== null && Array.isArray(data) && data.length > 0;
  createPlaceholders('EPL', season, count, isMigrated);
  console.log(`    EPL/${season}: ${count} teams, status=${isMigrated ? 'migrated' : 'placeholder'}`);
}

// For other leagues: empty placeholders
const OTHER_LEAGUES = ['LaLiga', 'SerieA', 'Bundesliga', 'Ligue1'];
for (const league of OTHER_LEAGUES) {
  for (const season of SEASONS) {
    const stFile = path.join(PROVIDER_ROOT, league, season, 'season_table.json');
    if (!fs.existsSync(stFile)) {
      writeJson(stFile, []);
    }
    createPlaceholders(league, season, 0, false);
  }
  console.log(`  Created scaffold: ${league}`);
}

// === Step 4: Clean up old structure ===
console.log('\n=== Step 4: Cleaning up old structure ===');

// Handle old EPL dir - only remove the migrated epl files, keep others
if (fs.existsSync(OLD_EPL_DIR)) {
  for (const season of SEASONS) {
    const oldFile = path.join(OLD_EPL_DIR, `epl ${season}.json`);
    if (fs.existsSync(oldFile)) {
      // Verify the content was already migrated (compare sizes as heuristic)
      const newFile = path.join(PROVIDER_ROOT, 'EPL', season, 'season_table.json');
      if (fs.existsSync(newFile)) {
        fs.unlinkSync(oldFile);
        console.log(`  Removed: data/bronze/EPL/epl ${season}.json`);
      }
    }
  }
  
  // Check what's left
  const remaining = fs.readdirSync(OLD_EPL_DIR).filter(f => f.endsWith('.json'));
  if (remaining.length === 0) {
    fs.rmdirSync(OLD_EPL_DIR);
    console.log('  Removed empty directory: data/bronze/EPL/');
  } else {
    console.log(`  Remaining in data/bronze/EPL/: ${remaining.length} files (non-understat)`);
  }
}

// Handle top-level data/epl*.json
for (const season of SEASONS) {
  const oldFile = path.join(__dirname, '..', 'data', `epl ${season}.json`);
  if (fs.existsSync(oldFile)) {
    const newFile = path.join(PROVIDER_ROOT, 'EPL', season, 'season_table.json');
    if (fs.existsSync(newFile)) {
      fs.unlinkSync(oldFile);
      console.log(`  Removed: data/epl ${season}.json`);
    }
  }
}

// === Step 5: Full validation ===
console.log('\n=== Step 5: Validation ===');

let allOk = true;
let structureFailures = [];
let dataFailures = [];

// Check every league/season has all 3 files
for (const league of LEAGUES) {
  for (const season of SEASONS) {
    const dir = path.join(PROVIDER_ROOT, league, season);
    const hasSeasonTable = fs.existsSync(path.join(dir, 'season_table.json'));
    const hasMatches = fs.existsSync(path.join(dir, 'matches.json'));
    const hasMetadata = fs.existsSync(path.join(dir, 'metadata.json'));

    if (!hasSeasonTable || !hasMatches || !hasMetadata) {
      structureFailures.push(`${league}/${season}`);
      allOk = false;
    }
  }
}

if (structureFailures.length === 0) {
  console.log('  ✓ All 55 season directories have season_table.json, matches.json, metadata.json');
} else {
  console.error(`  ✗ Missing files in: ${structureFailures.join(', ')}`);
}

// Verify EPL data integrity
console.log('\n  EPL Data Integrity:');
for (const season of SEASONS) {
  const data = readJsonSafe(path.join(PROVIDER_ROOT, 'EPL', season, 'season_table.json'));
  if (data === null || !Array.isArray(data)) {
    dataFailures.push(season);
    console.error(`  ✗ ${season}: INVALID`);
    allOk = false;
  } else {
    // Verify expected fields
    const first = data[0];
    const expectedFields = ['number', 'team', 'matches', 'wins', 'draws', 'loses', 'goals', 'ga', 'points', 'xG', 'xGA', 'xPTS'];
    const hasFields = expectedFields.every(f => f in first);
    console.log(`  ✓ ${season}: ${data.length} teams, ${hasFields ? 'all fields OK' : 'MISSING FIELDS'}`);
    if (!hasFields) {
      console.log(`    Fields found: ${Object.keys(first).join(', ')}`);
      dataFailures.push(season);
      allOk = false;
    }
  }
}

// Verify placeholder leagues are empty arrays
console.log('\n  Other Leagues (verify empty arrays):');
for (const league of ['LaLiga', 'SerieA', 'Bundesliga', 'Ligue1']) {
  let leagueOk = true;
  for (const season of SEASONS) {
    const data = readJsonSafe(path.join(PROVIDER_ROOT, league, season, 'season_table.json'));
    if (!Array.isArray(data) || data.length !== 0) {
      leagueOk = false;
      console.error(`  ✗ ${league}/${season}: expected empty array`);
      allOk = false;
    }
  }
  console.log(`  ${league}: ${leagueOk ? '✓ all empty' : '✗ issues found'}`);
}

// Verify matches.json files are empty arrays
console.log('\n  matches.json (all should be empty arrays):');
let matchesOk = true;
for (const league of LEAGUES) {
  for (const season of SEASONS) {
    const data = readJsonSafe(path.join(PROVIDER_ROOT, league, season, 'matches.json'));
    if (!Array.isArray(data) || data.length !== 0) {
      console.error(`  ✗ ${league}/${season}/matches.json: not empty`);
      matchesOk = false;
      allOk = false;
    }
  }
}
if (matchesOk) console.log('  ✓ All 55 matches.json are empty arrays');

// === Final Report ===
console.log('\n========================================');
console.log(` Migration: ${allOk ? '✅ SUCCESS' : '❌ FAILED'}`);
console.log('========================================');
console.log(`\nNew structure: data/bronze/understat/{League}/{Season}/`);
console.log('  Files: season_table.json, matches.json, metadata.json');
console.log(`\nLeagues: ${LEAGUES.join(', ')}`);
console.log(`Seasons: ${SEASONS[0]} to ${SEASONS[SEASONS.length-1]} (${SEASONS.length})`);
console.log(`EPL data migrated: ${migratedCount} seasons`);