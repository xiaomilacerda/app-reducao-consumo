'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Crown,
  Flame,
  Loader2,
  Lock,
  NotebookPen,
  Sparkles,
  Target,
  User as UserIcon,
} from 'lucide-react';

// ✅ Usa a MESMA instância global do app (igual /premium)
import { supabase } from '@/lib/supabase';

type Mission = {
  id: number;
  title: string;
  description: string | null;
  steps_json: string[] | string | null;
  journey_day: number;
  is_journey: boolean | null;
};

type MissionJournalRow = {
  id: number;
  journey_day: number | null;
  // Colunas existentes no Supabase de produção.
  answer_text: string | null;
  content: string | null;
  day_key: string | null;
  created_at: string | null;
};

type JourneyDayRow = {
  id: number;
  day_index: number;
  day_date: string;
};

type Profile = {
  id: string;
  is_premium: boolean | null;
};

const SUCCESS_MESSAGES = [
  'Reflexão salva. Mais um tijolinho na sua liberdade. 💜',
  'Boa! Cada dia registrado é uma prova de que você está levando isso a sério. ✨',
  'Top demais! No futuro você vai agradecer por ter escrito isso hoje. 📖',
  'Missão feita, reflexão salva. Sua nova versão está em construção. 🚀',
  'Perfeito. Hoje você deu um passo que muita gente deixa para depois. 👊',
];

function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getJournalText(row?: MissionJournalRow | null) {
  if (!row) return '';
  return row.content || row.answer_text || '';
}

function normalizeSteps(steps: Mission['steps_json']) {
  if (!steps) return [];

  if (Array.isArray(steps)) {
    return steps
      .map((step) => String(step || '').trim())
      .filter(Boolean);
  }

  if (typeof steps === 'string') {
    try {
      const parsed = JSON.parse(steps);
      if (Array.isArray(parsed)) {
        return parsed
          .map((step) => String(step || '').trim())
          .filter(Boolean);
      }
    } catch {
      return steps
        .split('\n')
        .map((step) => step.replace(/^[-•\d.)\s]+/, '').trim())
        .filter(Boolean);
    }
  }

  return [];
}

export default function Jornada365Page() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingJournal, setSavingJournal] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [currentMission, setCurrentMission] = useState<Mission | null>(null);

  const [journeyDayNumber, setJourneyDayNumber] = useState<number | null>(null);

  const [journalEntries, setJournalEntries] = useState<MissionJournalRow[]>([]);
  const [journalRecord, setJournalRecord] = useState<MissionJournalRow | null>(
    null
  );
  const [journalContent, setJournalContent] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const premiumUser = !!profile?.is_premium;

  // Mapa dia -> journal (para saber se o dia foi concluído e carregar reflexão)
  const journalByDay = useMemo(() => {
    const map = new Map<number, MissionJournalRow>();
    for (const row of journalEntries) {
      if (row.journey_day != null) {
        map.set(row.journey_day, row);
      }
    }
    return map;
  }, [journalEntries]);

  const completedDays = journalByDay.size;
  const totalDays = missions.length || 365;
  const currentProgressDay = Math.min(journeyDayNumber || 1, totalDays);
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((completedDays / totalDays) * 100))
  );
  const remainingDays = Math.max(totalDays - completedDays, 0);
  const unsavedChanges = journalRecord
    ? journalContent !== getJournalText(journalRecord)
    : journalContent.trim().length > 0;

  useEffect(() => {
    loadData().catch((err) => {
      console.error(err);
      setError('Erro ao carregar a Jornada. Tente novamente mais tarde.');
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    // ✅ Usa getSession com o supabase global (igual /premium)
    const {
      data: { session },
      error: sessionErr,
    } = await supabase.auth.getSession();

    if (sessionErr || !session?.user) {
      router.push('/login');
      return;
    }

    const user = session.user;

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, is_premium')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError && (profileError as any).message) {
      console.error('Erro ao carregar profile:', (profileError as any).message);
    }
    setProfile(profileData as Profile | null);

    const { data: missionsData, error: missionsError } = await supabase
      .from('journey_365_missions')
      .select('id, title, description, steps_json, journey_day, is_journey')
      .eq('is_journey', true)
      .order('journey_day', { ascending: true });

    if (missionsError) {
      console.error(missionsError);
      throw missionsError;
    }

    const missionsTyped = (missionsData || []) as Mission[];
    setMissions(missionsTyped);

    const today = todayKey();

    const { data: daysRows, error: daysError } = await supabase
      .from('journey_days')
      .select('id, day_index, day_date')
      .eq('user_id', user.id)
      .order('day_index', { ascending: true });

    if (daysError && (daysError as any).message) {
      console.error(
        'Erro ao carregar journey_days:',
        (daysError as any).message
      );
    }

    const rows = (daysRows || []) as JourneyDayRow[];
    let todayRow = rows.find((r) => r.day_date === today);

    if (!todayRow) {
      const maxIndex =
        rows.length > 0 ? Math.max(...rows.map((r) => r.day_index || 0)) : 0;

      // Tentar criar o dia — pode falhar se já existir (duplicado)
      const { data: inserted, error: insertError } = await supabase
        .from('journey_days')
        .insert({
          user_id: user.id,
          day_index: maxIndex + 1,
          day_date: today,
        })
        .select('id, day_index, day_date')
        .maybeSingle();

      if (insertError) {
        // Se for duplicado, apenas buscamos a linha existente
        if (insertError.message.includes('duplicate key value')) {
          const { data: existingDay } = await supabase
            .from('journey_days')
            .select('id, day_index, day_date')
            .eq('user_id', user.id)
            .eq('day_date', today)
            .maybeSingle();

          todayRow = existingDay as JourneyDayRow;
        } else {
          console.error(
            'Erro inesperado ao criar journey_days:',
            insertError.message
          );
          todayRow = {
            id: -1,
            day_index: 1,
            day_date: today,
          };
        }
      } else if (inserted) {
        todayRow = inserted as JourneyDayRow;
      }
    }

    const currentDayIndex = todayRow?.day_index ?? 1;
    setJourneyDayNumber(currentDayIndex);

    // Selecionar apenas colunas que existem no banco de produção.
    const { data: journalData, error: journalError } = await supabase
      .from('mission_journal')
      .select(
        'id, journey_day, answer_text, content, day_key, created_at'
      )
      .eq('user_id', user.id)
      .order('day_key', { ascending: true });

    if (journalError && (journalError as any).message) {
      console.error(
        'Erro ao carregar mission_journal (Jornada 365):',
        (journalError as any).message
      );
    }

    const journalRows = (journalData || []) as MissionJournalRow[];
    setJournalEntries(journalRows);

    const totalMissions = missionsTyped.length;
    const clampedDay =
      totalMissions > 0
        ? Math.min(Math.max(currentDayIndex, 1), totalMissions)
        : currentDayIndex;

    const current =
      missionsTyped.find((m) => m.journey_day === clampedDay) ||
      missionsTyped[0] ||
      null;

    setCurrentMission(current);

    if (current) {
      const existing = journalRows.find(
        (j) => j.journey_day === current.journey_day
      );
      if (existing) {
        setJournalRecord(existing);
        setJournalContent(getJournalText(existing));
      } else {
        setJournalRecord(null);
        setJournalContent('');
      }
    }

    setLoading(false);
  }

  async function handleSaveJournal() {
    if (!currentMission) return;

    setSavingJournal(true);
    setError(null);
    setSuccessMsg(null);

    const {
      data: { session },
      error: sessionErr,
    } = await supabase.auth.getSession();

    if (sessionErr || !session?.user) {
      router.push('/login');
      return;
    }

    const user = session.user;

    try {
      const day = todayKey();
      const cleanContent = journalContent.trim();

      const payload = {
        user_id: user.id,
        journey_day: currentMission.journey_day,
        // Mantém a coluna legada usada pelo histórico e a coluna principal.
        answer_text: cleanContent,
        content: cleanContent,
        day_key: day,
      };

      const { data, error } = await supabase
        .from('mission_journal')
        .upsert(payload, {
          onConflict: 'user_id,journey_day',
        })
        .select(
          'id, journey_day, answer_text, content, day_key, created_at'
        )
        .maybeSingle();

      if (error) {
        if ((error as any).message) {
          console.error('Erro ao salvar journal:', (error as any).message);
        } else {
          console.error(error);
        }
        setError('Não foi possível salvar sua reflexão. Tente novamente.');
      } else if (data) {
        const row = data as MissionJournalRow;
        setJournalRecord(row);
        setJournalContent(getJournalText(row));

        setJournalEntries((prev) => {
          const map = new Map<number, MissionJournalRow>();
          for (const p of prev) {
            if (p.journey_day != null) map.set(p.journey_day, p);
          }
          if (row.journey_day != null) map.set(row.journey_day, row);
          return Array.from(map.values()).sort((a, b) =>
            (a.day_key || '').localeCompare(b.day_key || '')
          );
        });

        const idx = Math.floor(Math.random() * SUCCESS_MESSAGES.length);
        setSuccessMsg(SUCCESS_MESSAGES[idx]);
      }
    } finally {
      setSavingJournal(false);
    }
  }

  // Status para linha do tempo
  function getStatusForDay(day: number): 'completed' | 'today' | 'pending' {
    if (journalByDay.has(day)) return 'completed';
    if (journeyDayNumber === day) return 'today';
    return 'pending'; // pode ser passado ou futuro, vamos diferenciar na timeline
  }

  // PREMIUM: selecionar uma missão (incluindo dias perdidos)
  function handleSelectMission(mission: Mission) {
    setCurrentMission(mission);
    setError(null);
    setSuccessMsg(null);

    const existing = mission.journey_day
      ? journalByDay.get(mission.journey_day)
      : undefined;

    if (existing) {
      setJournalRecord(existing);
      setJournalContent(getJournalText(existing));
    } else {
      setJournalRecord(null);
      setJournalContent('');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const currentSteps = useMemo(
    () => normalizeSteps(currentMission?.steps_json || null),
    [currentMission?.steps_json]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05020B] text-zinc-100">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Carregando sua Jornada 365...</span>
        </div>
      </div>
    );
  }

  if (!currentMission) {
    return (
      <div className="min-h-screen bg-[#05020B] text-zinc-100 p-4">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <h1 className="text-2xl font-semibold mb-2">Jornada 365</h1>
          <p className="text-zinc-400">
            Não encontramos missões ativas no momento. Verifique se a tabela
            <code className="mx-1">journey_365_missions</code> está preenchida.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05020B] text-zinc-100">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* HEADER */}
        <header className="flex items-center justify-between mb-5 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Início</span>
            </button>
            <div className="hidden sm:block h-5 w-px bg-zinc-700/70" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs uppercase tracking-[0.14em] text-purple-300/80">
                WeedReset · Jornada 365
              </span>
              <span className="text-base sm:text-lg font-semibold flex items-center gap-2 truncate">
                Reta final da sua liberdade
                <Sparkles className="w-4 h-4 text-purple-300 shrink-0" />
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {premiumUser && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-amber-400/60 px-3 py-1 text-[11px] text-amber-200 bg-amber-500/10">
                <Crown className="w-3 h-3" />
                Premium ativo
              </span>
            )}
            <Link
              href="/profile"
              className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-purple-500/60 bg-purple-900/60 hover:bg-purple-800 transition-colors"
              aria-label="Ir para o perfil"
            >
              <UserIcon className="w-4 h-4 text-purple-100" />
            </Link>
          </div>
        </header>

        {/* ALERTAS */}
        <div className="space-y-2 mb-4">
          {error && (
            <div className="rounded-xl border border-red-500/60 bg-red-950/40 px-3 py-2 text-xs text-red-100">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="rounded-xl border border-emerald-500/60 bg-emerald-900/40 px-3 py-2 text-xs text-emerald-100 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
          {unsavedChanges && !successMsg && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-100 flex items-center gap-2">
              <Clock3 className="w-4 h-4 shrink-0" />
              <span>Você tem uma reflexão escrita ainda não salva.</span>
            </div>
          )}
        </div>

        {/* RESUMO */}
        <section className="mb-6 rounded-2xl border border-purple-500/40 bg-gradient-to-b from-purple-900/40 to-purple-950/60 p-4 shadow-lg shadow-purple-900/40">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">
                Sobre a Jornada 365 – para a vida toda
              </h2>
              <p className="text-xs text-zinc-200 leading-relaxed max-w-2xl">
                A Jornada 365 não é só uma contagem de dias. Ela foi desenhada
                para tirar você do modo automático, reconstruir gatilhos,
                fortalecer sua cabeça e consolidar uma identidade livre. Não é
                “até o dia 365”: é o treino para uma vida inteira.
              </p>
            </div>

            <div className="rounded-2xl border border-purple-400/30 bg-black/25 p-3 min-w-[150px]">
              <p className="text-[10px] uppercase tracking-wide text-purple-200">
                Progresso registrado
              </p>
              <p className="text-2xl font-bold text-white mt-1">
                {progressPercent}%
              </p>
              <div className="mt-2 h-2 rounded-full bg-zinc-900 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-400 to-pink-400"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div className="rounded-xl border border-purple-400/20 bg-black/20 px-3 py-2">
              <p className="text-[10px] text-zinc-400">Dia atual</p>
              <p className="text-sm font-semibold flex items-center gap-1">
                <CalendarDays className="w-3 h-3 text-purple-200" />
                {currentProgressDay}/{totalDays}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-400/20 bg-black/20 px-3 py-2">
              <p className="text-[10px] text-zinc-400">Concluídas</p>
              <p className="text-sm font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                {completedDays}
              </p>
            </div>
            <div className="rounded-xl border border-amber-400/20 bg-black/20 px-3 py-2">
              <p className="text-[10px] text-zinc-400">Restantes</p>
              <p className="text-sm font-semibold flex items-center gap-1">
                <Target className="w-3 h-3 text-amber-200" />
                {remainingDays}
              </p>
            </div>
            <div className="rounded-xl border border-pink-400/20 bg-black/20 px-3 py-2">
              <p className="text-[10px] text-zinc-400">Foco</p>
              <p className="text-sm font-semibold flex items-center gap-1">
                <Flame className="w-3 h-3 text-pink-300" />
                Hoje
              </p>
            </div>
          </div>

          <ul className="text-[11px] text-zinc-200 space-y-1">
            <li>
              • <span className="font-semibold">Início:</span> entender o vício,
              quebrar automáticos e sobreviver aos primeiros dias.
            </li>
            <li>
              • <span className="font-semibold">Meio:</span> reconstruir
              rotina, emoções, relações e visão de futuro.
            </li>
            <li>
              • <span className="font-semibold">Final:</span> consolidar quem
              você se tornou e garantir que a mudança continue fora do app.
            </li>
          </ul>
        </section>

        {/* MISSÃO SELECIONADA (DIA ATUAL OU DIA ATRASADO PREMIUM) */}
        <section className="mb-8 rounded-2xl border border-purple-500/60 bg-gradient-to-b from-purple-900/50 to-purple-950 p-4 shadow-lg shadow-purple-900/40">
          <header className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-purple-200/80">
                Dia {currentMission.journey_day} de {missions.length || 365}
              </p>
              <h2 className="text-lg font-semibold mt-1">
                {currentMission.title}
              </h2>
              {journeyDayNumber && (
                <p className="text-[11px] text-purple-200/80 mt-1">
                  Seu dia na jornada hoje:{' '}
                  <strong>{journeyDayNumber}</strong>
                  {currentMission.journey_day !== journeyDayNumber && (
                    <span className="ml-1 text-[10px] text-amber-200">
                      (revendo missão de outro dia)
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/40 text-emerald-200 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Missão diária
              </span>
            </div>
          </header>

          {currentMission.description && (
            <p className="text-xs text-zinc-100/90 mb-3 leading-relaxed">
              {currentMission.description}
            </p>
          )}

          {currentSteps.length > 0 && (
            <div className="mt-3 mb-4 rounded-2xl bg-zinc-950/70 border border-purple-500/60 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-200" />
                  <h3 className="text-sm font-medium text-zinc-50">
                    Passo a passo da missão de hoje
                  </h3>
                </div>
                <span className="hidden sm:inline text-[10px] text-zinc-400">
                  Siga na ordem, sem pressa.
                </span>
              </div>
              <ol className="space-y-2">
                {currentSteps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-[11px] font-semibold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs text-zinc-100 leading-relaxed">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* REFLEXÃO */}
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-1">
              <NotebookPen className="w-4 h-4 text-purple-200" />
              <h3 className="text-sm font-medium">
                Sua reflexão da missão de hoje
              </h3>
            </div>
            <p className="text-[11px] text-zinc-300 mb-2">
              Escreva aqui sua resposta com calma. Não precisa ficar perfeito:
              o objetivo é registrar o que você percebeu hoje.
            </p>

            <textarea
  className="
    jornada-textarea
    w-full
    min-h-[220px]
    rounded-2xl
    bg-white
    border-2
    border-purple-400
    px-4
    py-3
    text-sm
    font-medium
    leading-relaxed
    outline-none
    resize-y
    shadow-inner
    shadow-purple-950/10
    focus:ring-4
    focus:ring-purple-400/30
    focus:border-purple-300
  "
              style={{
                color: '#111827',
                WebkitTextFillColor: '#111827',
                backgroundColor: '#ffffff',
              }}
              placeholder="Descreva aqui o que você aprendeu, decidiu ou sentiu com essa missão de hoje..."
              value={journalContent}
              onChange={(e) => setJournalContent(e.target.value)}
            />

            <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <button
                onClick={handleSaveJournal}
                disabled={savingJournal}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-500 hover:bg-purple-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-60"
              >
                {savingJournal ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    Salvar reflexão de hoje
                  </>
                )}
              </button>

              <div className="flex flex-col sm:items-end gap-0.5">
                <span className="text-[10px] text-zinc-400">
                  {journalContent.trim().length} caracteres
                </span>
                {journalRecord && (
                  <span className="text-[10px] text-emerald-300">
                    Último salvamento registrado para este dia.
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* HISTÓRICO (BOTÃO PREMIUM) */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Seu histórico da Jornada</h2>
          </div>

          <div className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-zinc-200">
              <p className="font-medium mb-1">
                Rever tudo o que você já escreveu
              </p>
              <p className="text-[11px] text-zinc-400">
                Acesso ao histórico completo das respostas da Jornada 365 é um
                recurso premium. Ideal para quem quer revisitar a própria
                trajetória com profundidade.
              </p>
            </div>

            {premiumUser ? (
              <Link
                href="/jornada/history"
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-purple-500 hover:bg-purple-600 px-3 py-2 text-[11px] font-semibold text-white shrink-0"
              >
                <Crown className="w-3 h-3" />
                Abrir histórico
              </Link>
            ) : (
              <div className="flex flex-col sm:items-end gap-1 shrink-0">
                <Link
                  href="/premium"
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-[11px] font-semibold text-zinc-100 border border-zinc-600"
                >
                  <Lock className="w-3 h-3" />
                  Recurso Premium
                </Link>
                <p className="text-[10px] text-zinc-500 max-w-[180px] sm:text-right">
                  Faça upgrade para acessar todas as reflexões, filtradas por
                  dia da jornada.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* LINHA DO TEMPO – COM BOTÃO DE REFAZER PARA PREMIUM */}
        <section className="mb-12">
          <h2 className="text-sm font-semibold mb-2">
            Linha do tempo da Jornada
          </h2>
          <div className="space-y-2">
            {missions.map((m) => {
              const status = getStatusForDay(m.journey_day);
              const isToday = journeyDayNumber === m.journey_day;
              const isPast =
                journeyDayNumber != null && m.journey_day < journeyDayNumber;
              const isFuture =
                journeyDayNumber != null && m.journey_day > journeyDayNumber;

              const baseClasses =
                'rounded-2xl border px-3 py-2 text-xs flex items-center justify-between gap-2 transition';
              const palette =
                status === 'completed'
                  ? 'border-emerald-500/40 bg-emerald-900/30'
                  : isToday
                  ? 'border-purple-500/60 bg-purple-900/40'
                  : 'border-zinc-700 bg-zinc-900/60';

              const canMakeUp =
                premiumUser && isPast && status === 'pending'; // PREMIUM: dias perdidos

              return (
                <div key={m.id} className={baseClasses + ' ' + palette}>
                  <div className="min-w-0">
                    <p className="font-medium">
                      Dia {m.journey_day} – {m.title}
                    </p>
                    {m.description && (
                      <p className="text-[11px] text-zinc-300 line-clamp-2">
                        {m.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-zinc-200">
                      {status === 'completed'
                        ? 'Concluída'
                        : isToday
                        ? 'Missão de hoje'
                        : isFuture
                        ? 'Ainda não liberada'
                        : 'Pendente'}
                    </span>

                    {canMakeUp && (
                      <button
                        onClick={() => handleSelectMission(m)}
                        className="inline-flex items-center gap-1 rounded-full bg-purple-500 hover:bg-purple-600 px-3 py-1 text-[10px] font-semibold text-white"
                      >
                        Refazer missão
                      </button>
                    )}

                    {!premiumUser && isPast && status === 'pending' && (
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Recurso Premium
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
