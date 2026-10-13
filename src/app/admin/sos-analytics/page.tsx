'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, RefreshCw, AlertTriangle, BarChart3 } from 'lucide-react';
import { getSupabaseBrowserClient } from '../_lib/supabase';

type SosUsage = {
  id?: string;
  user_id?: string | null;
  sos_id?: number | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

export default function AdminSosAnalyticsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [total, setTotal] = useState<number | null>(null);
  const [recent, setRecent] = useState<SosUsage[]>([]);
  const [byOutcome, setByOutcome] = useState<Record<string, number>>({});

  async function load() {
    setBusy(true);
    setError(null);
    try {
      // total count
      const countRes = await supabase.from('sos_usage').select('id', { count: 'exact', head: true } as any);
      setTotal((countRes as any).count ?? null);

      // recent
      const listRes = await supabase
        .from('sos_usage')
        .select('id,user_id,sos_id,created_at,metadata')
        .order('created_at', { ascending: false })
        .limit(50);

      if (listRes.error) throw listRes.error;

      const rows = (listRes.data as any[]) || [];
      setRecent(rows);

      const map: Record<string, number> = {};
      for (const r of rows) {
        const k = typeof r.metadata?.outcome === 'string' ? r.metadata.outcome : 'não informado';
        map[k] = (map[k] || 0) + 1;
      }
      setByOutcome(map);
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar SOS Analytics.');
    } finally {
      setBusy(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">SOS Analytics</h1>
          <p className="mt-1 text-sm text-slate-400">
            Métricas rápidas de uso do SOS (tabela <code className="text-slate-200">sos_usage</code>).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 disabled:opacity-50"
            disabled={busy}
          >
            <RefreshCw className={cx('h-4 w-4', busy && 'animate-spin')} />
            Atualizar
          </button>
          <Link
            href="/admin"
            className="rounded-xl border border-slate-800 bg-slate-900/20 px-4 py-2 text-sm hover:bg-slate-900/35"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 text-rose-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>
              <div className="font-semibold">Erro</div>
              <div className="text-sm">{error}</div>
              <div className="mt-2 text-xs text-rose-200/70">
                Se a tabela não existir ou RLS bloquear, ajuste permissões para admin.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-400">Total de usos</div>
            <Activity className="h-5 w-5 text-emerald-200" />
          </div>
          <div className="mt-2 text-3xl font-semibold">{total === null ? '—' : String(total)}</div>
          <div className="mt-2 text-xs text-slate-500">Contagem total em sos_usage.</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Resultados (últimos 50)</div>
            <BarChart3 className="h-5 w-5 text-indigo-300" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.keys(byOutcome).length === 0 ? (
              <div className="text-sm text-slate-400">{loading ? 'Carregando…' : 'Sem dados.'}</div>
            ) : (
              Object.entries(byOutcome)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <span key={k} className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1 text-xs text-slate-200">
                    {k}: <span className="text-slate-300">{v}</span>
                  </span>
                ))
            )}
          </div>
          <div className="mt-3 text-xs text-slate-600">
            Você pode padronizar outcome (ex.: <code className="text-slate-300">calm</code>, <code className="text-slate-300">craving_reduced</code>) pra ter estatísticas melhores.
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
        <div className="text-sm font-semibold">Registros recentes</div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[820px] w-full text-sm">
            <thead className="text-slate-300 bg-slate-900/40">
              <tr>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Usuário</th>
                <th className="px-4 py-3 text-left">Ferramenta</th>
                <th className="px-4 py-3 text-left">Resultado</th>
              </tr>
            </thead>
            <tbody className="bg-slate-950/30">
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-slate-400">
                    {loading ? 'Carregando…' : 'Sem registros.'}
                  </td>
                </tr>
              ) : (
                recent.map((r, idx) => (
                  <tr key={(r.id || String(idx))} className="border-t border-slate-900">
                    <td className="px-4 py-3 text-slate-300">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3 text-slate-300">{r.user_id || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{r.sos_id ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{typeof r.metadata?.outcome === 'string' ? r.metadata.outcome : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
