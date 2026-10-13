'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SosQuickHistory from '@/components/sos/SosQuickHistory';
import { ArrowLeft, Filter, BarChart3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type SosTool = {
  id: number;
  title: string | null;
  category: string | null;
};

type SosLog = {
  id: number | string;
  user_id: string;

  // ✅ seu schema real
  used_at: string; // timestamp
  tool_id: number; // bigint

  duration: number | null; // em segundos

  // opcionais (se existirem no seu schema, aparecem; se não, ficam null)
  notes?: string | null;
  result_summary?: string | null;
  cravings_level_before?: number | null;
  cravings_level_after?: number | null;
  mood_before?: string | null;
  mood_after?: string | null;
};

type PeriodFilter = 'all' | '7d' | '30d' | '90d';

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  all: 'Todo o período',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
};

function formatDateTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function daysDiffFromNow(iso?: string | null) {
  if (!iso) return Infinity;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return Infinity;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return null;
  const mins = Math.round(seconds / 60);
  if (mins < 1) return `${seconds}s`;
  if (mins === 1) return '1 minuto';
  return `${mins} minutos`;
}

function safeToolName(tool?: SosTool | null) {
  return tool?.title || tool?.category || 'Sessão SOS';
}

export default function SosHistoryPage() {
  const router = useRouter();

  const [checkingSession, setCheckingSession] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<SosLog[]>([]);
  const [toolsMap, setToolsMap] = useState<Map<number, SosTool>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState<PeriodFilter>('all');

  // 1) Verifica sessão (login)
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;

        if (error || !data?.user) {
          router.push('/login?next=%2Fsos%2Fhistory');
          return;
        }
        setUserId(data.user.id);
      } catch (err) {
        console.error('Erro ao verificar sessão SOS:', err);
        router.push('/login?next=%2Fsos%2Fhistory');
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // 2) Carrega histórico SOS + ferramentas (SEM depender de join por FK)
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      setError(null);

      try {
        // ✅ usa used_at + duration (seu schema real)
        const res = await supabase
          .from('sos_logs')
          .select(
            'id, user_id, used_at, tool_id, duration',
          )
          .eq('user_id', userId)
          .order('used_at', { ascending: false });

        // Fallback se alguma coluna não existir (robustez)
        if (res.error && (res.error as any).code === '42703') {
          const retry = await supabase
            .from('sos_logs')
            .select('id, user_id, tool_id, duration')
            .eq('user_id', userId)
            .order('id', { ascending: false });

          if (retry.error) {
            console.error('Erro carregando histórico SOS (fallback):', retry.error);
            if (!cancelled) {
              setError('Não foi possível carregar seu histórico SOS. Tente novamente mais tarde.');
              setLogs([]);
              setToolsMap(new Map());
            }
            return;
          }

          const fallbackLogs = ((retry.data as any[]) || []).map((r) => ({
            id: r.id,
            user_id: r.user_id,
            used_at: new Date().toISOString(), // evita quebrar UI (sem data real no fallback)
            tool_id: Number(r.tool_id),
            duration: r.duration ?? null,
          })) as SosLog[];

          if (!cancelled) {
            setLogs(fallbackLogs);
            setToolsMap(new Map());
          }
          return;
        }

        if (res.error) {
          console.error('Erro carregando histórico SOS:', res.error);
          if (!cancelled) {
            setError('Não foi possível carregar seu histórico SOS. Tente novamente mais tarde.');
            setLogs([]);
            setToolsMap(new Map());
          }
          return;
        }

        const rows = ((res.data as any[]) || []).map((r) => ({
          id: r.id,
          user_id: r.user_id,
          used_at: r.used_at,
          tool_id: Number(r.tool_id),
          duration: r.duration ?? null,
          notes: r.notes ?? null,
          result_summary: r.result_summary ?? null,
          cravings_level_before: r.cravings_level_before ?? null,
          cravings_level_after: r.cravings_level_after ?? null,
          mood_before: r.mood_before ?? null,
          mood_after: r.mood_after ?? null,
        })) as SosLog[];

        // Buscar nomes das ferramentas (sos_tools) sem join
        const toolIds = Array.from(new Set(rows.map((x) => Number(x.tool_id)).filter(Boolean)));

        let map = new Map<number, SosTool>();
        if (toolIds.length > 0) {
          const toolsRes = await supabase
            .from('sos_tools')
            .select('id, title, category')
            .in('id', toolIds);

          if (!toolsRes.error) {
            const trows = (toolsRes.data as any[]) || [];
            map = new Map(
              trows.map((t) => [
                Number(t.id),
                { id: Number(t.id), title: t.title ?? null, category: t.category ?? null } as SosTool,
              ]),
            );
          } else {
            console.warn('Não consegui carregar nomes de sos_tools:', {
              message: (toolsRes.error as any)?.message,
              code: (toolsRes.error as any)?.code,
            });
          }
        }

        if (!cancelled) {
          setLogs(rows);
          setToolsMap(map);
        }
      } catch (err) {
        console.error('Erro inesperado ao carregar histórico SOS:', err);
        if (!cancelled) {
          setError('Ocorreu um erro inesperado ao carregar seu histórico SOS.');
          setLogs([]);
          setToolsMap(new Map());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // 3) Aplica filtro de período (agora em used_at)
  const filteredLogs = useMemo(() => {
    if (period === 'all') return logs;

    const maxDays =
      period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : Infinity;

    return logs.filter((log) => daysDiffFromNow(log.used_at) <= maxDays);
  }, [logs, period]);

  // 4) Estatísticas + “faz sentido” (mais útil)
  const stats = useMemo(() => {
    const total = logs.length;

    if (total === 0) {
      return {
        total: 0,
        lastDate: null as string | null,
        lastToolName: null as string | null,
        totalMinutes: 0,
        topToolName: null as string | null,
        topToolCount: 0,
      };
    }

    const last = logs[0];
    const lastTool = toolsMap.get(Number(last.tool_id)) || null;

    const totalSeconds = logs.reduce((acc, l) => acc + Number(l.duration || 0), 0);
    const totalMinutes = Math.round(totalSeconds / 60);

    const counts = new Map<number, number>();
    for (const l of logs) {
      const id = Number(l.tool_id);
      counts.set(id, (counts.get(id) || 0) + 1);
    }

    let topId: number | null = null;
    let topCount = 0;
    for (const [id, c] of counts.entries()) {
      if (c > topCount) {
        topCount = c;
        topId = id;
      }
    }

    const topTool = topId != null ? toolsMap.get(topId) || null : null;

    return {
      total,
      lastDate: last.used_at ?? null,
      lastToolName: safeToolName(lastTool),
      totalMinutes,
      topToolName: topTool ? safeToolName(topTool) : null,
      topToolCount: topCount,
    };
  }, [logs, toolsMap]);

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-sm text-slate-400 animate-pulse">
            Conferindo sua sessão segura...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Cabeçalho */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/sos"
              className="inline-flex items-center gap-2 text-slate-300 hover:text-slate-50 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao SOS
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-slate-50">
                Histórico de Sessões SOS
              </h1>
              <p className="text-xs text-slate-400">
                Acompanhe as sessões que você usou para atravessar a fissura.
              </p>
            </div>
          </div>

          <Link
            href="/sos"
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-full border border-slate-700 bg-slate-900/40 hover:bg-slate-900/70 text-xs text-slate-200"
            title="Voltar e usar uma ferramenta SOS agora"
          >
            <BarChart3 className="w-4 h-4" />
            Voltar ao SOS
          </Link>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-4xl mx-auto px-4 pb-10 pt-4 space-y-6">
        <SosQuickHistory userId={userId}/>
        {/* Resumo (mais útil e claro) */}
        <section className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-xs text-slate-400 mb-1">Sessões registradas</p>
            <p className="text-2xl font-semibold text-slate-50">{stats.total}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Cada sessão é uma vitória registrada.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-xs text-slate-400 mb-1">Tempo total (aprox.)</p>
            <p className="text-2xl font-semibold text-slate-50">
              {stats.totalMinutes > 0 ? `${stats.totalMinutes} min` : '—'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Tempo investido em autocontrole.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-xs text-slate-400 mb-1">Ferramenta mais usada</p>
            <p className="text-sm text-slate-50">
              {stats.topToolName ? stats.topToolName : '—'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {stats.topToolCount > 0 ? `${stats.topToolCount}x no total` : '—'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-xs text-slate-400 mb-1">Última sessão</p>
            <p className="text-sm text-slate-50">
              {stats.lastDate ? formatDateTime(stats.lastDate) : '—'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {stats.lastToolName ? stats.lastToolName : '—'}
            </p>
          </div>
        </section>

        {/* Filtros */}
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-xs text-slate-400">
            <Filter className="w-4 h-4" />
            <span>Filtrar por período</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map((key) => {
              const selected = period === key;
              return (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={[
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    selected
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-slate-900/60 text-slate-200 border-slate-700 hover:border-slate-500',
                  ].join(' ')}
                >
                  {PERIOD_LABELS[key]}
                </button>
              );
            })}
          </div>
        </section>

        {/* Lista */}
        <section className="space-y-3">
          {loading && (
            <div className="space-y-2">
              <div className="h-16 rounded-2xl bg-slate-900/70 animate-pulse" />
              <div className="h-16 rounded-2xl bg-slate-900/70 animate-pulse" />
              <div className="h-16 rounded-2xl bg-slate-900/70 animate-pulse" />
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-100">
              {error}
            </div>
          )}

          {!loading && !error && filteredLogs.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
              <p className="font-medium mb-1">Nenhuma sessão SOS encontrada.</p>
              <p className="text-xs text-slate-500">
                Use uma ferramenta no SOS e finalize (tempo mínimo) para ela aparecer aqui.
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            filteredLogs.map((log) => {
              const tool = toolsMap.get(Number(log.tool_id)) || null;
              const toolName = safeToolName(tool);

              const durationLabel = formatDuration(log.duration);
              const cravingsBefore = log.cravings_level_before;
              const cravingsAfter = log.cravings_level_after;

              return (
                <article
                  key={String(log.id)}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col gap-3"
                >
                  {/* Linha topo */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/40 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                        {toolName}
                      </span>
                      {tool?.category && (
                        <span className="text-[11px] text-slate-500">
                          {tool.category}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-500">
                      {formatDateTime(log.used_at)}
                    </span>
                  </div>

                  {/* Blocos claros */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2">
                      <p className="uppercase tracking-wide text-slate-500 mb-0.5">
                        Situação / notas
                      </p>
                      <p className="text-slate-200 whitespace-pre-wrap break-words">
                        {log.notes
                          ? log.notes
                          : 'Sessão salva sem descrição. Mesmo assim, conta como reação saudável à vontade.'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2">
                      <p className="uppercase tracking-wide text-slate-500 mb-0.5">
                        Resultado percebido
                      </p>
                      <p className="text-slate-200 whitespace-pre-wrap break-words">
                        {log.result_summary
                          ? log.result_summary
                          : 'Você treinou seu cérebro a buscar uma alternativa — isso é progresso real.'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2 space-y-1.5">
                      <div>
                        <p className="uppercase tracking-wide text-slate-500 mb-0.5">
                          Duração
                        </p>
                        <p className="text-slate-200">
                          {durationLabel ? durationLabel : '—'}
                        </p>
                      </div>

                      {(cravingsBefore != null || cravingsAfter != null) && (
                        <div>
                          <p className="uppercase tracking-wide text-slate-500 mb-0.5">
                            Vontade (0–10)
                          </p>
                          <p className="text-slate-200">
                            {cravingsBefore != null ? cravingsBefore : '—'} →{' '}
                            {cravingsAfter != null ? cravingsAfter : '—'}
                          </p>
                        </div>
                      )}

                      {(log.mood_before || log.mood_after) && (
                        <div>
                          <p className="uppercase tracking-wide text-slate-500 mb-0.5">
                            Humor
                          </p>
                          <p className="text-slate-200">
                            {log.mood_before || '—'} → {log.mood_after || '—'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
        </section>
      </main>
    </div>
  );
}
