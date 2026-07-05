import { supabase } from '@/lib/supabase.server';
import { ValidationError } from './errors';

export type CheckpointStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface CheckpointModel {
  id?: string;
  provider: string;
  league: string;
  season: number;
  endpoint: string;
  page?: number;
  last_cursor?: string | null;
  rows_imported?: number;
  rows_skipped?: number;
  rows_failed?: number;
  started_at?: string;
  updated_at?: string;
  completed_at?: string | null;
  status?: CheckpointStatus;
  retry_count?: number;
  last_error?: string | null;
}

export class CheckpointValidator {
  public static validate(model: CheckpointModel) {
    const errors: string[] = [];
    if (!model.provider) errors.push('provider is required');
    if (!model.league) errors.push('league is required');
    if (model.season === undefined || model.season <= 0) errors.push('season is required and must be positive');
    if (!model.endpoint) errors.push('endpoint is required');
    
    if (errors.length > 0) {
      throw new ValidationError('Checkpoint', errors);
    }
  }
}

export class CheckpointRepository {
  public async get(provider: string, league: string, season: number, endpoint: string): Promise<CheckpointModel | null> {
    const { data, error } = await supabase
      .from('wh_sync_checkpoints')
      .select('*')
      .eq('provider', provider)
      .eq('league', league)
      .eq('season', season)
      .eq('endpoint', endpoint)
      .maybeSingle();

    if (error) {
      console.error('[CheckpointRepository] Error fetching checkpoint:', error.message);
      return null;
    }
    return data;
  }

  public async upsert(model: CheckpointModel): Promise<CheckpointModel> {
    CheckpointValidator.validate(model);
    
    const payload = {
      ...model,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('wh_sync_checkpoints')
      .upsert(payload, { onConflict: 'provider,league,season,endpoint' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`[CheckpointRepository] Upsert failed: ${error.message}`);
    }
    return data;
  }
}

export class CheckpointService {
  private readonly repo: CheckpointRepository;

  constructor(repo?: CheckpointRepository) {
    this.repo = repo || new CheckpointRepository();
  }

  /**
   * Transition checkpoint state to running if valid.
   */
  public async resume(provider: string, league: string, season: number, endpoint: string): Promise<CheckpointModel> {
    let checkpoint = await this.repo.get(provider, league, season, endpoint);

    if (!checkpoint) {
      // Initialize if not exists
      checkpoint = {
        provider,
        league,
        season,
        endpoint,
        status: 'pending',
        page: 1,
        retry_count: 0
      };
    }

    if (checkpoint.status === 'completed') {
      throw new Error(`Cannot resume checkpoint that is already completed`);
    }

    checkpoint.status = 'running';
    checkpoint.started_at = new Date().toISOString();
    return await this.repo.upsert(checkpoint);
  }

  /**
   * Pause checkpoint progress.
   */
  public async pause(provider: string, league: string, season: number, endpoint: string): Promise<CheckpointModel> {
    const checkpoint = await this.repo.get(provider, league, season, endpoint);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found for ${provider}/${league}/${season}/${endpoint}`);
    }

    if (checkpoint.status !== 'running') {
      throw new Error(`Cannot pause checkpoint that is not currently running`);
    }

    checkpoint.status = 'paused';
    return await this.repo.upsert(checkpoint);
  }

  /**
   * Restart/reset checkpoint back to beginning.
   */
  public async restart(provider: string, league: string, season: number, endpoint: string): Promise<CheckpointModel> {
    const checkpoint = await this.repo.get(provider, league, season, endpoint);
    
    const freshCheckpoint: CheckpointModel = {
      provider,
      league,
      season,
      endpoint,
      status: 'pending',
      page: 1,
      last_cursor: null,
      rows_imported: 0,
      rows_skipped: 0,
      rows_failed: 0,
      started_at: new Date().toISOString(),
      completed_at: null,
      retry_count: 0,
      last_error: null
    };

    if (checkpoint && checkpoint.id) {
      freshCheckpoint.id = checkpoint.id;
    }

    return await this.repo.upsert(freshCheckpoint);
  }

  /**
   * Mark checkpoint successfully completed.
   */
  public async markCompleted(provider: string, league: string, season: number, endpoint: string): Promise<CheckpointModel> {
    const checkpoint = await this.repo.get(provider, league, season, endpoint);
    if (!checkpoint) throw new Error('Checkpoint not found');

    checkpoint.status = 'completed';
    checkpoint.completed_at = new Date().toISOString();
    return await this.repo.upsert(checkpoint);
  }

  /**
   * Mark checkpoint failed and store the error description.
   */
  public async markFailed(
    provider: string,
    league: string,
    season: number,
    endpoint: string,
    errorMessage: string
  ): Promise<CheckpointModel> {
    const checkpoint = await this.repo.get(provider, league, season, endpoint);
    if (!checkpoint) throw new Error('Checkpoint not found');

    checkpoint.status = 'failed';
    checkpoint.last_error = errorMessage;
    checkpoint.retry_count = (checkpoint.retry_count || 0) + 1;
    return await this.repo.upsert(checkpoint);
  }
}
