// ============================================================================
// THE ODDS API ADAPTER FOR DATA PLATFORM
// ============================================================================
// Location: src/lib/data-platform/theOddsApiAdapter.ts
//
// Bridges TheOddsApiProvider with the Data Platform OddsProvider interface.
// ============================================================================

import { OddsProvider, ProviderCapability } from './providerInterface';
import { CanonicalFixture, CanonicalOdds } from './canonicalModel';
import { TheOddsApiProvider } from '@/lib/providers/theOddsApiProvider';
import { hasOddsApiKey } from '@/lib/providers/providerKey';

export class TheOddsApiAdapter implements OddsProvider {
  public name = 'TheOddsApi';

  public getCapabilities(): ProviderCapability {
    return {
      supportsMoneyline: false, // Strictly scoped to AH, OU, BTTS per product rules
      supportsAsianHandicap: true,
      supportsOverUnder: true,
      supportsLiveOdds: true,
      supportsHistorical: false, // Marked false by default until account capability validated
    };
  }

  public async connect(): Promise<boolean> {
    return hasOddsApiKey();
  }

  public async disconnect(): Promise<boolean> {
    return true;
  }

  public async health(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number }> {
    const res = await TheOddsApiProvider.healthCheck();
    return {
      status: res.healthy ? 'healthy' : 'unhealthy',
      latency: res.latencyMs,
    };
  }

  public async authenticate(): Promise<boolean> {
    return hasOddsApiKey();
  }

  public async getFixtures(): Promise<CanonicalFixture[]> {
    const res = await TheOddsApiProvider.getFixtures('soccer_epl');
    if (!res.success || !res.events) return [];

    return res.events.map((ev) => ({
      match_id: `theoddsapi_${ev.id}`,
      provider_id: ev.id,
      provider: 'the-odds-api',
      competition_id: ev.sport_key,
      season: new Date(ev.commence_time).getUTCFullYear().toString(),
      home_team_id: ev.home_team,
      away_team_id: ev.away_team,
      kickoff: ev.commence_time,
      home_goals: null,
      away_goals: null,
      home_xg: null,
      away_xg: null,
      home_shots: null,
      away_shots: null,
      home_shots_on_target: null,
      away_shots_on_target: null,
      status: 'SCHEDULED',
      schema_version: '1.0',
      generated_at: new Date().toISOString(),
      checksum: ev.id,
    }));
  }

  public async getOdds(fixtureId: string): Promise<CanonicalOdds[]> {
    const res = await TheOddsApiProvider.getOdds('soccer_epl');
    if (!res.success || !res.records) return [];

    const matched = res.records.filter(
      (r) => r.canonicalMatchId === fixtureId || r.providerMatchId === fixtureId
    );

    return matched.map((r) => {
      let sel: CanonicalOdds['selection'] = 'home';
      if (r.market === 'AH') {
        sel = r.selection === 'HOME' ? 'home' : 'away';
      } else if (r.market === 'OU') {
        sel = r.selection.toLowerCase().includes('over') ? 'over' : 'under';
      } else if (r.market === 'BTTS') {
        sel = r.selection.toLowerCase() === 'yes' ? 'btts_yes' : 'btts_no';
      }

      return {
        fixtureId: r.canonicalMatchId || r.providerMatchId,
        provider: 'the-odds-api',
        marketType: r.market,
        selection: sel,
        line: r.line,
        oddsDecimal: r.oddsDecimal,
        impliedProbability: r.oddsDecimal > 0 ? 1 / r.oddsDecimal : 0,
        receivedAt: r.capturedAtUtc,
        providerTimestamp: r.providerTimestamp,
        processedTimestamp: new Date().toISOString(),
        latencyMs: 10,
        normalizerVersion: 'v1.0.0-theoddsapi',
      };
    });
  }

  public async subscribe(): Promise<boolean> {
    return false; // Polling-based provider, webhooks not supported on free tier
  }

  public async unsubscribe(): Promise<boolean> {
    return true;
  }
}
