import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://oygfbystyotkqjcajgot.supabase.co'
const key =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_GPdT9SB3xLtkHT5DDnV3Cw_YtD7XeUL'

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'trennipaevik-auth',
  },
})
