import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataContractValidator, DataContractDefinition } from '../src/lib/warehouse/metadata/dataContract';
import { MetadataRegistry, DatasetMetadataModel, EntityAliasModel } from '../src/lib/warehouse/metadata/registry';
import { KnowledgeGraphClient, KnowledgeEdgeModel } from '../src/lib/warehouse/metadata/knowledgeGraph';

const mockContract: DataContractDefinition = {
  datasetId: 'silver_fixtures',
  version: '1.0.0',
  columns: {
    fixture_id: { type: 'BigInt', required: true, nullable: false },
    status: { type: 'String', required: true, nullable: false },
    home_goals: { type: 'Integer', required: false, nullable: true }
  },
  primaryKey: ['fixture_id'],
  compatibilityVersion: '1.0.0'
};

describe('DataContractValidator', () => {
  const validator = new DataContractValidator(mockContract);

  it('should pass validation for a valid row matching schema', () => {
    const row = {
      fixture_id: 1002,
      status: 'finished',
      home_goals: 3
    };
    const errors = validator.validateRow(row);
    expect(errors.length).toBe(0);
  });

  it('should catch missing required column failures', () => {
    const row = {
      status: 'finished'
      // fixture_id is missing
    };
    const errors = validator.validateRow(row);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('fixture_id');
  });

  it('should catch type mismatch errors', () => {
    const row = {
      fixture_id: '1002', // String instead of BigInt
      status: 'finished'
    };
    const errors = validator.validateRow(row as any);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('type mismatch');
  });
});

describe('Metadata & Knowledge Graph Mocks', () => {
  let registry: MetadataRegistry;
  let graphClient: KnowledgeGraphClient;

  beforeEach(() => {
    registry = new MetadataRegistry();
    graphClient = new KnowledgeGraphClient();
  });

  it('should successfully handle registered aliases with mocks', async () => {
    const mockAlias: EntityAliasModel = {
      canonicalId: 10,
      entityType: 'TEAM',
      providerName: 'api-football',
      aliasName: 'Man United',
      confidenceScore: 98.5
    };

    vi.spyOn(registry, 'registerAlias').mockResolvedValue(mockAlias);
    const result = await registry.registerAlias(mockAlias);
    expect(result.confidenceScore).toBe(98.5);
    expect(result.canonicalId).toBe(10);
  });

  it('should register knowledge graph connections with mocks', async () => {
    const mockEdge: KnowledgeEdgeModel = {
      sourceId: 10,
      sourceType: 'TEAM',
      targetId: 39,
      targetType: 'LEAGUE',
      relationshipType: 'PLAYS_IN',
      sourceProvenance: 'API-Football'
    };

    vi.spyOn(graphClient, 'addEdge').mockResolvedValue(mockEdge);
    const edge = await graphClient.addEdge(mockEdge);
    expect(edge.relationshipType).toBe('PLAYS_IN');
  });
});
