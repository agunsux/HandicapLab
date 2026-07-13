export interface GraphNode { id: string; label: string; category: string; metadata: Record<string, unknown>; }
export interface GraphEdge { source: string; target: string; relationship: string; bidirectional: boolean; metadata: Record<string, unknown>; }

const DOMAIN_CATEGORIES: Record<string, string> = {
  Competition: 'competition', Season: 'season', League: 'league', Fixture: 'fixture',
  Team: 'team', Player: 'player', Venue: 'venue', Odds: 'odds', Market: 'market',
  Prediction: 'prediction', Probability: 'probability', Calibration: 'calibration',
  Feature: 'feature', Decision: 'decision', Policy: 'policy', Stake: 'stake',
  Portfolio: 'portfolio', Research: 'research', Replay: 'replay', Evidence: 'evidence',
  Experiment: 'experiment', Model: 'model', Provider: 'provider', Result: 'result',
  Performance: 'performance', Drift: 'drift', Risk: 'risk', Report: 'report',
};

const DOMAIN_EDGES = [
  { source: 'Competition', target: 'Season', relationship: 'has' },
  { source: 'Season', target: 'League', relationship: 'has' },
  { source: 'League', target: 'Fixture', relationship: 'contains' },
  { source: 'Team', target: 'Fixture', relationship: 'participates_in', bidirectional: true },
  { source: 'Fixture', target: 'Odds', relationship: 'has' },
  { source: 'Fixture', target: 'Prediction', relationship: 'has' },
  { source: 'Prediction', target: 'Decision', relationship: 'triggers' },
  { source: 'Decision', target: 'Stake', relationship: 'produces' },
  { source: 'Stake', target: 'Portfolio', relationship: 'belongs_to' },
  { source: 'Prediction', target: 'Calibration', relationship: 'validated_by' },
  { source: 'Prediction', target: 'Performance', relationship: 'measured_by' },
  { source: 'Fixture', target: 'Result', relationship: 'produces' },
  { source: 'Replay', target: 'Evidence', relationship: 'produces' },
  { source: 'Experiment', target: 'Model', relationship: 'tests' },
  { source: 'Model', target: 'Prediction', relationship: 'generates' },
  { source: 'Provider', target: 'Odds', relationship: 'provides' },
  { source: 'Feature', target: 'Model', relationship: 'trains' },
  { source: 'Model', target: 'Calibration', relationship: 'has' },
  { source: 'League', target: 'Team', relationship: 'contains', bidirectional: true },
  { source: 'Team', target: 'Player', relationship: 'has' },
  { source: 'Fixture', target: 'Venue', relationship: 'played_at' },
  { source: 'Competition', target: 'Team', relationship: 'has' },
  { source: 'Model', target: 'Performance', relationship: 'has' },
  { source: 'Market', target: 'Odds', relationship: 'classifies' },
  { source: 'Policy', target: 'Decision', relationship: 'governs' },
  { source: 'Drift', target: 'Model', relationship: 'affects' },
  { source: 'Risk', target: 'Portfolio', relationship: 'belongs_to' },
  { source: 'Report', target: 'Performance', relationship: 'summarizes' },
  { source: 'Evidence', target: 'Report', relationship: 'feeds_into' },
  { source: 'Research', target: 'Evidence', relationship: 'produces' },
  { source: 'Feature', target: 'Fixture', relationship: 'calculates_for' },
  { source: 'Probability', target: 'Prediction', relationship: 'feeds' },
];

export class DomainGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge[]> = new Map();

  constructor() { this.initializeDefaultNodes(); this.initializeDefaultEdges(); }

  private initializeDefaultNodes(): void {
    for (const [label, category] of Object.entries(DOMAIN_CATEGORIES)) {
      this.nodes.set(label, { id: label.toLowerCase(), label, category, metadata: {} });
    }
  }

  private initializeDefaultEdges(): void {
    for (const def of DOMAIN_EDGES) {
      this.addEdge({ source: def.source, target: def.target, relationship: def.relationship, bidirectional: def.bidirectional ?? false, metadata: {} });
    }
  }

  addNode(node: GraphNode): void { this.nodes.set(node.id, node); }
  addEdge(edge: GraphEdge): void {
    if (!this.edges.has(edge.source)) this.edges.set(edge.source, []);
    this.edges.get(edge.source)!.push(edge);
  }

  getNode(id: string): GraphNode | undefined { return this.nodes.get(id); }
  getEdges(id: string): GraphEdge[] { return this.edges.get(id) ?? []; }

  getNeighbors(id: string, direction: 'in' | 'out' | 'both' = 'both'): string[] {
    const result: string[] = [];
    if (direction === 'out' || direction === 'both') for (const e of this.edges.get(id) ?? []) result.push(e.target);
    if (direction === 'in' || direction === 'both') for (const [, edges] of this.edges) for (const e of edges) if (e.target === id && e.source !== id) result.push(e.source);
    return [...new Set(result)];
  }

  getPath(from: string, to: string): GraphEdge[] | null {
    const visited = new Set<string>();
    const queue: { node: string; path: GraphEdge[] }[] = [{ node: from, path: [] }];
    while (queue.length > 0) {
      const { node, path } = queue.shift()!;
      if (node === to) return path;
      if (visited.has(node)) continue;
      visited.add(node);
      for (const edge of this.edges.get(node) ?? []) queue.push({ node: edge.target, path: [...path, edge] });
    }
    return null;
  }

  findCycles(): string[][] {
    const visited = new Set<string>(), recStack = new Set<string>(), cycles: string[][] = [];
    const dfs = (node: string, path: string[]) => {
      visited.add(node); recStack.add(node);
      for (const edge of this.edges.get(node) ?? []) {
        if (!visited.has(edge.target)) dfs(edge.target, [...path, edge.target]);
        else if (recStack.has(edge.target)) { const i = path.indexOf(edge.target); if (i !== -1) cycles.push(path.slice(i)); }
      }
      recStack.delete(node);
    };
    for (const id of this.nodes.keys()) if (!visited.has(id)) dfs(id, [id]);
    return cycles;
  }

  validate(): boolean {
    for (const [, edges] of this.edges) for (const edge of edges) if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) return false;
    return true;
  }

  getGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return { nodes: [...this.nodes.values()], edges: [...this.edges.values()].flat() };
  }

  toTopologicalOrder(): string[] {
    const inDegree = new Map<string, number>();
    for (const id of this.nodes.keys()) inDegree.set(id, 0);
    for (const [, edges] of this.edges) for (const edge of edges) inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    const queue: string[] = [];
    for (const [id, degree] of inDegree) if (degree === 0) queue.push(id);
    const result: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      for (const edge of this.edges.get(node) ?? []) {
        const d = (inDegree.get(edge.target) ?? 1) - 1;
        inDegree.set(edge.target, d);
        if (d === 0) queue.push(edge.target);
      }
    }
    return result;
  }

  detectOrphans(): string[] {
    const connected = new Set<string>();
    for (const [, edges] of this.edges) for (const edge of edges) { connected.add(edge.source); connected.add(edge.target); }
    return [...this.nodes.keys()].filter(id => !connected.has(id));
  }

  getSubgraph(category: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const ids = new Set([...this.nodes.values()].filter(n => n.category === category).map(n => n.id));
    const sub: GraphEdge[] = [];
    for (const [, edges] of this.edges) for (const edge of edges) if (ids.has(edge.source) && ids.has(edge.target)) sub.push(edge);
    return { nodes: [...ids].map(id => this.nodes.get(id)!).filter(Boolean), edges: sub };
  }
}
