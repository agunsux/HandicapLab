import { NextResponse } from 'next/server';
import { SEEDED_MODELS } from '../predictions/route';

export const revalidate = 300;

export async function GET() {
  try {
    let models = SEEDED_MODELS;
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await supabase.from('model_versions').select('*');
        if (!error && data && data.length > 0) {
          models = data;
        }
      } catch (err) {
        console.warn('[Public Models API] Supabase fetch fallback to seeded models:', err);
      }
    }

    return NextResponse.json(
      {
        status: 'SUCCESS',
        count: models.length,
        models,
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300, s-maxage=300',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Error' }, { status: 500 });
  }
}
