'use client';

import { traduzirErro } from '@/lib/traduzir-erro';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function useProcessSosTriggers() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run(userId: string, sosId: number) {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const { data, error: rpcErr } = await supabase.rpc('process_sos_triggers_with_logging', { p_user: userId, p_sos_id: sosId });
      if (rpcErr) {
        setError(traduzirErro(rpcErr, 'Não foi possível processar os gatilhos.'));
        setLoading(false);
        return { success: false, error: rpcErr };
      }
      // rpc may return jsonb or array
      const items = Array.isArray(data) ? data : (data ? [data] : []);
      setResults(items);
      setLoading(false);
      return { success: true, data: items };
    } catch (err:any) {
      setError(traduzirErro(err));
      setLoading(false);
      return { success: false, error: err };
    }
  }

  return { run, loading, results, error, setResults };
}
