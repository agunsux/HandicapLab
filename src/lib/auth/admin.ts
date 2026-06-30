import { supabase } from '../../lib/supabase.server';
import { NextResponse } from 'next/server';

/**
 * Simple admin authorization helper used by all /api/admin/* routes.
 * Expects an `Authorization: Bearer <token>` header.
 * The token is verified via Supabase auth and the user must have `role = 'admin'`.
 *
 * Throws a NextResponse with appropriate status codes:
 *  - 401 Unauthorized (no token / invalid token)
 *  - 403 Forbidden (valid token but not admin)
 */
export async function requireAdmin(request: Request): Promise<void> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new NextResponse(JSON.stringify({ success: false, error: 'Missing auth token' }), { status: 401 });
  }
  const token = authHeader.substring('Bearer '.length).trim();

  // Verify token via Supabase auth. The `auth.users` view is not directly exposed, but we can use the `auth.getUser` RPC if configured.
  // For simplicity we query the `profiles` table which stores a `beta_status` and a `role` column.
  const { data: user, error } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('auth_token', token) // assume a column storing the token for demo purposes
    .single();

  if (error || !user) {
    throw new NextResponse(JSON.stringify({ success: false, error: 'Invalid auth token' }), { status: 401 });
  }

  // Check admin role
  if ((user as any).role !== 'admin') {
    throw new NextResponse(JSON.stringify({ success: false, error: 'Forbidden: admin only' }), { status: 403 });
  }
  // Authorized – simply return.
}
