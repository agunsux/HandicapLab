import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: watchlists, error } = await supabase
      .from('watchlists')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      watchlists: watchlists || []
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
    const { type, entity_id } = body;

    if (!type || !entity_id) {
      return NextResponse.json({ success: false, error: 'Missing type or entity_id' }, { status: 400 });
    }

    const { data: inserted, error } = await supabase
      .from('watchlists')
      .upsert({
        user_id: userId,
        type,
        entity_id,
        created_at: new Date().toISOString()
      }, { onConflict: 'user_id,type,entity_id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      watchlist: inserted
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, entity_id } = body;

    if (!type || !entity_id) {
      return NextResponse.json({ success: false, error: 'Missing type or entity_id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('watchlists')
      .delete()
      .eq('user_id', userId)
      .eq('type', type)
      .eq('entity_id', entity_id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Removed from watchlist successfully'
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
