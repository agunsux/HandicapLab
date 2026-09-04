/**
 * UNDERSTAT ARCHIVAL SCRAPER UTILITY
 * Target: https://understat.com/
 * Purpose: Extract and archive raw xG, xGA, and shot data to data/bronze/understat/
 * Usage:
 *   node scripts/scrape-understat-archive.mjs --league EPL --season 2024
 *   node scripts/scrape-understat-archive.mjs --all
 */

import * as fs from 'fs';
import * as path from 'path';

const UNDERSTAT_BASE_URL = 'https://understat.com';

const LEAGUES = {
  EPL: 'EPL',
  LaLiga: 'La_liga',
  SerieA: 'Serie_A',
  Bundesliga: 'Bundesliga',
  Ligue1: 'Ligue_1',
};

function decodeHexEscapes(str) {
  return str.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

function extractEmbeddedJson(html, varName) {
  const regex = new RegExp(`var\\s+${varName}\\s*=\\s*JSON\\.parse\\(['"](.*?)['"]\\)`);
  const match = html.match(regex);
  if (!match) return null;
  try {
    const decoded = decodeHexEscapes(match[1]);
    return JSON.parse(decoded);
  } catch (e) {
    console.error(`Failed to parse ${varName}:`, e.message);
    return null;
  }
}

export async function scrapeLeagueSeason(leagueKey, seasonYear) {
  const understatSlug = LEAGUES[leagueKey];
  if (!understatSlug) {
    throw new Error(`Unsupported league: ${leagueKey}. Supported: ${Object.keys(LEAGUES).join(', ')}`);
  }

  const seasonFolder = `${seasonYear}-${Number(seasonYear) + 1}`;
  const outDir = path.join(process.cwd(), 'data', 'bronze', 'understat', leagueKey, seasonFolder);
  fs.mkdirSync(outDir, { recursive: true });

  const url = `${UNDERSTAT_BASE_URL}/league/${understatSlug}/${seasonYear}`;
  console.log(`[Understat Scraper] Fetching: ${url}`);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (HTTP ${res.status} ${res.statusText})`);
  }

  const html = await res.text();

  const datesData = extractEmbeddedJson(html, 'datesData');
  const teamsData = extractEmbeddedJson(html, 'teamsData');
  const playersData = extractEmbeddedJson(html, 'playersData');

  if (!datesData || !teamsData) {
    console.warn(`[Understat Scraper] Warning: Could not extract datesData or teamsData for ${leagueKey} ${seasonYear}`);
  }

  // Write immutable bronze artifacts
  if (datesData) {
    fs.writeFileSync(path.join(outDir, 'fixtures.json'), JSON.stringify(datesData, null, 2));
    console.log(`  Saved fixtures.json (${datesData.length} matches)`);
  }
  if (teamsData) {
    fs.writeFileSync(path.join(outDir, 'season_table.json'), JSON.stringify(teamsData, null, 2));
    console.log(`  Saved season_table.json (${Object.keys(teamsData).length} teams)`);
  }
  if (playersData) {
    fs.writeFileSync(path.join(outDir, 'players.json'), JSON.stringify(playersData, null, 2));
    console.log(`  Saved players.json (${playersData.length} players)`);
  }

  const metadata = {
    sourceUrl: url,
    league: leagueKey,
    season: seasonFolder,
    retrievedAt: new Date().toISOString(),
    fixturesCount: datesData?.length ?? 0,
    teamsCount: teamsData ? Object.keys(teamsData).length : 0,
    playersCount: playersData?.length ?? 0,
  };
  fs.writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  console.log(`[Understat Scraper] Completed ${leagueKey} ${seasonFolder}`);
  return metadata;
}

// CLI Execution Handler
if (process.argv[1]?.includes('scrape-understat-archive')) {
  const args = process.argv.slice(2);
  const leagueIdx = args.indexOf('--league');
  const seasonIdx = args.indexOf('--season');
  const league = leagueIdx !== -1 ? args[leagueIdx + 1] : 'EPL';
  const season = seasonIdx !== -1 ? args[seasonIdx + 1] : '2024';

  scrapeLeagueSeason(league, season)
    .then((meta) => console.log('Scraper result:', meta))
    .catch((err) => {
      console.error('[Understat Scraper Error]:', err.message);
      process.exit(1);
    });
}
