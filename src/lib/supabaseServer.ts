// Server-side Supabase client: initialize only when a request uses it.
// This prevents Vercel Preview builds without environment variables from
// failing while collecting route data. Missing runtime configuration still
// throws, rather than silently connecting to another database.
import { createClient } from '@supabase/supabase-js';

function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Supabase server configuration is missing');
  }
  return createClient(url, anonKey);
}

export const supabaseServer = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    const client = getSupabaseServerClient();
    const member = Reflect.get(client, prop);
    return typeof member === 'function' ? member.bind(client) : member;
  },
});
