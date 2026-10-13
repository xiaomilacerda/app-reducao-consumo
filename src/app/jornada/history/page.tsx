'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Crown,
  Loader2,
  Lock,
  NotebookPen,
  Sparkles,
  Search,
  Calendar,
} from 'lucide-react';

// 👉 usar o MESMO client do resto do app
import { supabase } from '@/lib/supabase';

type Profile = {
  id: string;
  is_premium: boolean | null;
};

type Mission = {
  id: number;
  journey_day: number;
  title: string;
  description: string | null;
};

type JournalEntry = {
  id: number;
  journey_day: number | null;
  answer_text: string | null;
  content: string | null;
  day_key: string | null;
  created_at: string | null;
};

export default function JourneyHistoryPage() {
  const router = useRouter();

  // se quiser muito, dá pra memorizar, mas o supabase do lib já é estável
  const supabaseClient = supabase;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState('');

  const premiumUser = !!profile?.is_premium;

  useEffect(() => {
    init().catch((err) => {
      console.error(err);
      setErrorMsg('Erro ao carregar o histórico. Tente novamente mais tarde.');
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    setLoading(true);
    setErrorMsg(null);

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError) {
      console.error('Erro ao buscar usuário no histórico:', userError.message);
    }

    if (!user) {
      setLoading(false); // evita ficar travado em "Carregando..." antes do redirect
      router.push('/login');
      return;
    }

    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, is_premium')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError && (profileError as any).message) {
      console.error(
        'Erro ao carregar profile no histórico:',
        (profileError as any).message
      );
    }
    setProfile(profileData as Profile | null);

    const { data: missionsData, error: missionsError } = await supabaseClient
      .from('journey_365_missions')
      .select('id, journey_day, title, description')
      .eq('is_journey', true)
      .order('journey_day', { ascending: true });

    if (missionsError && (missionsError as any).message) {
      console.error(
        'Erro ao carregar missions no histórico:',
        (missionsError as any).message
      );
    }

    setMissions((missionsData || []) as Mission[]);

    const { data: journalData, error: journalError } = await supabaseClient
      .from('mission_journal')
      .select('id, journey_day, answer_text, content, day_key, created_at')
      .eq('user_id', user.id)
      .not('journey_day', 'is', null)
      .order('day_key', { descending: true });

    if (journalError) {
      console.error(
        'Erro ao buscar mission_journal history:',
        (journalError as any).message ?? journalError
      );
      setErrorMsg('Não foi possível carregar seu histórico de missões.');
    } else if (journalData) {
      setEntries(journalData as JournalEntry[]);
    }

    setLoading(false);
  }

  function findMission(day: number | null) {
    if (!day) return null;
    return missions.find((x) => x.journey_day === day) || null;
  }

  function findMissionTitle(day: number | null) {
    const mission = findMission(day);
    if (!day && !mission) return 'Dia da jornada não definido';
    if (!mission) return `Dia ${day} – missão não encontrada`;
    return `Dia ${mission.journey_day} – ${mission.title}`;
  }

  function formatDate(iso?: string | null) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function getIsoDateOnly(iso?: string | null) {
    if (!iso) return '';
    if (iso.length >= 10) return iso.slice(0, 10);
    return iso;
  }

  const totalDaysInJourney = useMemo(
    () => (missions.length > 0 ? missions.length : 365),
    [missions.length]
  );

  const completedDaysCount = useMemo(() => {
    const set = new Set<number>();
    for (const e of entries) {
      if (e.journey_day != null) {
        set.add(e.journey_day);
      }
    }
    return set.size;
  }, [entries]);

  const pendingDaysCount = Math.max(
    0,
    totalDaysInJourney - completedDaysCount
  );

  const progressPercent = totalDaysInJourney
    ? Math.round((completedDaysCount / totalDaysInJourney) * 100)
    : 0;

  const filteredEntries = useMemo(() => {
    let list = entries;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((entry) => {
        const mission = findMission(entry.journey_day);
        const parts: (string | null | undefined)[] = [
          mission?.title,
          mission?.description,
          entry.content,
          entry.answer_text,
        ];
        return parts.some((p) => p && p.toLowerCase().includes(term));
      });
    }

    if (searchDate) {
      list = list.filter((entry) => {
        const base = entry.day_key || entry.created_at;
        if (!base) return false;
        return getIsoDateOnly(base) === searchDate;
      });
    }

    return list;
  }, [entries, searchTerm, searchDate, missions]);

  const visibleEntries = premiumUser
    ? filteredEntries
    : filteredEntries.slice(0, 1);

  const hasFilterActive = !!searchTerm.trim() || !!searchDate;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* HEADER */}
        <header className="flex items-center justify-between mb-5">
          <button
            onClick={() => router.push('/jornada')}
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Jornada
          </button>

          <div className="flex items-center gap-2">
            {premiumUser && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-amber-400/60 px-3 py-1 text-[11px] text-amber-200 bg-amber-500/10">
                <Crown className="w-3 h-3" />
                Premium ativo
              </span>
            )}
          </div>
        </header>

        <div className="mb-4">
          <h1 className="text-2xl font-semibold flex items-center gap-2 mb-1">
            Seu diário dentro do WeedReset
            <Sparkles className="w-4 h-4 text-purple-300" />
          </h1>
          <p className="text-sm text-slate-300">
            Aqui você encontra as reflexões que escreveu em cada missão da
            Jornada 365 – agora com contexto da missão e ferramentas para
            analisar sua caminhada com mais clareza.
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-3 text-sm text-slate-200 mb-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando histórico...
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-red-500/60 bg-red-950/40 px-3 py-2 text-xs text-red-100">
            {errorMsg}
          </div>
        )}

        {/* BARRA PREMIUM */}
        <section className="mb-4 rounded-2xl border border-purple-500/60 bg-purple-950/60 px-4 py-3 flex items-start gap-3">
          <div className="mt-1">
            {premiumUser ? (
              <Crown className="w-4 h-4 text-amber-300" />
            ) : (
              <Lock className="w-4 h-4 text-purple-200" />
            )}
          </div>
          <div className="flex-1 text-xs">
            <p className="font-semibold mb-1">
              {premiumUser
                ? 'Você desbloqueou o histórico completo da Jornada.'
                : 'Histórico completo é um recurso Premium.'}
            </p>
            <p className="text-slate-200">
              {premiumUser
                ? 'Use essa página sempre que quiser relembrar o que pensava em cada fase da sua caminhada.'
                : 'Como usuário gratuito, você vê apenas uma prévia das suas reflexões. Faça upgrade para liberar todas.'}
            </p>
          </div>
          {!premiumUser && (
            <Link
              href="/premium"
              className="inline-flex items-center gap-1 rounded-xl bg-purple-500 hover:bg-purple-600 px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              <Crown className="w-3 h-3" />
              Ver planos
            </Link>
          )}
        </section>

        {/* VISÃO GERAL */}
        <section className="mb-4 rounded-2xl border border-purple-500/50 bg-gradient-to-b from-purple-900/40 to-purple-950/70 px-4 py-4 shadow-lg shadow-purple-900/40">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-purple-200/80 mb-1">
                Visão geral da Jornada 365
              </p>
              <h2 className="text-lg font-semibold mb-1">
                Progresso registrado no diário
              </h2>
              <p className="text-xs text-slate-100 max-w-xl">
                Acompanhe quantos dias já foram registrados no diário e como
                está o seu avanço na Jornada 365. Cada reflexão escrita é uma
                prova concreta da sua mudança.
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-2 text-xs">
              <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/60 px-3 py-2 min-w-[110px]">
                  <p className="text-[10px] text-emerald-200/90 mb-1">
                    Concluídos
                  </p>
                  <p className="text-sm font-semibold text-emerald-100">
                    {completedDaysCount} dia(s)
                  </p>
                </div>
                <div className="rounded-xl bg-slate-900/80 border border-slate-600 px-3 py-2 min-w-[110px]">
                  <p className="text-[10px] text-slate-300 mb-1">Pendentes</p>
                  <p className="text-sm font-semibold text-slate-100">
                    {pendingDaysCount} dia(s)
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-purple-100/90">
                {progressPercent}% da Jornada registrada no diário
              </span>
            </div>
          </div>

          <div className="mt-1">
            <div className="h-2 w-full rounded-full bg-slate-950/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-purple-400 to-pink-500 transition-all duration-500"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
          </div>
        </section>

        {/* PESQUISA */}
        <section className="mb-6 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-300" />
            <h3 className="text-sm font-semibold">
              Procurar algo específico no seu diário
            </h3>
          </div>
          <p className="text-[11px] text-slate-400">
            Digite uma palavra ou expressão para localizar tanto o{' '}
            <span className="font-semibold text-slate-200">
              enunciado da missão
            </span>{' '}
            quanto o que você{' '}
            <span className="font-semibold text-slate-200">escreveu</span>{' '}
            naquele dia. Se quiser, filtre também por uma data específica.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* TEXTO */}
            <div className="flex-1 relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ex.: gatilho, compromisso, dinheiro, ansiedade..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/80 border border-slate-600 text-sm text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-purple-500/80 focus:border-purple-400"
              />
            </div>

            {/* DATA */}
            <div className="w-full sm:w-48 flex items-center gap-2">
              <div className="relative w-full">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <Calendar className="w-4 h-4" />
                </span>
                <input
                  type="date"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/80 border border-slate-600 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500/80 focus:border-purple-400 [color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          {hasFilterActive && (
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>
                {filteredEntries.length === 1
                  ? '1 resultado encontrado para o filtro atual.'
                  : `${filteredEntries.length} resultados encontrados para o filtro atual.`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSearchDate('');
                }}
                className="text-purple-300 hover:text-purple-200 underline underline-offset-2"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </section>

        {/* LISTA */}
        <section className="space-y-3">
          {visibleEntries.length === 0 && !loading && (
            <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-4 text-xs text-slate-300 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>
                {hasFilterActive
                  ? 'Nenhuma reflexão encontrada para os filtros atuais. Tente outra palavra ou limpe os filtros.'
                  : 'Ainda não encontramos reflexões salvas. Volte para a Jornada 365, escreva sobre a missão de hoje e depois retorne aqui.'}
              </span>
            </div>
          )}

          {visibleEntries.map((entry) => {
            const mission = findMission(entry.journey_day);
            const title = findMissionTitle(entry.journey_day);
            const missionContext =
              mission?.description ||
              'Descrição da missão não encontrada para este dia.';
            const text =
              entry.content ||
              entry.answer_text ||
              '(Reflexão vazia ou não encontrada)';

            return (
              <article
                key={entry.id}
                className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-xs flex flex-col gap-3"
              >
                <header className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[11px] font-bold">
                      {entry.journey_day ?? '?'}
                    </div>
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <NotebookPen className="w-3 h-3" />
                        Escrito em{' '}
                        {formatDate(
                          entry.day_key || entry.created_at || ''
                        )}
                      </p>
                    </div>
                  </div>
                </header>

                <div className="rounded-xl bg-purple-900/40 border border-purple-500/60 px-3 py-2">
                  <p className="text-[11px] text-purple-100 font-semibold mb-1">
                    O que essa missão te pedia naquele dia:
                  </p>
                  <p className="text-[11px] text-purple-100/90 leading-relaxed">
                    {missionContext}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2">
                  <p className="text-[11px] text-slate-200 font-semibold mb-1">
                    O que você escreveu nesse dia:
                  </p>
                  <p className="text-[11px] text-slate-100 leading-relaxed whitespace-pre-wrap">
                    {text}
                  </p>
                </div>
              </article>
            );
          })}

          {!premiumUser && entries.length > 1 && (
            <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-[11px] text-slate-300 flex items-center justify-between gap-3">
              <p>
                Você tem mais reflexões salvas, mas elas só aparecem aqui no
                plano Premium.
              </p>
              <Link
                href="/premium"
                className="inline-flex items-center gap-1 rounded-xl bg-purple-500 hover:bg-purple-600 px-3 py-1.5 text-[11px] font-semibold text-white"
              >
                <Crown className="w-3 h-3" />
                Desbloquear tudo
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
