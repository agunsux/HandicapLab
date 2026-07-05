import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAdmin } from '../src/lib/auth/admin';
import { supabase } from '../src/lib/supabase.server';

vi.mock('../src/lib/supabase.server', () => {
  return {
    supabase: {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(),
    },
  };
});

describe('requireAdmin helper', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should throw 401 if authorization header is missing', async () => {
    const req = new Request('http://localhost/api/admin/health');
    await expect(requireAdmin(req)).rejects.toThrow();
  });

  it('should throw 401 if user session is invalid', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: new Error('Invalid JWT') as any,
    });

    const req = new Request('http://localhost/api/admin/health', {
      headers: { authorization: 'Bearer invalid_token' },
    });

    await expect(requireAdmin(req)).rejects.toThrow();
  });

  it('should throw 403 if user is authenticated but admin role does not exist', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user_123' } as any },
      error: null,
    });

    // Mock roles query returning null
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      return chain;
    });
    vi.mocked(supabase.from).mockImplementation(mockFrom as any);

    const req = new Request('http://localhost/api/admin/health', {
      headers: { authorization: 'Bearer valid_token' },
    });

    await expect(requireAdmin(req)).rejects.toThrow();
  });

  it('should throw 403 if user does not have admin role mapping', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user_123' } as any },
      error: null,
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(() => {
          if (table === 'roles') {
            return Promise.resolve({ data: { id: 'admin_role_id' }, error: null });
          }
          return Promise.resolve({ data: null, error: null }); // user_roles mapping missing
        }),
      };
      return chain;
    });
    vi.mocked(supabase.from).mockImplementation(mockFrom as any);

    const req = new Request('http://localhost/api/admin/health', {
      headers: { authorization: 'Bearer valid_token' },
    });

    await expect(requireAdmin(req)).rejects.toThrow();
  });

  it('should resolve successfully if user is verified admin', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user_123' } as any },
      error: null,
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(() => {
          if (table === 'roles') {
            return Promise.resolve({ data: { id: 'admin_role_id' }, error: null });
          }
          return Promise.resolve({ data: { user_id: 'user_123' }, error: null }); // user_roles mapping exists
        }),
      };
      return chain;
    });
    vi.mocked(supabase.from).mockImplementation(mockFrom as any);

    const req = new Request('http://localhost/api/admin/health', {
      headers: { authorization: 'Bearer valid_token' },
    });

    await expect(requireAdmin(req)).resolves.not.toThrow();
  });
});
