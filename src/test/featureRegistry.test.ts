import { describe, it, expect } from 'vitest';
import { FeatureRegistry, FeatureDefinition } from '../lib/feature-platform/registry';

describe('Feature Registry & DAG Resolution', () => {
  it('should successfully resolve DAG without circular dependencies', () => {
    const registry = new FeatureRegistry();
    
    registry.register({
      id: 'base_stat',
      dependencies: [],
      // Mocks for other fields
    } as any);

    registry.register({
      id: 'derived_stat_1',
      dependencies: ['base_stat'],
    } as any);

    registry.register({
      id: 'derived_stat_2',
      dependencies: ['derived_stat_1'],
    } as any);

    const order = registry.resolveDAG();
    expect(order).toEqual(['base_stat', 'derived_stat_1', 'derived_stat_2']);
  });

  it('should detect circular dependencies and throw', () => {
    const registry = new FeatureRegistry();
    
    registry.register({
      id: 'A',
      dependencies: ['B'],
    } as any);

    registry.register({
      id: 'B',
      dependencies: ['C'],
    } as any);

    registry.register({
      id: 'C',
      dependencies: ['A'],
    } as any);

    expect(() => registry.resolveDAG()).toThrow(/Circular dependency/);
  });
});
