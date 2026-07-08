import { z } from 'zod';

export const UncertaintyVectorSchema = z.object({
  epistemic: z.number().nullable().optional(),
  aleatoric: z.number().nullable().optional(),
  data_quality: z.number().nullable().optional(),
  distribution_shift: z.number().nullable().optional(),
  calibration_quality: z.number().nullable().optional(),
  ensemble_agreement: z.number().nullable().optional(),
  external_consensus: z.number().nullable().optional(),
  evidence_agreement: z.number().nullable().optional()
});

export type UncertaintyVector = z.infer<typeof UncertaintyVectorSchema>;
