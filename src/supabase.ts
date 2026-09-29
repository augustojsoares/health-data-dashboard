import { createClient } from '@supabase/supabase-js'

// These browser-safe values are supplied by the deployment environment. No
// project identifier or credential belongs in source control.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = url && key ? createClient(url, key) : null
