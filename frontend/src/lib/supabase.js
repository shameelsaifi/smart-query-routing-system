import { createClient } from '@supabase/supabase-js'

import { env } from '../config/env'

const { supabaseUrl, supabasePublishableKey } = env

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Supabase environment variables are missing.')
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
)