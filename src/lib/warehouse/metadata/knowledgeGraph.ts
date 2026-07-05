import { supabase } from '@/lib/supabase.server';

export interface KnowledgeEdgeModel {
  id?: number;
  sourceId: number;
  sourceType: string;
  targetId: number;
  targetType: string;
  relationshipType: string;
  confidenceScore?: number;
  sourceProvenance: string;
  lastSeen?: string;
}

export class KnowledgeGraphClient {
  /**
   * Registers a knowledge graph edge connection.
   */
  public async addEdge(edge: KnowledgeEdgeModel): Promise<KnowledgeEdgeModel> {
    const payload = {
      source_id: edge.sourceId,
      source_type: edge.sourceType,
      target_id: edge.targetId,
      target_type: edge.targetType,
      relationship_type: edge.relationshipType,
      confidence_score: edge.confidenceScore || 100.0,
      source_provenance: edge.sourceProvenance,
      last_seen: edge.lastSeen || new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('wh_knowledge_edges')
      .upsert(payload, { onConflict: 'source_id,source_type,target_id,target_type,relationship_type' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`[KnowledgeGraphClient] Failed to add edge: ${error.message}`);
    }

    return {
      id: Number(data.id),
      sourceId: Number(data.source_id),
      sourceType: data.source_type,
      targetId: Number(data.target_id),
      targetType: data.target_type,
      relationshipType: data.relationship_type,
      confidenceScore: Number(data.confidence_score),
      sourceProvenance: data.source_provenance,
      lastSeen: data.last_seen
    };
  }

  /**
   * Queries connected targets from a source node.
   */
  public async getConnectedTargets(sourceId: number, sourceType: string): Promise<KnowledgeEdgeModel[]> {
    const { data, error } = await supabase
      .from('wh_knowledge_edges')
      .select('*')
      .eq('source_id', sourceId)
      .eq('source_type', sourceType);

    if (error || !data) return [];

    return data.map(item => ({
      id: Number(item.id),
      sourceId: Number(item.source_id),
      sourceType: item.source_type,
      targetId: Number(item.target_id),
      targetType: item.target_type,
      relationshipType: item.relationship_type,
      confidenceScore: Number(item.confidence_score),
      sourceProvenance: item.source_provenance,
      lastSeen: item.last_seen
    }));
  }
}
