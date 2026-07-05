import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Levenshtein, EntityResolver } from '../src/lib/warehouse/metadata/entityResolver';
import { MetadataRegistry } from '../src/lib/warehouse/metadata/registry';
import { KnowledgeGraphClient } from '../src/lib/warehouse/metadata/knowledgeGraph';
import { supabase } from '../src/lib/supabase.server';

describe('Levenshtein Similarity Logic', () => {
  it('should compute exact match as 1.0 similarity', () => {
    expect(Levenshtein.getSimilarity('Chelsea', 'Chelsea')).toBe(1.0);
  });

  it('should compute partial distance similarity accurately', () => {
    const sim = Levenshtein.getSimilarity('Chelsea FC', 'Chelsea');
    // "Chelsea FC" has length 10, "Chelsea" has length 7. Distance is 3.
    // Similarity = (10 - 3) / 10 = 0.7
    expect(sim).toBeCloseTo(0.7, 2);
  });

  it('should compute high similarity for minor differences', () => {
    const sim = Levenshtein.getSimilarity('Tottenham Hotspur', 'Tottenham Hotspurs');
    expect(sim).toBeGreaterThan(0.9);
  });
});

describe('EntityResolver Strategy Cascade', () => {
  let registry: MetadataRegistry;
  let graphClient: KnowledgeGraphClient;
  let resolver: EntityResolver;

  beforeEach(() => {
    registry = new MetadataRegistry();
    graphClient = new KnowledgeGraphClient();
    resolver = new EntityResolver(registry, graphClient);

    // Mock supabase insert (audit & manual review tables)
    vi.spyOn(supabase, 'from').mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null })
    } as any);
  });

  it('should resolve via alias lookup if registered', async () => {
    vi.spyOn(registry, 'resolveAlias').mockResolvedValue({
      canonicalId: 12,
      confidenceScore: 99.0
    });

    const result = await resolver.resolveTeam('api-football', '12', 'Arsenal FC');
    expect(result.canonicalId).toBe(12);
    expect(result.confidenceScore).toBe(99.0);
    expect(result.resolutionPath).toContain('alias_lookup');
  });

  it('should cascade to manual review queue if no match is found', async () => {
    vi.spyOn(registry, 'resolveAlias').mockResolvedValue(null);
    
    // Stub supabase team alias query to return empty
    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      insert: vi.fn().mockResolvedValue({ error: null })
    } as any);

    const result = await resolver.resolveTeam('api-football', '999', 'Unknown Team FC');
    expect(result.canonicalId).toBeNull();
    expect(result.manualReviewRequired).toBe(true);
    expect(result.resolutionPath).toContain('manual_review');
  });
});
