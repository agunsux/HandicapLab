import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') || 'https://rgkrfzxipkrwqccfuqfq.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_TY6TSX9kjjBiLbo25iSzIQ_Ht4OSwQI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
