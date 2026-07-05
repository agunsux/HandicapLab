import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CheckpointService,
  CheckpointRepository,
  CheckpointModel,
  CheckpointValidator
} from '../src/lib/warehouse/ingestion/checkpoint';
import { ValidationError } from '../src/lib/warehouse/ingestion/errors';

describe('CheckpointValidator', () => {
  it('should validate complete models', () => {
    const valid: CheckpointModel = {
      provider: 'api-football',
      league: 'EPL',
      season: 2026,
      endpoint: 'fixtures'
    };
    expect(() => CheckpointValidator.validate(valid)).not.toThrow();
  });

  it('should throw ValidationError on missing fields', () => {
    const invalid = { provider: 'api-football' } as any;
    expect(() => CheckpointValidator.validate(invalid)).toThrow(ValidationError);
  });
});

describe('CheckpointService & Repository Transitions', () => {
  let mockRepo: CheckpointRepository;
  let service: CheckpointService;
  let dbState: CheckpointModel | null = null;

  beforeEach(() => {
    dbState = null;
    
    // Construct mock repository
    mockRepo = {
      get: vi.fn().mockImplementation(async () => dbState),
      upsert: vi.fn().mockImplementation(async (model: CheckpointModel) => {
        dbState = { ...model, id: model.id || 'mock-uuid' };
        return dbState;
      })
    } as any;

    service = new CheckpointService(mockRepo);
  });

  it('should initialize and resume checkpoint correctly', async () => {
    const resumed = await service.resume('api-football', 'EPL', 2026, 'fixtures');
    expect(resumed.status).toBe('running');
    expect(resumed.page).toBe(1);
    expect(resumed.started_at).toBeDefined();
  });

  it('should allow pausing a running checkpoint', async () => {
    // Start running
    await service.resume('api-football', 'EPL', 2026, 'fixtures');
    
    // Pause
    const paused = await service.pause('api-football', 'EPL', 2026, 'fixtures');
    expect(paused.status).toBe('paused');
  });

  it('should reset checkpoint metrics on restart', async () => {
    // Create completed checkpoint
    dbState = {
      provider: 'api-football',
      league: 'EPL',
      season: 2026,
      endpoint: 'fixtures',
      status: 'completed',
      page: 10,
      rows_imported: 450
    };

    const restarted = await service.restart('api-football', 'EPL', 2026, 'fixtures');
    expect(restarted.status).toBe('pending');
    expect(restarted.page).toBe(1);
    expect(restarted.rows_imported).toBe(0);
  });

  it('should track retry count and record error on failure', async () => {
    dbState = {
      provider: 'api-football',
      league: 'EPL',
      season: 2026,
      endpoint: 'fixtures',
      status: 'running',
      retry_count: 1
    };

    const failed = await service.markFailed('api-football', 'EPL', 2026, 'fixtures', 'Timeout error');
    expect(failed.status).toBe('failed');
    expect(failed.retry_count).toBe(2);
    expect(failed.last_error).toBe('Timeout error');
  });
});
