import { z } from 'zod';

export const UncertaintyRegistryEntrySchema = z.object({
  id: z.string().optional(),
  experiment_id: z.string(),
  uncertainty_method: z.string(),
  entropy: z.number().nullable().optional(),
  variance: z.number().nullable().optional(),
  ood_score: z.number().nullable().optional(),
  shift_score: z.number().nullable().optional(),
  agreement_score: z.number().nullable().optional(),
  confidence: z.number().nullable().optional(),
  decision_accuracy: z.number().nullable().optional(),
  created_at: z.string().optional()
});

export type UncertaintyRegistryEntry = z.infer<typeof UncertaintyRegistryEntrySchema>;

export class UncertaintyRegistry {
  private static registry: UncertaintyRegistryEntry[] = [];

  static async register(entry: UncertaintyRegistryEntry): Promise<UncertaintyRegistryEntry> {
    const validated = UncertaintyRegistryEntrySchema.parse(entry);
    const newEntry = {
      ...validated,
      id: Math.random().toString(36).substring(7),
      created_at: new Date().toISOString(),
    };
    this.registry.push(newEntry);
    return newEntry;
  }

  static async getAll(): Promise<UncertaintyRegistryEntry[]> {
    return [...this.registry];
  }
}
