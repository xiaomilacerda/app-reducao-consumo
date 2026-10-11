'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  SmilePlus,
  Bell,
  Crown,
  CalendarDays,
  HeartPulse,
  RefreshCcw,
  TrendingUp,
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

/* ---------- CONFIG ---------- */
const DEFAULT_MIN_INTERVAL_HOURS = 12;

const MOODS = [
  { key: 'excelente', emoji: '🤩', label: 'Excelente', value: 100 },
  { key: 'maravilhoso', emoji: '😍', label: 'Maravilhoso', value: 95 },
  { key: 'otimo', emoji: '😄', label: 'Ótimo', value: 90 },
  { key: 'feliz', emoji: '🙂', label: 'Feliz', value: 80 },
  { key: 'animado', emoji: '😃', label: 'Animado', value: 75 },
  { key: 'bem', emoji: '😊', label: 'Bem', value: 65 },
  { key: 'normal', emoji: '😐', label: 'Normal', value: 55 },
  { key: 'calmo', emoji: '😌', label: 'Calmo', value: 50 },
  { key: 'preocupado', emoji: '😕', label: 'Preocupado', value: 40 },
  { key: 'ansioso', emoji: '😥', label: 'Ansioso', value: 30 },
  { key: 'muito_ansioso', emoji: '😰', label: 'Muito Ansioso', value: 20 },
  { key: 'irritado', emoji: '😤', label: 'Irritado', value: 15 },
  { key: 'triste', emoji: '😢', label: 'Triste', value: 8 },
  { key: 'muito_mal', emoji: '😡', label: 'Muito Mal / Raiva', value: 3 },
];

/**
 * Categoria aproximada por humor — usada para escolher a mensagem diária.
 */
const MOOD_CATEGORY_MAP: Record<string, string> = {
  excelente: 'motivation',
  maravilhoso: 'encouragement',
  otimo: 'motivation',
  feliz: 'encouragement',
  animado: 'encouragement',
  bem: 'reflection',
  normal: 'reflection',
  calmo: 'calma',
  preocupado: 'reflection',
  ansioso: 'calma',
  muito_ansioso: 'support',
  irritado: 'tapa',
  triste: 'support',
  muito_mal: 'support',
};

const LAST_NOTIF_KEY = 'last_notification_times_v2';

function getCategoryForMoodKey(moodKey: string): string {
  return MOOD_CATEGORY_MAP[moodKey] || moodKey;
}

function moodValueToEmoji(value: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '😐';
  let closest = MOODS[0];
  let bestDiff = Math.abs(value - closest.value);
  for (let i = 1; i < MOODS.length; i++) {
    const diff = Math.abs(value - MOODS[i].value);
    if (diff < bestDiff) {
      bestDiff = diff;
      closest = MOODS[i];
    }
  }
  return closest.emoji;
}

function localDateKey(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeEntryDate(value: string) {
  if (!value) return '';
  // Se o banco já retorna YYYY-MM-DD, não converte para UTC para evitar erro de fuso horário.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return localDateKey(new Date(value));
}

function formatDateShort(d: string) {
  const key = normalizeEntryDate(d);
  if (!key) return '--/--';
  const [yyyy, mm, dd] = key.split('-').map(Number);
  const date = new Date(yyyy, mm - 1, dd);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

function toPlainError(err: any) {
  if (!err) return null;
  try {
    const keys = Object.getOwnPropertyNames(err);
    const plain: any = {};
    for (const k of keys) plain[k] = err[k];
    plain.message = plain.message ?? err?.message;
    plain.code = plain.code ?? err?.code;
    plain.details = plain.details ?? err?.details;
    plain.hint = plain.hint ?? err?.hint;
    return plain;
  } catch {
    return { message: String(err) };
  }
}

function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('ENV SUPABASE AUSENTE:', { url: !!url, key: !!key });
  }

  return createBrowserClient(url || '', key || '');
}

export default function MoodTrackerPage() {
  const supabase = useMemo(createClient, []);

  const [user, setUser] = useState<any | null>(null);
  const [themeMode, setThemeMode] = useState<'normal' | 'focus'>('normal');
  const [isPremium, setIsPremium] = useState(false);

  /* dados principais */
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<any[]>([]);
  const [selectedMood, setSelectedMood] = useState<any | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveDebug, setSaveDebug] = useState<any | null>(null);

  /* ui / gráficos */
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedRange, setSelectedRange] = useState<
    'week' | 'month' | 'year' | 'day'
  >('month');
  const [thermo, setThermo] = useState(0);
  const [insights, setInsights] = useState({
    message: 'Carregando insights...',
    risk: 0,
    trend: 0,
  });
  const [notifPermission, setNotifPermission] = useState<
    'default' | 'granted' | 'denied'
  >('default');

  /* status de permissão de notificação */
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(
        Notification.permission as 'default' | 'granted' | 'denied'
      );
    }
  }, []);

  /* carregamento inicial: usuário, profile, mood_entries */
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getUser();
        const currentUser = data.user ?? null;

        if (!mounted) return;

        setUser(currentUser);
        if (!currentUser) {
          setLoading(false);
          return;
        }

        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('theme_mode, is_premium')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (profErr) {
          console.warn('Erro carregando profile.theme_mode', profErr);
        }

        setThemeMode(profile?.theme_mode ?? 'normal');
        setIsPremium(!!profile?.is_premium);

        const { data: moods, error: moodsErr } = await supabase
          .from('mood_entries')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: true });

        if (moodsErr) {
          console.error('Erro carregando mood_entries', moodsErr);
          setEntries([]);
        } else {
          setEntries(moods ?? []);
        }
      } catch (err) {
        console.error('Erro carregando dados do mood:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  /* ---------- helpers de notificações (localStorage) ---------- */
  function getLastNotifTimes(): Record<string, string> {
    try {
      const raw =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(LAST_NOTIF_KEY)
          : null;
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function setLastNotifTime(key: string) {
    try {
      if (typeof window === 'undefined') return;
      const map = getLastNotifTimes();
      map[key] = new Date().toISOString();
      window.localStorage.setItem(LAST_NOTIF_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  }

  function hoursSince(iso?: string) {
    if (!iso) return Infinity;
    return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
  }

  async function handleMaybeNotifyAfterSave() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    let perm: NotificationPermission = Notification.permission;
    if (perm === 'default') {
      try {
        perm = await Notification.requestPermission();
        setNotifPermission(perm as 'default' | 'granted' | 'denied');
      } catch (err) {
        console.error('Erro ao pedir permissão de notificação:', err);
      }
    }

    if (perm !== 'granted') return;

    const map = getLastNotifTimes();
    const last = map['mood_daily_reminder'];
    if (hoursSince(last) < DEFAULT_MIN_INTERVAL_HOURS) return;

    try {
      new Notification('WeedReset – lembrete emocional', {
        body: 'Volte amanhã para registrar como você está se sentindo. Seu diário está ficando cada vez mais completo.',
      });
      setLastNotifTime('mood_daily_reminder');
    } catch (err) {
      console.error('Erro ao criar notificação:', err);
    }
  }

  /* ---------- gráfico, termômetro e insights ---------- */
  useEffect(() => {
    if (!entries || entries.length === 0) {
      setChartData([]);
      setThermo(0);
      setInsights({
        message: 'Registre seu humor para gerar insights',
        risk: 0,
        trend: 0,
      });
      return;
    }

    // termômetro = média geral
    const sumAll = entries.reduce(
      (s: number, it: any) => s + (it.mood_value || 0),
      0
    );
    const avgAll = Math.round(sumAll / entries.length);
    setThermo(avgAll);

    const now = new Date();
    let startDate = new Date();
    if (selectedRange === 'week') startDate.setDate(now.getDate() - 7);
    else if (selectedRange === 'month') startDate.setMonth(now.getMonth() - 1);
    else if (selectedRange === 'year')
      startDate.setFullYear(now.getFullYear() - 1);
    else startDate = new Date('1970-01-01');

    const filtered = entries.filter((e) => new Date(e.date) >= startDate);

    if (!filtered.length) {
      setChartData([]);
      setInsights({
        message:
          'Continue registrando seu humor para ver a evolução neste período.',
        risk: avgAll < 30 ? 80 : avgAll < 50 ? 40 : 10,
        trend: avgAll,
      });
      return;
    }

    // visão diária: vários registros do dia atual
    if (selectedRange === 'day') {
      const todayKey = localDateKey();
      const dayEvents = filtered.filter(
        (e) => normalizeEntryDate(e.date) === todayKey
      );
      const data = dayEvents.map((e: any, i: number) => ({
        label: e.time || `#${i + 1}`,
        value: e.mood_value,
      }));
      setChartData(data);

      const avgDay = dayEvents.length
        ? Math.round(
            dayEvents.reduce(
              (s: number, it: any) => s + (it.mood_value || 0),
              0
            ) / dayEvents.length
          )
        : avgAll;

      const risk = avgDay < 30 ? 80 : avgDay < 50 ? 40 : 10;
      const trendMsg =
        avgDay > 70
          ? 'Você está indo muito bem hoje! Continue assim!'
          : avgDay > 40
          ? 'Oscilações são normais. Continue registrando!'
          : 'Hoje o dia está mais pesado — se cuide e procure apoio se necessário.';

      setInsights({ message: trendMsg, risk, trend: avgDay });
      return;
    }

    // agregação por dia para semana/mês/ano
    const days: Record<
      string,
      { total: number; count: number; events: any[] }
    > = {};
    filtered.forEach((e: any) => {
      const key = normalizeEntryDate(e.date);
      if (!days[key]) days[key] = { total: 0, count: 0, events: [] };
      days[key].total += e.mood_value || 0;
      days[key].count += 1;
      days[key].events.push(e);
    });

    const data = Object.keys(days)
      .sort()
      .map((k) => ({
        label: `${k.slice(8, 10)}/${k.slice(5, 7)}`,
        value: Math.round(days[k].total / days[k].count),
      }));
    setChartData(data);

    const avgRange = Math.round(
      filtered.reduce(
        (s: number, it: any) => s + (it.mood_value || 0),
        0
      ) / filtered.length
    );
    const risk = avgRange < 30 ? 80 : avgRange < 50 ? 40 : 10;
    const trendMsg =
      avgRange > 70
        ? 'Sua tendência emocional nesse período está muito positiva.'
        : avgRange > 40
        ? 'Humor com algumas oscilações — acompanhar ajuda a entender padrões.'
        : 'Nesse período o humor está mais delicado. Vale olhar com carinho para você.';

    setInsights({ message: trendMsg, risk, trend: avgRange });
  }, [entries, selectedRange]);

  /* ---------- SALVAR HUMOR ---------- */
  async function handleSave() {
    setSaveError(null);
    setSaveDebug(null);

    if (!selectedMood) return;

    setSaving(true);
    const tzDate = localDateKey();

    try {
      const { data: udata, error: uerr } = await supabase.auth.getUser();
      const freshUser = udata.user ?? null;

      if (uerr) console.error('auth.getUser error:', toPlainError(uerr));

      if (!freshUser) {
        setSaveError('Sua sessão expirou. Faça login novamente para salvar.');
        setSaving(false);
        return;
      }

      // pega a última entrada do dia, se existir
      const { data: existingList, error: checkErr } = await supabase
        .from('mood_entries')
        .select('*')
        .eq('user_id', freshUser.id)
        .eq('date', tzDate)
        .order('created_at', { ascending: false })
        .limit(1);

      if (checkErr) {
        console.error('Erro verificando entrada existente', toPlainError(checkErr));
      }

      const existing =
        Array.isArray(existingList) && existingList.length ? existingList[0] : null;

      const categoryForMood = getCategoryForMoodKey(selectedMood.key);

      // tenta mensagem diária
      let dailyMessage: string | null = null;
      try {
        const { data: rpcUserMsg, error: rpcErr } = await supabase.rpc(
          'get_random_mood_message_for_user',
          {
            p_user: freshUser.id,
            category_input: categoryForMood,
            avoid_days: 7,
          }
        );

        if (
          !rpcErr &&
          rpcUserMsg &&
          Array.isArray(rpcUserMsg) &&
          rpcUserMsg.length
        ) {
          dailyMessage = (rpcUserMsg[0] as any).message ?? null;
        } else {
          const { data: rpcSimple, error: rpcSimpleErr } = await supabase.rpc(
            'get_random_mood_message',
            {
              category_input: categoryForMood,
            }
          );
          if (
            !rpcSimpleErr &&
            rpcSimple &&
            Array.isArray(rpcSimple) &&
            rpcSimple.length
          ) {
            dailyMessage = (rpcSimple[0] as any).message ?? null;
          }
        }

        if (rpcErr) console.warn('RPC user msg error:', toPlainError(rpcErr));
      } catch (err) {
        console.error('Erro ao obter mensagem aleatória', err);
      }

      // se já existe hoje: atualiza e ANEXA texto
      if (existing) {
        const existingNotes = (existing.notes ?? existing.note ?? '') as string;
        const mergedNotes = [existingNotes || '', notes || '']
          .filter(Boolean)
          .join('\n\n');

        const payload: any = {
          notes: mergedNotes, // padrão
          mood: selectedMood.label,
          mood_value: selectedMood.value,
          time: new Date().toTimeString().slice(0, 5),
          updated_at: new Date().toISOString(),
        };
        if (!existing.daily_message && dailyMessage) {
          payload.daily_message = dailyMessage;
        }

        const res = await supabase
          .from('mood_entries')
          .update(payload)
          .eq('id', existing.id)
          .select('*')
          .maybeSingle();

        if (res.error) {
          const plain = toPlainError(res.error);
          console.error('Erro atualizando entrada do dia:', plain);
          setSaveError('Não foi possível atualizar seu registro de hoje.');
          setSaveDebug({
            phase: 'update',
            status: (res as any).status,
            statusText: (res as any).statusText,
            error: plain,
          });
        } else if (res.data) {
          setEntries((prev) =>
            prev.map((e) => (e.id === res.data.id ? res.data : e))
          );
          setNotes('');
          setSelectedMood(null);
          await handleMaybeNotifyAfterSave();
        }

        setSaving(false);
        return;
      }

      // não existe hoje: cria registro
      const now = new Date();
      const payloadInsert: any = {
        user_id: freshUser.id,
        mood: selectedMood.label,
        mood_value: selectedMood.value,
        notes, // padrão (você já migrou)
        date: tzDate,
        time: now.toTimeString().slice(0, 5),
        daily_message: dailyMessage,
      };

      const res = await supabase
        .from('mood_entries')
        .insert(payloadInsert)
        .select('*')
        .maybeSingle();

      if (res.error) {
        const plain = toPlainError(res.error);
        console.error('Erro insert mood (plain):', plain);
        console.error('Erro insert mood (status):', {
          status: (res as any).status,
          statusText: (res as any).statusText,
        });

        const st = (res as any).status;
        if (st === 401) setSaveError('Falha de sessão (401). Faça logout/login e tente novamente.');
        else if (st === 403) setSaveError('Bloqueado por segurança (403). Normalmente é RLS/policy.');
        else if (st === 400) setSaveError('Dados inválidos (400). Pode ser coluna/tipo/NOT NULL.');
        else setSaveError('Não foi possível salvar seu humor. Tente novamente.');

        setSaveDebug({
          phase: 'insert',
          status: st,
          statusText: (res as any).statusText,
          error: plain,
        });
      } else if (res.data) {
        setEntries((prev) => [...prev, res.data]);
        setNotes('');
        setSelectedMood(null);
        setSaveError(null);
        setSaveDebug(null);
      }

      await handleMaybeNotifyAfterSave();
    } catch (err) {
      console.error(err);
      setSaveError('Ocorreu um erro inesperado ao salvar. Tente novamente.');
      setSaveDebug({ phase: 'catch', error: toPlainError(err) });
    } finally {
      setSaving(false);
    }
  }

  /* ---------- estados de carregamento ---------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white">
        <div className="animate-spin w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  /* ---------- montar lista "Diário da Semana" ---------- */
  const groupedLatestPerDay: any[] = [];
  const seen: Record<string, boolean> = {};
  [...entries]
    .sort(
      (a, b) =>
        new Date(b.date + 'T' + (b.time || '00:00')).getTime() -
        new Date(a.date + 'T' + (a.time || '00:00')).getTime()
    )
    .forEach((e) => {
      const key = e.date;
      if (!seen[key]) {
        groupedLatestPerDay.push(e);
        seen[key] = true;
      }
    });

  const recentEntries = groupedLatestPerDay.slice(0, 7);
  const lastEntry = recentEntries[0] || null;
  const noteCharCount = notes.trim().length;
  const selectedMoodMessage = selectedMood
    ? `Selecionado: ${selectedMood.emoji} ${selectedMood.label} (${selectedMood.value}%)`
    : 'Escolha um humor antes de salvar.';

  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg hover:bg-white/10">
            <ArrowLeft className="w-6 h-6 text-white/80" />
          </Link>
          <SmilePlus className="w-8 h-8 text-purple-300" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-200 to-pink-200 bg-clip-text text-transparent drop-shadow">
            Diário Emoções
          </h1>
          <div className="ml-auto flex items-center gap-2">
            {isPremium ? (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-amber-300/40 px-3 py-1 text-[11px] text-amber-200 bg-amber-500/10">
                <Crown className="w-3 h-3" />
                Premium ativo
              </span>
            ) : null}
            <Link
              href="/mood/history"
              className="text-sm text-white/70 hover:text-white hover:underline"
            >
              Diário completo
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-7 space-y-10">
        {/* Banner Premium topo */}
        {user && (
          <section className="bg-gradient-to-r from-purple-700 via-purple-600 to-pink-600 text-white p-4 rounded-2xl shadow-md flex flex-col md:flex-row items-start md:items-center gap-3">
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Crown className="w-5 h-5" />
              <span className="font-semibold text-sm">
                {isPremium
                  ? 'Você está usando a versão Premium do Diário de Emoções.'
                  : 'Histórico detalhado, gráficos avançados e lembretes inteligentes brilham ainda mais no plano Premium.'}
              </span>
            </div>
            <div className="flex-1" />
            {!isPremium && (
              <Link
                href="/premium"
                className="inline-flex items-center gap-1 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-semibold"
              >
                <Crown className="w-3 h-3" />
                Ver planos
              </Link>
            )}
            {notifPermission === 'granted' && (
              <span className="flex items-center gap-1 text-[11px] opacity-90">
                <Bell className="w-3 h-3" />
                Lembretes ativados
              </span>
            )}
          </section>
        )}

        {/* Resumo rápido */}
        {user && (
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-white shadow-xl">
              <div className="flex items-center gap-2 text-white/60 text-xs">
                <CalendarDays className="w-4 h-4 text-purple-200" />
                Registros salvos
              </div>
              <p className="mt-2 text-2xl font-bold">{entries.length}</p>
              <p className="text-[11px] text-white/50">Quanto mais registros, melhor o app entende seus padrões.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-white shadow-xl">
              <div className="flex items-center gap-2 text-white/60 text-xs">
                <HeartPulse className="w-4 h-4 text-pink-200" />
                Média emocional
              </div>
              <p className="mt-2 text-2xl font-bold">{Number.isNaN(thermo) ? 0 : thermo}%</p>
              <p className="text-[11px] text-white/50">Termômetro geral dos seus registros.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-white shadow-xl">
              <div className="flex items-center gap-2 text-white/60 text-xs">
                <TrendingUp className="w-4 h-4 text-emerald-200" />
                Último registro
              </div>
              <p className="mt-2 text-lg font-bold">
                {lastEntry ? `${formatDateShort(lastEntry.date)} · ${lastEntry.mood}` : 'Ainda vazio'}
              </p>
              <p className="text-[11px] text-white/50">Use essa tela como check-in emocional diário.</p>
            </div>
          </section>
        )}

        {/* Termômetro + seleção de humor */}
        <section className="bg-black/30 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-2xl space-y-4 text-white">
          <h2 className="text-lg font-bold text-white">
            Como você está se sentindo agora?
          </h2>
          <p className="text-sm text-white/70">
            Registre sem julgamento. Esse diário ajuda você a enxergar padrões, gatilhos e evolução emocional ao longo da sua recuperação.
          </p>

          <div className="w-full h-10 rounded-full bg-white/10 overflow-hidden mt-3">
            <div
              className="h-full bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 transition-all duration-700"
              style={{ width: `${Number.isNaN(thermo) ? 0 : thermo}%` }}
            />
          </div>
          <p className="text-center text-sm mt-2 text-white/80">
            Seu humor médio até agora:{' '}
            <strong>{Number.isNaN(thermo) ? 0 : thermo}%</strong>
          </p>

          {/* Emojis */}
          <div className="mt-3">
            <div className="flex gap-3 overflow-x-auto py-2 no-scrollbar items-center">
              {MOODS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setSelectedMood(m)}
                  className={`flex flex-col items-center justify-center rounded-2xl p-2 min-w-[64px] text-2xl text-center shadow transition ${
                    selectedMood?.key === m.key
                      ? 'bg-purple-600 text-white scale-105'
                      : 'bg-white/10 text-white/90 hover:bg-white/15'
                  }`}
                >
                  <div className="text-2xl leading-none">{m.emoji}</div>
                  <div className="text-[11px] mt-1">{m.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75">
            {selectedMoodMessage}
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Escreva um resumo do seu dia — isso será anexado ao seu registro de hoje."
            className="mood-notes-textarea w-full p-4 rounded-xl text-sm bg-black/30 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/40 min-h-[120px] resize-y leading-relaxed"
            style={{
              color: '#ffffff',
              WebkitTextFillColor: '#ffffff',
              caretColor: '#ffffff',
            }}
            rows={4}
          />

          {saveError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-400/20 text-sm text-red-200 whitespace-pre-wrap">
              {saveError}
              {saveDebug?.status ? `\n(status: ${saveDebug.status})` : ''}
            </div>
          )}

          {saveDebug?.error?.message && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[12px] text-white/70 whitespace-pre-wrap">
              <div className="font-semibold text-white/80 mb-1">Debug:</div>
              {JSON.stringify(saveDebug, null, 2)}
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-white/45">
            <span>{noteCharCount} caracteres</span>
            <span>Salvar novamente no mesmo dia anexa a nova nota.</span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={!selectedMood || saving}
              className="flex-1 py-3 rounded-xl text-white bg-gradient-to-r from-purple-600 to-pink-600 font-semibold shadow-lg disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar meu humor'}
            </button>
            <button
              onClick={() => {
                setNotes('');
                setSelectedMood(null);
                setSaveError(null);
                setSaveDebug(null);
              }}
              className="px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white/80 hover:bg-white/15"
            >
              <RefreshCcw className="inline-block w-4 h-4 mr-1" />
              Limpar
            </button>
          </div>
        </section>

        {/* Diário da Semana */}
        <section className="bg-black/25 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl text-white">
          <h3 className="text-lg font-bold text-white">Diário da Semana</h3>

          {recentEntries.length === 0 && (
            <p className="text-sm text-white/70">Nenhum registro ainda.</p>
          )}

          <div className="space-y-4 mt-4">
            {recentEntries.map((entry: any) => {
              const fullNotes = (entry.notes ?? entry.note ?? '') as string;

              const parts = fullNotes
                .split(/\n{2,}/)
                .map((s: string) => s.trim())
                .filter(Boolean);
              const lastNote = parts.length ? parts[parts.length - 1] : null;

              return (
                <div
                  key={entry.id}
                  className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {moodValueToEmoji(entry.mood_value)}
                      </div>
                      <span className="text-sm font-semibold text-white">
                        {formatDateShort(entry.date)} — {entry.mood}
                      </span>
                    </div>
                    <span className="text-xs text-white/50">
                      {entry.time ?? ''}
                    </span>
                  </div>

                  {lastNote && (
                    <p className="text-sm text-white/80 whitespace-pre-wrap">
                      {lastNote}
                    </p>
                  )}

                  {entry.daily_message && (
                    <div className="mt-2 p-2 bg-purple-500/10 border border-purple-400/20 rounded text-sm text-purple-200">
                      {entry.daily_message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Link
            href="/mood/history"
            className="block text-center mt-4 text-purple-200 font-medium hover:text-white hover:underline text-sm"
          >
            Abrir meu diário completo →
          </Link>
        </section>

        {/* Evolução do Humor */}
        <section className="bg-black/25 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl space-y-4 text-white">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Evolução do Humor</h3>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <button
                onClick={() => setSelectedRange('day')}
                className={`px-3 py-1 rounded-full ${
                  selectedRange === 'day'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/10 text-white/80 hover:bg-white/15'
                }`}
              >
                Diário
              </button>
              <button
                onClick={() => setSelectedRange('week')}
                className={`px-3 py-1 rounded-full ${
                  selectedRange === 'week'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/10 text-white/80 hover:bg-white/15'
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => setSelectedRange('month')}
                className={`px-3 py-1 rounded-full ${
                  selectedRange === 'month'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/10 text-white/80 hover:bg-white/15'
                }`}
              >
                Mês
              </button>
              <button
                onClick={() => setSelectedRange('year')}
                className={`px-3 py-1 rounded-full ${
                  selectedRange === 'year'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/10 text-white/80 hover:bg-white/15'
                }`}
              >
                Ano
              </button>
            </div>
          </div>

          <div className="w-full h-56">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="label" stroke="rgba(255,255,255,0.6)" />
                  <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.6)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0,0,0,0.75)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      borderRadius: 12,
                      color: 'rgba(255,255,255,0.9)',
                    }}
                    labelStyle={{ color: 'rgba(255,255,255,0.75)' }}
                    itemStyle={{ color: 'rgba(255,255,255,0.9)' }}
                  />
                  <Line
                    dataKey="value"
                    type="monotone"
                    stroke="#d946ef"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#9333ea' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full rounded-2xl border border-dashed border-white/10 bg-white/5 flex items-center justify-center text-center px-6">
                <p className="text-sm text-white/60">
                  Salve alguns registros para visualizar sua evolução emocional neste período.
                </p>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-white">Insights</h4>
              <p className="text-sm text-white/80">{insights.message}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">
                Risco &amp; Tendência
              </h4>
              <div className="flex items-center gap-4 mt-2">
                <div className="text-sm">
                  Tendência:{' '}
                  <strong>
                    {Number.isNaN(insights.trend) ? 0 : insights.trend}%
                  </strong>
                </div>
                <div className="text-sm">
                  Risco emocional:{' '}
                  <strong>
                    {Number.isNaN(insights.risk) ? 0 : insights.risk}%
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Nota explicativa */}
        <section className="bg-white/5 border border-white/10 p-4 rounded-xl text-sm text-white/70 mb-4">
          <strong>Nota:</strong> Ao salvar novamente no mesmo dia você anexará
          notas ao registro do dia (o humor do dia será atualizado com sua
          seleção mais recente). A visualização &quot;Diário da Semana&quot;
          mostra apenas o registro principal por dia para manter a página
          limpa.
        </section>

        {/* Botão extra embaixo */}
        <div className="flex justify-center pb-10">
          <Link
            href="/mood/history"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-sm font-semibold text-white shadow-md hover:shadow-lg"
          >
            <SmilePlus className="w-4 h-4" />
            Abrir meu diário
          </Link>
        </div>
      </main>
    </div>
  );
}
