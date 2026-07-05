import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimeSeriesSplitEngine, CalibrationEngine, MLTrainingService, TrainingJobModel } from '../src/lib/warehouse/metadata/mlTraining';
import { supabase } from '../src/lib/supabase.server';

describe('TimeSeriesSplitEngine Operations', () => {
  it('should split arrays for walk forward folds correctly', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const { train, validation } = TimeSeriesSplitEngine.walkForwardSplit(data, 0.7);

    expect(train.length).toBe(7);
    expect(validation.length).toBe(3);
    expect(train[6]).toBe(7);
    expect(validation[0]).toBe(8);
  });

  it('should compute rolling window folds correctly', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const { train, validation } = TimeSeriesSplitEngine.rollingWindowSplit(data, 5, 0);

    expect(train.length).toBe(5);
    expect(validation.length).toBe(1); // 5 * 0.3 = 1.5 -> floor(1.5) = 1
    expect(train[4]).toBe(5);
    expect(validation[0]).toBe(6);
  });
});

describe('CalibrationEngine Platt Scaling & Brier Scores', () => {
  it('should apply Platt Calibration scale constants', () => {
    // Prob 0.5 -> log odds = 0. Calibrated = 1 / (1 + exp(0)) = 0.5
    const prob = CalibrationEngine.plattScale(0.5, -1.0, 0.0);
    expect(prob).toBeCloseTo(0.5, 4);

    const highProb = CalibrationEngine.plattScale(0.7, -1.2, 0.1);
    expect(highProb).toBeGreaterThan(0.5);
  });

  it('should compute Brier scores accurately', () => {
    const predictions = [0.8, 0.2, 0.6];
    const outcomes = [1, 0, 1]; // diffs: (0.2)^2 + (0.2)^2 + (0.4)^2 = 0.04 + 0.04 + 0.16 = 0.24. Average = 0.08
    const brier = CalibrationEngine.computeBrierScore(predictions, outcomes);
    expect(brier).toBe(0.08);
  });
});

describe('MLTrainingService Job Registry Mocks', () => {
  let service: MLTrainingService;

  beforeEach(() => {
    service = new MLTrainingService();

    // Mock supabase calls
    vi.spyOn(supabase, 'from').mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 10, job_id: 'job-101', dataset_version: '1.0.0', algorithm: 'poisson', seed: 42, hyperparameters: {}, duration_ms: 200, status: 'completed', model_tier: 'challenger' } })
    } as any);
  });

  it('should register training job configurations', async () => {
    const job: TrainingJobModel = {
      jobId: 'job-101',
      datasetVersion: '1.0.0',
      featureSet: ['goal_average'],
      algorithm: 'poisson',
      seed: 42,
      hyperparameters: {}
    };

    const result = await service.registerJob(job);
    expect(result.jobId).toBe('job-101');
    expect(result.status).toBe('completed');
  });

  it('should promote candidate models via client promotion', async () => {
    const updateSpy = vi.spyOn(supabase, 'from');
    await service.promoteModel('job-101', 'champion');
    expect(updateSpy).toHaveBeenCalledWith('wh_ml_training_jobs');
  });
});
