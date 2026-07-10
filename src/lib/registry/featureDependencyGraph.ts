/**
 * HandicapLab Feature Dependency Graph
 * =======================================
 * Directed acyclic graph (DAG) of feature dependencies.
 *
 * If a feature changes, every downstream feature is identified.
 * Enables impact analysis: "What breaks if poisson-attack changes?"
 */

import { FeatureStore, FeatureDefinition } from './featureStore';

export interface DependencyNode {
  id: string;
  name: string;
  version: string;
  type: string;
  depth: number;
  dependents: string[];
  dependencies: string[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'depends-on' | 'used-by';
}

export class FeatureDependencyGraph {
  private nodes: Map<string, DependencyNode> = new Map();
  private edges: DependencyEdge[] = [];

  constructor(featureStore?: FeatureStore) {
    if (featureStore) {
      this.buildFromStore(featureStore);
    }
  }

  buildFromStore(store: FeatureStore): void {
    this.nodes.clear();
    this.edges = [];
    const features = store.getAll();

    for (const f of features) {
      this.addFeature(f);
    }
  }

  addFeature(feature: FeatureDefinition): void {
    const existing = this.nodes.get(feature.id);

    const node: DependencyNode = {
      id: feature.id,
      name: feature.name,
      version: feature.version,
      type: feature.type,
      depth: 0,
      dependents: [],
      dependencies: [...feature.dependencies],
    };

    this.nodes.set(feature.id, node);

    // Add edges for dependencies
    for (const depId of feature.dependencies) {
      this.edges.push({ from: feature.id, to: depId, type: 'depends-on' });

      // Update the dependency's dependents list
      const depNode = this.nodes.get(depId);
      if (depNode && !depNode.dependents.includes(feature.id)) {
        depNode.dependents.push(feature.id);
      }
    }

    // Recalculate depths if this is an update
    if (!existing) {
      this.recalculateDepths();
    }
  }

  private recalculateDepths(): void {
    // Topological sort via Kahn's algorithm
    const inDegree = new Map<string, number>();
    const queue: string[] = [];

    for (const [id] of this.nodes) {
      inDegree.set(id, this.nodes.get(id)!.dependencies.length);
      if (inDegree.get(id) === 0) {
        queue.push(id);
      }
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      sorted.push(id);
      const node = this.nodes.get(id)!;
      for (const depId of node.dependencies) {
        const depNode = this.nodes.get(depId);
        if (depNode) {
          const currentIn = inDegree.get(depNode.id) || 0;
          inDegree.set(depNode.id, currentIn - 1);
          if (currentIn - 1 === 0) {
            queue.push(depNode.id);
          }
        }
      }
    }

    // Assign depths based on topological order
    const depths = new Map<string, number>();
    for (const id of sorted) {
      const node = this.nodes.get(id)!;
      let maxDepth = 0;
      for (const depId of node.dependencies) {
        const depDepth = depths.get(depId) ?? 0;
        maxDepth = Math.max(maxDepth, depDepth + 1);
      }
      depths.set(id, maxDepth);
      node.depth = maxDepth;
    }
  }

  getNode(id: string): DependencyNode | undefined {
    return this.nodes.get(id);
  }

  getAllNodes(): DependencyNode[] {
    return Array.from(this.nodes.values()).sort((a, b) => a.depth - b.depth);
  }

  /**
   * Impact analysis: if featureId changes, which dependents are affected?
   */
  analyzeImpact(featureId: string): { root: DependencyNode; affected: DependencyNode[]; maxDepth: number } {
    const root = this.nodes.get(featureId);
    if (!root) throw new Error(`Feature ${featureId} not found in graph`);

    const visited = new Set<string>();
    const affected: DependencyNode[] = [];
    let maxDepth = root.depth;

    const traverse = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      const node = this.nodes.get(id);
      if (node && node.id !== featureId) {
        affected.push(node);
        maxDepth = Math.max(maxDepth, node.depth);
      }
      if (node) {
        for (const depId of node.dependents) {
          traverse(depId);
        }
      }
    };

    traverse(featureId);

    return { root, affected, maxDepth };
  }

  /**
   * Find circular dependencies in the graph.
   */
  findCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (id: string, path: string[]) => {
      if (recStack.has(id)) {
        // Found a cycle
        const cycleStart = path.indexOf(id);
        cycles.push(path.slice(cycleStart));
        return;
      }
      if (visited.has(id)) return;

      visited.add(id);
      recStack.add(id);

      const node = this.nodes.get(id);
      if (node) {
        for (const depId of node.dependencies) {
          dfs(depId, [...path, depId]);
        }
      }

      recStack.delete(id);
    };

    for (const [id] of this.nodes) {
      if (!visited.has(id)) {
        dfs(id, [id]);
      }
    }

    return cycles;
  }

  /**
   * Get the complete dependency chain as a human-readable path.
   */
  getDependencyPath(featureId: string): string[] {
    const node = this.nodes.get(featureId);
    if (!node) return [];

    const path: string[] = [node.name];
    let current = node;
    while (current.dependencies.length > 0) {
      const depId = current.dependencies[0];
      const depNode = this.nodes.get(depId);
      if (!depNode) break;
      path.push(depNode.name);
      current = depNode;
    }
    return path;
  }
}