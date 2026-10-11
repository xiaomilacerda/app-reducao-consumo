'use client';
import React, { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useProcessSosTriggers } from '@/hooks/use-process-sos-triggers';
import RewardModal from '@/components/RewardModal';

// Ajuste para seu hook de auth real
function useUserId() {
  // substitua por seu hook real (ex: useUser() ou supabase.auth.getUser)
  // para testes, defina window.__TEST_USER_ID = 'abc273a9-76cf-44be-a2fb-987f1deba1c1'
  return (typeof window !== 'undefined' && (window as any).__TEST_USER_ID) ?? null;
}

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function SosSessionControls({ sosId, durationSeconds = 60 }: { sosId: number; durationSeconds?: number }) {
  const supabase = createClient();
  const userId = useUserId();
  const { run, loading } = useProcessSosTriggers();
  const [open, setOpen] = useState(false);
  const [rewards, setRewards] = useState<any[]>([]);
  const [running, setRunning] = useState(false);

  async function recordUsageAndProcess() {
    if (!userId) return alert('Faça login antes de usar a ferramenta.');
    setRunning(true);
    try {
      // 1) Inserir registro de uso (sos_usage) - opcional se você já grava isso em outro lugar
      const { error: insertErr } = await supabase
        .from('sos_usage')
        .insert([{ user_id: userId, sos_id: sosId, duration_seconds: durationSeconds, metadata: {} }]);
      if (insertErr) {
        console.error('Erro insert sos_usage', insertErr);
        alert('Erro ao registrar uso (sos_usage).');
        setRunning(false);
        return;
      }

      // 2) Chamar wrapper com logging:
      const resp = await run(userId, sosId);
      if (resp.success) {
        const items = resp.data ?? [];
        setRewards(items);
        if (items.length > 0) setOpen(true);
      } else {
        console.error('Erro process triggers', resp.error);
        alert('Erro ao processar missões/recompensas.');
      }
    } catch (err:any) {
      console.error(err);
      alert('Erro inesperado');
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <button onClick={recordUsageAndProcess} disabled={running || loading} className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-lg">
          {running || loading ? 'Processando...' : 'Marcar uso e verificar missões'}
        </button>
        <button onClick={() => { setRewards([]); setOpen(false); }} className="px-3 py-2 border rounded">Limpar</button>
      </div>

      <RewardModal open={open} onClose={() => setOpen(false)} rewards={rewards} />
    </>
  );
}
