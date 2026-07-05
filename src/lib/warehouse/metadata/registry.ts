import { supabase } from '@/lib/supabase.server';
import { DataContractDefinition } from './dataContract';

export interface DatasetMetadataModel {
  id?: string;
  datasetId: string;
  version: string;
  schemaDefinition: DataContractDefinition;
  checksum: string;
  compression?: 'gzip' | 'none' | 'zstd';
  partitionCount?: number;
  rowCount?: number;
  provider: string;
  coveragePct?: number;
  generatedAt?: string;
}

export interface EntityAliasModel {
  id?: number;
  canonicalId: number;
  entityType: 'TEAM' | 'LEAGUE' | 'COMPETITION';
  providerName: string;
  aliasName: string;
  confidenceScore?: number;
  manualOverride?: boolean;
}

export class MetadataRegistry {
  /**
   * Registers a dataset snapshot to the metadata store.
   */
  public async registerDataset(model: DatasetMetadataModel): Promise<DatasetMetadataModel> {
    const payload = {
      dataset_id: model.datasetId,
      version: model.version,
      schema_definition: model.schemaDefinition,
      checksum: model.checksum,
      compression: model.compression || 'gzip',
      partition_count: model.partitionCount || 0,
      row_count: model.rowCount || 0,
      provider: model.provider,
      coverage_pct: model.coveragePct || 100.0,
      generated_at: model.generatedAt || new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('wh_dataset_metadata')
      .upsert(payload, { onConflict: 'dataset_id,version' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`[MetadataRegistry] Failed to register dataset: ${error.message}`);
    }

    return {
      id: data.id,
      datasetId: data.dataset_id,
      version: data.version,
      schemaDefinition: data.schema_definition,
      checksum: data.checksum,
      compression: data.compression,
      partitionCount: data.partition_count,
      rowCount: data.row_count,
      provider: data.provider,
      coveragePct: data.coverage_pct,
      generatedAt: data.generated_at
    };
  }

  /**
   * Retrieves dataset metadata by ID and version.
   */
  public async getDataset(datasetId: string, version: string): Promise<DatasetMetadataModel | null> {
    const { data, error } = await supabase
      .from('wh_dataset_metadata')
      .select('*')
      .eq('dataset_id', datasetId)
      .eq('version', version)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      datasetId: data.dataset_id,
      version: data.version,
      schemaDefinition: data.schema_definition,
      checksum: data.checksum,
      compression: data.compression,
      partitionCount: data.partition_count,
      rowCount: data.row_count,
      provider: data.provider,
      coveragePct: data.coverage_pct,
      generatedAt: data.generated_at
    };
  }

  /**
   * Registers an alias for entity resolution.
   */
  public async registerAlias(model: EntityAliasModel): Promise<EntityAliasModel> {
    const payload = {
      canonical_id: model.canonicalId,
      entity_type: model.entityType,
      provider_name: model.providerName,
      alias_name: model.aliasName,
      confidence_score: model.confidenceScore || 100.0,
      manual_override: model.manualOverride || false
    };

    const { data, error } = await supabase
      .from('wh_entity_aliases')
      .upsert(payload, { onConflict: 'provider_name,entity_type,alias_name' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`[MetadataRegistry] Failed to register alias: ${error.message}`);
    }

    return {
      id: Number(data.id),
      canonicalId: Number(data.canonical_id),
      entityType: data.entity_type,
      providerName: data.provider_name,
      aliasName: data.alias_name,
      confidenceScore: Number(data.confidence_score),
      manualOverride: data.manual_override
    };
  }

  /**
   * Resolves a provider alias to its canonical surrogate ID.
   */
  public async resolveAlias(
    providerName: string,
    entityType: 'TEAM' | 'LEAGUE' | 'COMPETITION',
    aliasName: string
  ): Promise<{ canonicalId: number; confidenceScore: number } | null> {
    const { data, error } = await supabase
      .from('wh_entity_aliases')
      .select('canonical_id, confidence_score')
      .eq('provider_name', providerName)
      .eq('entity_type', entityType)
      .eq('alias_name', aliasName)
      .maybeSingle();

    if (error || !data) return null;

    return {
      canonicalId: Number(data.canonical_id),
      confidenceScore: Number(data.confidence_score)
    };
  }
}
