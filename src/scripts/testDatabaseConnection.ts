import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  console.log('Testing Supabase connection...');
  
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
  
  console.log('✅ Database connection successful!');
  console.log('Found', data?.length || 0, 'matches');
}

testConnection();
