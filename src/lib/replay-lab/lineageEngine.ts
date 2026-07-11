/**
 * EPIC 16.9 — Experiment Lineage
 * ================================
 * Constructs complete lineage graphs for reproducibility.
 *
 * Every experiment, replay, dataset, manifest, evidence artifact, model,
 * feature, prediction, outcome, and evaluation is traceable.
 */

import type { LineageGraph, LineageNode, LineageNodeType, LineageEdge, ReplaySessionSnapshot } from './types';
import { generateLineageId } from './id';

export class LineageEngine {
  /**
   * Build a complete lineage graph for an experiment session.
   */
  buildLineage(
    experimentId: string,
    session: ReplaySessionSnapshot,
    additionalNodes: LineageNode[] = []
  ): LineageGraph {
    const nodes: LineageNode[] = [];
    const edges: LineageEdge[] = [];
    const now = new Date().toISOString();

    // Experiment node
    const expNode: LineageNode = {
      id: experimentId,
      type: 'experiment',
      label: `Experiment ${experimentId}`,
      timestamp: session.startTime,
      metadata: { experimentId },
    };
    nodes.push(expNode);

    // Replay session node
    const replayNode: LineageNode = {
      id: session.sessionId,
      type: 'replay',
      label: `Replay ${session.sessionId}`,
      timestamp: session.startTime,
      metadata: {
        sessionId: session.sessionId,
        modelVersion: session.modelVersion,
        featureVersion: session.featureVersion,
        seed: String(session.seed),
      },
    };
    nodes.push(replayNode);
    edges.push({ from: experimentId, to: session.sessionId, label: 'executes' });

    // Dataset node
    const datasetNode: LineageNode = {
      id: session.datasetId,
      type: 'dataset',
      label: `Dataset ${session.datasetId}`,
      timestamp: session.startTime,
      metadata: {
        datasetId: session.datasetId,
        fingerprint: session.datasetFingerprint,
        version: session.datasetVersion,
      },
    };
    nodes.push(datasetNode);
    edges.push({ from: session.sessionId, to: session.datasetId, label: 'uses' });

    // Add any additional nodes (model, features, etc.)
    for (const n of additionalNodes) {
      if (!nodes.some((existing) => existing.id === n.id)) {
        nodes.push(n);
        edges.push({ from: session.sessionId, to: n.id, label: `has_${n.type}` });
      }
    }

    return {
      lineageId: generateLineageId(),
      experimentId,
      nodes,
      edges,
      generatedAt: now,
    };
  }

  /** Serialize a lineage graph to JSON. */
  toJSON(graph: LineageGraph): string {
    return JSON.stringify(graph, null, 2);
  }
}

export const defaultLineageEngine = new LineageEngine();