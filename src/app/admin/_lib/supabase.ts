'use client';

import { createBrowserClient } from '@supabase/ssr';

export type SupabaseClient = ReturnType<typeof createBrowserClient>;

export function getSupabaseBrowserClient(): SupabaseClient {
  // NOTE: createBrowserClient reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
