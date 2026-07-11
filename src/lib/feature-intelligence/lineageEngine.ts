/**
 * EPIC 19.2 — Feature Lineage
 */

import type { FeatureLineageGraph, LineageNode, LineageNodeType, LineageEdge } from './types';
import { generateLineageId } from './id';

export class FeatureLineageEngine {
  buildLineage(featureId: string): FeatureLineageGraph {
    const nodes: LineageNode[] = [];
    const edges: LineageEdge[] = [];
    const now = new Date().toISOString();

    nodes.push({ id: featureId, type: 'feature', label: `Feature ${featureId}`, timestamp: now, metadata: { featureId } });
    nodes.push({ id: `${featureId}:raw`, type: 'raw_source', label: `Raw Source for ${featureId}`, timestamp: now, metadata: { source: 'unknown' } });
    edges.push({ from: `${featureId}:raw`, to: featureId, label: 'transforms_to' });

    return {
      lineageId: generateLineageId(),
      nodes,
      edges,
      generatedAt: now,
    };
  }

  addTransformation(graph: FeatureLineageGraph, transformationId: string, label: string): FeatureLineageGraph {
    const now = new Date().toISOString();
    return {
      ...graph,
      nodes: [...graph.nodes, { id: transformationId, type: 'transformation', label, timestamp: now, metadata: {} }],
      edges: [...graph.edges, { from: graph.nodes[0]?.id ?? '', to: transformationId, label: 'transforms_to' }],
    };
  }
}

export const defaultFeatureLineageEngine = new FeatureLineageEngine();