import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from './config'

// Only instantiate a real client when configured. In mock mode this stays null
// and the data layer uses the localStorage-backed implementation instead.
export const supabase: SupabaseClient | null = config.mockMode
  ? null
  : createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
