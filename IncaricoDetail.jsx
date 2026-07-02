import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://etrwrxahdbrswljzrzra.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_NSez7ZFpvDDZhr-34ZQxFg_QTgw4Gnk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
