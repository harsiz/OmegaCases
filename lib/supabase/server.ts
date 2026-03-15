import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Use service role key for server-side API routes — bypasses RLS cookie issues
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
