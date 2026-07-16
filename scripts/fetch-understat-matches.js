/**
 * Understat Match Data Fetcher
 *
 * Fetches match-level data from Understat.com for EPL seasons
 * and saves to the Bronze Lakehouse structure:
 *
 *   data/bronze/understat/EPL/{season}/matches.json
 *
 * Understat page embeds a JSON object in JavaScript:
 *   var datesData = JSON.parse('...');
 *
 * This script:
 *   - Fetches https://understat.com/league/EPL/{season}
 *   - Extracts the embedded JSON from `var datesData = JSON.parse(...)`
 *   - Validates and saves matches to Bronze layer
 *   - Updates metadata.json with checksums
 *   - Includes delays and proper user-agent for safety
 *
 * Usage:
 *   node scripts/fetch-understat-matches.js [--season YYYY-YYYY] [--force]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

// === Configuration ===
const UNDERSTAT_BASE = 'https://understat.com/league/EPL';
const TARGET_BASE = path.join(__dirname, '..', 'data', 'bronze', 'understat', 'EPL');

const ALL_SEASONS = {
  '2015-2016': '2015',
  '2016-2017': '2016',
  '2017-2018': '2017',
  '2018-2019': '2018',
  '2019-2020': '2019',
  '2020-2021': '2020',
  '2021-2022': '2021',
  '2022-2023': '2022',
  '2023-2024': '2023',
  '2024-2025': '2024',
  '2025-2026': '2025'
};

const REQUEST_DELAY_MS = 2000; // 2 second delay between requests
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// === Helpers ===

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://understat.com/'
      },
      timeout: 30000
    };

    https.get(url, opts, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject)
      .on('timeout', function() {
        this.destroy();
        reject(new Error(`Timeout for ${url}`));
      });
  });
}

/**
 * Extract the datesData JSON from Understat page HTML.
 * The page contains: var datesData = JSON.parse('...');
 */
function extractDatesData(html) {
  // Pattern 1: var datesData = JSON.parse('...')
  const match1 = html.match(/var\s+datesData\s*=\s*JSON\.parse\s*\(\s*'([^']+)'\s*\)/);
  if (match1) {
    return JSON.parse(match1[1].replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
  }

  // Pattern 2: var datesData = JSON.parse("...")
  const match2 = html.match(/var\s+datesData\s*=\s*JSON\.parse\s*\(\s*"([^"]+)"\s*\)/);
  if (match2) {
    return JSON.parse(match2[1].replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
  }

  // Pattern 3: raw JSON object assignment
  const match3 = html.match(/var\s+datesData\s*=\s*(\[[\s\S]*?\]);/);
  if (match3) {
    return JSON.parse(match3[1]);
  }

  throw new Error('Could not extract datesData from Understat page');
}

function computeChecksum(filepath) {
  if (!fs.existsSync(filepath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filepath, 'utf8')).digest('hex');
}

function writeJson(filepath, data) {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function readJson(filepath) {
  if (!fs.existsSync(filepath)) return null;
  let raw = fs.readFileSync(filepath, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// === Main ===

async function run() {
  console.log('=== Understat Match Data Fetcher ===');
  console.log(`Source: ${UNDERSTAT_BASE}/{year}`);
  console.log(`Target: ${TARGET_BASE}/{season}/matches.json\n`);

  // Parse command line
  const args = process.argv.slice(2);
  const forceMode = args.includes('--force');
  const seasonFilter = args.find(a => a.startsWith('--season='));

  let seasonsToFetch;
  if (seasonFilter) {
    const s = seasonFilter.split('=')[1];
    if (!ALL_SEASONS[s]) {
      console.error(`Unknown season: ${s}. Valid options: ${Object.keys(ALL_SEASONS).join(', ')}`);
      process.exit(1);
    }
    seasonsToFetch = { [s]: ALL_SEASONS[s] };
    console.log(`Mode: single season (${s})\n`);
  } else {
    seasonsToFetch = ALL_SEASONS;
    console.log(`Mode: all ${Object.keys(ALL_SEASONS).length} seasons\n`);
  }

  const results = [];

  for (const [season, year] of Object.entries(seasonsToFetch)) {
    const url = `${UNDERSTAT_BASE}/${year}`;
    const targetFile = path.join(TARGET_BASE, season, 'matches.json');
    const metadataFile = path.join(TARGET_BASE, season, 'metadata.json');

    const result = {
      season,
      year,
      url,
      status: 'pending',
      match_count: 0,
      errors: [],
      file_size: null,
      checksum: null,
      from_cache: false
    };

    // Check if already fetched and valid
    if (!forceMode && fs.existsSync(targetFile)) {
      const existing = readJson(targetFile);
      if (existing && Array.isArray(existing) && existing.length > 300) {
        console.log(`  [CACHE] ${season}: ${existing.length} matches (use --force to re-fetch)`);
        result.status = 'cached';
        result.match_count = existing.length;
        result.from_cache = true;
        results.push(result);
        continue;
      }
    }

    console.log(`  [FETCH] ${season} (${year})...`);

    try {
      // Fetch the page
      const html = await fetchUrl(url);

      // Extract the JSON
      const matches = extractDatesData(html);

      if (!Array.isArray(matches)) {
        throw new Error(`Expected array, got ${typeof matches}`);
      }

      result.match_count = matches.length;

      // Validate matches
      let validCount = 0;
      const validationErrors = [];

      for (const match of matches) {
        const hasRequired = match.id && match.datetime && match.h?.title && match.a?.title;
        if (hasRequired) validCount++;
        else {
          validationErrors.push(`Match ${match.id || 'unknown'}: missing required fields`);
          if (validationErrors.length <= 5) {
            result.errors.push(`validation: match ${match.id || '?'} missing fields`);
          }
        }
      }

      console.log(`    Parsed ${matches.length} matches (${validCount} valid, ${matches.length - validCount} incomplete)`);

      // Write matches.json
      writeJson(targetFile, matches);

      const stats = fs.statSync(targetFile);
      result.file_size = stats.size;
      result.checksum = computeChecksum(targetFile);

      // Update metadata.json
      const existingMeta = readJson(metadataFile) || {};
      const xgCount = matches.filter(m => m.h?.xG !== undefined || m.a?.xG !== undefined).length;
      const goalCount = matches.filter(m => m.goals?.h !== undefined || m.goals?.a !== undefined).length;

      const updatedMeta = {
        provider: 'understat',
        league: 'English Premier League',
        season: season,
        dataset: 'matches',
        version: existingMeta.version ? existingMeta.version + (forceMode ? 1 : 0) : 1,
        status: 'imported',
        record_count: matches.length,
        checksum: result.checksum,
        imported_at: new Date().toISOString(),
        source_url: url,
        validation: {
          total_matches: matches.length,
          valid_matches: validCount,
          incomplete_matches: matches.length - validCount,
          matches_with_xg: xgCount,
          matches_with_goals: goalCount
        }
      };

      writeJson(metadataFile, updatedMeta);

      result.status = 'success';
      console.log(`    [OK] → ${targetFile} (${result.file_size} bytes)`);

    } catch (err) {
      result.status = 'failed';
      result.errors.push(`fetch_error: ${err.message}`);
      console.error(`    [FAIL] ${err.message}`);
    }

    results.push(result);

    // Delay between requests (unless last or from cache)
    const seasonKeys = Object.keys(seasonsToFetch);
    const isLast = seasonKeys.indexOf(season) === seasonKeys.length - 1;
    if (!isLast && result.status !== 'cached') {
      console.log(`    Waiting ${REQUEST_DELAY_MS}ms before next request...`);
      await sleep(REQUEST_DELAY_MS);
    }
  }

  // === Summary Report ===
  console.log('\n=== Fetch Summary ===\n');

  console.log('Season       | Matches | Size     | Status');
  console.log('-' .repeat(48));

  let totalMatches = 0;
  let successCount = 0;
  let failCount = 0;
  let cacheCount = 0;

  for (const r of results) {
    if (r.status === 'success') successCount++;
    else if (r.status === 'cached') cacheCount++;
    else failCount++;
    totalMatches += r.match_count;

    const statusIcon = r.status === 'success' ? 'OK' : (r.status === 'cached' ? 'CACHE' : 'FAIL');
    const sizeStr = r.file_size ? `${(r.file_size / 1024).toFixed(0)} KB` : '-';
    console.log(
      `${r.season} | ${String(r.match_count).padStart(7)} | ${sizeStr.padStart(7)} | ${statusIcon}`
    );
  }

  console.log('-' .repeat(48));
  console.log(`Total        | ${String(totalMatches).padStart(7)} |\n`);

  // === Summary Stats ===
  console.log('=== Statistics ===');
  console.log(`Seasons fetched: ${successCount}`);
  console.log(`Seasons cached:  ${cacheCount}`);
  console.log(`Seasons failed:  ${failCount}`);
  console.log(`Total matches:   ${totalMatches}`);
  console.log(`Expected range:  ~${Object.keys(seasonsToFetch).length * 380} (380 per season)`);

  if (failCount > 0) {
    console.log('\n=== Failures ===');
    for (const r of results) {
      if (r.status === 'failed') {
        console.log(`  ${r.season}: ${r.errors.join('; ')}`);
      }
    }
  }

  const overall = failCount === 0;
  console.log(`\n=== Pipeline: ${overall ? 'SUCCESS' : 'PARTIAL'} ===`);

  if (overall && totalMatches >= Object.keys(seasonsToFetch).length * 350) {
    console.log('All seasons have sufficient match coverage.');
  }

  return overall;
}

run().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});