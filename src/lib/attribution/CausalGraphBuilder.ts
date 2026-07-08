import { CausalGraph, CausalNode, CausalEdge, Contribution, InteractionEffect } from './types';
import { DecisionObject } from '../decision/DecisionObject';

export class CausalGraphBuilder {
  /**
   * Translates contributions and interactions into a strict nodes/edges graph.
   */
  static build(decision: DecisionObject, contributions: Contribution[], interactions: InteractionEffect[]): CausalGraph {
    const nodes: CausalNode[] = [];
    const edges: CausalEdge[] = [];

    // Core Nodes
    nodes.push({ id: 'DECISION_FINAL', type: 'DECISION', label: `Decision: ${decision.decision}`, value: 1.0 });
    nodes.push({ id: 'CONFIDENCE', type: 'CONFIDENCE', label: 'Confidence Score', value: decision.confidence ?? 0 });

    edges.push({ from: 'CONFIDENCE', to: 'DECISION_FINAL', weight: decision.confidence ?? 0, relation: 'CAUSES' });

    // Map Contributions
    for (const c of contributions) {
      const nodeId = `NODE_${c.name}`;
      
      // Prevent duplicates if a factor acts across multiple dimensions
      if (!nodes.find(n => n.id === nodeId)) {
        nodes.push({
          id: nodeId,
          type: c.type,
          label: c.name,
          value: c.normalizedContribution
        });
      }

      // Link to Confidence if it's uncertainty/health/risk, else to Decision
      const targetId = (c.type === 'UNCERTAINTY' || c.type === 'HEALTH' || c.type === 'RISK') 
        ? 'CONFIDENCE' 
        : 'DECISION_FINAL';

      edges.push({
        from: nodeId,
        to: targetId,
        weight: c.normalizedContribution,
        relation: c.direction === 'POSITIVE' ? 'INCREASES' : 'DECREASES'
      });
    }

    // Map Interactions (Virtual Nodes)
    for (const i of interactions) {
      const interactionNodeId = `INT_${i.ruleId}`;
      nodes.push({
        id: interactionNodeId,
        type: 'FEATURE', // Synergy behaves like a meta-feature
        label: i.effectName,
        value: i.multiplier
      });

      // Link participating factors to the interaction node
      for (const factorName of i.participatingFactors) {
        edges.push({
          from: `NODE_${factorName}`,
          to: interactionNodeId,
          weight: 1.0,
          relation: 'CAUSES'
        });
      }

      // Link interaction node to decision
      edges.push({
        from: interactionNodeId,
        to: 'DECISION_FINAL',
        weight: i.multiplier > 1 ? i.multiplier - 1 : 1 - i.multiplier, // Absolute impact
        relation: i.impactDirection === 'POSITIVE' ? 'INCREASES' : 'DECREASES'
      });
    }

    return { nodes, edges };
  }
}
