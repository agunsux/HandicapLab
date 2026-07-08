import { z } from 'zod';

export const ProbabilityObjectSchema = z.object({
  probability_version: z.literal('v1'),
  raw_probability: z.number().min(0).max(1),
  calibrated_probability: z.number().min(0).max(1).nullable().optional(),
  calibration_method: z.string().nullable().optional(),
  confidence_interval: z.tuple([z.number(), z.number()]).nullable().optional(),
  uncertainty_score: z.number().nullable().optional(),
  epistemic_uncertainty: z.number().nullable().optional(),
  aleatoric_uncertainty: z.number().nullable().optional(),
  expected_calibration_error: z.number().nullable().optional(),
  brier_score: z.number().nullable().optional(),
  log_loss: z.number().nullable().optional(),
  entropy: z.number().nullable().optional(),
  reliability_bucket: z.number().int().nullable().optional(),
  risk_flags: z.array(z.string()),
  explanation: z.string().nullable().optional(),
  feature_attribution: z.record(z.string(), z.number()).nullable().optional(),
  prediction_confidence: z.number().nullable().optional(),
  ood_score: z.number().nullable().optional()
});

export type ProbabilityObject = z.infer<typeof ProbabilityObjectSchema>;
