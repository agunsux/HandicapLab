// EPIC 52 Stage B — OpenWeatherMap client for venue weather at T-60 snapshot.
// Free tier: 1,000 calls/day (ample for football fixtures).
// Fetched at T-60 only (not polled). If unavailable, data_gap is flagged.

import { z } from 'zod';

if (typeof window !== 'undefined') {
  throw new Error('OpenWeather client can only be used on the server side.');
}

export const OpenWeatherCurrentSchema = z.object({
  coord: z.object({ lon: z.number(), lat: z.number() }),
  weather: z.array(z.object({
    id: z.number(),
    main: z.string(),
    description: z.string(),
    icon: z.string(),
  })),
  main: z.object({
    temp: z.number(),
    feels_like: z.number(),
    temp_min: z.number(),
    temp_max: z.number(),
    pressure: z.number(),
    humidity: z.number(),
  }),
  visibility: z.number().optional(),
  wind: z.object({
    speed: z.number(),
    deg: z.number().optional(),
    gust: z.number().optional(),
  }),
  clouds: z.object({ all: z.number() }).optional(),
  rain: z.object({ '1h': z.number().optional() }).optional(),
  snow: z.object({ '1h': z.number().optional() }).optional(),
  dt: z.number(),
  name: z.string().optional(),
});

export type OpenWeatherCurrent = z.infer<typeof OpenWeatherCurrentSchema>;

export class OpenWeatherClient {
  private baseUrl = 'https://api.openweathermap.org/data/2.5';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENWEATHERMAP_KEY || '';
    if (!this.apiKey) {
      console.warn('[OpenWeather] No API key configured. Set OPENWEATHERMAP_KEY env var.');
    }
  }

  private ensureKey(): void {
    if (!this.apiKey) {
      throw new Error('OPENWEATHERMAP_KEY not configured');
    }
  }

  async getCurrentWeather(lat: number, lon: number): Promise<OpenWeatherCurrent | null> {
    this.ensureKey();
    const url = `${this.baseUrl}/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        console.warn(`[OpenWeather] API returned ${res.status} for lat=${lat}, lon=${lon}`);
        return null;
      }
      const json = await res.json();
      const parsed = OpenWeatherCurrentSchema.safeParse(json);
      if (!parsed.success) {
        console.warn('[OpenWeather] Response validation failed:', parsed.error.format());
        return null;
      }
      return parsed.data;
    } catch (err) {
      console.warn(`[OpenWeather] Fetch failed for lat=${lat}, lon=${lon}:`, err);
      return null;
    }
  }
}

export const openWeatherClient = new OpenWeatherClient();
