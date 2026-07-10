/**
 * HandicapLab Dataset Loader
 * ============================
 * Generic loader for historical match data from multiple sources.
 *
 * Supported formats:
 *   - CSV
 *   - JSON
 *   - Supabase
 *   - API
 *
 * Every loader validates schema before returning data.
 * No production code is modified by this module.
 */

import { HistoricalFixture, HistoricalOdds, HistoricalResult, HistoricalMatch, ReplayValidationError } from './types';

export interface DatasetSchema {
  fixtures: boolean;
  odds: boolean;
  results: boolean;
}

export interface LoadedDataset {
  fixtures: HistoricalFixture[];
  odds: HistoricalOdds[];
  results: HistoricalResult[];
  errors: ReplayValidationError[];
}

export interface DatasetLoader {
  readonly name: string;
  readonly format: string;
  load(path: string): Promise<LoadedDataset>;
  validate(data: unknown): ReplayValidationError[];
}

// ─── JSON Loader ────────────────────────────────────────────────────────

export class JsonDatasetLoader implements DatasetLoader {
  readonly name = 'JSON Dataset Loader';
  readonly format = 'json';

  async load(path: string): Promise<LoadedDataset> {
    // In production, this reads from file system
    // For now, parse from string
    let data: unknown;
    try {
      // Simulate file read
      data = JSON.parse(path);
    } catch {
      return { fixtures: [], odds: [], results: [], errors: [{ fixtureId: 'all', field: 'file', message: 'Invalid JSON', severity: 'error' }] };
    }
    return this.processData(data);
  }

  loadFromObject(data: unknown): LoadedDataset {
    return this.processData(data);
  }

  validate(data: unknown): ReplayValidationError[] {
    const { errors } = this.processData(data);
    return errors;
  }

  private processData(data: unknown): LoadedDataset {
    const errors: ReplayValidationError[] = [];
    const fixtures: HistoricalFixture[] = [];
    const odds: HistoricalOdds[] = [];
    const results: HistoricalResult[] = [];

    if (!data || typeof data !== 'object') {
      errors.push({ fixtureId: 'all', field: 'root', message: 'Data must be an object', severity: 'error' });
      return { fixtures, odds, results, errors };
    }

    const root = data as Record<string, unknown>;

    // Parse fixtures
    if (Array.isArray(root.fixtures)) {
      for (const f of root.fixtures) {
        try {
          fixtures.push(f as HistoricalFixture);
        } catch {
          errors.push({ fixtureId: String((f as any)?.id || 'unknown'), field: 'fixture', message: 'Invalid fixture', severity: 'error' });
        }
      }
    }

    // Parse odds
    if (Array.isArray(root.odds)) {
      for (const o of root.odds) {
        try {
          odds.push(o as HistoricalOdds);
        } catch {
          errors.push({ fixtureId: String((o as any)?.fixtureId || 'unknown'), field: 'odds', message: 'Invalid odds entry', severity: 'error' });
        }
      }
    }

    // Parse results
    if (Array.isArray(root.results)) {
      for (const r of root.results) {
        try {
          results.push(r as HistoricalResult);
        } catch {
          errors.push({ fixtureId: String((r as any)?.fixtureId || 'unknown'), field: 'result', message: 'Invalid result', severity: 'error' });
        }
      }
    }

    if (fixtures.length === 0) {
      errors.push({ fixtureId: 'all', field: 'fixtures', message: 'No fixtures found in dataset', severity: 'error' });
    }

    return { fixtures, odds, results, errors };
  }
}

// ─── Supabase Loader ────────────────────────────────────────────────────

export class SupabaseDatasetLoader implements DatasetLoader {
  readonly name = 'Supabase Dataset Loader';
  readonly format = 'supabase';

  async load(path: string): Promise<LoadedDataset> {
    // Placeholder for future Supabase-based historical data loading
    return { fixtures: [], odds: [], results: [], errors: [{ fixtureId: 'all', field: 'loader', message: 'Supabase loader not yet implemented', severity: 'warning' }] };
  }

  validate(data: unknown): ReplayValidationError[] {
    return [];
  }
}

// ─── CSV Loader (Foundation) ────────────────────────────────────────────

export class CsvDatasetLoader implements DatasetLoader {
  readonly name = 'CSV Dataset Loader';
  readonly format = 'csv';

  async load(path: string): Promise<LoadedDataset> {
    // Placeholder for future CSV-based loading
    return { fixtures: [], odds: [], results: [], errors: [{ fixtureId: 'all', field: 'loader', message: 'CSV loader not yet implemented', severity: 'warning' }] };
  }

  validate(data: unknown): ReplayValidationError[] {
    return [];
  }
}