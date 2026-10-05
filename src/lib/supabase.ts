import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when both Supabase env vars are set. Otherwise the app uses mock data. */
export const isSupabaseConfigured = Boolean(url && anonKey);

// Only the public anon key is used here; data access is protected by Row Level Security.
export const supabase: SupabaseClient | null = isSupabaseConfigured ? createClient(url!, anonKey!) : null;
