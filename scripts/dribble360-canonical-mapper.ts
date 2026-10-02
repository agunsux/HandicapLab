/**
 * DRIBBLE360 CANONICAL MAPPER SCRIPT
 * 
 * Maps Dribble360 raw harvests into Canonical Match Registry entries.
 * 
 * Pipeline:
 *   Dribble360 JSONL / Captures
 *        ↓
 *   Dribble360Adapter
 *        ↓
 *   CanonicalFixture DTOs
 *        ↓
 *   data/research/dribble360/canonical_mapping_index.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { Dribble360Adapter } from '../src/lib/data-platform/dribble360Adapter';
import type { Dribble360Match, Dribble360TeamMatch } from '../src/lib/providers/dribble360Provider';

async function main() {
  console.log('=== DRIBBLE360 CANONICAL MAPPER ===');
  
  const rawCapturesDir = path.resolve('data/research/dribble360/raw_captures');
  const harvestDir = path.resolve('data/research/dribble360/harvest');
  const outputFile = path.resolve('data/research/dribble360/canonical_mapping_index.json');

  const matches: Dribble360Match[] = [];
  const teamMatches: Dribble360TeamMatch[] = [];

  // 1. Ingest raw captures
  if (fs.existsSync(rawCapturesDir)) {
    const files = fs.readdirSync(rawCapturesDir);
    for (const f of files) {
      if (f.startsWith('matches_') && f.endsWith('.json')) {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(rawCapturesDir, f), 'utf8'));
          const rows = content.data?.rows || content.data || [];
          if (Array.isArray(rows)) {
            matches.push(...rows);
          }
        } catch (e) {
          console.warn(`Failed reading capture ${f}:`, e);
        }
      } else if (f.startsWith('team_matches_') && f.endsWith('.json')) {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(rawCapturesDir, f), 'utf8'));
          const rows = content.data?.rows || content.data || [];
          if (Array.isArray(rows)) {
            teamMatches.push(...rows);
          }
        } catch (e) {
          console.warn(`Failed reading capture ${f}:`, e);
        }
      }
    }
  }

  console.log(`Ingested from raw captures: ${matches.length} matches, ${teamMatches.length} team_matches.`);

  // 2. Map matches using Dribble360Adapter
  const mappedIndex: any[] = [];
  const seenIds = new Set<string>();

  for (const m of matches) {
    if (!m.id || seenIds.has(String(m.id))) continue;
    seenIds.add(String(m.id));

    // Find associated team matches by match_id or match_slug
    const relatedTm = teamMatches.filter(tm => 
      (tm.match_id && tm.match_id === m.id) ||
      (m.slug && tm.match_slug && tm.match_slug === m.slug)
    );

    const canonical = Dribble360Adapter.toCanonicalFixture(m, relatedTm);
    mappedIndex.push({
      canonicalId: canonical.match_id,
      dribbleMatchId: canonical.provider_id,
      leagueId: canonical.competition_id,
      season: canonical.season,
      date: canonical.kickoff.split('T')[0],
      homeTeam: m.home_team || (m.description ? m.description.split(' vs ')[0] : 'Unknown'),
      awayTeam: m.away_team || (m.description ? m.description.split(' vs ')[1] : 'Unknown'),
      scoresMatch: canonical.home_goals != null && canonical.away_goals != null,
      canonicalScore: `${canonical.home_goals ?? 0}-${canonical.away_goals ?? 0}`,
      dribbleScore: `${m.home_score ?? 0}-${m.away_score ?? 0}`,
      dribbleXgHome: canonical.home_xg,
      dribbleXgAway: canonical.away_xg,
      status: canonical.status,
      checksum: canonical.checksum,
    });
  }

  console.log(`Total mapped canonical entries: ${mappedIndex.length}`);

  // Write updated index if non-empty
  if (mappedIndex.length > 0) {
    fs.writeFileSync(outputFile, JSON.stringify(mappedIndex, null, 2), 'utf8');
    console.log(`Saved canonical mapping index to ${outputFile}`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
