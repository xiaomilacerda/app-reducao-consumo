'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Search,
  Edit3,
  Trash2,
  Lock,
  Crown,
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

/**
 * Página: Diário Completo (history)
 * - Filtragem por texto e datas
 * - Paginação por dias (PAGE_SIZE)
 * - Mostra daily_message em caixa roxa
 * - Botões Editar / Excluir:
 *    -> Só funcionam se o usuário for Premium
 *    -> Usuário gratuito vê as opções com cadeado e,
 *       ao clicar, é direcionado para /premium
 */

const PAGE_SIZE = 12;

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

export default function MoodHistoryPage() {
  const supabase = useMemo(createClient, []);
  const router = useRouter();

  const [user, setUser] = useState<any | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  const [entries, setEntries] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Busca + datas
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);

  // paginação por dias
  const [page, setPage] = useState(1);

  // expansão por dia
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getUser();
        const currentUser = data?.user ?? null;

        if (!mounted) return;

        setUser(currentUser);
        if (!currentUser) {
          setLoading(false);
          return;
        }

        // pega info de premium
        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('is_premium')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (profErr) {
          console.warn('Erro carregando profile em history:', profErr);
        }

        setIsPremium(!!profile?.is_premium);

        // carrega histórico de humor
        const { data: moods, error } = await supabase
          .from('mood_entries')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('date', { ascending: false })
          .order('time', { ascending: false });

        if (error) {
          console.error('Erro ao buscar moods', error);
          setEntries([]);
          setFiltered([]);
        } else {
          setEntries(moods ?? []);
          setFiltered(moods ?? []);
        }
      } catch (err) {
        console.error('Erro ao carregar histórico:', err);
        setEntries([]);
        setFiltered([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  // filtragem simples (texto + datas)
  useEffect(() => {
    let results = [...entries];
    const s = search.trim().toLowerCase();

    if (s) {
      results = results.filter(
        (e) =>
          String(e.mood ?? '').toLowerCase().includes(s) ||
          String(e.notes ?? '').toLowerCase().includes(s) ||
          String(e.daily_message ?? '').toLowerCase().includes(s)
      );
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      results = results.filter((e) => new Date(e.date) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      results = results.filter((e) => new Date(e.date) <= to);
    }

    setFiltered(results);
    setPage(1);
  }, [search, entries, dateFrom, dateTo]);

  // agrupamento por dia
  const groupedByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const e of filtered) {
      const day = new Date(e.date).toISOString().slice(0, 10);
      map[day] = map[day] ?? [];
      map[day].push(e);
    }
    const days = Object.keys(map).sort((a, b) => b.localeCompare(a)); // desc
    return days.map((d) => ({ date: d, items: map[d] }));
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(groupedByDay.length / PAGE_SIZE));

  const pagedDays = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return groupedByDay.slice(start, start + PAGE_SIZE);
  }, [groupedByDay, page]);

  // utilitário de emoji
  function moodValueToEmoji(value: number | null | undefined) {
    const v = Number(value ?? 0);
    if (isNaN(v)) return '😶';
    if (v >= 85) return '🤩';
    if (v >= 70) return '😊';
    if (v >= 50) return '🙂';
    if (v >= 30) return '😕';
    if (v > 0) return '😔';
    return '😶';
  }

  // deletar registro (apenas premium)
  async function handleDelete(id: number | string) {
    if (!user || !isPremium) {
      router.push('/premium');
      return;
    }

    const ok = window.confirm(
      'Tem certeza que deseja excluir este registro do seu diário?'
    );
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('mood_entries')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao deletar registro de humor:', error);
        alert('Não foi possível excluir este registro. Tente novamente.');
        return;
      }

      setEntries((prev) => prev.filter((e) => String(e.id) !== String(id)));
      setFiltered((prev) => prev.filter((e) => String(e.id) !== String(id)));
    } catch (err) {
      console.error('Erro inesperado ao excluir registro:', err);
      alert('Erro inesperado ao excluir. Tente novamente.');
    }
  }

  // componente auxiliar: botões de ação por registro
  function ActionButtons({ entryId }: { entryId: number | string }) {
    if (isPremium) {
      return (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleDelete(entryId)}
            className="px-3 py-1 rounded-md border border-red-400/40 text-red-200 hover:bg-red-500/10 transition-colors inline-flex items-center gap-2 text-xs sm:text-sm"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Excluir</span>
          </button>
        </div>
      );
    }

    // usuário gratuito: mostra opções com cadeado e empurra para /premium
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.push('/premium')}
          className="px-3 py-1 rounded-md border border-dashed border-white/20 text-white/60 hover:bg-white/5 transition-colors inline-flex items-center gap-1 text-[11px] sm:text-xs"
          title="Função exclusiva para assinantes Premium"
        >
          <Edit3 className="w-3 h-3" />
          <Lock className="w-3 h-3" />
          <span className="hidden sm:inline">Editar (Premium)</span>
        </button>
        <button
          type="button"
          onClick={() => router.push('/premium')}
          className="px-3 py-1 rounded-md border border-dashed border-white/20 text-white/60 hover:bg-white/5 transition-colors inline-flex items-center gap-1 text-[11px] sm:text-xs"
          title="Função exclusiva para assinantes Premium"
        >
          <Trash2 className="w-3 h-3" />
          <Lock className="w-3 h-3" />
          <span className="hidden sm:inline">Excluir (Premium)</span>
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <header className="sticky top-0 z-40 bg-black/35 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/mood"
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-white/80" />
          </Link>

          <h1 className="text-lg font-semibold text-white">Diário Completo</h1>

          <div className="ml-auto text-sm text-white/60 hidden sm:block">
            Acesse seus registros pessoais de humor e notas.
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Banner Premium explicando as travas de edição */}
        {user && (
          <section className="bg-gradient-to-r from-purple-700 via-purple-600 to-pink-600 text-white p-4 rounded-2xl shadow-md flex flex-col md:flex-row items-start md:items-center gap-3">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5" />
              <p className="text-xs sm:text-sm">
                {isPremium
                  ? 'Você é Premium: pode excluir qualquer registro do seu diário.'
                  : 'Editar e excluir registros do diário são recursos exclusivos do plano Premium.'}
              </p>
            </div>
            <div className="flex-1" />
            {!isPremium && (
              <button
                type="button"
                onClick={() => router.push('/premium')}
                className="inline-flex items-center gap-1 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-semibold"
              >
                <Crown className="w-3 h-3" />
                Ver planos
              </button>
            )}
          </section>
        )}

        {/* Busca + introdução */}
        <div className="bg-black/30 p-4 rounded-2xl border border-white/10 backdrop-blur-xl">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2 flex-1 bg-black/20 border border-white/10 p-2 rounded-lg">
              <Search className="w-4 h-4 text-white/40" />
              <input
                aria-label="Buscar registros"
                className="w-full bg-transparent outline-none text-sm text-white/90 placeholder:text-white/40"
                placeholder="Buscar por humor, texto ou mensagem..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="Data inicial"
                className="p-2 bg-black/20 border border-white/10 rounded-lg text-sm text-white/80"
                value={dateFrom ?? ''}
                onChange={(e) => setDateFrom(e.target.value || null)}
              />
              <input
                type="date"
                aria-label="Data final"
                className="p-2 bg-black/20 border border-white/10 rounded-lg text-sm text-white/80"
                value={dateTo ?? ''}
                onChange={(e) => setDateTo(e.target.value || null)}
              />
              <button
                onClick={() => {
                  setDateFrom(null);
                  setDateTo(null);
                  setSearch('');
                }}
                className="px-3 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-sm text-white/80 transition-colors"
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="mt-4 text-sm text-white/90 placeholder:text-white/40">
            <h2 className="text-base font-semibold">
              O lugar onde sua memória não fuma...
            </h2>
            <p className="mt-2 text-sm text-white/80">
              Este é o seu Diário Completo — o lugar onde você acompanha sua
              jornada, seus humores e seus dias. Mesmo quando a cabeça fica
              cheia, aqui você encontra tudo registrado com clareza.
            </p>
          </div>
        </div>

        {/* Conteúdo: diário agrupado por dia */}
        <section>
          {groupedByDay.length === 0 ? (
            <div className="bg-black/30 p-6 rounded-2xl border border-white/10 backdrop-blur-xl text-center">
              <p className="text-white/80">
                Nenhum registro encontrado.
              </p>
              <p className="text-sm text-white/50 mt-2">
                Registre seu humor no painel principal para que ele apareça
                aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pagedDays.map((day) => (
                <div
                  key={day.date}
                  className="bg-black/30 p-4 rounded-2xl border border-white/10 backdrop-blur-xl"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-white/50">
                        {formatDate(day.date)}
                      </div>
                      <div className="text-base font-medium text-white">Diária</div>
                    </div>
                    <div className="text-sm text-white/50">
                      {day.items.length} reações
                    </div>
                  </div>

                  {/* destaque: primeira reação do dia */}
                  <div className="mt-4 p-4 rounded-xl border border-white/10 bg-gradient-to-r from-purple-500/10 via-fuchsia-500/10 to-pink-500/10 flex items-start gap-4">
                    <div className="text-2xl select-none">
                      {moodValueToEmoji(day.items[0].mood_value)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm text-white/50">
                            {day.items[0].time ?? ''}
                          </div>
                          <div className="font-semibold text-white">
                            {day.items[0].mood ?? '—'}
                          </div>
                        </div>

                        <ActionButtons entryId={day.items[0].id} />
                      </div>

                      {day.items[0].notes && (
                        <p className="mt-3 text-sm text-white/90 placeholder:text-white/40 whitespace-pre-wrap">
                          {day.items[0].notes}
                        </p>
                      )}

                      {/* daily_message - caixa roxa */}
                      {day.items[0].daily_message && (
                        <div className="mt-3 p-2 rounded-lg border border-purple-400/20 bg-purple-500/10 text-sm text-purple-200">
                          {day.items[0].daily_message}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* reações adicionais */}
                  {day.items.length > 1 && (
                    <div className="mt-3">
                      <button
                        onClick={() =>
                          setExpandedDays((s) => ({
                            ...s,
                            [day.date]: !s[day.date],
                          }))
                        }
                        className="text-sm text-purple-200 hover:text-purple-100 underline"
                      >
                        {expandedDays[day.date]
                          ? 'Mostrar menos'
                          : `Mostrar mais (${day.items.length - 1})`}
                      </button>

                      {expandedDays[day.date] && (
                        <div className="mt-3 space-y-3">
                          {day.items.slice(1).map((it: any) => (
                            <div
                              key={it.id}
                              className="p-3 rounded-lg border border-white/10 bg-black/20 flex items-start gap-3"
                            >
                              <div className="text-xl select-none">
                                {moodValueToEmoji(it.mood_value)}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <div className="text-sm text-white/50">
                                      {it.time ?? ''}
                                    </div>
                                    <div className="font-medium text-white">
                                      {it.mood ?? '—'}
                                    </div>
                                  </div>

                                  <ActionButtons entryId={it.id} />
                                </div>

                                {it.notes && (
                                  <p className="mt-2 text-sm text-white/90 placeholder:text-white/40 whitespace-pre-wrap">
                                    {it.notes}
                                  </p>
                                )}

                                {it.daily_message && (
                                  <div className="mt-2 p-2 rounded-lg border border-purple-400/20 bg-purple-500/10 text-sm text-purple-200">
                                    {it.daily_message}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* paginação + total de registros */}
              <div className="flex items-center justify-between text-xs text-white/50">
                <div>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-2 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white/80 transition-colors mr-2"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    className="px-2 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white/80 transition-colors"
                  >
                    Próxima
                  </button>
                </div>
                <div>
                  Página {page} • {totalPages}
                  <span className="mx-3">•</span>
                  <span className="text-xs text-white/40">
                    Total de registros: {entries.length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
