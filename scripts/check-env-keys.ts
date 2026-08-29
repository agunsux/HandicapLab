import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });

console.log('Available env keys:', Object.keys(process.env).filter(k => 
  k.includes('SUPABASE') || k.includes('POSTGRES') || k.includes('DATABASE') || k.includes('DB') || k.includes('PG')
));
