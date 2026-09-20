import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export const isConfigured=Boolean(SUPABASE_URL&&SUPABASE_ANON_KEY&&!SUPABASE_URL.includes('YOUR_'));
export const db=isConfigured?createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
