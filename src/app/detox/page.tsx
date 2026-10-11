'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Crown,
  Dumbbell,
  Droplet,
  Flame,
  History,
  Lock,
  Moon,
  Pencil,
  Save,
  Search,
  Sparkles,
  X,
  Timer,
  Utensils,
  Info,
  ShieldCheck,
} from 'lucide-react';

import { storage } from '@/lib/storage';
import { getSupabaseClient } from '@/lib/supabase';
import type { UserData } from '@/lib/types';

type DetoxEntry = {
  date: string; // YYYY-MM-DD (local)
  dayNumber: number; // 0..30
  water: boolean;
  movement: boolean;
  sleep: boolean;
  urge: number; // 0..10
  note: string;
  updatedAt: string; // ISO

  // local-only (não vai pro supabase, pra não quebrar schema)
  food?: boolean;
};

type ModalState =
  | { open: false }
  | { open: true; date: string; draft: DetoxEntry; source: 'history' | 'calendar' };

const KEY_PREFIX = 'weedreset_detox_daily_v1';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toISODateLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseISODateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map((x) => Number(x));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function todayISO(): string {
  return toISODateLocal(new Date());
}

function diffDays(fromISO: string, toISO: string): number {
  const a = parseISODateLocal(fromISO).getTime();
  const b = parseISODateLocal(toISO).getTime();
  return Math.floor((b - a) / 86400000);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatPtBr(iso: string) {
  const [y, m, d] = iso.split('-').map((x) => Number(x));
  if (!y || !m || !d) return iso;
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

function uniqByDate(entries: DetoxEntry[]): DetoxEntry[] {
  const map = new Map<string, DetoxEntry>();
  for (const e of entries) map.set(e.date, e);
  return Array.from(map.values());
}

function sortDesc(entries: DetoxEntry[]): DetoxEntry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function makeEmptyEntry(date: string, dayNumber: number): DetoxEntry {
  return {
    date,
    dayNumber,
    water: false,
    movement: false,
    sleep: false,
    urge: 5,
    note: '',
    updatedAt: new Date().toISOString(),
    food: false,
  };
}

async function safeFetchPremium(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', userId)
      .maybeSingle();

    if (error) return false;
    return !!data?.is_premium;
  } catch {
    return false;
  }
}

function looksLikeTableOrRlsError(err: any): boolean {
  const msg = String(err?.message || err?.error_description || err || '');
  return (
    msg.includes('42P01') ||
    msg.toLowerCase().includes('relation') ||
    msg.toLowerCase().includes('does not exist') ||
    msg.toLowerCase().includes('permission') ||
    msg.toLowerCase().includes('insufficient_privilege') ||
    msg.toLowerCase().includes('rls')
  );
}

function humanUrgeLabel(n: number) {
  if (n <= 2) return 'Tranquilo';
  if (n <= 4) return 'Leve';
  if (n <= 6) return 'Médio';
  if (n <= 8) return 'Forte';
  return 'Muito forte';
}

function toRemotePayload(userId: string, entry: DetoxEntry) {
  return {
    user_id: userId,
    day_date: entry.date,
    day_number: entry.dayNumber,
    water: entry.water,
    movement: entry.movement,
    sleep: entry.sleep,
    urge: entry.urge,
    note: entry.note,
    updated_at: new Date().toISOString(),
  };
}

export default function DetoxPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [mounted, setMounted] = useState(false);

  const [userData, setUserData] = useState<UserData | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  const [remoteOk, setRemoteOk] = useState<boolean>(false); // se conseguimos ler/salvar no supabase
  const [entries, setEntries] = useState<DetoxEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [calendarSelected, setCalendarSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [showTools, setShowTools] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef<{ [date: string]: number }>({});
  const syncDoneRef = useRef(false);

  // Protocolo 10 min
  const [showProtocol, setShowProtocol] = useState(false);
  const [protocolRunning, setProtocolRunning] = useState(false);
  const [protocolSecondsLeft, setProtocolSecondsLeft] = useState(600);

  useEffect(() => {
    if (!protocolRunning) return;
    if (protocolSecondsLeft <= 0) {
      setProtocolRunning(false);
      return;
    }
    const t = window.setTimeout(() => setProtocolSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [protocolRunning, protocolSecondsLeft]);

  function resetProtocol() {
    setProtocolRunning(false);
    setProtocolSecondsLeft(600);
  }

  function formatMMSS(total: number) {
    const mm = Math.floor(total / 60);
    const ss = total % 60;
    return `${pad2(mm)}:${pad2(ss)}`;
  }

  // ---------- bootstrap (storage + onboarding) ----------
  useEffect(() => {
    setMounted(true);
    const data = storage.getUserData();

    if (!data || !data.onboardingCompleted) {
      router.push('/onboarding');
      return;
    }

    setUserData(data);
  }, [router]);

  // ---------- auth + premium ----------
  useEffect(() => {
    let cancelled = false;

    async function loadAuth() {
      try {
        const { data } = await supabase.auth.getUser();
        const u = data?.user ?? null;

        if (cancelled) return;

        setUserId(u?.id ?? null);

        if (u?.id) {
          const premium = await safeFetchPremium(supabase, u.id);
          if (!cancelled) setIsPremium(premium);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    }

    loadAuth();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // ---------- resolve detox start ----------
  const isoToday = useMemo(() => todayISO(), []);
  const detoxStartISO = useMemo(() => {
    if (!userData) return isoToday;

    const raw =
      (userData.detoxCycleStartDate ? String(userData.detoxCycleStartDate).slice(0, 10) : '') ||
      (userData.lastRelapseDate ? String(userData.lastRelapseDate).slice(0, 10) : '') ||
      (userData.startDate ? String(userData.startDate).slice(0, 10) : '') ||
      isoToday;

    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : isoToday;
  }, [userData, isoToday]);

  const cleanDays = useMemo(() => {
    const days = diffDays(detoxStartISO, isoToday);
    return Math.max(0, days);
  }, [detoxStartISO, isoToday]);

  const cycleDay = useMemo(() => clamp(cleanDays, 0, 30), [cleanDays]);
  const cyclePercent = useMemo(() => Math.round((cycleDay / 30) * 100), [cycleDay]);

  // ---------- persistence helpers ----------
  function persistLocal(nextEntries: DetoxEntry[]) {
    try {
      const key = `${KEY_PREFIX}:${userId || 'guest'}`;
      window.localStorage.setItem(key, JSON.stringify(uniqByDate(nextEntries)));
    } catch {
      // ignore
    }
  }

  async function tryRemoteUpsertOne(entry: DetoxEntry): Promise<boolean> {
    if (!userId) return false;

    try {
      const payload = toRemotePayload(userId, entry);

      const { error } = await supabase
        .from('detox_daily')
        .upsert(payload as any, { onConflict: 'user_id,day_date' });

      if (!error) {
        setRemoteOk(true);
        return true;
      }

      // fallback: tenta update por (user_id, day_date), senão insert
      const { data: existing, error: selErr } = await supabase
        .from('detox_daily')
        .select('id')
        .eq('user_id', userId)
        .eq('day_date', entry.date)
        .maybeSingle();

      if (!selErr && existing?.id) {
        const { error: upErr } = await supabase.from('detox_daily').update(payload as any).eq('id', existing.id);
        if (!upErr) {
          setRemoteOk(true);
          return true;
        }
      } else {
        const { error: insErr } = await supabase.from('detox_daily').insert(payload as any);
        if (!insErr) {
          setRemoteOk(true);
          return true;
        }
      }

      return false;
    } catch (err: any) {
      if (!looksLikeTableOrRlsError(err)) {
        // eslint-disable-next-line no-console
        console.error('Detox remote persist error:', err);
      }
      return false;
    }
  }

  async function tryRemoteUpsertMany(list: DetoxEntry[]): Promise<boolean> {
    if (!userId) return false;
    if (list.length === 0) return true;

    try {
      const payloads = list.map((e) => toRemotePayload(userId, e));
      const { error } = await supabase
        .from('detox_daily')
        .upsert(payloads as any, { onConflict: 'user_id,day_date' });

      if (!error) {
        setRemoteOk(true);
        return true;
      }
      return false;
    } catch (err: any) {
      if (!looksLikeTableOrRlsError(err)) {
        // eslint-disable-next-line no-console
        console.error('Detox remote bulk upsert error:', err);
      }
      return false;
    }
  }

  function scheduleRemoteSave(entry: DetoxEntry) {
    if (!userId) return;

    const stamp = Date.now();
    savingRef.current[entry.date] = stamp;

    window.setTimeout(async () => {
      if (savingRef.current[entry.date] !== stamp) return;
      setSaving(true);
      try {
        await tryRemoteUpsertOne(entry);
      } finally {
        setSaving(false);
      }
    }, 450);
  }

  function upsertEntryLocalState(next: DetoxEntry) {
    setEntries((prev) => {
      const merged = uniqByDate([next, ...prev.filter((p) => p.date !== next.date)]);
      const sorted = sortDesc(merged);
      persistLocal(sorted);
      return sorted;
    });

    // 🔥 tenta sempre salvar no Supabase quando logado
    if (userId) scheduleRemoteSave(next);
  }

  // ---------- load entries (local first, then remote if possible) ----------
  useEffect(() => {
    if (!mounted || !userData) return;

    let cancelled = false;

    async function loadAll() {
      setLoading(true);

      const key = `${KEY_PREFIX}:${userId || 'guest'}`;
      const localRaw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;

      let localEntries: DetoxEntry[] = [];
      try {
        if (localRaw) localEntries = JSON.parse(localRaw) as DetoxEntry[];
      } catch {
        localEntries = [];
      }

      let merged = uniqByDate(localEntries);

      // remote (se logado)
      let remoteEntries: DetoxEntry[] = [];
      let remoteWorks = false;

      if (userId) {
        try {
          const { data, error } = await supabase
            .from('detox_daily')
            .select('day_date, day_number, water, movement, sleep, urge, note, updated_at')
            .eq('user_id', userId)
            .order('day_date', { ascending: true });

          if (!error) {
            remoteWorks = true;
            remoteEntries =
              (data || []).map((r: any) => ({
                date: String(r.day_date),
                dayNumber: clamp(Number(r.day_number ?? 0), 0, 30),
                water: !!r.water,
                movement: !!r.movement,
                sleep: !!r.sleep,
                urge: clamp(Number(r.urge ?? 5), 0, 10),
                note: String(r.note ?? ''),
                updatedAt: String(r.updated_at ?? new Date().toISOString()),
                food: false,
              })) || [];
          }
        } catch (err: any) {
          remoteWorks = false;
          if (!looksLikeTableOrRlsError(err)) {
            // eslint-disable-next-line no-console
            console.error('Detox remote load error:', err);
          }
        }
      }

      if (remoteWorks) merged = uniqByDate([...merged, ...remoteEntries]);

      if (cancelled) return;

      setRemoteOk(remoteWorks);
      setEntries(sortDesc(merged));
      setLoading(false);

      // ✅ Sync local -> remote (1 vez) quando logado e remoto funciona
      if (userId && remoteWorks && !syncDoneRef.current) {
        syncDoneRef.current = true;

        // sobe somente entradas que existem localmente (merged) – é seguro usar upsert
        // para não perder nada, mandamos tudo.
        setSaving(true);
        try {
          await tryRemoteUpsertMany(sortDesc(merged));
        } finally {
          setSaving(false);
        }
      }
    }

    loadAll();

    return () => {
      cancelled = true;
    };
  }, [mounted, userData, userId, supabase]);

  // ---------- derived entry for today ----------
  const todayEntryDayNumber = useMemo(() => clamp(cleanDays, 0, 30), [cleanDays]);

  const currentEntry = useMemo(() => {
    const found = entries.find((e) => e.date === isoToday);
    return found || makeEmptyEntry(isoToday, todayEntryDayNumber);
  }, [entries, isoToday, todayEntryDayNumber]);

  const canEditPast = isPremium;

  const visibleHistory = useMemo(() => {
    const all = sortDesc(entries);
    const limit = isPremium ? 90 : 7;
    return all.slice(0, limit);
  }, [entries, isPremium]);

  const premiumSearchResults = useMemo(() => {
    if (!isPremium) return [];
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return sortDesc(entries).filter((e) => (e.note || '').toLowerCase().includes(q));
  }, [entries, isPremium, search]);

  const calendarDays = useMemo(() => {
    const start = parseISODateLocal(detoxStartISO);
    const out: {
      date: string;
      dayNumber: number;
      unlocked: boolean;
      hasNote: boolean;
      doneCount: number;
      entryExists: boolean;
    }[] = [];

    for (let d = 0; d <= 30; d++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + d);
      const iso = toISODateLocal(dt);
      const entry = entries.find((e) => e.date === iso);
      const doneCount = Number(!!entry?.water) + Number(!!entry?.movement) + Number(!!entry?.sleep);
      out.push({
        date: iso,
        dayNumber: d,
        unlocked: d <= cycleDay,
        hasNote: !!(entry?.note && entry.note.trim()),
        doneCount,
        entryExists: !!entry,
      });
    }
    return out;
  }, [detoxStartISO, entries, cycleDay]);

  // ---------- handlers (today) ----------
  function updateToday(patch: Partial<DetoxEntry>) {
    const next: DetoxEntry = {
      ...currentEntry,
      ...patch,
      dayNumber: currentEntry.dayNumber,
      updatedAt: new Date().toISOString(),
    };
    upsertEntryLocalState(next);
  }

  // ---------- modal editing (premium) ----------
  function openEdit(date: string, source: 'history' | 'calendar') {
    const existing = entries.find((e) => e.date === date);
    const d = clamp(diffDays(detoxStartISO, date), 0, 30);
    const base = existing || makeEmptyEntry(date, d);
    setModal({ open: true, date, source, draft: { ...base } });
  }

  function closeModal() {
    setModal({ open: false });
  }

  function saveModal() {
    if (!modal.open) return;
    const next: DetoxEntry = {
      ...modal.draft,
      date: modal.date,
      updatedAt: new Date().toISOString(),
    };
    upsertEntryLocalState(next);
    closeModal();
  }

  // ---------- render guards ----------
  if (!mounted || !userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  const isFocusMode = userData.themeMode === 'focus';

  const headline = cycleDay >= 30 ? 'Ciclo de 30 dias concluído' : `Dia ${cycleDay} de 30`;

  const helperLine =
    cycleDay >= 30
      ? 'Você completou o ciclo. Agora é consistência. Um dia de cada vez.'
      : 'Check-in rápido + rotina simples. Isso reduz recaídas porque corta o “piloto automático”.';

  const doneCountToday =
    Number(!!currentEntry.water) + Number(!!currentEntry.movement) + Number(!!currentEntry.sleep);

  const quickStatus =
    doneCountToday === 3
      ? 'Check-in completo ✅'
      : doneCountToday === 2
      ? 'Quase lá (faltou 1) 👌'
      : doneCountToday === 1
      ? 'Bom começo 💪'
      : 'Vamos começar?';

  const timeline = [
    { title: 'Dias 1–2', text: 'Começo da abstinência: irritação/ansiedade e sono começando a bagunçar.' },
    { title: 'Dias 2–6', text: 'Pico comum: fissura mais forte + sono ruim/sonhos vivos. Rotina ajuda muito.' },
    { title: 'Dias 7–14', text: 'Tende a aliviar: humor mais estável, sono começando a destravar (se você protege ele).' },
  ];

  const urgeLabel = humanUrgeLabel(currentEntry.urge);

  return (
    <div
      className={`min-h-screen ${
        isFocusMode
          ? 'bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950'
          : 'bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900'
      }`}
    >
      {/* Header */}
      <header className="bg-black/40 backdrop-blur-xl shadow-lg sticky top-0 z-40 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-6 h-6 text-white/80" />
            </Link>
            <Droplet className="w-8 h-8 text-cyan-500" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Detox 0–30
              </h1>
              <p className="text-xs sm:text-sm text-white/70">
                Check-in diário: água, movimento, sono e fissura (com protocolo anti-fissura).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowTools((v) => !v)}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white/90 text-xs sm:text-sm border border-white/10"
              aria-expanded={showTools}
              aria-controls="detox-tools"
              title="Ferramentas extras (opcional)"
            >
              <Sparkles className="w-4 h-4" />
              Ferramentas
            </button>

            {isPremium ? (
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-white text-xs sm:text-sm font-semibold">
                <Crown className="w-4 h-4" />
                <span className="hidden sm:inline">Premium</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-white/10 rounded-full text-white/80 text-xs sm:text-sm border border-white/10">
                <Lock className="w-4 h-4" />
                <span className="hidden sm:inline">Premium desbloqueia extras</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Hero / Progress */}
        <section className="rounded-3xl p-6 sm:p-8 shadow-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white,transparent_35%),radial-gradient(circle_at_80%_30%,white,transparent_40%),radial-gradient(circle_at_50%_80%,white,transparent_30%)]" />

          <div className="relative">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <p className="text-white/90 text-xs sm:text-sm uppercase tracking-wide">{headline}</p>
                <h2 className="text-2xl sm:text-3xl font-extrabold mt-1">
                  {cycleDay >= 30 ? 'Você chegou até aqui. Isso é gigante.' : 'Detox prático: rotina simples, todo dia.'}
                </h2>
                <p className="mt-2 text-sm sm:text-base text-white/90 max-w-2xl">{helperLine}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-2xl bg-white/15 border border-white/20">
                  <div className="text-xs text-white/80 mb-1">Hoje</div>
                  <div className="text-lg font-bold">{formatPtBr(isoToday)}</div>
                </div>
                <div className="px-4 py-2 rounded-2xl bg-white/15 border border-white/20">
                  <div className="text-xs text-white/80 mb-1">Status</div>
                  <div className="text-lg font-bold">{quickStatus}</div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-white/80 mb-2">
                <span>Progresso do ciclo</span>
                <span>{cyclePercent}%</span>
              </div>
              <div className="w-full bg-white/15 rounded-full h-3 overflow-hidden border border-white/15">
                <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${cyclePercent}%` }} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/85">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15 border border-white/15">
                  <Calendar className="w-3.5 h-3.5" />
                  Início: {formatPtBr(detoxStartISO)}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15 border border-white/15">
                  <History className="w-3.5 h-3.5" />
                  Dia: {cycleDay}
                </span>
                {saving && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15 border border-white/15">
                    <Save className="w-3.5 h-3.5" />
                    Salvando…
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Aviso de sync (importante) */}
        {authChecked && userId && !remoteOk && (
          <section className="rounded-3xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/70 dark:border-amber-800/40 p-5">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-700 dark:text-amber-300 mt-0.5" />
              <div>
                <div className="font-extrabold text-amber-900 dark:text-amber-100 text-sm">
                  Atenção: ainda não consegui sincronizar no Supabase
                </div>
                <div className="text-xs text-amber-900/80 dark:text-amber-100/80 mt-1">
                  Enquanto a tabela/policies não estiverem OK, o Detox pode ficar apenas neste dispositivo.
                  Rode o SQL que eu te mandei para garantir acesso em qualquer aparelho.
                </div>
              </div>
            </div>
          </section>
        )}

        {/* O que é detox + timeline */}
        <section className="rounded-3xl bg-white/80 dark:bg-gray-800/80 shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 sm:p-7 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Info className="w-5 h-5 text-cyan-600" />
              Antes de tudo: o que é “detox” aqui?
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              Quando você para, é comum ter ansiedade/irritação, sono bagunçado (insônia/sonhos vivos),
              apetite alterado e humor mais baixo. Geralmente começa em 24–48h, costuma piorar entre os dias 2–6
              e melhora ao longo de 2–3 semanas.
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              Esse Detox é <strong>prático</strong>: água, comida simples, sono e movimento. Nada de “produto milagroso”.
            </p>
          </div>

          <div className="p-6 sm:p-7">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {timeline.map((t) => (
                <div key={t.title} className="rounded-2xl p-4 bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700">
                  <div className="font-extrabold text-gray-900 dark:text-gray-100">{t.title}</div>
                  <div className="text-xs text-gray-700 dark:text-gray-300 mt-2">{t.text}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200/70 dark:border-amber-800/40">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <div className="font-extrabold text-amber-900 dark:text-amber-100 text-sm">O que NÃO fazer</div>
                  <div className="text-xs text-amber-900/80 dark:text-amber-100/80 mt-1">
                    Evite laxantes/diuréticos/suplementos “detox”. Eles não “limpam” e podem desidratar, piorar ansiedade e sono.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ferramentas extras */}
        <section
          id="detox-tools"
          className="rounded-3xl bg-white/80 dark:bg-gray-800/80 shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setShowTools((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100">Ferramentas extras (opcional)</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Use só se quiser — o foco desta página é o check-in e o protocolo anti-fissura.
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200">
              {showTools ? 'Fechar' : 'Abrir'}
            </span>
          </button>

          {showTools && (
            <div className="px-5 pb-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Link
                  href="/sos"
                  className="group rounded-2xl p-4 bg-white dark:bg-gray-900/40 shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-900/25 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">SOS agora</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Técnica guiada rápida.</p>
                    </div>
                  </div>
                </Link>

                <Link
                  href="/cant-stop"
                  className="group rounded-2xl p-4 bg-white dark:bg-gray-900/40 shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-900/25 flex items-center justify-center">
                      <Flame className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">Não consigo parar</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Estratégias e substituições.</p>
                    </div>
                  </div>
                </Link>

                <Link
                  href="/body-evolution"
                  className="group rounded-2xl p-4 bg-white dark:bg-gray-900/40 shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-cyan-50 dark:bg-cyan-900/25 flex items-center justify-center">
                      <Droplet className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">Evolução do corpo</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Benefícios por etapa.</p>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Check-in de hoje */}
        <section className="rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 sm:p-7 border-b border-gray-100 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">Check-in de hoje</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  O “detox real” é repetição: água + comida simples + sono + movimento.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!authChecked ? (
                  <span className="text-xs text-gray-500 dark:text-gray-400">Verificando conta…</span>
                ) : !userId ? (
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center px-3 py-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold text-xs sm:text-sm"
                  >
                    Entrar para sincronizar
                  </Link>
                ) : remoteOk ? (
                  <span className="text-xs text-gray-500 dark:text-gray-400">Sincronizado no seu perfil</span>
                ) : (
                  <span className="text-xs text-gray-500 dark:text-gray-400">Tentando sincronizar…</span>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-7 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main */}
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => updateToday({ water: !currentEntry.water })}
                  className={`rounded-2xl p-4 border transition-all text-left ${
                    currentEntry.water
                      ? 'bg-cyan-50 border-cyan-200 dark:bg-cyan-900/20 dark:border-cyan-700'
                      : 'bg-gray-50 border-gray-200 dark:bg-gray-900/40 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Droplet className={`w-5 h-5 ${currentEntry.water ? 'text-cyan-600' : 'text-gray-500'}`} />
                    <span className="font-bold text-gray-900 dark:text-gray-100">Água</span>
                    {currentEntry.water && <CheckCircle2 className="w-5 h-5 text-cyan-600 ml-auto" />}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    Beba ao longo do dia. Urina clara/amarelo bem claro é um bom sinal.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => updateToday({ movement: !currentEntry.movement })}
                  className={`rounded-2xl p-4 border transition-all text-left ${
                    currentEntry.movement
                      ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700'
                      : 'bg-gray-50 border-gray-200 dark:bg-gray-900/40 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Dumbbell className={`w-5 h-5 ${currentEntry.movement ? 'text-emerald-600' : 'text-gray-500'}`} />
                    <span className="font-bold text-gray-900 dark:text-gray-100">Movimento</span>
                    {currentEntry.movement && <CheckCircle2 className="w-5 h-5 text-emerald-600 ml-auto" />}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">20–40 min leve/moderado ajuda ansiedade e sono.</p>
                </button>

                <button
                  type="button"
                  onClick={() => updateToday({ sleep: !currentEntry.sleep })}
                  className={`rounded-2xl p-4 border transition-all text-left ${
                    currentEntry.sleep
                      ? 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-700'
                      : 'bg-gray-50 border-gray-200 dark:bg-gray-900/40 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Moon className={`w-5 h-5 ${currentEntry.sleep ? 'text-purple-600' : 'text-gray-500'}`} />
                    <span className="font-bold text-gray-900 dark:text-gray-100">Sono</span>
                    {currentEntry.sleep && <CheckCircle2 className="w-5 h-5 text-purple-600 ml-auto" />}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Proteja o sono hoje: 60 min sem telas pesadas.</p>
                </button>
              </div>

              {/* Fissura + protocolo */}
              <div className="rounded-2xl p-5 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900/40 dark:to-gray-800 border border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <Flame className="w-5 h-5 text-orange-500" />
                      Nível de fissura agora
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      0 = tranquilo • 10 = muito forte • status: <strong>{urgeLabel}</strong>
                    </p>
                  </div>
                  <div className="text-3xl font-extrabold text-orange-600 dark:text-orange-400">{currentEntry.urge}</div>
                </div>

                <div className="mt-4">
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={currentEntry.urge}
                    onChange={(e) => updateToday({ urge: Number(e.target.value) })}
                    className="w-full"
                  />
                  <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                    <span>0</span>
                    <span>5</span>
                    <span>10</span>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl p-4 bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Timer className="w-5 h-5 text-cyan-600" />
                        Protocolo anti-fissura (10 minutos)
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Fissura vem em ondas e passa. O objetivo é atravessar a onda sem “piloto automático”.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProtocol((v) => !v);
                        if (!showProtocol) resetProtocol();
                      }}
                      className="px-3 py-2 rounded-full text-xs font-bold border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {showProtocol ? 'Fechar' : 'Abrir'}
                    </button>
                  </div>

                  {showProtocol && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                          Tempo:{' '}
                          <span className="text-cyan-700 dark:text-cyan-300">{formatMMSS(protocolSecondsLeft)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setProtocolRunning(true)}
                            className="px-3 py-2 rounded-full text-xs font-extrabold bg-cyan-600 text-white hover:bg-cyan-700"
                          >
                            Iniciar
                          </button>
                          <button
                            type="button"
                            onClick={() => setProtocolRunning(false)}
                            className="px-3 py-2 rounded-full text-xs font-extrabold bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700"
                          >
                            Pausar
                          </button>
                          <button
                            type="button"
                            onClick={resetProtocol}
                            className="px-3 py-2 rounded-full text-xs font-extrabold bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/60"
                          >
                            Reset
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-2xl p-4 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700">
                          <div className="font-extrabold text-gray-900 dark:text-gray-100">1) Adia 10 min</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Você não está proibindo — está adiando. Isso quebra o impulso.
                          </div>
                        </div>

                        <div className="rounded-2xl p-4 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700">
                          <div className="font-extrabold text-gray-900 dark:text-gray-100">2) Respira lento</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Inspire 4s • solte 6–8s. Faça 10 ciclos.
                          </div>
                        </div>

                        <div className="rounded-2xl p-4 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700">
                          <div className="font-extrabold text-gray-900 dark:text-gray-100">3) Troca de ambiente</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Saia do cômodo, beba água, lave o rosto.</div>
                        </div>

                        <div className="rounded-2xl p-4 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700">
                          <div className="font-extrabold text-gray-900 dark:text-gray-100">4) Ação substituta</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Chiclete, banho, música, desenhar, caminhada curta, flexão.
                          </div>
                        </div>
                      </div>

                      {currentEntry.urge >= 7 && (
                        <div className="rounded-2xl p-4 bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/40">
                          <div className="flex items-start gap-2">
                            <Sparkles className="w-5 h-5 text-red-500 mt-0.5" />
                            <div>
                              <div className="font-extrabold text-red-800 dark:text-red-100">
                                Pico de fissura: fique no protocolo até o tempo zerar
                              </div>
                              <div className="text-xs text-red-800/80 dark:text-red-100/80 mt-1">
                                Quando terminar, revise: “qual foi o gatilho?” e “o que ajudou?”
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Anotação */}
              <div className="rounded-2xl p-5 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900/40 dark:to-gray-800 border border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-extrabold text-gray-900 dark:text-gray-100">Anotação do dia</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Anote o <strong>gatilho</strong> e o <strong>antídoto</strong> (o que você fez que ajudou).
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{currentEntry.note.trim().length}/700</div>
                </div>

                <textarea
                  value={currentEntry.note}
                  onChange={(e) => updateToday({ note: e.target.value.slice(0, 700) })}
                  placeholder="Ex.: Hoje senti ansiedade depois do almoço. Comi algo simples + caminhei 10 min e melhorou."
                  className="mt-3 w-full min-h-[120px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                />
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <div className="rounded-2xl p-5 bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h4 className="font-extrabold text-gray-900 dark:text-gray-100">Micro-metas de hoje (bem simples)</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Isso é “limpeza de verdade”: estabilidade do corpo e da mente.
                </p>

                <div className="mt-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center">
                      <Droplet className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-gray-900 dark:text-gray-100">Água</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Sem exagero, mas constante.</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                      <Dumbbell className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-gray-900 dark:text-gray-100">Movimento</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">20–40 min leve/moderado.</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                      <Moon className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-gray-900 dark:text-gray-100">Sono</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">60 min antes: luz baixa, sem rolar rede social.</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                      <Utensils className="w-5 h-5 text-amber-700 dark:text-amber-300" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-gray-900 dark:text-gray-100">Comida simples</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">3 refeições pequenas. Proteína + fibra + carbo “bom”.</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-[11px] text-gray-500 dark:text-gray-400">
                  Truque anti-fissura: muita gente confunde fissura com fome/queda de energia. Tenha um lanche simples pronto.
                </div>
              </div>

              {!isPremium && (
                <div className="rounded-2xl p-5 bg-gradient-to-br from-purple-600 to-pink-500 text-white shadow-xl">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5" />
                    <h4 className="font-extrabold">Premium: calendário + busca</h4>
                  </div>
                  <p className="text-xs text-white/90 mt-2">
                    No Premium você vê o calendário de 30 dias e busca no histórico de anotações.
                  </p>
                  <div className="mt-4">
                    <Link
                      href="/profile"
                      className="inline-flex items-center justify-center w-full px-4 py-2 rounded-full bg-white text-purple-700 font-extrabold text-sm hover:bg-white/95"
                    >
                      Ver Premium
                    </Link>
                  </div>
                </div>
              )}

              {isPremium && (
                <div className="rounded-2xl p-5 bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 shadow-sm">
                  <h4 className="font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Search className="w-5 h-5 text-purple-600" />
                    Buscar nas anotações
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Ex.: “ansiedade”, “sono”, “gatilho”.</p>

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Digite uma palavra…"
                    className="mt-3 w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400/60"
                  />

                  {!!search.trim() && (
                    <div className="mt-3 max-h-56 overflow-auto pr-1 space-y-2">
                      {premiumSearchResults.length === 0 ? (
                        <div className="text-xs text-gray-600 dark:text-gray-400">Nada encontrado.</div>
                      ) : (
                        premiumSearchResults.slice(0, 10).map((e) => (
                          <button
                            key={`sr-${e.date}`}
                            type="button"
                            onClick={() => openEdit(e.date, 'history')}
                            className="w-full text-left rounded-xl px-3 py-2 bg-gray-50 dark:bg-gray-900/40 hover:bg-gray-100 dark:hover:bg-gray-900/60 border border-gray-200 dark:border-gray-700"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                {formatPtBr(e.date)} • Dia {e.dayNumber}
                              </div>
                              <Pencil className="w-4 h-4 text-gray-500" />
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{e.note}</div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* History */}
        <section className="rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 sm:p-7 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <History className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                Histórico
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {isPremium ? 'Seu histórico completo de check-ins.' : 'Mostrando os últimos dias.'}
              </p>
            </div>

            {isPremium && (
              <button
                type="button"
                onClick={() => setCalendarSelected((prev) => (prev ? null : isoToday))}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-900/60"
              >
                <Calendar className="w-4 h-4" />
                Calendário
              </button>
            )}
          </div>

          <div className="p-6 sm:p-7">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin w-10 h-10 border-4 border-cyan-600 border-t-transparent rounded-full" />
              </div>
            ) : visibleHistory.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Ainda não há check-ins salvos. Preencha o check-in de hoje para começar.
              </div>
            ) : (
              <div className="space-y-3">
                {visibleHistory.map((e) => {
                  const done = Number(!!e.water) + Number(!!e.movement) + Number(!!e.sleep);
                  const isToday = e.date === isoToday;
                  const canEdit = isToday || canEditPast;

                  return (
                    <div
                      key={`h-${e.date}`}
                      className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                              {formatPtBr(e.date)}{' '}
                              <span className="text-gray-500 dark:text-gray-400 font-bold">• Dia {e.dayNumber}</span>
                            </div>
                            {isToday && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 border border-cyan-200">
                                HOJE
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-700 dark:text-gray-200">
                            <span className="px-2 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                              ✅ Checklist: {done}/3
                            </span>
                            <span className="px-2 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                              🔥 Fissura: {e.urge}/10
                            </span>
                            {e.note.trim() && (
                              <span className="px-2 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                📝 Com anotação
                              </span>
                            )}
                          </div>
                        </div>

                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => openEdit(e.date, 'history')}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-900/60"
                          >
                            <Pencil className="w-4 h-4" />
                            Editar
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-gray-500 text-xs font-bold">
                            <Lock className="w-4 h-4" />
                            Editar (Premium)
                          </span>
                        )}
                      </div>

                      {e.note.trim() && (
                        <div className="mt-3 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{e.note}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Calendar (Premium) */}
        {isPremium && (
          <section className="rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 sm:p-7 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                Calendário do ciclo (0–30)
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Clique em um dia para ver/editar o check-in.</p>
            </div>

            <div className="p-6 sm:p-7">
              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                {calendarDays.map((d) => {
                  const selected = (calendarSelected || '') === d.date;
                  return (
                    <button
                      key={`cal-${d.date}`}
                      type="button"
                      onClick={() => {
                        setCalendarSelected(d.date);
                        openEdit(d.date, 'calendar');
                      }}
                      className={`rounded-2xl p-2 border text-left transition-all ${
                        selected
                          ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                          : d.unlocked
                          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 hover:bg-gray-100 dark:hover:bg-gray-900/50'
                          : 'border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/20 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-extrabold text-gray-900 dark:text-gray-100">{d.dayNumber}</div>
                        {d.entryExists ? (
                          <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">{d.doneCount}/3</span>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </div>
                      <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">{d.hasNote ? '📝' : ''}</div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 text-xs text-gray-500 dark:text-gray-400">
                * O número é o dia do ciclo. O calendário segue a data de início do seu ciclo atual.
              </div>
            </div>
          </section>
        )}

        {/* Modal edit */}
        {modal.open && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
            <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden">
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                    Editar {formatPtBr(modal.date)}
                    <span className="text-gray-500 dark:text-gray-400 font-bold"> • Dia {modal.draft.dayNumber}</span>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Ajuste checklist, fissura e anotação.</div>
                </div>
                <button type="button" onClick={closeModal} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
                  <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setModal((prev) =>
                        !prev.open ? prev : { ...prev, draft: { ...prev.draft, water: !prev.draft.water } },
                      )
                    }
                    className={`rounded-2xl p-4 border transition-all text-left ${
                      modal.draft.water
                        ? 'bg-cyan-50 border-cyan-200 dark:bg-cyan-900/20 dark:border-cyan-700'
                        : 'bg-gray-50 border-gray-200 dark:bg-gray-900/40 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Droplet className={`w-5 h-5 ${modal.draft.water ? 'text-cyan-600' : 'text-gray-500'}`} />
                      <span className="font-bold text-gray-900 dark:text-gray-100">Água</span>
                      {modal.draft.water && <CheckCircle2 className="w-5 h-5 text-cyan-600 ml-auto" />}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setModal((prev) =>
                        !prev.open ? prev : { ...prev, draft: { ...prev.draft, movement: !prev.draft.movement } },
                      )
                    }
                    className={`rounded-2xl p-4 border transition-all text-left ${
                      modal.draft.movement
                        ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700'
                        : 'bg-gray-50 border-gray-200 dark:bg-gray-900/40 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Dumbbell className={`w-5 h-5 ${modal.draft.movement ? 'text-emerald-600' : 'text-gray-500'}`} />
                      <span className="font-bold text-gray-900 dark:text-gray-100">Movimento</span>
                      {modal.draft.movement && <CheckCircle2 className="w-5 h-5 text-emerald-600 ml-auto" />}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setModal((prev) =>
                        !prev.open ? prev : { ...prev, draft: { ...prev.draft, sleep: !prev.draft.sleep } },
                      )
                    }
                    className={`rounded-2xl p-4 border transition-all text-left ${
                      modal.draft.sleep
                        ? 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-700'
                        : 'bg-gray-50 border-gray-200 dark:bg-gray-900/40 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Moon className={`w-5 h-5 ${modal.draft.sleep ? 'text-purple-600' : 'text-gray-500'}`} />
                      <span className="font-bold text-gray-900 dark:text-gray-100">Sono</span>
                      {modal.draft.sleep && <CheckCircle2 className="w-5 h-5 text-purple-600 ml-auto" />}
                    </div>
                  </button>
                </div>

                <div className="rounded-2xl p-4 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <Flame className="w-5 h-5 text-orange-500" />
                      Fissura
                    </div>
                    <div className="text-2xl font-extrabold text-orange-600 dark:text-orange-400">{modal.draft.urge}</div>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={modal.draft.urge}
                    onChange={(e) =>
                      setModal((prev) =>
                        !prev.open ? prev : { ...prev, draft: { ...prev.draft, urge: Number(e.target.value) } },
                      )
                    }
                    className="w-full mt-3"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <div className="font-extrabold text-gray-900 dark:text-gray-100">Anotação</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{modal.draft.note.trim().length}/700</div>
                  </div>
                  <textarea
                    value={modal.draft.note}
                    onChange={(e) =>
                      setModal((prev) =>
                        !prev.open ? prev : { ...prev, draft: { ...prev.draft, note: e.target.value.slice(0, 700) } },
                      )
                    }
                    className="mt-2 w-full min-h-[140px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400/60"
                    placeholder="O que você sentiu? O que ajudou?"
                  />
                </div>
              </div>

              <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveModal}
                  className="px-5 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-extrabold hover:opacity-95"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400 text-center pb-6">
          Este ciclo é um guia prático do app (não é orientação médica). Se sentir que perdeu o controle, use o protocolo e procure apoio.
        </div>
      </main>
    </div>
  );
}
