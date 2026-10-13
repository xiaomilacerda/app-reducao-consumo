'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Target,
  ArrowLeft,
  Trophy,
  Star,
  CheckCircle,
  Clock,
  Zap,
  Coins,
  Crown,
  Lock,
  LogIn,
  X,
} from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import MissionsEngagement from '@/components/missions/MissionsEngagement';
type MissionRow = {
  id: number | string;
  title: string;
  description: string | null;
  type: string | null; // 'daily' | 'weekly' | 'premium' | etc
  category: string | null;
  reward_xp?: number | null;
  reward_coins?: number | null;
  xp_reward?: number | null;
  coins_reward?: number | null;
  is_premium_only?: boolean | null;
  premium_only?: boolean | null;
  day_index?: number | null;       // 1..365 para missões diárias/premium; 1..55 para weekly
  answer_prompt?: string | null;   // pergunta guiando o texto que o usuário escreve
};

type ProfileRow = {
  id: string;
  xp?: number | null;
  is_premium?: boolean | null;
};

const XP_PER_LEVEL = 500;
const MIN_ANSWER_LENGTH = 10; // mínimo de caracteres para aceitar a resposta


const LS_MISSIONS_ANSWERS_KEY = 'wr_missions_answer_history_v1';
const LS_MISSIONS_DRAFT_PREFIX = 'wr_missions_draft_v1';

type MissionAnswerHistoryEntry = {
  mission_id: string;
  day_key: string;
  text: string;
  title?: string;
  created_at: string;
  source?: 'local' | 'db';
};

function safeParseJson<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type LocalCompletedEntry = {
  day_key?: string;
  completed_at?: string;
};

type LocalCompletedMap = Record<string, LocalCompletedEntry>;

const LS_MISSIONS_COMPLETED_MAP_PREFIX = 'wr_missions_completed_map_v1';

function getCompletedMapKey(userId: string) {
  return `${LS_MISSIONS_COMPLETED_MAP_PREFIX}:${userId}`;
}

function readLocalCompletedMap(userId: string): LocalCompletedMap {
  try {
    const raw = localStorage.getItem(getCompletedMapKey(userId));
    const parsed = safeParseJson<LocalCompletedMap>(raw, {});
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalCompleted(userId: string, missionId: string, dayKey: string) {
  try {
    const map = readLocalCompletedMap(userId);
    map[String(missionId)] = { day_key: dayKey, completed_at: new Date().toISOString() };
    localStorage.setItem(getCompletedMapKey(userId), JSON.stringify(map));
  } catch (e) {
    console.warn('Falha ao salvar completado local (ignorado):', e);
  }
}

function localSaysCompletedToday(userId: string | null, missionId: string, dayKey: string) {
  if (!userId) return false;
  try {
    const map = readLocalCompletedMap(userId);
    const entry = map?.[String(missionId)];
    return !!entry && String(entry.day_key ?? '') === dayKey;
  } catch {
    return false;
  }
}

function isDoneFromUserMissionRow(row: any): boolean {
  if (!row) return false;
  if (Boolean(row.completed)) return true;
  if (row.completed_at) return true;

  const s = String(row.status ?? '').toLowerCase().trim();
  if (!s) return false;

  return ['completed', 'concluida', 'concluída', 'done', 'finished', 'success'].includes(s);
}

function getAnswerHistoryKey(uid: string) {
  return `${LS_MISSIONS_ANSWERS_KEY}:${uid}`;
}

function getDraftKey(uid: string, missionId: string) {
  return `${LS_MISSIONS_DRAFT_PREFIX}:${uid}:${missionId}`;
}

function upsertHistoryEntry(list: MissionAnswerHistoryEntry[], entry: MissionAnswerHistoryEntry) {
  const key = `${entry.day_key}::${entry.mission_id}`;
  const map = new Map<string, MissionAnswerHistoryEntry>();
  for (const it of list) {
    map.set(`${it.day_key}::${it.mission_id}`, it);
  }
  map.set(key, entry);
  return Array.from(map.values()).sort((a, b) => (b.day_key || '').localeCompare(a.day_key || '') || (b.created_at || '').localeCompare(a.created_at || ''));
}


function getLevelFromXp(xp: number) {
  const safe = Number.isFinite(xp) ? xp : 0;
  return Math.floor(safe / XP_PER_LEVEL) + 1;
}

function getXpFromMission(m: any): number {
  return (
    Number(
      m.reward_xp ??
        m.xp_reward ??
        m.xpReward ??
        m['xp_reward'] ??
        m['xpReward'] ??
        0,
    ) || 0
  );
}

function getCoinsFromMission(m: any): number {
  return (
    Number(
      m.reward_coins ??
        m.coins_reward ??
        m.coinsReward ??
        m['coins'] ??
        m['coins_reward'] ??
        0,
    ) || 0
  );
}

// Dia do ano (1..366) para usarmos com day_index e rodízio
function getDayOfYear(date: Date) {
  const currentUTC = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const janFirstUTC = Date.UTC(date.getFullYear(), 0, 1);
  return Math.floor((currentUTC - janFirstUTC) / 86400000) + 1;
}

function getLocalDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ISO week (padrão: semana começa na segunda; semana 1 = semana do 1º quinta-feira)
function getISOWeekInfo(date: Date): { isoYear: number; isoWeek: number } {
  // Trabalha em UTC para evitar bug de fuso/DST
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // 1..7 (Mon..Sun)
  // move para a quinta-feira da mesma semana
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);

  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  return { isoYear, isoWeek: weekNo };
}

function getMondayOfWeekLocal(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0..6 (Sun..Sat)
  const diff = (dow + 6) % 7; // quantos dias voltar até segunda
  d.setDate(d.getDate() - diff);
  return d;
}

function addDaysLocal(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getWeekKeyMonday(date: Date): { weekKey: string; isoYear: number; isoWeek: number; monday: Date; days: string[] } {
  const { isoYear, isoWeek } = getISOWeekInfo(date);
  const monday = getMondayOfWeekLocal(date);
  const days = Array.from({ length: 7 }, (_, i) => getLocalDayKey(addDaysLocal(monday, i)));
  const weekKey = `${isoYear}-W${String(isoWeek).padStart(2, '0')}`;
  return { weekKey, isoYear, isoWeek, monday, days };
}

// ✅ Semana justa: se o usuário começa no meio da semana, a meta vira (dias restantes até domingo)
function getRequiredDaysForWeek(weekDays: string[], startDayKey: string | undefined): number {
  if (!startDayKey) return 7;
  const idx = weekDays.indexOf(startDayKey);
  if (idx < 0) return 7;
  return Math.max(1, 7 - idx); // seg=7, ter=6, ..., dom=1
}

/** Calcula o dia da jornada a partir do início escolhido pela pessoa. */
function personalJourneyDay(startISO: string | null | undefined, timezone: string) {
  if (!startISO) return 1;
  const start = new Date(startISO);
  if (Number.isNaN(start.getTime())) return 1;
  const key = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).formatToParts(date);
    const part = (name: string) => parts.find(p => p.type === name)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  };
  try {
    const from = Date.parse(key(start) + 'T12:00:00Z');
    const until = Date.parse(key(new Date()) + 'T12:00:00Z');
    return Math.max(1, Math.min(365, Math.floor((until - from) / 86400000) + 1));
  } catch { return 1; }
}

type WeeklyProgress = {
  week_key: string;
  checkins: Record<string, boolean>;
  count: number;
  rewarded_week_key?: string;

  // ✅ novos campos para semana justa (gratuito, sem pay-to-win)
  start_day_key?: string;
  required_days?: number;

  // ✅ tolerância 1x/semana: marcar "ontem" (anti-frustração)
  retro_used?: boolean;
  retro_used_day_key?: string;
  retro_used_at?: string;
};

function normalizeWeeklyProgress(raw: any, weekKey: string): WeeklyProgress {
  const p = (raw ?? {}) as any;
  const wk = String(p.week_key ?? p.weekKey ?? '');
  if (wk !== weekKey) {
    return {
      week_key: weekKey,
      checkins: {},
      count: 0,
      rewarded_week_key: p.rewarded_week_key ?? p.rewardedWeekKey,
      start_day_key: undefined,
      required_days: undefined,
      retro_used: undefined,
      retro_used_day_key: undefined,
      retro_used_at: undefined,
    };
  }
  const checkins = (p.checkins ?? {}) as Record<string, boolean>;
  const count =
    Number(p.count ?? p.done_count ?? p.doneCount) || Object.values(checkins).filter(Boolean).length;

  return {
    week_key: weekKey,
    checkins,
    count,
    rewarded_week_key: p.rewarded_week_key ?? p.rewardedWeekKey,
    start_day_key: p.start_day_key ?? p.startDayKey,
    required_days: Number(p.required_days ?? p.requiredDays) || undefined,
    retro_used: !!(p.retro_used ?? p.retroUsed),
    retro_used_day_key: p.retro_used_day_key ?? p.retroUsedDayKey,
    retro_used_at: p.retro_used_at ?? p.retroUsedAt,
  };
}

// Só missões "reflexivas" precisam de texto
function missionRequiresAnswer(m: MissionRow): boolean {
  const t = (m.type || '').toLowerCase();
  return t === 'daily' || !!m.answer_prompt;
}

export default function MissionsPage() {
  const supabase = useMemo(() => {
    try {
      return getSupabaseClient();
    } catch (e) {
      console.error('Supabase client init failed:', e);
      return null as any;
    }
  }, []);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showLoginNotice, setShowLoginNotice] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  const [walletCoins, setWalletCoins] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
  const [level, setLevel] = useState(1);
  const [personalMissionDay, setPersonalMissionDay] = useState(1);
  const [xpVerified, setXpVerified] = useState(false);
  const [walletVerified, setWalletVerified] = useState(false);
  const [completedDailyTodayId, setCompletedDailyTodayId] = useState<string | null>(null);

  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [weeklyMission, setWeeklyMission] = useState<MissionRow | null>(null);
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgress>(() => ({ week_key: '', checkins: {}, count: 0 }));
  const [weeklyDoneThisWeek, setWeeklyDoneThisWeek] = useState(false);
  const [verifiedWeekCheckins, setVerifiedWeekCheckins] = useState(0);
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({}); // texto que o usuário digitou por missão

  const [answerHistory, setAnswerHistory] = useState<MissionAnswerHistoryEntry[]>([]);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Record<string, number>>({});
  const draftSaveTimersRef = useRef<Record<string, any>>({});

  // Histórico:
  // - Grátis: só um "gostinho" (últimas respostas)
  // - Premium: histórico completo (365 dias) + busca + filtros + paginação
  const RECENT_LIMIT_FREE = 3;
  const RECENT_LIMIT_PREMIUM = 14;
  const FULL_HISTORY_PAGE_SIZE = 30;

  const recentLimit = isPremium ? RECENT_LIMIT_PREMIUM : RECENT_LIMIT_FREE;

  const [historyView, setHistoryView] = useState<'recent' | 'full'>('recent');
  const [historyMonth, setHistoryMonth] = useState<'all' | 'other' | string>('all'); // 'YYYY-MM' | 'all' | 'other'
  const [historyPage, setHistoryPage] = useState(1);

  useEffect(() => {
    // Premium abre o histórico completo por padrão
    setHistoryView(isPremium ? 'full' : 'recent');
  }, [isPremium]);

  useEffect(() => {
    // Sempre que mudar busca/filtro/aba, volta pra página 1
    setHistoryPage(1);
  }, [historyQuery, historyMonth, historyView]);



  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (userId) setShowLoginNotice(false);
  }, [userId]);

  function requestMissionLogin() {
    setShowLoginNotice(true);
  }

  const today = new Date();
  const todayDayKey = getLocalDayKey(today); // YYYY-MM-DD (LOCAL)
  const todayIndex = personalMissionDay; // 1..365 desde o início da jornada
  const weekInfo = useMemo(() => getWeekKeyMonday(today), [todayDayKey]);
  const weeklyIndex = useMemo(() => ((weekInfo.isoWeek - 1) % 55) + 1, [weekInfo.weekKey]);

  // ---------------- CARREGAR USER + PROFILE + WALLET + MISSIONS ----------------

  // === AUTH SESSION (resolve userId reliably) ===
  useEffect(() => {
    if (!supabase) {
      setUserId(null);
      setAuthChecked(true);
      return;
    }

    let cancelled = false;

    // Apenas identidade validada pelo Supabase Auth pode habilitar missões
    // e mostrar o saldo. Nunca confiar em tokens de outro banco no localStorage.
    const loadAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;
        if (error) console.warn('Falha ao validar sessão de missões:', error.message);
        setUserId(error ? null : data?.user?.id ?? null);
        setAuthChecked(true);
      } catch (err) {
        if (cancelled) return;
        console.warn('Autenticação indisponível ao abrir missões:', err);
        setUserId(null);
        setAuthChecked(true);
      }
    };

    loadAuth();

    const { data: sub } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (cancelled) return;
      setUserId(session?.user?.id ?? null);
      setAuthChecked(true);
    });

    return () => {
      cancelled = true;
      sub.subscription?.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      if (!supabase) {
        setErrorMsg('Supabase não inicializou (verifique .env.local e reinicie o npm run dev).');
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMsg(null);

      try {
        const uid = userId;
        let completedTodayIds: string[] = [];
        if (!uid || cancelled) {
          setProfile(null);
          setIsPremium(false);
          setWalletCoins(0);
          setTotalXP(0);
          setXpVerified(false);
          setWalletVerified(false);
          setPersonalMissionDay(1);
          setCompletedDailyTodayId(null);
        } else {

          // perfil
          const { data: p, error: pErr } = await supabase
            .from('profiles')
            .select('id, xp, is_premium, created_at, timezone')
            .eq('id', uid)
            .maybeSingle();

          if (pErr || !p) {
            setXpVerified(false);
            console.warn('profiles load error', pErr);
          } else {
            const xp = Number((p as any).xp ?? 0);
            const tz = (p as any).timezone || 'America/Sao_Paulo';
            const registered = (p as any).created_at as string | null;
            setProfile(p as ProfileRow);
            setIsPremium(!!(p as any).is_premium);
            setTotalXP(xp);
            setXpVerified(true);
            setLevel(Math.floor(xp / XP_PER_LEVEL) + 1);
            setPersonalMissionDay(personalJourneyDay(registered, tz));
            // Início do onboarding tem prioridade; sua falha não impede o login.
            void supabase.from('user_private_state').select('data')
              .eq('user_id', uid).maybeSingle()
              .then(({ data: saved, error: stateError }: any) => {
                if (cancelled || stateError) return;
                const cloudStart = saved?.data?.userData?.detoxCycleStartDate ||
                  saved?.data?.userData?.startDate;
                if (typeof cloudStart === 'string')
                  setPersonalMissionDay(personalJourneyDay(cloudStart, tz));
              }, () => {});
          }

          // carteira
          const { data: w, error: wErr } = await supabase
            .from('user_wallet')
            .select('coins')
            .eq('user_id', uid)
            .maybeSingle();

          if (wErr) {
            setWalletVerified(false);
            console.warn('wallet load error', wErr);
          } else {
            setWalletCoins(Number((w as any)?.coins ?? 0));
            setWalletVerified(true);
          }

          // user_missions (se já completou)
          try {
            const { data: um, error: umErr } = await supabase
              .from('user_missions')
              .select('mission_id, completed, completed_at, status, progress')
              .eq('user_id', uid);

            if (umErr) {
              console.warn('user_missions load error', umErr);
            } else if (um) {
              const map: Record<string, boolean> = {};
              (um as any[]).forEach((row) => {
                const mid = String(row.mission_id);
                if (isDoneFromUserMissionRow(row)) {
                  map[mid] = true;
                  const completionKey = row.progress?.day_key || row.progress?.dayKey;
                  const completedAt = typeof row.completed_at === 'string'
                    ? getLocalDayKey(new Date(row.completed_at)) : null;
                  if (completionKey === todayDayKey || completedAt === todayDayKey)
                    completedTodayIds.push(mid);
                }
              });

              // Fallback local: se a página recarregar antes do DB refletir, ainda bloqueia "farm"
              try {
                const localMap = readLocalCompletedMap(userId);
                Object.entries(localMap || {}).forEach(([mid, entry]) => {
                  if (String((entry as any)?.day_key ?? '') === todayDayKey) {
                    map[String(mid)] = true;
                  }
                });
              } catch {}

              setCompletedMap(map);
}
          } catch (err) {
            console.warn('user_missions load catch', err);
          }
        }

        // missions
        // Consulta direta por dia e apenas o pequeno catálogo Premium.
        // Evita o corte em 1.000 registros que exibia erroneamente o Dia 1.
        const [dailyQuery, premiumQuery, weeklyQuery] = await Promise.all([
          // 365 missões diárias para preservar também os títulos do histórico.
          // Consultas segmentadas não sofrem o corte em 1.000 linhas.
          supabase.from('missions').select('*')
            .eq('type', 'daily')
            .order('id', { ascending: true }).limit(400),
          supabase.from('missions').select('*')
            .or('premium_only.eq.true,is_premium_only.eq.true,type.eq.premium')
            .order('id', { ascending: true }).limit(150),
          supabase.from('missions').select('*')
            .eq('type', 'weekly')
            .order('id', { ascending: true }).limit(70),
        ]);
        const mErr = dailyQuery.error || premiumQuery.error || weeklyQuery.error;
        const mData = [
          ...(dailyQuery.data ?? []),
          ...(premiumQuery.data ?? []),
          ...(weeklyQuery.data ?? []),
        ];

        if (mErr) {
          console.error('missions load error', mErr);
          setMissions([]);
          setErrorMsg('Não foi possível carregar as missões.');
        } else {
          const list = ((mData as MissionRow[]) ?? []) as MissionRow[];
          setMissions(list);
          const dailyDone = list.find(m => m.type === 'daily' &&
            completedTodayIds.includes(String(m.id)));
          setCompletedDailyTodayId(dailyDone ? String(dailyDone.id) : null);

          // Carrega apenas o histórico da missão semanal antiga (somente leitura).
          // Nunca mais cria linhas, reinicia progresso nem premia por este fluxo.
          const legacyWeekly = list.find(m => m.type === 'weekly' &&
            m.day_index === weeklyIndex) ?? null;
          setWeeklyMission(legacyWeekly);
          if (uid && legacyWeekly) {
            const { data: legacyProgress } = await supabase.from('user_missions')
              .select('progress').eq('user_id', uid)
              .eq('mission_id', Number(legacyWeekly.id)).maybeSingle();
            const normalized = normalizeWeeklyProgress(legacyProgress?.progress, weekInfo.weekKey);
            setWeeklyProgress(normalized);
            setWeeklyDoneThisWeek(normalized.rewarded_week_key === weekInfo.weekKey);
          } else {
            setWeeklyProgress({ week_key: weekInfo.weekKey, checkins: {}, count: 0 });
            setWeeklyDoneThisWeek(false);
          }
        }
      } catch (err) {
        console.error('Erro inesperado carregando missões:', err);
        setErrorMsg('Erro inesperado ao carregar dados.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [userId, authChecked, supabase]);

  // ---------------- RESPOSTAS (DIÁRIA): rascunho + histórico ----------------

  function handleAnswerChange(missionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [missionId]: value }));

    if (!userId) return;
    try {
      const lsKey = getDraftKey(userId, missionId);

      // debounce leve pra não escrever no localStorage em todo keypress
      const timers = draftSaveTimersRef.current || {};
      if (timers[missionId]) clearTimeout(timers[missionId]);

      timers[missionId] = setTimeout(() => {
        try {
          localStorage.setItem(lsKey, value ?? '');
          setDraftSavedAt((prev) => ({ ...prev, [missionId]: Date.now() }));
            } catch (e) {
          console.warn('Falha ao salvar rascunho (ignorado):', e);
        }
      }, 250);

      draftSaveTimersRef.current = timers;
        } catch (e) {
      console.warn('Draft change catch (ignorado):', e);
    }
  }

  function getSavedAnswerText(missionId: string, dayKey: string): string | null {
    const hit = answerHistory.find(
      (e) => e.mission_id === missionId && e.day_key === dayKey,
    );
    return hit?.text ?? null;
  }

  async function loadAnswerHistory(uid: string) {
    if (!supabase) return;
    setHistoryLoading(true);

    try {
      // 1) localStorage
      try {
        const local = safeParseJson<MissionAnswerHistoryEntry[]>(
          localStorage.getItem(getAnswerHistoryKey(uid)),
          [],
        );
        if (local.length) {
          const cleaned = local.reduce((acc, it) => upsertHistoryEntry(acc, it), [] as MissionAnswerHistoryEntry[]);
          setAnswerHistory(cleaned);
        }
          } catch (e) {
        console.warn('Falha ao ler histórico local (ignorado):', e);
      }

      // 2) best-effort no banco (user_missions.progress)
      try {
        const { data: rows, error } = await supabase
          .from('user_missions')
          .select('mission_id, progress, last_update, completed_at')
          .eq('user_id', uid)
          .order('last_update', { ascending: false })
          .limit(1000);

        if (!error && rows && Array.isArray(rows)) {
          const list: MissionAnswerHistoryEntry[] = [];
          for (const r of rows as any[]) {
            const p = r?.progress;
            if (!p || typeof p !== 'object') continue;

            const dayKey =
              String(p.day_key ?? p.dayKey ?? '').trim();

            const text =
              String(
                p.answer_text ??
                  p.answerText ??
                  p.answered_text ??
                  p.content ??
                  '',
              ).trim();

            if (!dayKey || !text) continue;

            const missionId = String(r.mission_id ?? '');
            if (!missionId) continue;

            const title =
              missions.find((m) => String(m.id) === missionId)?.title ||
              undefined;

            list.push({
              mission_id: missionId,
              day_key: dayKey,
              text,
              title,
              created_at:
                String(r.completed_at ?? r.last_update ?? new Date().toISOString()),
              source: 'db',
            });
          }

          if (list.length) {
            // mescla com local (mantendo o mais recente por chave)
            setAnswerHistory((prev) => {
              let merged = [...prev];
              for (const it of list) merged = upsertHistoryEntry(merged, it);
              return merged;
            });
          }
        }
          } catch (e) {
        console.warn('Falha ao ler histórico do banco (ignorado):', e);
      }
    } finally {
      setHistoryLoading(false);
    }
  }

  async function persistMissionAnswer(m: MissionRow, dayKey: string, text: string) {
    if (!supabase) return;
    if (!userId) return;
    const missionId = String(m.id);
    const entry: MissionAnswerHistoryEntry = {
      mission_id: missionId,
      day_key: dayKey,
      text: (text ?? '').trim(),
      title: m.title ?? undefined,
      created_at: new Date().toISOString(),
      source: 'local',
    };

    // 1) localStorage + state
    try {
      setAnswerHistory((prev) => {
        const next = upsertHistoryEntry(prev, entry);
        try {
          localStorage.setItem(getAnswerHistoryKey(userId), JSON.stringify(next.slice(0, 400)));
            } catch (e) {
          console.warn('Falha ao salvar histórico local (ignorado):', e);
        }
        return next;
      });
        } catch (e) {
      console.warn('persist history catch (ignorado):', e);
    }

    // 2) best-effort no banco (user_missions.progress)
    try {
      const nowIso = new Date().toISOString();

      const { data: prevRow } = await supabase
        .from('user_missions')
        .select('progress')
        .eq('user_id', userId)
        .eq('mission_id', Number(m.id))
        .maybeSingle();

      const prevProgress =
        (prevRow as any)?.progress && typeof (prevRow as any).progress === 'object'
          ? (prevRow as any).progress
          : {};

      const nextProgress = {
        ...(prevProgress as any),
        day_key: dayKey,
        answer_text: entry.text,
        answer_saved_at: nowIso,
      };

      const { data: updated, error: upErr } = await supabase
        .from('user_missions')
        .update({ progress: nextProgress as any, last_update: nowIso })
        .eq('user_id', userId)
        .eq('mission_id', Number(m.id))
        .select('mission_id');

      if (upErr) throw upErr;

      if (!updated || (Array.isArray(updated) && updated.length === 0)) {
        const payload = {
          user_id: userId,
          mission_id: Number(m.id),
          progress: nextProgress as any,
          last_update: nowIso,
        } as any;

        const { error: upsertErr } = await supabase
          .from('user_missions')
          .upsert([payload], { onConflict: 'user_id,mission_id' });

        if (upsertErr) throw upsertErr;
      }
        } catch (e) {
      console.warn('persist user_missions.progress falhou (ignorado):', e);
    }
  }

  // ---------------- SEMANAL: salvar progresso com segurança (update -> upsert) ----------------

  async function saveWeeklyProgressSafe(newProgress: WeeklyProgress) {
    if (!supabase) return;
    if (!userId || !weeklyMission) return;

    const nowIso = new Date().toISOString();

    const { data: updated, error: upErr } = await supabase
      .from('user_missions')
      .update({
        progress: newProgress as any,
        status: 'in_progress',
        last_update: nowIso,
        completed: false,
        completed_at: null,
      } as any)
      .eq('user_id', userId)
      .eq('mission_id', Number(weeklyMission.id))
      .select('mission_id');

    if (upErr) throw upErr;

    if (!updated || (Array.isArray(updated) && updated.length === 0)) {
      const payload = {
        user_id: userId,
        mission_id: Number(weeklyMission.id),
        progress: newProgress as any,
        status: 'in_progress',
        last_update: nowIso,
        completed: false,
        completed_at: null,
      } as any;

      const { error: upsertErr } = await supabase
        .from('user_missions')
        .upsert([payload], { onConflict: 'user_id,mission_id' });

      if (upsertErr) throw upsertErr;
    }
  }

  async function handleWeeklyRetroCheckin() {
    if (!userId || !weeklyMission) return;

    const missionKey = `weeklyRetro:${String(weeklyMission.id)}`;
    if (processing[missionKey]) return;

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const yesterdayKey = getLocalDayKey(yesterday);

    // só permite se o "ontem" estiver dentro desta mesma semana calculada
    if (!weekInfo.days.includes(yesterdayKey)) return;
    if (weeklyProgress.checkins?.[yesterdayKey]) return;
    if (weeklyProgress.retro_used) return;
    if (weeklyDoneThisWeek) return;

    const confirmed = window.confirm(
      `Marcar ontem (${yesterdayKey})?

Você tem 1 tolerância por semana para evitar perder a sequência.`,
    );
        if (!confirmed) return;

    try {
      setProcessing((prev) => ({ ...prev, [missionKey]: true }));

      const baseCheckins = (weeklyProgress.checkins ?? {}) as Record<string, boolean>;
      const nextCheckins = { ...baseCheckins, [yesterdayKey]: true };

      const currentStart =
        weeklyProgress.start_day_key && weekInfo.days.includes(weeklyProgress.start_day_key)
          ? weeklyProgress.start_day_key
          : null;

      const startKey = currentStart
        ? (yesterdayKey < currentStart ? yesterdayKey : currentStart)
        : yesterdayKey;

            const reqDays = getRequiredDaysForWeek(weekInfo.days, startKey);
            const nextCount = Object.values(nextCheckins).filter(Boolean).length;

      const nextProgress: WeeklyProgress = {
        week_key: weekInfo.weekKey,
        checkins: nextCheckins,
        count: nextCount,
        rewarded_week_key: weeklyProgress.rewarded_week_key,
        start_day_key: startKey,
        required_days: reqDays,
        retro_used: true,
        retro_used_day_key: yesterdayKey,
        retro_used_at: new Date().toISOString(),
      };

      // persiste com segurança
      await saveWeeklyProgressSafe(nextProgress);

      setWeeklyProgress(nextProgress);
            setWeeklyDoneThisWeek(nextCount >= reqDays);
        } catch (e) {
      console.warn('weekly retro check-in falhou:', e);
      setErrorMsg('Não foi possível marcar ontem. Tente novamente.');
    } finally {
      setProcessing((prev) => ({ ...prev, [missionKey]: false }));
    }
  }

  // ---------------- EFEITOS: restaurar rascunho + carregar histórico ----------------

  useEffect(() => {
    if (!userId) return;
    // carrega histórico uma vez por login/mudança de usuário
    loadAnswerHistory(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!missions.length) return;
    setAnswerHistory((prev) =>
      prev.map((it) => {
        if (it.title) return it;
        const title =
          missions.find((m) => String(m.id) === String(it.mission_id))?.title ||
          undefined;
        return { ...it, title };
      }),
    );
  }, [missions]);



  // ---------------- HANDLE COMPLETE ----------------

  async function handleCompleteMission(m: MissionRow) {
    const key = String(m.id);

    if (!userId) {
      setErrorMsg('Você precisa estar logado para completar missões.');
      return;
    }
            const doneLocal = localSaysCompletedToday(userId, key, todayDayKey);

            if (completedMap[key] || doneLocal) {
              setErrorMsg('Esta missão já foi completada.');
              setCompletedMap((prev) => ({ ...prev, [key]: true }));
              return;
            }

            // Confirma no banco (evita duplicar recompensa se o estado local/DB estiver atrasado)
            try {
              const { data: existing } = await supabase
                .from('user_missions')
                .select('completed, completed_at, status')
                .eq('user_id', userId)
                .eq('mission_id', Number(m.id))
                .maybeSingle();

              if (existing && isDoneFromUserMissionRow(existing)) {
                setCompletedMap((prev) => ({ ...prev, [key]: true }));
                writeLocalCompleted(userId, key, todayDayKey);
                setErrorMsg('Esta missão já foi completada.');
                return;
              }
            } catch (e) {
              // ignora (vamos seguir com o fluxo normal)
            }
const requiresAnswer = missionRequiresAnswer(m);
    const answerText = (answers[key] || '').trim();

    // Só obriga texto para missões diárias / reflexivas
    if (requiresAnswer && answerText.length < MIN_ANSWER_LENGTH) {
      setErrorMsg(
        'Antes de completar a missão, escreva pelo menos uma frase sobre o que você fez.',
      );
      return;
    }

    setProcessing((prev) => ({ ...prev, [key]: true }));
    setErrorMsg(null);

    try {
      // Supabase realiza resposta, XP, moedas e recibo na mesma transação.
      // Não há fallback de crédito pelo navegador.
      const { data: claim, error: claimError } = await supabase.rpc(
        'claim_personal_mission_secure', {
          p_mission_id: Number(m.id),
          p_answer: answerText,
        }
      );
      if (claimError) throw claimError;
      if (!claim?.ok) {
        if (claim?.already_completed) setCompletedMap((prev) => ({ ...prev, [key]: true }));
        throw new Error(claim?.message || 'O servidor não confirmou a recompensa.');
      }

      // 🔄 Recarrega wallet + XP para refletir instantaneamente (senão só atualiza ao dar refresh)
      try {
        const { data: w } = await supabase
          .from('user_wallet')
          .select('coins')
          .eq('user_id', userId)
          .maybeSingle();
        if (w) setWalletCoins(Number((w as any).coins ?? 0));

        const { data: p } = await supabase
          .from('profiles')
          .select('xp')
          .eq('id', userId)
          .maybeSingle();
        if (p) {
          const xpNow = Number((p as any).xp ?? 0);
          setTotalXP(xpNow);
          setLevel(Math.floor(xpNow / XP_PER_LEVEL) + 1);
          setProfile((prev) => (prev ? { ...prev, xp: xpNow } : { id: userId, xp: xpNow }));
        }
          } catch (e) {
        console.warn('refresh wallet/xp falhou (ignorado):', e);
      }

      // Reflexão e progresso já salvos pelo servidor.
      try { localStorage.removeItem(getDraftKey(userId, String(m.id))); } catch {}
      setCompletedMap((prev) => ({ ...prev, [key]: true }));
      writeLocalCompleted(userId, key, todayDayKey);

      setAnswers((prev) => ({ ...prev, [key]: prev[key] ?? '' })); // mantém texto (travado após concluir)
} catch (err: any) {
      console.error('Erro completando missão:', err);
      setErrorMsg(
        err?.message || 'Erro inesperado ao tentar completar a missão.',
      );
    } finally {
      setProcessing((prev) => ({ ...prev, [key]: false }));
    }
  }

  // ---------------- MISSÃO SEMANAL: CHECK-IN + CONCLUIR ----------------

  async function handleWeeklyCheckin() {
    if (!userId) {
      setErrorMsg('Você precisa estar logado para marcar o check-in semanal.');
      return;
    }
    if (!weeklyMission) {
      setErrorMsg('Nenhuma missão semanal encontrada.');
      return;
    }

    if (weeklyDoneThisWeek) {
      setErrorMsg('Você já concluiu a missão semanal desta semana.');
      return;
    }

    const todayKey = todayDayKey;

    // Só permite marcar o DIA DE HOJE (força o retorno diário)
    if (!weekInfo.days.includes(todayKey)) {
      setErrorMsg('Hoje não pertence à semana atual.');
      return;
    }

    if (weeklyProgress.checkins?.[todayKey]) {
      setErrorMsg('O check-in de hoje já foi marcado.');
      return;
    }

    const key = `weekly:${String(weeklyMission.id)}`;
    setProcessing((prev) => ({ ...prev, [key]: true }));
    setErrorMsg(null);

    try {
      const newCheckins = { ...(weeklyProgress.checkins || {}), [todayKey]: true };
      const newCount = Object.values(newCheckins).filter(Boolean).length;

      // ✅ Semana justa: define start_day_key e required_days no primeiro check-in
      const startDayKey = weeklyProgress.start_day_key || todayKey;
      const requiredDays = weeklyProgress.required_days ?? getRequiredDaysForWeek(weekInfo.days, startDayKey);

      const newProgress: WeeklyProgress = {
        week_key: weekInfo.weekKey,
        checkins: newCheckins,
        count: newCount,
        rewarded_week_key: weeklyProgress.rewarded_week_key,
        start_day_key: startDayKey,
        required_days: requiredDays,
        retro_used: weeklyProgress.retro_used,
        retro_used_day_key: weeklyProgress.retro_used_day_key,
        retro_used_at: weeklyProgress.retro_used_at,
      };

      await saveWeeklyProgressSafe(newProgress);

      setWeeklyProgress(newProgress);
    } catch (err: any) {
      console.error('Erro no check-in semanal:', err);
      setErrorMsg(err?.message || 'Não foi possível marcar o check-in de hoje.');
    } finally {
      setProcessing((prev) => ({ ...prev, [`weekly:${String(weeklyMission?.id ?? '')}`]: false }));
    }
  }

  async function handleWeeklyComplete() {
    if (!userId) {
      setErrorMsg('Você precisa estar logado para concluir a missão semanal.');
      return;
    }
    if (!weeklyMission) {
      setErrorMsg('Nenhuma missão semanal encontrada.');
      return;
    }
    if (weeklyDoneThisWeek) {
      setErrorMsg('Você já coletou a recompensa desta semana.');
      return;
    }

    const requiredDays =
      weeklyProgress.required_days ??
      getRequiredDaysForWeek(weekInfo.days, weeklyProgress.start_day_key);

    if (verifiedWeekCheckins < 7) {
      setErrorMsg(`Para coletar o bônus, registre 7 check-ins reais no Ritual de Hoje. Você tem ${verifiedWeekCheckins}/7.`);
      return;
    }

    const confirmed = window.confirm(
      `Concluir a semana agora?

Pressione apenas se você realmente cumpriu a missão a semana toda.
Não minta para você mesmo só para coletar XP e moedas.`,
    );
      if (!confirmed) return;

    const key = `weeklyComplete:${String(weeklyMission.id)}`;
    setProcessing((prev) => ({ ...prev, [key]: true }));
    setErrorMsg(null);

    try {
      // Operação atômica no servidor: valida 7 check-ins verificados, a
      // semana vigente, a missão e a coleta única. Não existe fallback que
      // credite recompensas diretamente pelo navegador.
      const { data, error: rpcError } = await supabase.rpc('complete_weekly_mission', {
        p_user: userId,
        p_mission_id: Number(weeklyMission.id),
        p_week_key: weekInfo.weekKey,
      } as any);
      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.success) {
        throw new Error(row?.message || 'O banco não confirmou a recompensa semanal.');
      }
      setWeeklyProgress((prev) => ({ ...prev, rewarded_week_key: weekInfo.weekKey }));
      setErrorMsg(null);

      setWeeklyDoneThisWeek(true);

      // 🔄 Recarrega wallet + XP para refletir instantaneamente
      const { data: w } = await supabase
        .from('user_wallet')
        .select('coins')
        .eq('user_id', userId)
        .maybeSingle();
      if (w) setWalletCoins(Number((w as any).coins ?? 0));

      const { data: p } = await supabase
        .from('profiles')
        .select('xp')
        .eq('id', userId)
        .maybeSingle();
      if (p) {
        const xpNow = Number((p as any).xp ?? 0);
        setTotalXP(xpNow);
        setLevel(getLevelFromXp(xpNow));
      }
    } catch (err: any) {
      console.error('Erro concluindo missão semanal:', err);
      setErrorMsg(err?.message || 'Não foi possível concluir a missão semanal.');
    } finally {
      setProcessing((prev) => ({ ...prev, [key]: false }));
    }
  }

  // ---------------- DERIVADOS (SEÇÕES) ----------------

  const dailyMissionsRaw = useMemo(
    () =>
      missions.filter(
        (m) => (m.type || '').toLowerCase() === 'daily',
      ),
    [missions],
  );

  // Missão diária do dia (usando day_index se estiver preenchido)
  const dailyMissionToday: MissionRow | null = useMemo(() => {
    if (!dailyMissionsRaw.length) return null;

    // Se um desafio já foi feito hoje na versão anterior, mostre esse
    // desafio concluído, em vez de oferecer outro ao recalcular o dia pessoal.
    const alreadyDone = dailyMissionsRaw.find(m =>
      String(m.id) === completedDailyTodayId);
    if (alreadyDone) return alreadyDone;
    const byIndex = dailyMissionsRaw.find(
      (m) => (m.day_index || 0) === Math.min(todayIndex, 365),
    );
    if (byIndex) return byIndex;

    // fallback: se ninguém tem day_index igual ao dia, pega a primeira
    return dailyMissionsRaw[0];
  }, [dailyMissionsRaw, todayIndex, completedDailyTodayId]);

  // ---------------- EFEITO: restaurar rascunho e garantir resposta visível após concluir ----------------
  useEffect(() => {
    if (!userId) return;
    if (!dailyMissionToday) return;

    const missionId = String(dailyMissionToday.id);
    const done = !!completedMap[missionId] || localSaysCompletedToday(userId, missionId, todayDayKey);

    // se já concluiu hoje e ainda não temos texto em state, tenta puxar do histórico
    if (done) {
      const saved = getSavedAnswerText(missionId, todayDayKey);
      if (saved && !(answers[missionId] || '').trim()) {
        setAnswers((prev) => ({ ...prev, [missionId]: saved }));
      }
      return;
    }

    // se não concluiu, tenta restaurar rascunho
    try {
      const draft = localStorage.getItem(getDraftKey(userId, missionId));
      if (draft && !(answers[missionId] || '').trim()) {
        setAnswers((prev) => ({ ...prev, [missionId]: draft }));
        setDraftSavedAt((prev) => ({ ...prev, [missionId]: Date.now() }));
      }
        } catch (e) {
      console.warn('Falha ao restaurar rascunho (ignorado):', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dailyMissionToday?.id, todayDayKey, completedMap]);








  const premiumMissions = useMemo(
    () =>
      missions.filter((m) => {
        const t = (m.type || '').toLowerCase();
        return (
          t === 'premium' ||
          m.is_premium_only ||
          m.premium_only ||
          (m.category || '').toLowerCase().includes('premium')
        );
      }),
    [missions],
  );

  // Apenas UMA missão premium por dia
  const premiumMissionToday: MissionRow | null = useMemo(() => {
    if (!premiumMissions.length) return null;

    // se tiver day_index preenchido, usa
    const byIndex = premiumMissions.find(
      (m) => (m.day_index || 0) === todayIndex,
    );
    if (byIndex) return byIndex;

    // senão, faz rodízio com base no dia do ano
    const idx = (todayIndex - 1) % premiumMissions.length;
    return premiumMissions[idx];
  }, [premiumMissions, todayIndex]);

  const weeklyRequiredDays = useMemo(() => {
    return weeklyProgress.required_days ?? getRequiredDaysForWeek(weekInfo.days, weeklyProgress.start_day_key);
  }, [weeklyProgress.required_days, weeklyProgress.start_day_key, weekInfo.weekKey]);


  
  const monthOptions = useMemo(() => {
    // meses disponíveis no formato YYYY-MM
    const months = new Set<string>();
    let hasOther = false;

    for (const it of answerHistory) {
      const dk = it.day_key || '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(dk)) {
        months.add(dk.slice(0, 7));
      } else if (dk) {
        hasOther = true;
      }
    }

    const list = Array.from(months).sort((a, b) => b.localeCompare(a));
    if (hasOther) list.push('other');
    return list;
  }, [answerHistory]);

  const filteredAllHistory = useMemo(() => {
    const q = (historyQuery || '').trim().toLowerCase();

    const base = answerHistory
      .filter((it) => !!it.text && !!it.day_key && !!it.mission_id)
      .sort(
        (a, b) =>
          (b.day_key || '').localeCompare(a.day_key || '') ||
          (b.created_at || '').localeCompare(a.created_at || ''),
      );

    const byMonth =
      historyMonth === 'all'
        ? base
        : historyMonth === 'other'
          ? base.filter((it) => !/^\d{4}-\d{2}-\d{2}$/.test(it.day_key || ''))
          : base.filter((it) => (it.day_key || '').startsWith(historyMonth));

    if (!q) return byMonth;

    return byMonth.filter((it) => {
      const hay = `${it.day_key} ${it.title || ''} ${it.text}`.toLowerCase();
      return hay.includes(q);
    });
  }, [answerHistory, historyQuery, historyMonth]);

  const recentAnswerHistory = useMemo(() => {
    return filteredAllHistory.slice(0, recentLimit);
  }, [filteredAllHistory, recentLimit]);

  const fullAnswerHistoryVisible = useMemo(() => {
    return filteredAllHistory.slice(0, historyPage * FULL_HISTORY_PAGE_SIZE);
  }, [filteredAllHistory, historyPage]);

  const visibleAnswerHistory = useMemo(() => {
    if (isPremium && historyView === 'full') return fullAnswerHistoryVisible;
    return recentAnswerHistory;
  }, [isPremium, historyView, fullAnswerHistoryVisible, recentAnswerHistory]);

  const hasMoreAnswerHistory =
    isPremium &&
    historyView === 'full' &&
    fullAnswerHistoryVisible.length < filteredAllHistory.length;


  // ---------------- RENDER ----------------

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-black to-gray-900">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-gray-900 text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-black/40 backdrop-blur-sm border-b border-purple-500/20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md">
                  <Target className="w-5 h-5" />
                </div>
                <h1 className="text-lg sm:text-xl font-bold text-white">
                  Missões &amp; Recompensas
                </h1>
              </div>
              <p className="text-xs text-purple-100/80 mt-0.5">
                Pequenos cuidados, conquistas reais. Sua evolução acontece no seu ritmo.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* INDICADORES CONCISOS: dados verificados, nunca zeros falsos em falhas. */}
        <section className="grid grid-cols-3 gap-2.5 sm:gap-4" aria-label="Seu progresso e recompensas">
          <div className="rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-700/65 to-[#1c1640] p-3 sm:p-5 shadow-lg">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-100"><Trophy className="h-4 w-4" /> Nível</div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums sm:text-3xl">{userId && xpVerified ? level : '—'}</div>
            <p className="mt-1 hidden text-xs text-violet-200 sm:block">Um passo de cada vez.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#17172a] p-3 sm:p-5 shadow-lg">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300"><Star className="h-4 w-4 text-amber-300" /> XP total</div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums sm:text-3xl">{userId && xpVerified ? totalXP : '—'}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar"
              aria-label="Progresso para o próximo nível" aria-valuemin={0} aria-valuemax={XP_PER_LEVEL}
              aria-valuenow={xpVerified ? totalXP % XP_PER_LEVEL : 0}>
              <div className="h-full rounded-full bg-emerald-400" style={{width: `${xpVerified ? (totalXP % XP_PER_LEVEL) / XP_PER_LEVEL * 100 : 0}%`}} />
            </div>
            <p className="mt-1 text-[10px] text-slate-400">{userId && xpVerified ? `${XP_PER_LEVEL - totalXP % XP_PER_LEVEL} XP para subir` : 'Entre para acompanhar'}</p>
          </div>
          <Link href={userId ? '/rewards' : '/login?next=%2Fmissions'}
            className="rounded-2xl border border-amber-400/20 bg-[#211a1c] p-3 shadow-lg transition hover:border-amber-300/60 hover:bg-[#2c2020] sm:p-5"
            aria-label="Ver sua carteira e suas recompensas">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-200"><Coins className="h-4 w-4" /> Moedas</div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums sm:text-3xl">{userId && walletVerified ? walletCoins : '—'}</div>
            <p className="mt-1 text-[10px] text-amber-200/80">Ver recompensas →</p>
          </Link>
        </section>
        {userId && (!xpVerified || !walletVerified) && (
          <div role="status" className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            Os saldos ainda não foram confirmados pela nuvem. Não mostramos zero até conseguir sincronizar.
          </div>
        )}

        {/* AVISO LOGIN */}
        {authChecked && !userId && (
          <section className="rounded-2xl border border-purple-500/30 bg-white/5 px-4 py-3 text-xs sm:text-sm text-purple-50 flex flex-col sm:flex-row sm:items-center gap-2">
            <span>
              Entre ou crie uma conta para salvar suas conquistas e receber XP e moedas.
            </span>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-xs font-semibold text-white hover:opacity-90 transition-colors"
            >
              Entrar / Criar conta
            </Link>
          </section>
        )}

        {/* RITUAL DIÁRIO, DESAFIOS PESSOAIS E PROGRESSO REAL NA NUVEM */}
        <MissionsEngagement
          userId={userId}
          onRequireLogin={requestMissionLogin}
          onProgress={setVerifiedWeekCheckins}
          onReward={() => {
            void (async () => {
              if (!userId) return;
              const [wallet, profileData] = await Promise.all([
                supabase.from('user_wallet').select('coins').eq('user_id', userId).maybeSingle(),
                supabase.from('profiles').select('xp').eq('id', userId).maybeSingle(),
              ]);
              if (typeof wallet.data?.coins === 'number') setWalletCoins(wallet.data.coins);
              if (typeof profileData.data?.xp === 'number') {
                setTotalXP(profileData.data.xp);
                setLevel(getLevelFromXp(profileData.data.xp));
              }
              // O mesmo ritual alimenta o progresso de sete conquistas.
            })();
          }}
        />

        {/* MISSÃO DIÁRIA DO DIA */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm sm:text-base font-semibold text-white">
                Desafio extra de hoje
              </h2>
            </div>
            <span className="text-[11px] text-purple-100/80">
              {userId ? `Dia ${dailyMissionToday?.day_index ?? todayIndex} da sua jornada` : 'Seu primeiro passo'}
            </span>
          </div>

          {!dailyMissionToday ? (
            <div className="rounded-xl border border-dashed border-purple-400/50 bg-white/5 px-4 py-3 text-xs text-purple-100">
              Nenhuma missão diária cadastrada no momento.
            </div>
          ) : (
            (() => {
              const m = dailyMissionToday;
              const key = String(m.id);
              const done = !!completedMap[key] || localSaysCompletedToday(userId, key, todayDayKey);
              const xp = getXpFromMission(m);
              const coins = getCoinsFromMission(m);
              const answerPrompt =
                m.answer_prompt ||
                'Descreva em 1–3 frases o que você fez para cumprir essa missão:';
              const answer = answers[key] || '';
              const answerTooShort =
                missionRequiresAnswer(m) &&
                answer.trim().length < MIN_ANSWER_LENGTH &&
                !done;

              return (
                <article className="rounded-3xl bg-white/5 border border-white/10 px-4 py-4 flex flex-col gap-3 shadow-2xl">
                  <div className="flex items-center gap-2">
                    <CheckCircle
                      className={`w-4 h-4 ${
                        done ? 'text-emerald-400' : 'text-white/40'
                      }`}
                    />
                    <h3 className="text-sm sm:text-base font-semibold text-white">
                      {m.title.replace(/^Dia\s*\d+\s*[-–—]\s*/i, '')}
                    </h3>
                  </div>
                  {m.description && (
                    <p className="text-xs sm:text-sm text-white/70">
                      {m.description}
                    </p>
                  )}

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                    {xp > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-100 border border-purple-400/20">
                        <Star className="w-3 h-3" />
                        {xp} XP
                      </span>
                    )}
                    {coins > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-100 border border-amber-400/20">
                        <Coins className="w-3 h-3" />
                        {coins} moedas
                      </span>
                    )}
                    {m.category && (
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/10">
                        {m.category}
                      </span>
                    )}
                  </div>

                  {/* Campo de resposta do usuário – só aparece enquanto não está concluída */}
                  {userId && !done && (
                    <div className="mt-3 space-y-1">
                      <label className="text-[11px] uppercase tracking-wide text-white/60">
                        {answerPrompt}
                      </label>
                      <textarea
                        rows={3}
                        value={answer}
                        onChange={(e) => handleAnswerChange(key, e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs sm:text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-400/40"
                        placeholder="Exemplo: Hoje eu..."
                        disabled={done}
                      />
                      <div className="mt-2 flex items-center justify-between text-[11px] text-white/60">
                        <span>
                          {(() => {
                            const t = draftSavedAt[key];
                            if (!t) return 'Rascunho não salvo ainda';
                            const secs = Math.max(0, Math.floor((Date.now() - t) / 1000));
                            return secs <= 3 ? 'Rascunho salvo ✓' : `Rascunho salvo há ${secs}s`;
                          })()}
                        </span>
                        <span className="opacity-80">Seu registro fica salvo na conta.</span>
                      </div>

                      {answerTooShort && (
                        <p className="text-[11px] text-red-300 mt-0.5">
                          Escreva pelo menos uma frase pra registrar essa missão
                          no seu histórico.
                        </p>
                      )}
                    </div>
                  )}

                  {userId && done && (
                    <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-wide text-emerald-200">
                        Sua resposta (salva)
                      </div>
                      <div className="mt-1 text-sm text-emerald-50 whitespace-pre-line">
                        {(() => {
                          const saved =
                            (getSavedAnswerText(key, todayDayKey) ||
                              (answers[key] || '')).trim();
                          return saved || 'Desafio concluído hoje. Veja seu registro no histórico.';
                        })()}
                      </div>
                    </div>
                  )}

<div className="mt-3 flex items-center justify-end">
                    <button
                      type="button"
                      disabled={
                        done ||
                        processing[key] ||
                        (userId !== null && missionRequiresAnswer(m) && answerTooShort)
                      }
                      onClick={() => {
                        if (!userId) { requestMissionLogin(); return; }
                        void handleCompleteMission(m);
                      }}
                      className={`px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
                        done
                          ? 'bg-emerald-500/15 text-emerald-100 border border-emerald-400/20 cursor-default'
                          : processing[key]
                          ? 'bg-purple-500/15 text-purple-100 border border-purple-400/20 cursor-wait'
                          : (missionRequiresAnswer(m) && answerTooShort && !!userId)
                          ? 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border border-purple-500/60 hover:opacity-90'
                      }`}
                    >
                      {done ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Concluída hoje
                        </>
                      ) : processing[key] ? (
                        <>
                          <Clock className="w-4 h-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          {!userId ? <LogIn className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                          {!userId ? 'Entrar para completar' : 'Completar missão'}
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })()
          )}
        </section>

        {/* A missão semanal foi integrada ao Ritual de Hoje.
            O antigo histórico permanece preservado no banco. */}

        {/* MISSÕES PREMIUM */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-400" />
              <h2 className="text-sm sm:text-base font-semibold text-white">
                {isPremium ? 'Seu desafio Premium' : 'Desafio Premium'}
              </h2>
            </div>
            <span className="text-[11px] text-purple-100/80">
              {isPremium ? 'Uma conquista extra para sua assinatura' : 'Desbloqueie experiências e recompensas extras'}
            </span>
          </div>

          {!premiumMissionToday ? (
            <div className="rounded-xl border border-dashed border-purple-400/50 bg-white/5 px-4 py-3 text-xs text-purple-100">
              Nenhuma missão premium cadastrada no momento.
            </div>
          ) : (
            (() => {
              const m = premiumMissionToday;
              const key = String(m.id);
              const done = !!completedMap[key] || localSaysCompletedToday(userId, key, todayDayKey);
              const xp = getXpFromMission(m);
              const coins = getCoinsFromMission(m);
              const locked = !isPremium;

              return (
                <article
                  className="rounded-3xl bg-gradient-to-r from-amber-500/[.09] to-white/[.03] border border-amber-400/20 px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 shadow-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-yellow-500" />
                      <h3 className="text-sm font-semibold text-white truncate">
                        {m.title}
                      </h3>
                    </div>
                    {m.description && (
                      <p className="mt-1 text-xs text-white/70 line-clamp-3">
                        {m.description}
                      </p>
                    )}
                    {locked && (
                      <div className="mt-3 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-3">
                        <div className="text-sm text-fuchsia-100 font-semibold">
                          Premium libera
                        </div>
                        <ul className="mt-1 list-disc pl-5 text-sm text-fuchsia-100/90">
                          <li>Missão Premium do dia (recompensas maiores)</li>
                          <li>Histórico maior das suas respostas + busca</li>
                          <li>Recursos extras e análises</li>
                        </ul>
                        <div className="mt-2">
                          <Link href="/premium" className="text-sm font-semibold text-fuchsia-200 underline">
                            Ver Premium
                          </Link>
                        </div>
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                      {xp > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-100 border border-yellow-400/20">
                          <Star className="w-3 h-3" />
                          {xp} XP
                        </span>
                      )}
                      {coins > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-100 border border-amber-400/20">
                          <Coins className="w-3 h-3" />
                          {coins} moedas
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-100 border border-yellow-400/20">
                        Exclusivo Premium
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={locked || done || processing[key] || !userId}
                      onClick={() => handleCompleteMission(m)}
                      className={`px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
                        locked
                          ? 'bg-white/5 text-white/50 border border-white/10 cursor-not-allowed'
                          : done
                          ? 'bg-yellow-500/15 text-yellow-100 border border-yellow-400/20 cursor-default'
                          : processing[key]
                          ? 'bg-yellow-500/15 text-yellow-100 border border-yellow-400/20 cursor-wait'
                          : !userId
                          ? 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed'
                          : 'bg-gradient-to-r from-yellow-400 to-amber-400 text-yellow-950 hover:opacity-90 border border-yellow-500/60'
                      }`}
                    >
                      {locked ? (
                        <>
                          <Lock className="w-4 h-4" />
                          Só Premium
                        </>
                      ) : done ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Concluída
                        </>
                      ) : processing[key] ? (
                        <>
                          <Clock className="w-4 h-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          Completar
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })()
          )}
        </section>

                {/* Histórico recolhível: mantém acesso, deixa a ação principal em destaque. */}
                <details className="group mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[.035]">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-semibold text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 [&::-webkit-details-marker]:hidden">
                    <span className="flex flex-col">
                      <span>Minhas conquistas e reflexões</span>
                      <span className="mt-0.5 text-xs font-normal text-slate-400">Acesse seus registros anteriores quando quiser.</span>
                    </span>
                    <span className="text-xs text-violet-200 group-open:hidden">Abrir ↓</span>
                    <span className="hidden text-xs text-violet-200 group-open:inline">Fechar ↑</span>
                  </summary>
                <section className="mt-1">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-white font-semibold text-lg">
                          Histórico de respostas
                        </h2>
                        <p className="text-white/70 text-sm mt-1">
                          {isPremium
                            ? 'Premium: histórico completo (365 dias) + busca por palavras + filtros.'
                            : 'Grátis: últimas 3 respostas. Premium libera histórico completo (365 dias) + busca por palavras + filtros.'}
                        </p>
                      </div>

                      <div className="text-xs text-white/70">
                        {historyLoading ? 'Carregando...' : ''}
                      </div>
                    </div>

                    {userId && weeklyProgress.count > 0 && (
                      <p className="mt-3 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-xs leading-relaxed text-slate-300">
                        Seus {weeklyProgress.count} registros da missão semanal anterior continuam salvos.
                        O novo ciclo de recompensas utiliza somente os check-ins confirmados no Ritual de Hoje.
                      </p>
                    )}
                    {userId && (
                      <div className="mt-4 space-y-3">
                        {isPremium && (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setHistoryView('full')}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                                  historyView === 'full'
                                    ? 'bg-white/15 border-white/25 text-white'
                                    : 'bg-black/20 border-white/10 text-white/70 hover:text-white'
                                }`}
                              >
                                Histórico completo
                              </button>
                              <button
                                type="button"
                                onClick={() => setHistoryView('recent')}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                                  historyView === 'recent'
                                    ? 'bg-white/15 border-white/25 text-white'
                                    : 'bg-black/20 border-white/10 text-white/70 hover:text-white'
                                }`}
                              >
                                Recentes
                              </button>
                            </div>

                            {historyView === 'full' && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-white/60">Mês:</span>
                                <select
                                  value={historyMonth}
                                  onChange={(e) => setHistoryMonth(e.target.value)}
                                  className="rounded-full bg-black/30 border border-white/10 px-3 py-1.5 text-xs text-white/90 outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                                >
                                  <option value="all">Todos</option>
                                  {monthOptions.map((m) => (
                                    <option key={m} value={m}>
                                      {m === 'other' ? 'Outros' : m}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div className="sm:ml-auto text-xs text-white/60">
                              {filteredAllHistory.length > 0 ? (
                                <span>
                                  {isPremium && historyView === 'full'
                                    ? `Mostrando ${visibleAnswerHistory.length} de ${filteredAllHistory.length}`
                                    : `Total: ${filteredAllHistory.length}`}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        )}

                        <div className="relative">
                          <input
                            value={historyQuery}
                            onChange={(e) => setHistoryQuery(e.target.value)}
                            placeholder={
                              isPremium
                                ? 'Buscar por data, título ou texto...'
                                : 'Buscar no histórico (Premium)'
                            }
                            disabled={!isPremium}
                            className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white/90 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-fuchsia-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                          {!isPremium && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50">
                              <Lock className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {!userId ? (
                      <div className="mt-4 text-white/70 text-sm">
                        Faça login para salvar e ver suas respostas.
                      </div>
                    ) : visibleAnswerHistory.length === 0 ? (
                      <div className="mt-4 text-white/70 text-sm">
                        Nenhuma resposta salva ainda.
                      </div>
                    ) : (
                      <>
                      <div className="mt-4 space-y-3">
                        {visibleAnswerHistory.map((it) => (
                          <div
                            key={`${it.day_key}:${it.mission_id}`}
                            className="rounded-2xl border border-white/10 bg-black/20 p-4"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs text-white/70">
                                <span className="font-semibold text-white/90">
                                  {it.day_key}
                                </span>
                                {it.title ? (
                                  <span className="ml-2">• {it.title}</span>
                                ) : null}
                              </div>
                              <div className="text-[11px] text-white/50">
                                {it.source === 'db' ? '✓ Salvo na nuvem' : 'Salvo neste aparelho'}
                              </div>
                            </div>

                            <div className="mt-2 text-sm text-white/90 whitespace-pre-line">
                              {it.text}
                            </div>
                          </div>
                        ))}
                      </div>

                        {isPremium && historyView === 'full' && hasMoreAnswerHistory && (
                          <div className="mt-4 flex justify-center">
                            <button
                              type="button"
                              onClick={() => setHistoryPage((p) => p + 1)}
                              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-semibold transition"
                            >
                              Carregar mais
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {!isPremium && userId && (
                      <div className="mt-4 rounded-2xl border border-amber-200/30 bg-amber-500/10 p-4">
                        <div className="text-sm text-amber-100">
                          São 365 missões ao longo do ano. Quer ter acesso a tudo o que você já respondeu, com busca por palavras e filtros? Isso é{' '}
                          <Link href="/premium" className="underline font-semibold">
                            Premium
                          </Link>
                          .
                        </div>
                      </div>
                    )}
                  </div>
                </section>
                </details>

        {/* Aviso visível para visitantes: nenhum botão de missão deve falhar silenciosamente. */}
        {authChecked && !userId && showLoginNotice && (
          <div role="alert" aria-live="assertive" className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-md rounded-2xl border border-violet-300/50 bg-[#171228] p-4 text-white shadow-[0_15px_60px_rgba(0,0,0,.75)] sm:bottom-6 sm:p-5">
            <button type="button" onClick={() => setShowLoginNotice(false)}
              aria-label="Fechar aviso de login"
              className="absolute right-3 top-3 rounded-lg p-2 text-violet-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-start gap-3 pr-7">
              <span className="rounded-xl bg-violet-500/25 p-2 text-violet-200">
                <Lock className="h-5 w-5" />
              </span>
              <div>
                <p className="text-base font-bold text-white">Entre para validar sua missão</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-200">
                  Para marcar os dias, salvar seu progresso e receber XP ou moedas,
                  você precisa estar conectado à sua conta WeedReset.
                </p>
              </div>
            </div>
            <Link href="/login?next=%2Fmissions"
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-400 px-4 py-3 text-sm font-bold text-[#170c2a] transition-colors hover:bg-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200">
              <LogIn className="h-5 w-5" /> Entrar para registrar minha missão
            </Link>
            <p className="mt-2 text-center text-xs text-slate-400">
              Depois do login, você volta para a página de missões.
            </p>
          </div>
        )}

{/* ERRO GERAL */}
        {errorMsg && (
          <div className="mt-4 rounded-xl border border-red-500/50 bg-red-900/40 px-4 py-2 text-xs sm:text-sm text-red-50">
            {errorMsg}
          </div>
        )}
      </main>
    </div>
  );
}