/**
 * Understat Match Ingestion Pipeline
 * 
 * Copies existing Understat match-level JSON files from the legacy storage
 * (data/bronze/EPL/*_understat.json) into the new Bronze Lakehouse structure:
 * 
 *   data/bronze/understat/EPL/{season}/matches.json
 *
 * This script:
 *   - Reads raw Understat match files (already scraped, stored locally)
 *   - Validates JSON structure and data integrity
 *   - Writes to the canonical Bronze location
 *   - Updates matches.json AND metadata.json for each season
 *   - Generates a validation report
 *
 * Conventions followed:
 *   - Bronze data is raw/unmodified (write-once, read-many)
 *   - Only reorganizes filesystem — no prediction/analysis code modified
 *   - Uses existing Bronze metadata schema
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// === Configuration ===
const SEASONS = [
  '2015-2016', '2016-2017', '2017-2018', '2018-2019', '2019-2020',
  '2020-2021', '2021-2022', '2022-2023', '2023-2024', '2024-2025',
  '2025-2026'
];

const SOURCE_DIR = path.join(__dirname, '..', 'data', 'bronze', 'EPL');
const TARGET_DIR = path.join(__dirname, '..', 'data', 'bronze', 'understat', 'EPL');

// === Helpers ===

function readJson(filepath) {
  if (!fs.existsSync(filepath)) return null;
  let raw = fs.readFileSync(filepath, 'utf8');
  // Strip UTF-8 BOM if present
  if (raw.charCodeAt(0) === 0xFEFF) {
    raw = raw.slice(1);
  }
  return JSON.parse(raw);
}

function writeJson(filepath, data) {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function computeChecksum(filepath) {
  if (!fs.existsSync(filepath)) return null;
  const raw = fs.readFileSync(filepath, 'utf8');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function validateUnderstatMatch(match) {
  const errors = [];
  if (!match.id) errors.push('missing id');
  if (!match.datetime) errors.push('missing datetime');
  if (!match.h || !match.h.title) errors.push('missing home team');
  if (!match.a || !match.a.title) errors.push('missing away team');
  if (match.h && match.h.xG === undefined) errors.push('missing home xG');
  if (match.a && match.a.xG === undefined) errors.push('missing away xG');
  return errors;
}

// === Main Pipeline ===

async function run() {
  console.log('=== Understat Match Ingestion Pipeline ===\n');

  const results = [];

  for (const season of SEASONS) {
    const sourceFile = path.join(SOURCE_DIR, `${season}_understat.json`);
    const targetFile = path.join(TARGET_DIR, season, 'matches.json');
    const metadataFile = path.join(TARGET_DIR, season, 'metadata.json');

    const result = {
      season,
      source_exists: fs.existsSync(sourceFile),
      parsed: false,
      match_count: 0,
      validation_errors: [],
      checksum: null,
      file_size: null,
      has_xg: false,
      has_goals: false,
      written: false,
      metadata_updated: false
    };

    // Step 1: Read source
    if (!result.source_exists) {
      console.warn(`  [SKIP] ${season}: source file not found at ${sourceFile}`);
      results.push(result);
      continue;
    }

    let matches;
    try {
      matches = readJson(sourceFile);
      result.parsed = true;
      result.file_size = fs.statSync(sourceFile).size;
    } catch (e) {
      console.error(`  [FAIL] ${season}: parse error - ${e.message}`);
      result.validation_errors.push(`parse_error: ${e.message}`);
      results.push(result);
      continue;
    }

    if (!Array.isArray(matches)) {
      console.error(`  [FAIL] ${season}: not an array`);
      result.validation_errors.push('not_an_array');
      results.push(result);
      continue;
    }

    result.match_count = matches.length;

    // Step 2: Validate
    const matchErrors = [];
    let xgCount = 0;
    let goalCount = 0;

    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const errs = validateUnderstatMatch(m);
      if (errs.length > 0) {
        matchErrors.push({ index: i, id: m.id, errors: errs });
        if (matchErrors.length <= 5) {
          result.validation_errors.push(`match_${m.id || i}: ${errs.join(', ')}`);
        }
      }
      if (m.h && m.h.xG !== undefined && m.h.xG !== null) xgCount++;
      if (m.goals && (m.goals.h !== undefined || m.goals.a !== undefined)) goalCount++;
    }

    result.has_xg = xgCount > 0;
    result.has_goals = goalCount > 0;

    if (matchErrors.length > 0) {
      console.warn(`  [WARN] ${season}: ${matchErrors.length}/${matches.length} matches have validation issues`);
    }

    // Step 3: Write matches.json (keep raw Understat structure)
    try {
      writeJson(targetFile, matches);
      result.written = true;
      result.checksum = computeChecksum(targetFile);
    } catch (e) {
      console.error(`  [FAIL] ${season}: write error - ${e.message}`);
      result.validation_errors.push(`write_error: ${e.message}`);
      results.push(result);
      continue;
    }

    // Step 4: Update metadata.json
    const existingMeta = readJson(metadataFile) || {};
    const updatedMeta = {
      provider: 'understat',
      league: 'English Premier League',
      season: season,
      dataset: 'matches',
      version: 1,
      status: 'imported',
      record_count: matches.length,
      checksum: result.checksum,
      imported_at: new Date().toISOString(),
      validation: {
        total_matches: matches.length,
        matches_with_xg: xgCount,
        matches_with_goals: goalCount,
        validation_errors: matchErrors.length,
        source_file: `${season}_understat.json`
      }
    };

    try {
      writeJson(metadataFile, updatedMeta);
      result.metadata_updated = true;
    } catch (e) {
      console.error(`  [FAIL] ${season}: metadata write error - ${e.message}`);
      result.validation_errors.push(`metadata_write_error: ${e.message}`);
    }

    console.log(`  [OK] ${season}: ${matches.length} matches, ${xgCount} with xG, ${goalCount} with goals`);
    results.push(result);
  }

  // === Summary Report ===
  console.log('\n=== Ingestion Summary ===\n');
  
  let totalMatches = 0;
  let successCount = 0;
  let failCount = 0;

  console.log('Season       | Matches | xG    | Goals | Status');
  console.log('-' .repeat(50));

  for (const r of results) {
    const status = r.written ? 'OK' : (r.source_exists ? 'FAIL' : 'SKIP');
    if (r.written) successCount++;
    else if (r.source_exists) failCount++;
    totalMatches += r.match_count;
    console.log(
      `${r.season} | ${String(r.match_count).padStart(7)} | ${r.has_xg ? 'YES' : 'NO '}   | ${r.has_goals ? 'YES' : 'NO '}    | ${status}`
    );
  }

  console.log('-' .repeat(50));
  console.log(`Total        | ${String(totalMatches).padStart(7)} |\n`);

  // === Expected vs Actual ===
  console.log('=== Expected Match Counts ===');
  console.log('EPL seasons: 380 matches per full season');
  console.log('Total expected: ' + (SEASONS.length * 380));
  console.log('Total actual:   ' + totalMatches);

  // === Data Quality ===
  console.log('\n=== Data Quality ===');
  const xgSeasons = results.filter(r => r.has_xg).length;
  const goalSeasons = results.filter(r => r.has_goals).length;
  console.log(`Seasons with xG data: ${xgSeasons}/${SEASONS.length}`);
  console.log(`Seasons with goals data: ${goalSeasons}/${SEASONS.length}`);
  console.log(`Seasons successfully written: ${successCount}/${SEASONS.length}`);
  console.log(`Seasons failed: ${failCount}/${SEASONS.length}`);

  // === Files Created ===
  console.log('\n=== Files Modified ===');
  for (const r of results) {
    if (r.written) {
      console.log(`  data/bronze/understat/EPL/${r.season}/matches.json (${r.match_count} matches, ${r.file_size} bytes source)`);
      console.log(`  data/bronze/understat/EPL/${r.season}/metadata.json (updated)`);
    }
  }

  const overallSuccess = successCount === SEASONS.length && failCount === 0;
  console.log(`\n=== Pipeline Result: ${overallSuccess ? 'SUCCESS' : 'PARTIAL'} ===`);
  
  return overallSuccess;
}

run().catch(err => {
  console.error('Pipeline failed:', err.message);
  process.exit(1);
});