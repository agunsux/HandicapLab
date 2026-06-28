import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: pref, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const defaultPreferences = {
      user_id: userId,
      preferred_markets: ['Asian Handicap', 'Over/Under', 'Moneyline'],
      preferred_competitions: [],
      minimum_confidence: 0.0,
      minimum_edge: 0.0,
      notification_enabled: true
    };

    return NextResponse.json({
      success: true,
      preferences: pref || defaultPreferences
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { preferred_markets, preferred_competitions, minimum_confidence, minimum_edge, notification_enabled } = body;

    const payload = {
      user_id: userId,
      preferred_markets: preferred_markets || [],
      preferred_competitions: preferred_competitions || [],
      minimum_confidence: minimum_confidence !== undefined ? Number(minimum_confidence) : 0.0,
      minimum_edge: minimum_edge !== undefined ? Number(minimum_edge) : 0.0,
      notification_enabled: notification_enabled !== undefined ? Boolean(notification_enabled) : true,
      updated_at: new Date().toISOString()
    };

    const { data: updatedPref, error } = await supabase
      .from('user_preferences')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      preferences: updatedPref
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
