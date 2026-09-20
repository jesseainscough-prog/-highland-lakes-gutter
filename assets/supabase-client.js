import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// The publishable key is safe for browser use when Row Level Security is enabled.
const SUPABASE_URL='https://yxvohwjaiucdaqylktih.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_AeJwBaa0VAahNIdncZkjcA_Aoi1kim6';

export const isConfigured=Boolean(SUPABASE_URL&&SUPABASE_ANON_KEY);
export const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
