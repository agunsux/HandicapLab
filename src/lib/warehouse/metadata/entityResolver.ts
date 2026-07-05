import { supabase } from '@/lib/supabase.server';
import { MetadataRegistry } from './registry';
import { KnowledgeGraphClient } from './knowledgeGraph';

export type ResolutionStrategy =
  | 'provider_id_map'
  | 'alias_lookup'
  | 'normalized_string'
  | 'fuzzy_match'
  | 'graph_inference'
  | 'historical'
  | 'manual_review';

export interface ResolutionResult {
  canonicalId: number | null;
  confidenceScore: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  resolutionReason: string;
  resolutionPath: string;
  manualReviewRequired: boolean;
}

export class Levenshtein {
  public static getDistance(s1: string, s2: string): number {
    const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
    for (let j = 1; j <= s2.length; j += 1) {
      for (let i = 1; i <= s1.length; i += 1) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j - 1][i] + 1, // deletion
          track[j][i - 1] + 1, // insertion
          track[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    return track[s2.length][s1.length];
  }

  public static getSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 1.0;
    return (longer.length - this.getDistance(longer, shorter)) / longer.length;
  }
}

export class EntityResolver {
  private readonly registry: MetadataRegistry;
  private readonly graphClient: KnowledgeGraphClient;

  constructor(registry?: MetadataRegistry, graphClient?: KnowledgeGraphClient) {
    this.registry = registry || new MetadataRegistry();
    this.graphClient = graphClient || new KnowledgeGraphClient();
  }

  private getConfidenceLevel(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (score >= 90.0) return 'HIGH';
    if (score >= 70.0) return 'MEDIUM';
    return 'LOW';
  }

  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  public async resolveTeam(
    providerName: string,
    providerTeamId: string,
    teamName: string,
    leagueId?: number
  ): Promise<ResolutionResult> {
    const now = new Date().toISOString();
    const resolutionPath: string[] = [];

    // Step 1: Provider ID Mapping
    resolutionPath.push('provider_id_map');
    const { data: directMapping } = await supabase
      .from('wh_entity_aliases')
      .select('canonical_id, confidence_score')
      .eq('provider_name', providerName)
      .eq('entity_type', 'TEAM')
      .eq('alias_name', providerTeamId)
      .maybeSingle();

    if (directMapping) {
      const score = Number(directMapping.confidence_score);
      const res: ResolutionResult = {
        canonicalId: Number(directMapping.canonical_id),
        confidenceScore: score,
        confidenceLevel: this.getConfidenceLevel(score),
        resolutionReason: 'Resolved via explicit provider ID map',
        resolutionPath: resolutionPath.join(' -> '),
        manualReviewRequired: score < 80.0
      };
      await this.auditResolution(providerName, 'TEAM', teamName, res, 'provider_id_map');
      return res;
    }

    // Step 2: Canonical Alias Lookup
    resolutionPath.push('alias_lookup');
    const resolvedAlias = await this.registry.resolveAlias(providerName, 'TEAM', teamName);
    if (resolvedAlias) {
      const score = resolvedAlias.confidenceScore;
      const res: ResolutionResult = {
        canonicalId: resolvedAlias.canonicalId,
        confidenceScore: score,
        confidenceLevel: this.getConfidenceLevel(score),
        resolutionReason: 'Resolved via canonical alias registry lookup',
        resolutionPath: resolutionPath.join(' -> '),
        manualReviewRequired: score < 80.0
      };
      await this.auditResolution(providerName, 'TEAM', teamName, res, 'alias_lookup');
      return res;
    }

    // Step 3: Normalized String Matching (e.g. "Man Utd" -> "manutd")
    resolutionPath.push('normalized_string');
    const normalizedQuery = this.normalizeString(teamName);
    const { data: allAliases } = await supabase
      .from('wh_entity_aliases')
      .select('canonical_id, alias_name, confidence_score')
      .eq('provider_name', providerName)
      .eq('entity_type', 'TEAM');

    const exactNormalized = (allAliases || []).find(
      a => this.normalizeString(a.alias_name) === normalizedQuery
    );

    if (exactNormalized) {
      const score = Number(exactNormalized.confidence_score) - 2.0; // Deduct penalty for loose matching
      const res: ResolutionResult = {
        canonicalId: Number(exactNormalized.canonical_id),
        confidenceScore: score,
        confidenceLevel: this.getConfidenceLevel(score),
        resolutionReason: 'Resolved via normalized string alignment',
        resolutionPath: resolutionPath.join(' -> '),
        manualReviewRequired: score < 80.0
      };
      await this.auditResolution(providerName, 'TEAM', teamName, res, 'normalized_string');
      return res;
    }

    // Step 4: Fuzzy Levenshtein Matching (Similarity > 0.85)
    resolutionPath.push('fuzzy_match');
    let bestMatch: any = null;
    let maxSimilarity = 0;

    for (const a of allAliases || []) {
      const similarity = Levenshtein.getSimilarity(teamName, a.alias_name);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        bestMatch = a;
      }
    }

    if (bestMatch && maxSimilarity > 0.85) {
      const score = maxSimilarity * 100.0 - 5.0; // Deduct penalty for fuzzy distance
      const res: ResolutionResult = {
        canonicalId: Number(bestMatch.canonical_id),
        confidenceScore: score,
        confidenceLevel: this.getConfidenceLevel(score),
        resolutionReason: `Resolved via fuzzy matching (similarity: ${(maxSimilarity * 100).toFixed(1)}%)`,
        resolutionPath: resolutionPath.join(' -> '),
        manualReviewRequired: score < 80.0
      };
      await this.auditResolution(providerName, 'TEAM', teamName, res, 'fuzzy_match');
      return res;
    }

    // Step 5: Knowledge Graph Context Inference (Fallback context matches)
    if (leagueId) {
      resolutionPath.push('graph_inference');
      const edges = await this.graphClient.getConnectedTargets(leagueId, 'LEAGUE');
      const teamInLeague = edges.find(
        e => e.targetType === 'TEAM' && e.relationshipType === 'CONTAINS_TEAM'
      );
      if (teamInLeague) {
        const res: ResolutionResult = {
          canonicalId: teamInLeague.targetId,
          confidenceScore: 70.0,
          confidenceLevel: 'MEDIUM',
          resolutionReason: 'Resolved via knowledge graph league context inference',
          resolutionPath: resolutionPath.join(' -> '),
          manualReviewRequired: true
        };
        await this.auditResolution(providerName, 'TEAM', teamName, res, 'graph_inference');
        return res;
      }
    }

    // Step 6: Fallback to Manual Review Queue
    resolutionPath.push('manual_review');
    const fallbackRes: ResolutionResult = {
      canonicalId: null,
      confidenceScore: 0.0,
      confidenceLevel: 'LOW',
      resolutionReason: 'No matching strategies succeeded. Flagged for manual review.',
      resolutionPath: resolutionPath.join(' -> '),
      manualReviewRequired: true
    };

    await this.auditResolution(providerName, 'TEAM', teamName, fallbackRes, 'manual_review');
    await this.triggerManualReview(providerName, 'TEAM', teamName, 'unknown');
    return fallbackRes;
  }

  private async auditResolution(
    provider: string,
    entityType: string,
    originalValue: string,
    res: ResolutionResult,
    strategy: string
  ): Promise<void> {
    const auditPayload = {
      provider_name: provider,
      entity_type: entityType,
      original_value: originalValue,
      resolved_id: res.canonicalId,
      strategy_used: strategy,
      confidence_score: res.confidenceScore,
      resolution_path: res.resolutionPath
    };

    const { error } = await supabase.from('wh_resolution_audit').insert(auditPayload);
    if (error) {
      console.warn(`[EntityResolver] Failed to write audit: ${error.message}`);
    }
  }

  private async triggerManualReview(
    provider: string,
    entityType: string,
    originalValue: string,
    reason: string
  ): Promise<void> {
    const queuePayload = {
      provider_name: provider,
      entity_type: entityType,
      original_value: originalValue,
      reason,
      status: 'pending'
    };

    const { error } = await supabase.from('wh_manual_review_queue').insert(queuePayload);
    if (error) {
      console.warn(`[EntityResolver] Failed to enqueue manual review: ${error.message}`);
    }
  }
}
