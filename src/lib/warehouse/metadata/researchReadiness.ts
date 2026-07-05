import { supabase } from '@/lib/supabase.server';

export interface DatasetRegistryModel {
  id?: number;
  datasetId: string;
  version: string;
  datasetType?: 'silver' | 'benchmark' | 'feature';
  sourceProvenance: string;
  coveragePct: number;
  checksum: string;
  partitionList?: string[];
  schemaVersion: string;
  isFrozen?: boolean;
  isBenchmark?: boolean;
}

export interface DatasetProfileModel {
  registryId: number;
  rowCount: number;
  nullPct: number;
  duplicatePct: number;
  missingFixturesCount: number;
  outliersCount: number;
}

export class ResearchReadinessService {
  /**
   * Registers a dataset in the research registry.
   */
  public async registerDataset(model: DatasetRegistryModel): Promise<DatasetRegistryModel> {
    // Check if the dataset version is already registered and frozen
    const { data: existing } = await supabase
      .from('wh_dataset_registry')
      .select('id, is_frozen')
      .eq('dataset_id', model.datasetId)
      .eq('version', model.version)
      .maybeSingle();

    if (existing && existing.is_frozen) {
      throw new Error(`Cannot modify frozen dataset version: ${model.datasetId} (v${model.version})`);
    }

    const payload = {
      dataset_id: model.datasetId,
      version: model.version,
      dataset_type: model.datasetType || 'silver',
      source_provenance: model.sourceProvenance,
      coverage_pct: model.coveragePct,
      checksum: model.checksum,
      partition_list: model.partitionList || [],
      schema_version: model.schemaVersion,
      is_frozen: model.isFrozen || false,
      is_benchmark: model.isBenchmark || false
    };

    const { data, error } = await supabase
      .from('wh_dataset_registry')
      .upsert(payload, { onConflict: 'dataset_id,version' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`[DatasetRegistry] Failed to register: ${error.message}`);
    }

    return {
      id: Number(data.id),
      datasetId: data.dataset_id,
      version: data.version,
      datasetType: data.dataset_type,
      sourceProvenance: data.source_provenance,
      coveragePct: Number(data.coverage_pct),
      checksum: data.checksum,
      partitionList: data.partition_list,
      schemaVersion: data.schema_version,
      isFrozen: data.is_frozen,
      isBenchmark: data.is_benchmark
    };
  }

  /**
   * Freezes a dataset version to make it permanently read-only.
   */
  public async freezeDataset(datasetId: string, version: string): Promise<void> {
    const { error } = await supabase
      .from('wh_dataset_registry')
      .update({ is_frozen: true })
      .eq('dataset_id', datasetId)
      .eq('version', version);

    if (error) {
      throw new Error(`[DatasetFreezer] Failed to freeze dataset: ${error.message}`);
    }
  }

  /**
   * Profiles a collection of rows to compute statistics.
   */
  public profileData(rows: Record<string, any>[]): Omit<DatasetProfileModel, 'registryId'> {
    const rowCount = rows.length;
    if (rowCount === 0) {
      return { rowCount: 0, nullPct: 0, duplicatePct: 0, missingFixturesCount: 0, outliersCount: 0 };
    }

    let nullCount = 0;
    let totalFields = 0;
    const seen = new Set<string>();
    let duplicateCount = 0;
    let outliersCount = 0;

    for (const row of rows) {
      const serialized = JSON.stringify(row);
      if (seen.has(serialized)) {
        duplicateCount++;
      } else {
        seen.add(serialized);
      }

      for (const [key, val] of Object.entries(row)) {
        totalFields++;
        if (val === null || val === undefined) {
          nullCount++;
        }

        // Outlier detection for odds > 100 or probability < 0
        if (key === 'odds' && typeof val === 'number' && val > 100) {
          outliersCount++;
        }
      }
    }

    const nullPct = totalFields > 0 ? (nullCount / totalFields) * 100 : 0;
    const duplicatePct = (duplicateCount / rowCount) * 100;

    return {
      rowCount,
      nullPct: Number(nullPct.toFixed(2)),
      duplicatePct: Number(duplicatePct.toFixed(2)),
      missingFixturesCount: 0,
      outliersCount
    };
  }

  /**
   * Compares two dataset definitions to detect schema and coverage drift.
   */
  public detectDrift(
    source: DatasetRegistryModel,
    target: DatasetRegistryModel
  ): { schemaDrift: boolean; coverageDrift: number } {
    const schemaDrift = source.schemaVersion !== target.schemaVersion;
    const coverageDrift = Math.abs(source.coveragePct - target.coveragePct);

    return {
      schemaDrift,
      coverageDrift: Number(coverageDrift.toFixed(2))
    };
  }
}
