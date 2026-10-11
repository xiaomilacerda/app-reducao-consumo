'use client';

import { createBrowserClient } from '@supabase/ssr';

let _client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Cliente Supabase no browser (App Router).
 * Cria 1 vez e reutiliza.
 */
export function getSupabaseClient() {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('SUPABASE ENV AUSENTE', { hasUrl: !!url, hasKey: !!key });
    throw new Error(
      'Supabase env ausente: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  _client = createBrowserClient(url, key);
  return _client;
}

/**
 * Compat: mantém `import { supabase } from '@/lib/supabase'`
 * sem criar o client no import (evita "Failed to fetch").
 */
export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabaseClient() as any;
      return client[prop as any];
    },
  }
) as any;
