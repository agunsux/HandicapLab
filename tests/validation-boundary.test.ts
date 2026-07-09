import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { HttpClient } from '../src/lib/http/HttpClient';
import { RateLimiter } from '../src/lib/http/RateLimiter';
import { CircuitBreaker } from '../src/lib/http/CircuitBreaker';

const MockItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  active: z.boolean(),
});

describe('HttpClient Zod Boundary Validation', () => {
  let client: HttpClient;

  beforeEach(() => {
    const rateLimiter = new RateLimiter({
      maxRequests: 10,
      windowMs: 60000,
      provider: 'test',
    });
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      cooldownMs: 1000,
      halfOpenSuccessThreshold: 1,
      provider: 'test',
    });

    client = new HttpClient(
      {
        baseUrl: 'https://api.test.local',
        provider: 'test',
      },
      rateLimiter,
      circuitBreaker
    );

    vi.clearAllMocks();
  });

  it('should parse and return valid response when schema matches payload', async () => {
    const mockPayload = { id: 42, name: 'Active Team', active: true };
    
    // Mock the global fetch
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => mockPayload,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await client.get<z.infer<typeof MockItemSchema>>('/test', {
      schema: MockItemSchema,
    });

    expect(result.data).toEqual(mockPayload);
    expect(result.data.id).toBe(42);
    expect(result.data.name).toBe('Active Team');
  });

  it('should throw validation error when response does not match Zod schema', async () => {
    const malformedPayload = { id: 'not-a-number', name: 'Active Team' }; // missing active, invalid id type

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => malformedPayload,
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      client.get<z.infer<typeof MockItemSchema>>('/test', {
        schema: MockItemSchema,
      })
    ).rejects.toThrow(/validation failed/i);
  });
});
