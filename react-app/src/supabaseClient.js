import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://zjabvburavcuvtpszuzw.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_rkVH95JUz8stAdXgk96ahA_Z3k_a7pG';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase credentials missing. Please check .env configuration.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
