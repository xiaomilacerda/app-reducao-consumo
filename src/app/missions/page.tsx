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
} from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';
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
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
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
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  const [walletCoins, setWalletCoins] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
  const [level, setLevel] = useState(1);

  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [weeklyMission, setWeeklyMission] = useState<MissionRow | null>(null);
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgress>(() => ({ week_key: '', checkins: {}, count: 0 }));
  const [weeklyDoneThisWeek, setWeeklyDoneThisWeek] = useState(false);
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

  const today = new Date();
  const todayDayKey = getLocalDayKey(today); // YYYY-MM-DD (LOCAL)
  const todayIndex = getDayOfYear(today); // 1..366
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

    const tryHydrateFromLocalStorage = async () => {
      try {
        // Supabase stores session in localStorage under a key like: sb-<project-ref>-auth-token
        const key = Object.keys(localStorage).find(
          (k) => k.startsWith("sb-") && k.endsWith("-auth-token")
        );
        if (!key) return null;
        const raw = localStorage.getItem(key);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        const access_token = parsed?.access_token;
        const refresh_token = parsed?.refresh_token;

        // If we have tokens, we can re-hydrate the client session
        if (access_token && refresh_token) {
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (!error && data?.session) return data.session;
        }

        return parsed?.user ? { user: parsed.user } : null;
      } catch {
        return null;
      }
    };

    const loadAuth = async () => {
      try {
        // 1) normal path
        const { data } = await supabase.auth.getSession();
        const s = data?.session ?? null;

        if (cancelled) return;

        if (s?.user?.id) {
          setUserId(s.user.id);
          setAuthChecked(true);
          return;
        }

        // 2) fallback: localStorage hydration (helps when session exists but client didn't pick it up yet)
        const fallback = await tryHydrateFromLocalStorage();
        if (cancelled) return;

        const uid = (fallback as any)?.user?.id ?? null;
        setUserId(uid);
        setAuthChecked(true);
          } catch (e) {
        if (cancelled) return;
        console.warn("Missions auth check failed:", e);
        setUserId(null);
        setAuthChecked(true);
      }
    };

    loadAuth();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
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
        if (!uid || cancelled) {
          setProfile(null);
          setIsPremium(false);
          setWalletCoins(0);
        } else {

          // perfil
          const { data: p, error: pErr } = await supabase
            .from('profiles')
            .select('id, xp, is_premium')
            .eq('id', uid)
            .maybeSingle();

          if (pErr) {
            console.warn('profiles load error', pErr);
          } else if (p) {
            const xp = Number((p as any).xp ?? 0);
            setProfile(p as ProfileRow);
            setIsPremium(!!(p as any).is_premium);
            setTotalXP(xp);
            setLevel(Math.floor(xp / XP_PER_LEVEL) + 1);
          }

          // carteira
          const { data: w, error: wErr } = await supabase
            .from('user_wallet')
            .select('coins')
            .eq('user_id', uid)
            .maybeSingle();

          if (wErr) {
            console.warn('wallet load error', wErr);
          } else if (w) {
            setWalletCoins(Number((w as any).coins ?? 0));
          }

          // user_missions (se já completou)
          try {
            const { data: um, error: umErr } = await supabase
              .from('user_missions')
              .select('mission_id, completed, completed_at, status')
              .eq('user_id', uid);

            if (umErr) {
              console.warn('user_missions load error', umErr);
            } else if (um) {
              const map: Record<string, boolean> = {};
              (um as any[]).forEach((row) => {
                const mid = String(row.mission_id);
                if (isDoneFromUserMissionRow(row)) map[mid] = true;
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
        const { data: mData, error: mErr } = await supabase
          .from('missions')
          .select('*')
          .order('id', { ascending: true });

        if (mErr) {
          console.error('missions load error', mErr);
          setMissions([]);
          setErrorMsg('Não foi possível carregar as missões.');
        } else {
          const list = ((mData as MissionRow[]) ?? []) as MissionRow[];
          setMissions(list);

          // missão semanal da semana (renova na segunda-feira)
          try {
            let chosen: MissionRow | null = null;

            // A tabela `missions` pode ter muitas linhas; então a semanal precisa ser buscada com filtro.
            const { data: wExact, error: wExactErr } = await supabase
              .from('missions')
              .select('*')
              .eq('type', 'weekly')
              .eq('day_index', weeklyIndex)
              .maybeSingle();

            if (wExactErr) console.warn('weekly exact load error', wExactErr);
            if (wExact) chosen = (wExact as MissionRow) ?? null;

            // fallback: pega qualquer semanal cadastrada
            if (!chosen) {
              const { data: wAny, error: wAnyErr } = await supabase
                .from('missions')
                .select('*')
                .eq('type', 'weekly')
                .order('day_index', { ascending: true })
                .limit(1)
                .maybeSingle();

              if (wAnyErr) console.warn('weekly fallback load error', wAnyErr);
              if (wAny) chosen = (wAny as MissionRow) ?? null;
            }

            setWeeklyMission(chosen);

            if (uid && chosen) {
              // garante a linha em user_missions
              try {
                await supabase.rpc('ensure_user_mission', {
                  p_user_id: uid,
                  p_mission_id: Number(chosen.id),
                  p_source: 'weekly',
                } as any);
                  } catch (e) {
                console.warn('ensure_user_mission weekly falhou (ignorado):', e);
              }

              const { data: umw, error: umwErr } = await supabase
                .from('user_missions')
                .select('progress')
                .eq('user_id', uid)
                .eq('mission_id', Number(chosen.id))
                .maybeSingle();

              if (umwErr) console.warn('weekly user_missions load error', umwErr);

              const norm = normalizeWeeklyProgress((umw as any)?.progress, weekInfo.weekKey);

              // se mudou a semana, reseta no banco (mantendo rewarded_week_key antigo se tiver)
              if ((umw as any)?.progress && String((umw as any).progress?.week_key ?? '') !== weekInfo.weekKey) {
                try {
                  await supabase
                    .from('user_missions')
                    .update({ progress: norm as any, status: 'pending', last_update: new Date().toISOString() })
                    .eq('user_id', uid)
                    .eq('mission_id', Number(chosen.id));
                    } catch (e) {
                  console.warn('weekly progress reset update falhou (ignorado):', e);
                }
              }

              setWeeklyProgress(norm);
              setWeeklyDoneThisWeek(norm.rewarded_week_key === weekInfo.weekKey);
            } else {
              setWeeklyProgress((prev) => ({ ...prev, week_key: weekInfo.weekKey }));
              setWeeklyDoneThisWeek(false);
            }
              } catch (e) {
            console.warn('weekly load catch', e);
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



  // ---------------- FALBACK PARA COMPLETAR MISSÃO ----------------

  async function fallbackCompleteMission(
    m: MissionRow,
    answerText?: string,
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    if (!userId) {
      return { success: false, message: 'Faça login para completar missões.' };
    }

    const missionKey = String(m.id);
    const xp = getXpFromMission(m);
    const coins = getCoinsFromMission(m);

    try {
      const nowIso = new Date().toISOString();

      // marca em user_missions (controle geral de missão concluída)
      try {
        await supabase.from('user_missions').upsert(
          [
            {
              user_id: userId,
              mission_id: m.id,
              completed: true,
              completed_at: nowIso,
            } as any,
          ],
          { onConflict: 'user_id,mission_id' },
        );
      } catch (err) {
        console.warn('user_missions upsert error (ignorado):', err);
      }

      // histórico textual da missão (não editável)
      try {
        if (answerText && answerText.trim().length >= MIN_ANSWER_LENGTH) {
          await supabase.from('mission_journal').insert([
            {
              user_id: userId,
              mission_id: m.id,
              answered_text: answerText.trim(),
              day_key: todayDayKey,
            } as any,
          ]);
        }
      } catch (err) {
        console.warn('mission_journal insert error (ignorado):', err);
      }

      // atualiza XP no perfil
      try {
        if (xp > 0) {
          const oldXp =
            (profile?.xp != null ? Number(profile.xp) : totalXP) || 0;
          const newXp = oldXp + xp;

          const { error: upErr } = await supabase
            .from('profiles')
            .update({ xp: newXp })
            .eq('id', userId);

          if (upErr) {
            console.warn('profiles xp update error:', upErr);
          } else {
            setTotalXP(newXp);
            setLevel(Math.floor(newXp / XP_PER_LEVEL) + 1);
            setProfile((prev) =>
              prev ? { ...prev, xp: newXp } : { id: userId, xp: newXp },
            );
          }
        }
      } catch (err) {
        console.warn('XP update catch:', err);
      }

      // atualiza coins na wallet
      try {
        if (coins > 0) {
          const newCoins = walletCoins + coins;
          const { error: wErr } = await supabase.from('user_wallet').upsert(
            [{ user_id: userId, coins: newCoins } as any],
            { onConflict: 'user_id' },
          );
          if (wErr) {
            console.warn('user_wallet upsert error:', wErr);
          } else {
            setWalletCoins(newCoins);
          }
        }
      } catch (err) {
        console.warn('Coins update catch:', err);
      }

      // log em user_rewards_log (se a tabela/colunas baterem)
      try {
        if (xp > 0 || coins > 0) {
          await supabase.from('user_rewards_log').insert([
            {
              user_id: userId,
              source: 'missions',
              event: 'mission_complete',
              xp_delta: xp,
              coins_delta: coins,
              metadata: { mission_id: m.id, title: m.title },
            } as any,
          ]);
        }
      } catch (err) {
        console.warn('user_rewards_log insert error (ignorado):', err);
      }

      setCompletedMap((prev) => ({ ...prev, [missionKey]: true }));
      return { success: true };
    } catch (err) {
      console.error('fallbackCompleteMission erro:', err);
      return { success: false, message: 'Erro ao completar missão (fallback).' };
    }
  }

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
      let ok = false;

      // tenta RPC (se existir), senão cai pro fallback
      try {
        const { error: rpcErr } = await supabase.rpc('complete_mission', {
          // ✅ assinatura no seu banco: complete_mission(p_user uuid, p_mission_id bigint)
          p_user: userId,
          p_mission_id: Number(m.id),
        } as any);
        if (!rpcErr) {
          ok = true;
        } else {
          console.warn('complete_mission RPC error, usando fallback:', rpcErr);
        }
      } catch (err) {
        console.warn('complete_mission RPC falhou, usando fallback:', err);
      }

      if (!ok) {
        const fb = await fallbackCompleteMission(m, answerText);
        if (!fb.success) {
          throw new Error(fb.message || 'Não foi possível completar a missão.');
        }
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

      // salva a resposta (se houver) e marca localmente como concluída
      if ((answerText || '').trim().length >= MIN_ANSWER_LENGTH) {
        await persistMissionAnswer(m, todayDayKey, answerText);
        try {
          if (userId) localStorage.removeItem(getDraftKey(userId, String(m.id)));
            } catch (e) {
          // ignore
        }
      }

      setCompletedMap((prev) => ({ ...prev, [key]: true }));
              // Anti-farm: registra local + marca como concluída no banco (caso a RPC não atualize o user_missions)
              writeLocalCompleted(userId, key, todayDayKey);

              try {
                const nowIso = new Date().toISOString();

                const { data: curRow } = await supabase
                  .from('user_missions')
                  .select('progress')
                  .eq('user_id', userId)
                  .eq('mission_id', Number(m.id))
                  .maybeSingle();

                const curProgress =
                  (curRow as any)?.progress && typeof (curRow as any).progress === 'object'
                    ? (curRow as any).progress
                    : {};

                const nextProgress: any = { ...curProgress, day_key: todayDayKey };

                if (answerText.trim()) {
                  nextProgress.answer_text = answerText.trim();
                  nextProgress.answer_saved_at = nowIso;
                }

                await supabase.from('user_missions').upsert(
                  [
                    {
                      user_id: userId,
                      mission_id: Number(m.id),
                      completed: true,
                      status: 'completed',
                      completed_at: nowIso,
                      last_update: nowIso,
                      progress: nextProgress,
                    },
                  ],
                  { onConflict: 'user_id,mission_id' } as any
                );
              } catch (e) {
                console.warn('Falha ao marcar missão como concluída no DB (ignorado):', e);
              }

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

    if ((weeklyProgress?.count ?? 0) < requiredDays) {
      setErrorMsg(`Você precisa marcar ${requiredDays}/${requiredDays} dias desta semana para concluir.`);
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
      // ✅ recomendado: criar RPC no banco. Se não existir, cai no fallback.
      let ok = false;

      try {
        const { data, error } = await supabase.rpc('complete_weekly_mission', {
          p_user: userId,
          p_mission_id: Number(weeklyMission.id),
          p_week_key: weekInfo.weekKey,
        } as any);

        if (!error && data) {
          const row = Array.isArray(data) ? data[0] : data;
          if (row?.success) ok = true;
          if (!row?.success && row?.message) setErrorMsg(row.message);
        }
          } catch (e) {
        // ignora e tenta fallback
      }

      if (!ok) {
        const xp = getXpFromMission(weeklyMission);
        const coins = getCoinsFromMission(weeklyMission);

        // credita recompensa
        await supabase.rpc('log_user_reward', {
          p_user: userId,
          p_mission_id: Number(weeklyMission.id),
          p_title: weeklyMission.title,
          p_reward_xp: xp,
          p_reward_coins: coins,
          p_metadata: { week_key: weekInfo.weekKey, type: 'weekly' },
        } as any);

        // marca como "recompensa coletada nesta semana"
        const newProgress: WeeklyProgress = {
          ...weeklyProgress,
          week_key: weekInfo.weekKey,
          rewarded_week_key: weekInfo.weekKey,
          required_days: requiredDays,
        };

        await supabase
          .from('user_missions')
          .update({
            progress: newProgress as any,
            status: 'concluida',
            last_update: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('mission_id', Number(weeklyMission.id));

        setWeeklyProgress(newProgress);
      }

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

    const byIndex = dailyMissionsRaw.find(
      (m) => (m.day_index || 0) === todayIndex,
    );
    if (byIndex) return byIndex;

    // fallback: se ninguém tem day_index igual ao dia, pega a primeira
    return dailyMissionsRaw[0];
  }, [dailyMissionsRaw, todayIndex]);

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
                Complete missões diárias e semanais para ganhar XP e moedas dentro do Weed Reset.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* RESUMO XP / NIVEL / COINS */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 border border-purple-300/50 p-4 flex flex-col gap-2 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-purple-50">
                Nível
              </span>
              <Trophy className="w-4 h-4 text-purple-50" />
            </div>
            <div className="text-2xl font-bold text-white">
              {level}
            </div>
            <div className="text-[11px] text-purple-100/90">
              {totalXP} XP • próximo nível em{' '}
              {Math.max(0, level * XP_PER_LEVEL - totalXP)} XP
            </div>
          </div>

          <div className="rounded-2xl bg-white/95 border border-purple-100 p-4 flex flex-col gap-2 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-purple-600">
                XP Total
              </span>
              <Star className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {totalXP}
            </div>
            <div className="text-[11px] text-gray-600">
              Ganho de XP vem de missões, SOS e outras ações dentro do app.
            </div>
          </div>

          <div className="rounded-2xl bg-white/95 border border-amber-100 p-4 flex flex-col gap-2 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-amber-600">
                Moedas
              </span>
              <Coins className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {walletCoins}
            </div>
            <div className="text-[11px] text-gray-600">
              Use suas moedas na loja para desbloquear temas, molduras e mais.
            </div>
          </div>
        </section>

        {/* AVISO LOGIN */}
        {authChecked && !userId && (
          <section className="rounded-2xl border border-purple-500/30 bg-white/5 px-4 py-3 text-xs sm:text-sm text-purple-50 flex flex-col sm:flex-row sm:items-center gap-2">
            <span>
              Para registrar suas missões e receber recompensas, é
              recomendado fazer login ou criar uma conta.
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
            })();
          }}
        />

        {/* MISSÃO DIÁRIA DO DIA */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm sm:text-base font-semibold text-white">
                Missão diária de hoje
              </h2>
            </div>
            <span className="text-[11px] text-purple-100/80">
              {todayDayKey.split('-').reverse().join('/')}
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
                      {m.title}
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
                        <span className="opacity-80">Após concluir, o texto fica travado.</span>
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
                          return saved || '—';
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
                        (missionRequiresAnswer(m) && answerTooShort) ||
                        !userId
                      }
                      onClick={() => handleCompleteMission(m)}
                      className={`px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
                        done
                          ? 'bg-emerald-500/15 text-emerald-100 border border-emerald-400/20 cursor-default'
                          : processing[key]
                          ? 'bg-purple-500/15 text-purple-100 border border-purple-400/20 cursor-wait'
                          : (missionRequiresAnswer(m) && answerTooShort) || !userId
                          ? 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border border-purple-500/60 hover:opacity-90'
                      }`}
                    >
                      {done ? (
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
                          Completar missão
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })()
          )}
        </section>

        {/* MISSÕES SEMANAIS */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-sky-300" />
              <h2 className="text-sm sm:text-base font-semibold text-white">
                Missão semanal (renova toda segunda)
              </h2>
            </div>
            <p className="text-[11px] text-zinc-300/80">
              Semana {weekInfo.isoWeek} • {weekInfo.weekKey}
            </p>
          </div>

          {!weeklyMission ? (
            <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-zinc-300">
              Nenhuma missão semanal cadastrada no momento. (Crie missões com{' '}
              <code className="mx-1">type = 'weekly'</code> e{' '}
              <code className="mx-1">day_index = 1..55</code>)
            </div>
          ) : (
            <article className="rounded-2xl bg-white/5 border border-white/10 px-4 sm:px-5 py-4 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/15 flex items-center justify-center text-sky-200">
                  <Trophy className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white truncate">
                      {weeklyMission.title}
                    </h3>
                    {weeklyDoneThisWeek ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-100 border border-emerald-400/20">
                        Concluída nesta semana
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-100 border border-sky-400/20">
                        Check-in diário
                      </span>
                    )}
                  </div>

                  {weeklyMission.description ? (
                    <p className="text-sm text-white/70 mt-1 whitespace-pre-line">
                      {weeklyMission.description}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-100 border border-purple-400/20 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" /> {getXpFromMission(weeklyMission)} XP
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-100 border border-amber-400/20 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5" /> {getCoinsFromMission(weeklyMission)} moedas
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/10">
                      {weeklyProgress.count}/{weeklyRequiredDays} dias marcados
                    </span>
                  </div>

                  {/* Ação principal: não depender dos pequenos quadrados para descobrir o check-in. */}
                  <div className="mt-4 max-w-xl rounded-2xl border border-sky-400/30 bg-sky-400/[.07] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-white">
                          {weeklyProgress.checkins?.[todayDayKey]
                            ? 'Check-in semanal de hoje realizado!'
                            : 'Já fez sua ação anti-gatilho hoje?'}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-300">
                          {weeklyProgress.checkins?.[todayDayKey]
                            ? 'Muito bem! Volte amanhã para dar o próximo passo.'
                            : 'Marque seu dia e acompanhe o progresso da missão semanal.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleWeeklyCheckin()}
                        disabled={!userId || weeklyDoneThisWeek || !!weeklyProgress.checkins?.[todayDayKey] || !!processing[`weekly:${String(weeklyMission.id)}`]}
                        className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-3 text-sm font-extrabold text-sky-950 shadow-[0_8px_20px_rgba(56,189,248,.18)] transition-all hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/40 disabled:cursor-not-allowed disabled:bg-emerald-500/15 disabled:text-emerald-100 disabled:shadow-none"
                      >
                        {!!processing[`weekly:${String(weeklyMission.id)}`]
                          ? <><Clock className="h-4 w-4 animate-spin" /> Salvando...</>
                          : weeklyProgress.checkins?.[todayDayKey]
                            ? <><CheckCircle className="h-4 w-4" /> Dia marcado</>
                            : <><CheckCircle className="h-4 w-4" /> Marcar dia de hoje</>}
                      </button>
                    </div>
                    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-700" role="progressbar"
                      aria-label="Progresso da missão semanal" aria-valuemin={0}
                      aria-valuemax={weeklyRequiredDays} aria-valuenow={Math.min(weeklyRequiredDays, weeklyProgress.count)}>
                      <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-[width] duration-500"
                        style={{ width: `${Math.min(100, (weeklyProgress.count / Math.max(1,weeklyRequiredDays)) * 100)}%` }} />
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-300">
                      {weeklyProgress.count} de {weeklyRequiredDays} dias marcados nesta missão.
                    </p>
                  </div>

                  {/* Dias: hoje claramente clicável, concluídos com check e futuros bloqueados. */}
                  <div className="mt-3 grid w-full max-w-xl grid-cols-7 gap-1.5 sm:gap-2">
                    {(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const).map((label, idx) => {
                      const dayKey = weekInfo.days[idx];
                      const checked = !!weeklyProgress.checkins?.[dayKey];
                      const isToday = dayKey === todayDayKey;

                      const disabled =
                        !userId ||
                        weeklyDoneThisWeek ||
                        checked ||
                        !isToday;

                      return (
                        <button
                          key={dayKey}
                          type="button"
                          onClick={() => {
                            if (!disabled) handleWeeklyCheckin();
                          }}
                          className={[
                            'relative flex min-h-[78px] flex-col items-center justify-center rounded-xl border px-1 py-2 text-center text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 sm:min-h-[86px]',
                            checked
                              ? 'bg-emerald-600/25 text-emerald-100 border-emerald-400/60'
                              : isToday
                                ? 'bg-sky-400/20 border-sky-300 text-sky-50 ring-2 ring-sky-400/20 hover:-translate-y-0.5 hover:bg-sky-400/30'
                                : 'bg-slate-900 border-slate-700 text-slate-400 cursor-not-allowed',
                          ].join(' ')}
                          title={
                            checked
                              ? `Marcado (${dayKey})`
                              : isToday
                                ? `Marcar hoje (${dayKey})`
                                : `Volte no dia (${dayKey})`
                          }
                        >
                          <div className="font-bold">{label}</div>
                          <div className="mt-1 text-[10px] opacity-90">{dayKey.slice(8, 10)}/{dayKey.slice(5, 7)}</div>
                          {checked ? <CheckCircle className="mt-1 h-4 w-4 text-emerald-200" />
                            : isToday ? <span className="mt-1 text-[9px] font-extrabold text-sky-200">HOJE</span>
                              : <span className="mt-1 h-4" />}
                        </button>
                      );
                    })}
                  </div>

                  {(() => {
                    const t = new Date();
                    const y = new Date(t);
                    y.setDate(t.getDate() - 1);
                    const yKey = getLocalDayKey(y);

                    const canRetro =
                      !!userId &&
                      !!weeklyMission &&
                      !weeklyDoneThisWeek &&
                      weekInfo.days.includes(yKey) &&
                      !weeklyProgress.checkins?.[yKey] &&
                      !weeklyProgress.retro_used;

                    if (!canRetro) return null;

                    const busy = !!processing[`weeklyRetro:${String(weeklyMission.id)}`];

                    return (
                      <div className="mt-3 max-w-md">
                        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="text-sm text-amber-100/90 leading-relaxed">
                              Esqueceu de marcar <b>ontem</b>? Você tem <b>1 tolerância por semana</b>.
                            </div>

                            <button
                              type="button"
                              onClick={() => handleWeeklyRetroCheckin()}
                              disabled={busy}
                              className={[
                                'rounded-xl px-3 py-2 text-xs font-semibold transition',
                                busy
                                  ? 'bg-amber-400/30 text-amber-100/80 cursor-not-allowed'
                                  : 'bg-amber-500 text-black hover:bg-amber-400',
                              ].join(' ')}
                            >
                              {busy ? 'Salvando...' : 'Marcar ontem'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <p className="mt-3 max-w-xl rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs leading-relaxed text-slate-200">
                    <strong className="text-white">Como funciona:</strong> marque o dia atual após realizar a atividade.
                    Se esquecer de registrar ontem, você tem uma tolerância por semana.
                    Um dia não marcado não apaga suas conquistas anteriores.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {weeklyDoneThisWeek ? (
                    <button
                      type="button"
                      className="px-4 py-2 rounded-full bg-emerald-500/15 text-emerald-100 border border-emerald-400/20 font-medium text-sm"
                      disabled
                    >
                      ✅ Concluída
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleWeeklyComplete}
                      disabled={
                        !userId ||
                        processing[`weeklyComplete:${String(weeklyMission.id)}`] ||
                        weeklyProgress.count < weeklyRequiredDays
                      }
                      className={[
                        'px-4 py-2 rounded-full font-medium text-sm border transition',
                        weeklyProgress.count >= weeklyRequiredDays
                          ? 'bg-sky-600 text-white border-sky-600 hover:bg-sky-700'
                          : 'bg-white/5 text-white/40 border-white/10 cursor-not-allowed',
                      ].join(' ')}
                      title={
                        weeklyProgress.count >= weeklyRequiredDays
                          ? 'Concluir semana e coletar recompensa'
                          : `Marque ${weeklyRequiredDays}/${weeklyRequiredDays} dias para liberar`
                      }
                    >
                      {processing[`weeklyComplete:${String(weeklyMission.id)}`]
                        ? 'Processando...'
                        : 'Concluir semana'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          )}
        </section>

        {/* MISSÕES PREMIUM */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-400" />
              <h2 className="text-sm sm:text-base font-semibold text-white">
                Missão Premium de hoje
              </h2>
            </div>
            <span className="text-[11px] text-purple-100/80">
              Recompensas maiores para assinantes Weed Reset Premium
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
                  className="rounded-3xl bg-white/5 border border-yellow-400/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 shadow-2xl"
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

                {/* Histórico de respostas (missão diária) */}
                <section className="mt-6">
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
                                {it.source === 'db' ? 'sync' : 'local'}
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