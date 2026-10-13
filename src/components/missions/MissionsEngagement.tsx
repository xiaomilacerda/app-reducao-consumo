'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Check, CheckCircle2, CircleHelp, Coins, Flame, Heart,
  Leaf, Loader2, RefreshCw, ShieldCheck, Sparkles, Star, Trophy, Zap,
} from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';

type ChallengeId = 'respirar' | 'movimento' | 'refletir';
type MoodId = 'bem' | 'normal' | 'dificil';
type CheckinRow = { checkin_date: string; challenge: ChallengeId; mood: MoodId; reflection: string };
type CheckinResult = {
  ok: boolean;
  already_recorded: boolean;
  date: string;
  week_count: number;
  reward_xp: number;
  reward_coins: number;
  week_bonus: boolean;
};
type JourneyDay = { title: string; description: string; task: string };

const CHALLENGES: Array<{
  id: ChallengeId;
  title: string;
  duration: string;
  description: string;
  icon: typeof Leaf;
}> = [
  {
    id: 'respirar',
    title: 'Pausa consciente',
    duration: '2 minutos',
    description: 'Respire devagar e observe como seu corpo está agora.',
    icon: Leaf,
  },
  {
    id: 'movimento',
    title: 'Mudar de ambiente',
    duration: '5 minutos',
    description: 'Caminhe, alongue-se ou saia por alguns minutos.',
    icon: Flame,
  },
  {
    id: 'refletir',
    title: 'Reconhecer o gatilho',
    duration: '3 minutos',
    description: 'Registre o que sentiu e escolha uma resposta mais saudável.',
    icon: Heart,
  },
];

const WEEK_STORY: JourneyDay[] = [
  { title: 'Um pequeno compromisso', description: 'Toda transformação começa com uma decisão possível hoje.', task: 'Escolha uma ação simples para cuidar de você.' },
  { title: 'Reconheça seus gatilhos', description: 'Entender os momentos difíceis ajuda a preparar alternativas.', task: 'Observe em que situação a vontade costuma aparecer.' },
  { title: 'Experimente outro caminho', description: 'Novos hábitos podem ocupar o espaço dos antigos.', task: 'Faça uma pausa ou mude de ambiente quando precisar.' },
  { title: 'Valorize o que conseguiu', description: 'Progresso não precisa ser perfeito para ser importante.', task: 'Registre uma pequena conquista da semana.' },
  { title: 'Prepare os desafios', description: 'Ter um plano torna as situações difíceis mais manejáveis.', task: 'Pense numa atitude que pode ajudar você amanhã.' },
  { title: 'Cuide da sua energia', description: 'Sono, movimento e conexão também fazem parte do processo.', task: 'Escolha um cuidado prático para seu bem-estar.' },
  { title: 'Olhe para sua evolução', description: 'Você pode recomeçar quantas vezes precisar.', task: 'Reflita sobre o que descobriu e leve isso para a próxima semana.' },
];

const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

function localDayKey(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const read = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

function addUTCDate(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayOf(key: string) {
  const date = new Date(`${key}T12:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  return addUTCDate(key, -offset);
}

function recommendedChallenge(goal: string | null): ChallengeId {
  const text = (goal || '').toLowerCase();
  if (/ansiedade|estresse|calma|humor/.test(text)) return 'respirar';
  if (/saúde|corpo|energia|sono/.test(text)) return 'movimento';
  if (/parar|abstin|sem fumar|reduzir|consumo/.test(text)) return 'refletir';
  return 'respirar';
}

function focusHint(goal: string | null) {
  const text = (goal || '').toLowerCase();
  if (/ansiedade|estresse|calma|humor/.test(text)) return 'Suas missões priorizam tranquilidade e autocuidado.';
  if (/parar|abstin|sem fumar|reduzir|consumo/.test(text)) return 'Suas missões apoiam a mudança dos hábitos de consumo.';
  if (/saúde|corpo|energia|sono/.test(text)) return 'Suas missões priorizam saúde e bem-estar.';
  return 'Escolha a atividade que combina mais com o seu momento.';
}

type Props = {
  userId: string | null;
  onReward?: () => void;
  onProgress?: (count: number) => void;
};

export default function MissionsEngagement({ userId, onReward, onProgress }: Props) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [goal, setGoal] = useState<string | null>(null);
  const [rows, setRows] = useState<CheckinRow[]>([]);
  const [awardedWeek, setAwardedWeek] = useState(false);
  const [selected, setSelected] = useState<ChallengeId>('respirar');
  const [mood, setMood] = useState<MoodId>('normal');
  const [reflection, setReflection] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState(false);
  const [dayClock, setDayClock] = useState(() => new Date().toISOString());

  const today = useMemo(() => {
    try { return localDayKey(timezone); }
    catch { return dayClock; }
  }, [timezone, dayClock]);

  const weekStart = mondayOf(today);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addUTCDate(weekStart, i)), [weekStart]);
  const indexToday = days.indexOf(today);
  const recorded = rows.find((r) => r.checkin_date === today);
  const daysRecorded = rows.filter((r) => days.includes(r.checkin_date));
  const completedSet = new Set(daysRecorded.map((r) => r.checkin_date));
  const total = daysRecorded.length;
  const percent = Math.min(100, Math.round((total / 7) * 100));
  const recommended = recommendedChallenge(goal);

  const refresh = useCallback(async () => {
    if (!userId) { setLoading(false); setRows([]); setAwardedWeek(false); onProgress?.(0); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles').select('timezone,main_goal').eq('id', userId).maybeSingle();
      if (profileErr) throw profileErr;
      const tz = profile?.timezone || 'America/Sao_Paulo';
      let verifiedTz = 'America/Sao_Paulo';
      try { localDayKey(tz); verifiedTz = tz; } catch { /* fallback de fuso */ }
      setTimezone(verifiedTz);

      const key = localDayKey(verifiedTz);
      const monday = mondayOf(key);
      const { data: checkins, error: checkinErr } = await supabase
        .from('engagement_daily_checkins')
        .select('checkin_date,challenge,mood,reflection')
        .eq('user_id', userId).gte('checkin_date', monday)
        .lte('checkin_date', addUTCDate(monday, 6))
        .order('checkin_date', { ascending: true });
      if (checkinErr) throw checkinErr;

      const { data: bonus, error: bonusErr } = await supabase
        .from('engagement_week_awards').select('week_start')
        .eq('user_id', userId).eq('week_start', monday).maybeSingle();
      if (bonusErr) throw bonusErr;
      setGoal(profile?.main_goal ?? null);
      setSelected(recommendedChallenge(profile?.main_goal ?? null));
      setRows((checkins ?? []) as CheckinRow[]);
      setAwardedWeek(!!bonus);
      onProgress?.(checkins?.length ?? 0);
    } catch (e) {
      console.error('Erro ao carregar check-ins:', e);
      setError('Não foi possível sincronizar seus check-ins. Confira a conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [supabase, userId, onProgress]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    // Atualiza o dia quando a página volta ao primeiro plano.
    function onVisible() { if (document.visibilityState === 'visible') { setDayClock(new Date().toISOString()); void refresh(); } }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  async function submit() {
    if (!userId) { setError('Entre na sua conta para registrar seu check-in.'); return; }
    if (busy || recorded) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setCelebration(false);
    try {
      const { data, error: rpcErr } = await supabase.rpc('engagement_record_checkin', {
        p_challenge: selected,
        p_mood: mood,
        p_reflection: reflection.trim(),
      });
      if (rpcErr) throw rpcErr;
      const result = data as CheckinResult | null;
      if (!result?.ok) throw new Error('O servidor não confirmou seu check-in.');
      await refresh();
      if (result.already_recorded) {
        setMessage('Seu check-in de hoje já estava registrado. Nenhuma recompensa foi duplicada.');
      } else {
        setCelebration(true);
        setMessage(result.week_bonus
          ? 'Você concluiu 7 dias! Recebeu 8 XP e 4 moedas, mais o bônus semanal de 35 XP e 20 moedas. ✨'
          : 'Sua vitória de hoje foi registrada! Você ganhou 8 XP e 4 moedas. ✨');
        onReward?.();
      }
    } catch (err) {
      console.error('Falha no check-in:', err);
      setError('Seu check-in não foi confirmado. Tente novamente; não haverá recompensa duplicada.');
    } finally {
      setBusy(false);
    }
  }

  const story = WEEK_STORY[Math.max(0, indexToday)];
  const displayedMotivation = selected === 'respirar'
    ? 'A respiração ajuda a criar um intervalo antes de reagir a um impulso.'
    : selected === 'movimento'
      ? 'Mudar de ambiente pode interromper o ciclo de um gatilho.'
      : 'Dar nome ao que você sente ajuda a reconhecer padrões.';

  return (
    <section className="space-y-5" aria-label="Seu ritual diário e jornada de sete dias">
      <div className="overflow-hidden rounded-3xl border border-violet-400/25 bg-gradient-to-br from-violet-950 via-[#111124] to-[#071a17] shadow-[0_16px_48px_rgba(0,0,0,.30)]">
        <div className="relative px-5 py-6 sm:px-7 sm:py-7">
          <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-emerald-400/10 blur-[56px]" aria-hidden="true" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-emerald-300">
                <Sparkles className="h-4 w-4" /> Seu ritual de hoje
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Uma conquista de cada vez.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
                Escolha uma ação, registre como está se sentindo e reconheça seu progresso — sem pressão para ser perfeito.
              </p>
              <p className="mt-2 text-xs text-violet-200/90">{focusHint(goal)}</p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200">
              <Zap className="h-4 w-4" /> +8 XP <span className="text-amber-300/40">•</span>
              <Coins className="h-4 w-4" /> +4 moedas
            </div>
          </div>

          {loading ? (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando suas conquistas...
            </div>
          ) : recorded ? (
            <div className="mt-6 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-5" role="status">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-emerald-300" />
                <div>
                  <h3 className="text-lg font-bold text-emerald-100">Check-in de hoje concluído!</h3>
                  <p className="mt-1 text-sm text-emerald-100/85">
                    Você escolheu {CHALLENGES.find((c) => c.id === recorded.challenge)?.title.toLowerCase() ?? 'uma ação de cuidado'}.
                    Amanhã haverá outra oportunidade.
                  </p>
                  {recorded.reflection && <p className="mt-3 rounded-xl bg-black/20 p-3 text-sm text-slate-200">{recorded.reflection}</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white">1. O que faz mais sentido para você hoje?</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {CHALLENGES.map((option) => {
                    const Icon = option.icon;
                    const active = selected === option.id;
                    return (
                      <button key={option.id} type="button" onClick={() => setSelected(option.id)}
                        aria-pressed={active}
                        className={`min-h-[124px] rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${active
                          ? 'border-emerald-400 bg-emerald-400/15 shadow-[0_0_0_1px_rgba(52,211,153,.35)]'
                          : 'border-white/15 bg-white/5 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10'}`}>
                        <div className="flex items-center justify-between">
                          <Icon className={`h-5 w-5 ${active ? 'text-emerald-300' : 'text-violet-300'}`} />
                          {active && <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                        </div>
                        <p className="mt-2 text-sm font-bold text-white">{option.title}</p>
                        {goal && option.id === recommended && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-violet-400/20 px-2 py-0.5 text-[10px] font-bold text-violet-100">
                            <Sparkles className="h-3 w-3" /> Recomendado para você
                          </span>
                        )}
                        <p className="text-[11px] font-medium text-emerald-200/85">{option.duration}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-300">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-400">{displayedMotivation}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">2. Como está se sentindo?</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {([
                    ['bem', '🙂 Estou bem'],
                    ['normal', '😐 Um dia comum'],
                    ['dificil', '💜 Está difícil'],
                  ] as const).map(([id, label]) => (
                    <button key={id} type="button" onClick={() => setMood(id)}
                      aria-pressed={mood === id}
                      className={`min-h-11 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${mood === id
                        ? 'border-violet-400 bg-violet-500/25 text-white'
                        : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="engagement-reflection" className="text-sm font-semibold text-white">
                  3. Quer registrar uma reflexão? <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <textarea id="engagement-reflection" rows={2} maxLength={500} value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  placeholder={story.task}
                  className="mt-2 w-full resize-y rounded-xl border border-slate-600 bg-[#0b1121] p-3 text-sm text-white placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                />
                <p className="mt-1 text-right text-xs text-slate-400">{reflection.length}/500</p>
              </div>
              <button type="button" onClick={() => void submit()} disabled={!userId || busy}
                className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-400 px-5 py-3.5 text-base font-extrabold text-[#06271d] shadow-[0_10px_28px_rgba(52,211,153,.20)] transition-all hover:-translate-y-0.5 hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/50 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> Salvando seu check-in...</>
                  : <><CheckCircle2 className="h-5 w-5" /> Registrar minha vitória de hoje <ArrowRight className="h-4 w-4" /></>}
              </button>
              <p className="text-center text-xs leading-relaxed text-slate-400">
                Check-in opcional: não é necessário manter uma sequência perfeita para continuar sua jornada.
              </p>
            </div>
          )}

          {message && (
            <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${celebration ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100' : 'border-violet-400/30 bg-violet-400/10 text-violet-100'}`} role="status" aria-live="polite">
              {celebration && <Sparkles className="mr-2 inline h-4 w-4" />}{message}
            </div>
          )}
          {error && <div className="mt-4 flex items-start justify-between gap-2 rounded-xl border border-rose-400/35 bg-rose-500/10 p-3 text-sm text-rose-100" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void refresh()} className="inline-flex shrink-0 items-center gap-1 font-semibold underline underline-offset-2">
              <RefreshCw className="h-4 w-4" /> Tentar
            </button>
          </div>}
        </div>
      </div>

      <div className="rounded-3xl border border-white/15 bg-[#10121c] p-5 shadow-xl sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.13em] text-violet-300">
              <Trophy className="h-4 w-4" /> Sua jornada de 7 dias
            </p>
            <h2 className="mt-2 text-xl font-bold text-white">Pequenas ações, progresso real.</h2>
            <p className="mt-1 text-sm text-slate-300">Um tema diferente a cada dia. Sua jornada recomeça toda segunda, sem punições.</p>
          </div>
          <span className="rounded-xl border border-violet-400/25 bg-violet-500/15 px-3 py-2 text-sm font-semibold text-violet-100">
            {total}/7 dias
          </span>
        </div>

        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-700/75"
          role="progressbar" aria-label="Progresso da jornada semanal" aria-valuemin={0} aria-valuemax={7} aria-valuenow={total}>
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-emerald-400 transition-[width] duration-500 ease-out"
            style={{ width: `${percent}%` }} />
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">
          {days.map((day, i) => {
            const done = completedSet.has(day);
            const current = day === today;
            const isPast = day < today;
            return (
              <div key={day} title={`${DAY_NAMES[i]}, ${day}: ${done ? 'registrado' : current ? 'hoje' : isPast ? 'sem registro' : 'próximo dia'}`}
                className={`relative flex min-h-[81px] flex-col items-center justify-center rounded-xl border px-1 py-2 text-center transition-colors sm:min-h-[90px] ${done
                  ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                  : current
                    ? 'border-violet-300 bg-violet-500/20 text-white ring-2 ring-violet-400/30'
                    : 'border-white/10 bg-white/[.035] text-slate-400'}`}>
                <span className="text-xs font-bold sm:text-sm">{DAY_NAMES[i]}</span>
                <span className="mt-1 text-[10px] sm:text-xs">{day.slice(8,10)}/{day.slice(5,7)}</span>
                {done ? <Check className="mt-1 h-4 w-4 text-emerald-300" />
                  : current ? <span className="mt-1 text-[10px] font-bold text-violet-200">HOJE</span>
                    : <span className="mt-1 h-4" />}
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-2xl border border-violet-400/20 bg-gradient-to-r from-violet-500/10 to-transparent p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-200">
              {indexToday >= 0 ? `Capítulo ${indexToday + 1} de 7` : 'Seu próximo capítulo'}
            </p>
            {recorded && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Vivido hoje</span>}
          </div>
          <h3 className="mt-2 text-lg font-bold text-white">{story.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{story.description}</p>
          <p className="mt-3 flex items-start gap-2 text-sm text-violet-100">
            <Star className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /> {story.task}
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[.06] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm text-slate-200">
            <Coins className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <p className="font-semibold text-white">{awardedWeek ? 'Bônus da semana desbloqueado!' : 'Recompensa por completar os 7 dias'}</p>
              <p className="mt-1 text-xs text-slate-300">
                {awardedWeek ? 'Seu bônus foi creditado uma vez na sua conta.' : '+35 XP e +20 moedas ao registrar os 7 dias desta semana.'}
              </p>
            </div>
          </div>
          <Link href="/rewards" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-bold text-amber-100 transition-colors hover:bg-amber-400/20">
            Ver recompensas <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs leading-relaxed text-slate-400">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
          Check-ins e bônus são confirmados pelo Supabase. Um dia perdido não apaga suas conquistas anteriores.
        </div>
      </div>
    </section>
  );
}
