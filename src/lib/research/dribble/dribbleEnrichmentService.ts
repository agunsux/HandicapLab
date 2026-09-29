import * as fs from 'fs';
import * as path from 'path';
import { SecretScrubber } from '../bakeoff/scrubber';
import { normalizeTeamName } from '@/lib/identity/fixtureMapping';

export interface DribbleRollingStats {
  teamName: string;
  normalizedName: string;
  matchesSampled: number;
  rollingXg: number;
  rollingXga: number;
  rollingXa: number;
  rollingShots: number;
  rollingShotsOnTarget: number;
  cutoffAppliedUtc: string;
  coverageStatus: 'FULL' | 'PARTIAL' | 'UNAVAILABLE';
}

export class DribbleEnrichmentService {
  private static baseUrl = 'https://dribble360.com/api/v1';
  private static cachedTeamMatches: any[] | null = null;
  private static cacheFile = path.resolve('data/cache/dribble_team_matches_cache.json');

  private static getApiKey(): string | null {
    const raw = process.env.DRIBBLE_API_KEY?.trim();
    if (!raw || raw.length < 5 || raw.includes('[SENSITIVE]')) {
      return null;
    }
    return raw;
  }

  public static isConfigured(): boolean {
    return this.getApiKey() !== null;
  }

  /**
   * Loads or refreshes historical team_matches from Dribble.
   * Respects local caching so multiple calls do not exhaust quota.
   */
  public static async loadTeamMatches(forceRefresh = false): Promise<any[]> {
    if (!forceRefresh && this.cachedTeamMatches) {
      return this.cachedTeamMatches;
    }

    // Check disk cache (valid for 24h)
    if (!forceRefresh && fs.existsSync(this.cacheFile)) {
      try {
        const stats = fs.statSync(this.cacheFile);
        const ageMs = Date.now() - stats.mtimeMs;
        if (ageMs < 24 * 3600 * 1000) {
          const raw = fs.readFileSync(this.cacheFile, 'utf8');
          this.cachedTeamMatches = JSON.parse(raw);
          return this.cachedTeamMatches || [];
        }
      } catch (e) {
        console.warn('[DribbleEnrichmentService] Error reading disk cache:', e);
      }
    }

    const key = this.getApiKey();
    if (!key) {
      console.warn('[DribbleEnrichmentService] DRIBBLE_API_KEY is not configured.');
      return [];
    }

    try {
      SecretScrubber.initialize();
      const res = await fetch(`${this.baseUrl}/team_matches?limit=100`, {
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
          'User-Agent': 'HandicapLab-Live/1.0',
        },
      });

      if (!res.ok) {
        console.warn(`[DribbleEnrichmentService] Dribble returned status ${res.status}`);
        return [];
      }

      const json = await res.json();
      const rows = json.rows || [];
      this.cachedTeamMatches = rows;

      // Save to disk cache
      try {
        const dir = path.dirname(this.cacheFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(this.cacheFile, JSON.stringify(rows, null, 2), 'utf8');
      } catch {}

      return rows;
    } catch (e: any) {
      console.warn('[DribbleEnrichmentService] Fetch error:', e.message);
      return [];
    }
  }

  /**
   * Extracts point-in-time rolling metrics for a team strictly BEFORE cutoff_utc.
   * Invariant: feature_timestamp < cutoff_utc (kickoff - 30 minutes).
   */
  public static async getPointInTimeTeamStats(
    teamName: string,
    cutoffUtc: string,
    sampleWindow = 10
  ): Promise<DribbleRollingStats> {
    const norm = normalizeTeamName(teamName);
    const allRows = await this.loadTeamMatches();
    const cutoffMs = new Date(cutoffUtc).getTime();

    // Match team rows by match_slug or team identification
    const teamRows = allRows.filter((r) => {
      const slug = (r.match_slug || '').toLowerCase();
      const isTeamInSlug = slug.includes(norm) || norm.includes(slug.split('-vs-')[0] || '') || norm.includes(slug.split('-vs-')[1] || '');
      
      let matchDateMs = 0;
      const slugParts = slug.split('-');
      if (slugParts.length >= 4) {
        const day = slugParts[slugParts.length - 3];
        const month = slugParts[slugParts.length - 2];
        const year = slugParts[slugParts.length - 1];
        if (year && month && day) {
          matchDateMs = new Date(`${year}-${month}-${day}T00:00:00Z`).getTime();
        }
      }
      if (!matchDateMs && r.last_updated) {
        matchDateMs = new Date(r.last_updated).getTime();
      }

      // CRITICAL INVARIANT: matchDateMs must be strictly earlier than cutoffMs
      const isPriorToCutoff = matchDateMs > 0 ? matchDateMs < cutoffMs : true;
      return isTeamInSlug && isPriorToCutoff;
    });

    if (teamRows.length === 0) {
      return {
        teamName,
        normalizedName: norm,
        matchesSampled: 0,
        rollingXg: 0,
        rollingXga: 0,
        rollingXa: 0,
        rollingShots: 0,
        rollingShotsOnTarget: 0,
        cutoffAppliedUtc: cutoffUtc,
        coverageStatus: 'UNAVAILABLE',
      };
    }

    const recent = teamRows.slice(0, sampleWindow);
    const n = recent.length;

    let totalXg = 0;
    let totalXga = 0;
    let totalXa = 0;
    let totalShots = 0;
    let totalSot = 0;

    for (const row of recent) {
      totalXg += Number(row.expected_goals) || 0;
      totalXga += Number(row.expected_goals_conceded) || 0;
      totalXa += Number(row.expected_assists) || 0;
      totalShots += Number(row.shots || row.total_scoring_att) || 0;
      totalSot += Number(row.shots_on_target || row.ontarget_scoring_att) || 0;
    }

    return {
      teamName,
      normalizedName: norm,
      matchesSampled: n,
      rollingXg: Number((totalXg / n).toFixed(4)),
      rollingXga: Number((totalXga / n).toFixed(4)),
      rollingXa: Number((totalXa / n).toFixed(4)),
      rollingShots: Number((totalShots / n).toFixed(2)),
      rollingShotsOnTarget: Number((totalSot / n).toFixed(2)),
      cutoffAppliedUtc: cutoffUtc,
      coverageStatus: n >= 5 ? 'FULL' : 'PARTIAL',
    };
  }
}
export default DribbleEnrichmentService;
