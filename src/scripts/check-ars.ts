import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function checkFixture() {
  const { data: f } = await supabase.from('fixtures').select('*').eq('id', 'f5e61ba6-97d5-40a1-89f4-1a4b4c1a447c').single();
  if (f) {
    console.log('Fixture ID:', f.id);
    console.log('Kickoff:', f.kickoff_time);
    console.log('Source:', f.provider_id || f.source || 'N/A');
    console.log('Created At:', f.created_at);
    console.log('Updated At:', f.updated_at);
    console.log('Is Mock/Synthetic:', Object.keys(f).some(k => k.includes('mock') || k.includes('synthetic') || k.includes('seed')) ? 'Has flag' : 'No obvious flag');
  } else {
    const { data: m } = await supabase.from('matches').select('*').eq('id', 'f5e61ba6-97d5-40a1-89f4-1a4b4c1a447c').single();
    if (m) {
      console.log('Match ID:', m.id);
      console.log('Kickoff:', m.kickoff);
      console.log('Source:', m.source || m.provider_id || 'N/A');
      console.log('Created At:', m.created_at);
      console.log('Updated At:', m.updated_at);
      console.log('Status:', m.status);
    }
  }
}
checkFixture().catch(console.error);
