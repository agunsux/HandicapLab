import { z } from 'zod';

export const CalibrationRegistryEntrySchema = z.object({
  id: z.string().optional(),
  method: z.string(),
  dataset: z.string(),
  protocol: z.string(),
  ece: z.number(),
  brier: z.number(),
  log_loss: z.number(),
  created_at: z.string().optional(),
  approved_at: z.string().nullable().optional(),
  champion: z.boolean().default(false),
});

export type CalibrationRegistryEntry = z.infer<typeof CalibrationRegistryEntrySchema>;

// Mock implementation for the registry (would be backed by DB)
export class CalibrationRegistry {
  private static registry: CalibrationRegistryEntry[] = [];

  static async register(entry: CalibrationRegistryEntry): Promise<CalibrationRegistryEntry> {
    const validated = CalibrationRegistryEntrySchema.parse(entry);
    const newEntry = {
      ...validated,
      id: Math.random().toString(36).substring(7),
      created_at: new Date().toISOString(),
    };
    this.registry.push(newEntry);
    return newEntry;
  }

  static async getChampion(method?: string): Promise<CalibrationRegistryEntry | null> {
    const champions = this.registry.filter(e => e.champion && (!method || e.method === method));
    if (champions.length === 0) return null;
    return champions.reduce((prev, current) => (prev.brier < current.brier ? prev : current)); // simple rule for mock
  }

  static async getAll(): Promise<CalibrationRegistryEntry[]> {
    return [...this.registry];
  }

  static async promote(id: string): Promise<void> {
    const entry = this.registry.find(e => e.id === id);
    if (entry) {
      entry.champion = true;
      entry.approved_at = new Date().toISOString();
    }
  }
}
