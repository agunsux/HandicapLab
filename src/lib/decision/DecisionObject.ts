import { z } from 'zod';
import { UncertaintyVectorSchema } from './UncertaintyVector';

export const DecisionObjectSchema = z.object({
  decision_version: z.literal('v1'),
  probability: z.number().nullable().optional(),
  expected_value: z.number().nullable().optional(),
  uncertainty_vector: UncertaintyVectorSchema,
  confidence: z.number().nullable().optional(),
  risk_level: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  decision: z.enum(['BET', 'NO_BET', 'INCONCLUSIVE', 'WAIT']),
  reasoning: z.array(z.string()).default([]),
  blocking_flags: z.array(z.string()).default([])
});

export type DecisionObject = z.infer<typeof DecisionObjectSchema>;

export class DecisionContract {
  static validate(data: unknown): DecisionObject {
    return DecisionObjectSchema.parse(data);
  }

  static createInconclusive(reason: string): DecisionObject {
    return {
      decision_version: 'v1',
      uncertainty_vector: {},
      decision: 'INCONCLUSIVE',
      reasoning: [reason],
      blocking_flags: ['CONFLICTING_EVIDENCE']
    };
  }
}
