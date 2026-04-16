import { createClient } from '@supabase/supabase-js'

/**
 * Service role client — bypasses RLS entirely.
 * NEVER expose this to the client bundle.
 * Use only in server-side API route handlers.
 */
export function createServiceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. This client must only be used server-side.')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}