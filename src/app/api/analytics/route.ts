import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { logEvent } from '@/lib/pricing/analytics';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    let userId: string | null = null;

    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
      }
    }

    const { eventName, metadata } = await request.json();
    if (!eventName) {
      return NextResponse.json({ success: false, error: 'Missing eventName' }, { status: 400 });
    }

    await logEvent(userId, eventName, metadata || {});
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Analytics Route Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
