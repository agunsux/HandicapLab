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

  // 1. Verify token securely via Supabase Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new NextResponse(JSON.stringify({ success: false, error: 'Invalid auth token' }), { status: 401 });
  }

  // 2. Resolve admin role ID
  const { data: adminRole, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'admin')
    .maybeSingle();

  if (roleError || !adminRole) {
    throw new NextResponse(JSON.stringify({ success: false, error: 'Forbidden: admin only' }), { status: 403 });
  }

  // 3. Verify user has active admin role relationship
  const { data: userRole, error: userRoleError } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('role_id', adminRole.id)
    .maybeSingle();

  if (userRoleError || !userRole) {
    throw new NextResponse(JSON.stringify({ success: false, error: 'Forbidden: admin only' }), { status: 403 });
  }
  // Authorized – simply return.
}
