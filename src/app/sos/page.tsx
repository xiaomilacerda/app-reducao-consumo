'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Heart,
  Wind,
  Target,
  Crown,
  Lock,
  Clock,
  Flame,
  Search,
  Filter,
  ChevronDown,
  BookOpen,
  ArrowRight,
  Leaf,
  Moon,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import SosPlayer from '@/components/SosPlayer';
import SosQuickHelp from '@/components/sos/SosQuickHelp';
import ProfileSupportReminder from '@/components/profile/ProfileSupportReminder';
import ProfileActionNotice from '@/components/profile/ProfileActionNotice';

type ThemeMode = 'default' | 'focus';

type SosTool = {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  duration_minutes: number | null;
  thumbnail: string | null;
  tags: string[] | null;
  premium_only: boolean | null;
  steps_json: string[] | null;

  // NOVO: curtidas globais (todos usuários)
  likes_count?: number;
};

type SosLikeAgg = {
  sos_id: number;
  total_likes: number;
};

type SosLog = {
  id: number | string;
  tool_id: number;
  duration: number | null; // em segundos
  used_at: string; // timestamp
};

// tempo mínimo (em segundos) para registrar no histórico
const MIN_SECONDS_TO_LOG = 30;

// Escolhe um EMOJI baseado no título/categoria/tags da técnica
function getEmojiForTool(tool: SosTool): string {
  const base = (
    (tool.title || '') +
    ' ' +
    (tool.category || '') +
    ' ' +
    ((tool.tags || []).join(' '))
  ).toLowerCase();

  if (base.includes('grounding') || base.includes('visual')) return '👁️';
  if (base.includes('gatilho')) return '🛡️';
  if (base.includes('ansiedade') || base.includes('crise')) return '😰';
  if (base.includes('respira') || base.includes('respiração')) return '🌬️';
  if (base.includes('sono') || base.includes('dormir') || base.includes('sleep')) return '🌙';
  if (base.includes('corpo') || base.includes('tensão') || base.includes('relax')) return '🍃';
  if (base.includes('pensamento') || base.includes('mental') || base.includes('cbt')) return '🧠';
  if (base.includes('urge') || base.includes('vontade')) return '🔥';
  if (base.includes('meditação') || base.includes('mindfulness')) return '🪷';
  if (base.includes('caminh') || base.includes('exercise')) return '🚶';
  if (base.includes('audio') || base.includes('som')) return '🎧';
  if (base.includes('distraction') || base.includes('distração')) return '🧩';
  return '✨';
}

function normalizeCategory(s: string | null): string {
  const v = (s || '').trim();
  return v ? v : 'Outros';
}

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `agora mesmo`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia(s)`;
}

export default function SosPage() {
  // ----- ESTADO BÁSICO / USUÁRIO / TEMA -----
  const [mounted, setMounted] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('default');

  const [supabaseUser, setSupabaseUser] = useState<any | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  // ----- EXERCÍCIOS LOCAIS -----
  const [activeExercise, setActiveExercise] = useState<
    'breathing' | 'focus' | 'calm' | null
  >(null);

  const [breathingPhase, setBreathingPhase] = useState<
    'inhale' | 'hold' | 'exhale'
  >('inhale');
  const [breathingCount, setBreathingCount] = useState(4);

  const [focusTimer, setFocusTimer] = useState(60);

  // ----- FERRAMENTAS SOS DO BANCO -----
  const [tools, setTools] = useState<SosTool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<SosTool | null>(null);
  const [sosSuccess, setSosSuccess] = useState<string | null>(null);
  const [sosError, setSosError] = useState<string | null>(null);
  const dismissSosNotice = useCallback(() => {
    setSosSuccess(null);
    setSosError(null);
  }, []);

  // ----- NOVO: Curtidas globais + minhas curtidas -----
  const [myLikes, setMyLikes] = useState<Set<number>>(new Set());
  const [likesReady, setLikesReady] = useState(false);
  const [likesBusy, setLikesBusy] = useState<Set<number>>(new Set());

  // ----- NOVO: Organização (busca, categoria, filtro) -----
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Todas');
  const [sortMode, setSortMode] = useState<'popular' | 'favorites' | 'recent'>(
    'popular',
  );

  // ----- NOVO: Histórico breve (mais claro) -----
  const [recentLogs, setRecentLogs] = useState<SosLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const [quickFilter, setQuickFilter] = useState<'all' | 'free' | 'short' | 'guided'>('all');
  useEffect(() => setVisibleCount(12), [search, activeCategory, sortMode, quickFilter]);

  // ---------------- EFFECTS BÁSICOS ----------------

  // Montagem + resgatar tema do storage
  useEffect(() => {
    setMounted(true);
    const local = storage.getUserData();
    if (local?.themeMode === 'focus' || local?.themeMode === 'default') {
      setThemeMode(local.themeMode);
    }
  }, []);

  // Checar sessão Supabase + status premium
  useEffect(() => {
    let cancelled = false;

    async function loadAuth() {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user ?? null;
        if (cancelled) return;

        setSupabaseUser(user);

        if (user) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('is_premium')
            .eq('id', user.id)
            .maybeSingle();

          if (!cancelled) {
            if (error) {
              console.error('Erro carregando profile em /sos:', {
                message: (error as any)?.message,
                details: (error as any)?.details,
                hint: (error as any)?.hint,
                code: (error as any)?.code,
              });
            }
            setIsPremium(!!profile?.is_premium);
          }
        }
      } catch (err: any) {
        console.error('Erro auth /sos:', err?.message || err);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    }

    loadAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  // Carregar sos_tools + curtidas globais (view) em paralelo
  useEffect(() => {
    let cancelled = false;

    async function loadToolsAndLikes() {
      setToolsLoading(true);
      try {
        const toolsReq = supabase
          .from('sos_tools')
          .select(
            'id, title, description, category, duration_minutes, thumbnail, tags, premium_only, steps_json, created_at',
          )
          .order('created_at', { ascending: true });

        const likesReq = supabase
          .from('sos_likes_aggregates')
          .select('sos_id, total_likes');

        const [toolsRes, likesRes] = await Promise.all([toolsReq, likesReq]);

        if (cancelled) return;

        if (toolsRes.error) {
          console.error('Erro carregando sos_tools:', {
            message: (toolsRes.error as any)?.message,
            details: (toolsRes.error as any)?.details,
            hint: (toolsRes.error as any)?.hint,
            code: (toolsRes.error as any)?.code,
          });
          setTools([]);
          return;
        }

        const rawTools = (toolsRes.data as any[]) ?? [];
        const likeMap = new Map<number, number>();

        if (!likesRes.error) {
          const rows = (likesRes.data as SosLikeAgg[]) ?? [];
          for (const r of rows) likeMap.set(Number(r.sos_id), Number(r.total_likes) || 0);
        } else {
          // Se view ainda não existir, continua com 0 curtidas
          console.warn('Não consegui carregar sos_likes_aggregates (talvez não criada ainda).', {
            message: (likesRes.error as any)?.message,
            code: (likesRes.error as any)?.code,
          });
        }

        const merged: SosTool[] = rawTools.map((t) => ({
          id: Number(t.id),
          title: (t.title as string) || 'Ferramenta SOS',
          description: t.description ?? null,
          category: t.category ?? null,
          duration_minutes: t.duration_minutes ?? null,
          thumbnail: t.thumbnail ?? null,
          tags: t.tags ?? null,
          premium_only: t.premium_only ?? null,
          steps_json: t.steps_json ?? null,
          likes_count: likeMap.get(Number(t.id)) ?? 0,
        }));

        setTools(merged);
      } catch (err: any) {
        console.error('Erro inesperado sos_tools/likes:', err?.message || err);
        if (!cancelled) setTools([]);
      } finally {
        if (!cancelled) setToolsLoading(false);
      }
    }

    loadToolsAndLikes();
    return () => {
      cancelled = true;
    };
  }, []);

  // Carregar minhas curtidas (se logado)
  useEffect(() => {
    let cancelled = false;

    async function loadMyLikes() {
      setLikesReady(false);

      if (!supabaseUser) {
        setMyLikes(new Set());
        setLikesReady(true);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('sos_likes')
          .select('sos_id')
          .eq('user_id', supabaseUser.id);

        if (cancelled) return;

        if (error) {
          console.error('Erro carregando minhas curtidas (sos_likes):', {
            message: (error as any)?.message,
            details: (error as any)?.details,
            hint: (error as any)?.hint,
            code: (error as any)?.code,
          });
          setMyLikes(new Set());
        } else {
          const s = new Set<number>((data ?? []).map((x: any) => Number(x.sos_id)));
          setMyLikes(s);
        }
      } catch (e: any) {
        console.error('Erro inesperado minhas curtidas:', e?.message || e);
        if (!cancelled) setMyLikes(new Set());
      } finally {
        if (!cancelled) setLikesReady(true);
      }
    }

    loadMyLikes();
    return () => {
      cancelled = true;
    };
  }, [supabaseUser]);

  // Histórico rápido (últimas 3 sessões) - CORRIGIDO para seu schema
  useEffect(() => {
    let cancelled = false;

    async function loadRecentLogs() {
      setRecentLogs([]);
      if (!supabaseUser) return;

      setLogsLoading(true);
      try {
        const { data, error } = await supabase
          .from('sos_logs')
          .select('id, tool_id, duration, used_at')
          .eq('user_id', supabaseUser.id)
          .order('used_at', { ascending: false })
          .limit(3);

        if (cancelled) return;

        if (error) {
          console.error('Erro carregando sos_logs recentes:', {
            message: (error as any)?.message,
            details: (error as any)?.details,
            hint: (error as any)?.hint,
            code: (error as any)?.code,
          });
          setRecentLogs([]);
        } else {
          setRecentLogs((data as any[]) ?? []);
        }
      } catch (e: any) {
        console.error('Erro inesperado logs:', e?.message || e);
        if (!cancelled) setRecentLogs([]);
      } finally {
        if (!cancelled) setLogsLoading(false);
      }
    }

    loadRecentLogs();
    return () => {
      cancelled = true;
    };
  }, [supabaseUser]);

  // Animação de respiração 4-7-8
  useEffect(() => {
    if (activeExercise !== 'breathing') return;

    const interval = setInterval(() => {
      setBreathingCount((prev) => {
        if (prev <= 1) {
          if (breathingPhase === 'inhale') {
            setBreathingPhase('hold');
            return 7;
          }
          if (breathingPhase === 'hold') {
            setBreathingPhase('exhale');
            return 8;
          }
          setBreathingPhase('inhale');
          return 4;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeExercise, breathingPhase]);

  // Timer de foco
  useEffect(() => {
    if (activeExercise !== 'focus') return;
    if (focusTimer <= 0) return;

    const interval = setInterval(() => {
      setFocusTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeExercise, focusTimer]);

  // ---------------- Curtir (global) ----------------
  async function toggleLike(toolId: number) {
    if (!supabaseUser) {
      setSosError('Entre em sua conta para salvar favoritas e sessões no histórico.');
      return;
    }
    if (likesBusy.has(toolId) || !likesReady) return;
    setLikesBusy(prev => new Set(prev).add(toolId));
    setSosError(null);
    const already = myLikes.has(toolId);

    // UI otimista
    setMyLikes((prev) => {
      const next = new Set(prev);
      if (already) next.delete(toolId);
      else next.add(toolId);
      return next;
    });

    setTools((prev) =>
      prev.map((t) =>
        t.id === toolId
          ? {
              ...t,
              likes_count: Math.max(0, Number(t.likes_count || 0) + (already ? -1 : 1)),
            }
          : t,
      ),
    );

    try {
      if (already) {
        const { error } = await supabase
          .from('sos_likes')
          .delete()
          .eq('user_id', supabaseUser.id)
          .eq('sos_id', toolId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sos_likes')
          .insert({ user_id: supabaseUser.id, sos_id: toolId });

        if (error) throw error;
      }
    } catch (e: any) {
      console.error('Erro ao curtir/descurtir:', {
        message: e?.message,
        details: e?.details,
        hint: e?.hint,
        code: e?.code,
      });

      // rollback
      setMyLikes((prev) => {
        const next = new Set(prev);
        if (already) next.add(toolId);
        else next.delete(toolId);
        return next;
      });

      setTools((prev) =>
        prev.map((t) =>
          t.id === toolId
            ? {
                ...t,
                likes_count: Math.max(0, Number(t.likes_count || 0) + (already ? +1 : -1)),
              }
            : t,
        ),
      );
      setSosError('Não foi possível atualizar esta favorita. Confira a conexão e tente novamente.');
    } finally {
      setLikesBusy(prev => {
        const next = new Set(prev);
        next.delete(toolId);
        return next;
      });
    }
  }

  // ---------------- LÓGICA PARA REGISTRAR NO HISTÓRICO ----------------
  async function handleSosComplete(tool: SosTool, seconds: number): Promise<boolean> {
    if (!supabaseUser) {
      setSosSuccess('Técnica concluída. Para guardar as sessões em outros aparelhos, entre na sua conta.');
      return true;
    }

    const duration = Math.max(0, Math.round(seconds || 0));

    if (duration < MIN_SECONDS_TO_LOG) {
      setSosError('Conclua pelo menos 30 segundos para registrar esta técnica.');
      return false;
    }

    try {
      // Salva e retorna o recibo real do banco, associado ao usuário.
      const { data: saved, error } = await supabase.from('sos_logs')
        .insert({ user_id: supabaseUser.id, tool_id: tool.id, duration })
        .select('id,tool_id,duration,used_at')
        .single();

      if (error || !saved) {
        setSosError('O registro não foi confirmado. Você pode tentar salvar novamente.');
        console.error('Erro ao salvar sessão em sos_logs:', {
          message: (error as any)?.message,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
          code: (error as any)?.code,
        });
        return false;
      } else {
        const nowIso = saved.used_at || new Date().toISOString();
        console.log(
          `[SOS] Sessão da ferramenta "${tool.title}" registrada em sos_logs com ~${duration}s.`,
        );

        // Atualiza histórico rápido local
        setRecentLogs((prev) => [
          { id: saved.id, tool_id: Number(saved.tool_id), duration: Number(saved.duration), used_at: nowIso },
          ...prev,
        ].slice(0, 3));
        setSosError(null);
        setSosSuccess('Sessão concluída e salva no seu histórico da nuvem.');
        return true;
      }
    } catch (err: any) {
      console.error('Erro inesperado ao registrar sessão SOS:', err?.message || err);
      setSosError('Falha de conexão ao salvar a sessão. Tente novamente.');
      return false;
    }
  }

  // ---------------- Derivados (categorias / filtro / ordenação) ----------------
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of tools) set.add(normalizeCategory(t.category));
    const arr = Array.from(set).sort((a, b) => a.localeCompare(b));
    return ['Todas', ...arr];
  }, [tools]);

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase();

    let base = tools;

    if (activeCategory !== 'Todas') {
      base = base.filter((t) => normalizeCategory(t.category) === activeCategory);
    }
    if (quickFilter === 'free') base = base.filter(t => !t.premium_only);
    if (quickFilter === 'short') base = base.filter(t => t.duration_minutes != null && t.duration_minutes > 0 && t.duration_minutes <= 3);
    if (quickFilter === 'guided') base = base.filter(t => Array.isArray(t.steps_json) && t.steps_json.length >= 2);

    if (q) {
      base = base.filter((t) => {
        const blob = (
          (t.title || '') +
          ' ' +
          (t.description || '') +
          ' ' +
          (t.category || '') +
          ' ' +
          ((t.tags || []).join(' '))
        ).toLowerCase();
        return blob.includes(q);
      });
    }

    if (sortMode === 'favorites') {
      base = base.filter((t) => myLikes.has(t.id));
      base = [...base].sort((a, b) => Number(b.likes_count || 0) - Number(a.likes_count || 0));
      return base;
    }

    if (sortMode === 'popular') {
      base = [...base].sort((a, b) => Number(b.likes_count || 0) - Number(a.likes_count || 0));
      return base;
    }

    // recent (fallback por ID desc)
    base = [...base].sort((a, b) => Number(b.id) - Number(a.id));
    return base;
  }, [tools, activeCategory, search, sortMode, myLikes, quickFilter]);

  // A técnica abre em área de foco; a lista não fica mais se expandindo.
  useEffect(() => {
    if (!selectedTool) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedTool(null); };
    window.addEventListener('keydown', key);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', key); };
  }, [selectedTool]);

  const featuredTools = useMemo(() => {
    // Somente opções gratuitas com orientação estruturada: variedade acima de popularidade.
    const eligible = tools.filter(t => !t.premium_only &&
      Array.isArray(t.steps_json) && t.steps_json.length >= 2);
    const selected: SosTool[] = [];
    for (const category of ['grounding', 'breathing', 'distraction']) {
      const match = eligible.find(t => (t.category || '').toLowerCase() === category &&
        !selected.some(item => item.id === t.id));
      if (match) selected.push(match);
    }
    for (const match of eligible) {
      if (selected.length >= 3) break;
      if (!selected.some(t => t.id === match.id)) selected.push(match);
    }
    return selected;
  }, [tools]);

  const showExercise = (name: 'breathing' | 'focus' | 'calm') => {
    setActiveExercise(previous => previous === name ? null : name);
    if (name === 'breathing') {
      setBreathingPhase('inhale');
      setBreathingCount(4);
    }
    if (name === 'focus') setFocusTimer(60);
    // O conteúdo abre logo abaixo dos atalhos. Role até ele, sem procurar.
    window.setTimeout(() => document.getElementById('sos-active-exercise')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 70);
  };

  // ---------------- RENDER ----------------
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  const isFocusMode = themeMode === 'focus';

  return (
    <div
      className={`min-h-screen w-full overflow-x-clip ${
        isFocusMode
          ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900'
          : 'bg-gradient-to-br from-red-50 via-orange-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900'
      }`}
    >
      <ProfileActionNotice success={sosSuccess} error={sosError} onDismiss={dismissSosNotice}/>
      {/* HEADER */}
      <header className="bg-black/40 backdrop-blur-xl shadow-lg sticky top-0 z-40 border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-white/80" />
            </Link>
            <Heart className="h-6 w-6 shrink-0 text-fuchsia-400 sm:h-8 sm:w-8" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
                Modo SOS Anti-Fissura
              </h1>
              <p className="text-xs sm:text-sm text-white/70">
                Ferramentas rápidas para segurar a fissura agora
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/sos/history"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-2 text-xs sm:text-sm rounded-full bg-white dark:bg-gray-900 border border-purple-500/30 text-purple-700 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Clock className="w-4 h-4" />
              Histórico SOS
            </Link>

            {isPremium && (
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-white text-xs sm:text-sm font-semibold">
                <Crown className="w-4 h-4" />
                <span className="hidden sm:inline">Premium</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="mx-auto w-full max-w-5xl min-w-0 space-y-5 px-3 py-5 pb-28 sm:space-y-7 sm:px-6 sm:py-8">
        <SosQuickHelp userId={supabaseUser?.id ?? null} />
        <section aria-label="Técnicas rápidas e sem distração" className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white sm:text-xl">Três formas de cuidar de você</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">Escolha uma prática. Não é necessário concluir uma etapa perfeita.</p>
          </div>
        {/* CARTÕES DE EXERCÍCIO RÁPIDO */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {/* Respiração Guiada */}
          <button
            onClick={() => showExercise('breathing')}
            className={`min-w-0 rounded-2xl border border-white/10 p-3 text-left shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 sm:p-5 ${
              activeExercise === 'breathing'
                ? 'bg-gradient-to-br from-blue-500 to-cyan-600 text-white'
                : 'bg-white dark:bg-gray-800 hover:shadow-2xl'
            }`}
          >
            <Wind
              className={`h-6 w-6 mb-2 sm:h-8 sm:w-8 sm:mb-3 ${
                activeExercise === 'breathing'
                  ? 'text-white'
                  : 'text-blue-500'
              }`}
            />
            <h3
              className={`text-[13px] font-bold leading-tight sm:mb-1 sm:text-lg ${
                activeExercise === 'breathing'
                  ? 'text-white'
                  : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              Respiração 4-7-8
            </h3>
            <p
              className={`sr-only sm:not-sr-only sm:block sm:text-sm ${
                activeExercise === 'breathing'
                  ? 'text-white/90'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Técnica rápida para reduzir ansiedade em poucos minutos.
            </p>
          </button>

          {/* Treino de Foco */}
          <button
            onClick={() => showExercise('focus')}
            className={`min-w-0 rounded-2xl border border-white/10 p-3 text-left shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 sm:p-5 ${
              activeExercise === 'focus'
                ? 'bg-gradient-to-br from-purple-500 to-pink-600 text-white'
                : 'bg-white dark:bg-gray-800 hover:shadow-2xl'
            }`}
          >
            <Target
              className={`h-6 w-6 mb-2 sm:h-8 sm:w-8 sm:mb-3 ${
                activeExercise === 'focus' ? 'text-white' : 'text-purple-500'
              }`}
            />
            <h3
              className={`text-[13px] font-bold leading-tight sm:mb-1 sm:text-lg ${
                activeExercise === 'focus'
                  ? 'text-white'
                  : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              Treino de Foco (1 min)
            </h3>
            <p
              className={`sr-only sm:not-sr-only sm:block sm:text-sm ${
                activeExercise === 'focus'
                  ? 'text-white/90'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Exercício de atenção plena para atravessar a fissura.
            </p>
          </button>

          {/* Pausa guiada, disponível mesmo sem áudio ou conexão. */}
          <button
            onClick={() => showExercise('calm')}
            className={`min-w-0 rounded-2xl border border-white/10 p-3 text-left shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 sm:p-5 ${
              activeExercise === 'calm'
                ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                : 'bg-white dark:bg-gray-800 hover:shadow-2xl'
            }`}
          >
            <Heart
              className={`h-6 w-6 mb-2 sm:h-8 sm:w-8 sm:mb-3 ${
                activeExercise === 'calm' ? 'text-white' : 'text-green-500'
              }`}
            />
            <h3
              className={`text-[13px] font-bold leading-tight sm:mb-1 sm:text-lg ${
                activeExercise === 'calm'
                  ? 'text-white'
                  : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              Pausa de Calma
            </h3>
            <p
              className={`sr-only sm:not-sr-only sm:block sm:text-sm ${
                activeExercise === 'calm'
                  ? 'text-white/90'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Aterre sua atenção no presente, sem áudio nem conexão.
            </p>
          </button>
        </div>
        </section>

        {/* BLOCO DO EXERCÍCIO ATIVO */}
        {activeExercise === 'breathing' && (
          <section id="sos-active-exercise" className="scroll-mt-28 min-w-0 rounded-3xl bg-white p-4 shadow-xl dark:bg-gray-800 sm:p-8 space-y-6">
            <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-4">
              Respiração 4-7-8
            </h2>

            <div className="flex flex-col items-center gap-8">
              <div className="relative h-48 w-48 sm:h-64 sm:w-64">
                <div
                  className={`absolute inset-0 rounded-full transition-all duration-1000 ${
                    breathingPhase === 'inhale'
                      ? 'bg-gradient-to-br from-blue-400 to-cyan-500 scale-100'
                      : breathingPhase === 'hold'
                      ? 'bg-gradient-to-br from-purple-400 to-pink-500 scale-110'
                      : 'bg-gradient-to-br from-green-400 to-emerald-500 scale-75'
                  }`}
                  style={{
                    boxShadow: '0 0 60px rgba(59,130,246,0.5)',
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <div className="mb-2 text-5xl font-bold sm:text-6xl">
                    {breathingCount}
                  </div>
                  <div className="text-xl font-semibold sm:text-2xl">
                    {breathingPhase === 'inhale' && 'Inspire'}
                    {breathingPhase === 'hold' && 'Segure'}
                    {breathingPhase === 'exhale' && 'Expire'}
                  </div>
                </div>
              </div>

              <p className="text-lg text-center text-gray-700 dark:text-gray-300 max-w-xl">
                {breathingPhase === 'inhale' &&
                  'Inspire profundamente pelo nariz enquanto o círculo cresce.'}
                {breathingPhase === 'hold' &&
                  'Segure o ar com calma. Foque apenas na contagem.'}
                {breathingPhase === 'exhale' &&
                  'Expire lentamente pela boca, soltando a tensão do corpo.'}
              </p>
            </div>
          </section>
        )}

        {activeExercise === 'focus' && (
          <section id="sos-active-exercise" className="scroll-mt-28 min-w-0 rounded-3xl bg-white p-4 shadow-xl dark:bg-gray-800 sm:p-8 space-y-6">
            <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-4">
              Treino de Foco (1 minuto)
            </h2>

            <div className="flex flex-col items-center gap-8">
              <div className="text-7xl sm:text-8xl font-bold text-purple-600 dark:text-purple-400">
                {focusTimer}s
              </div>

              <div className="w-full max-w-md">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-600 rounded-full transition-all duration-1000"
                    style={{
                      width: `${((60 - focusTimer) / 60) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="text-center space-y-3 max-w-xl">
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Foque em um ponto fixo (na parede, objeto, ícone...)
                </p>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                  Deixe os pensamentos passarem como nuvens. Não lute contra
                  eles — apenas volte o foco para sua respiração.
                </p>
              </div>

              {focusTimer === 0 && (
                <div className="mt-4 text-center p-6 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200/60 dark:border-green-700/60 max-w-xl">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300 mb-2">
                    Parabéns! 🎉
                  </p>
                  <p className="text-base sm:text-lg text-green-700/80 dark:text-green-200/80">
                    Você atravessou mais um pico de fissura sem usar. Isso é
                    exatamente o tipo de treino que muda a sua história.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeExercise === 'calm' && (
          <section id="sos-active-exercise" className="scroll-mt-28 min-w-0 rounded-3xl border border-emerald-300/20 bg-white p-5 shadow-xl dark:bg-gray-800 sm:p-8" aria-label="Pausa guiada de calma">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Pausa de Calma</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              Um exercício sem áudio, disponível imediatamente. Faça no seu ritmo e mantenha a respiração confortável.
            </p>
            <ol className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ['Apoie os pés', 'Perceba o contato dos pés com o chão. Sinta o peso do corpo.'],
                ['Olhe ao redor', 'Identifique três coisas que você consegue ver neste momento.'],
                ['Solte a tensão', 'Relaxe os ombros e respire suavemente algumas vezes, sem prender o ar.'],
              ].map(([title, guidance], index) => (
                <li key={title} className="rounded-2xl border border-emerald-300/20 bg-emerald-50 p-4 dark:bg-emerald-950/20">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">PASSO {index + 1}</p>
                  <h3 className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{guidance}</p>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-gray-600 dark:text-gray-300">
              Você pode repetir a sequência ou escolher outra técnica. Não é necessário se sentir melhor imediatamente.
            </p>
            <button type="button" onClick={() => setActiveExercise(null)}
              className="mt-4 min-h-11 rounded-xl border border-emerald-600/25 bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Encerrar minha pausa
            </button>
          </section>
        )}

        <details className="group overflow-hidden rounded-2xl border border-emerald-300/15 bg-[#122622] text-white">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0"><span className="block text-sm font-semibold">Meu plano pessoal de apoio</span>
              <span className="mt-1 block text-xs text-emerald-100/70">Meus gatilhos e ações que me ajudam, quando precisar.</span>
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 text-emerald-300 transition-transform group-open:rotate-180"/>
          </summary>
          <div className="px-2 pb-3 sm:px-3">
            <ProfileSupportReminder userId={supabaseUser?.id ?? null}/>
          </div>
        </details>

        {/* Três indicações gratuitas com instruções cadastradas no banco. */}
        <section aria-label="Técnicas sugeridas" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">Descubra no seu ritmo</p>
              <h2 className="mt-1 text-lg font-bold text-white sm:text-xl">Três boas opções para conhecer</h2>
              <p className="mt-1 text-xs text-slate-400">Gratuitas, com passos disponíveis. Você escolhe quando começar.</p>
            </div>
          </div>
          {toolsLoading ? <div className="grid gap-3 sm:grid-cols-3">
            {[0,1,2].map(i=><div key={i} className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/5"/>)}
          </div> : featuredTools.length ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {featuredTools.map(t=>(
                <button type="button" key={t.id} onClick={()=>setSelectedTool(t)}
                  className="group flex min-w-0 flex-col items-start rounded-2xl border border-white/10 bg-[#212b3c] p-4 text-left text-white transition hover:border-violet-300/40 hover:bg-[#28364b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-400/10 text-2xl" aria-hidden="true">{getEmojiForTool(t)}</span>
                    <span className="text-[11px] font-semibold text-emerald-300">Gratuita</span>
                  </span>
                  <span className="mt-3 line-clamp-2 text-sm font-semibold leading-snug">{t.title}</span>
                  <span className="mt-2 text-xs text-slate-300">Passo a passo guiado · {t.duration_minutes && t.duration_minutes > 0 ? t.duration_minutes + ' min' : 'no seu tempo'}</span>
                  <span className="mt-4 flex items-center gap-1.5 text-xs font-bold text-violet-200">Conhecer técnica <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1"/></span>
                </button>
              ))}
            </div>
          ) : <p className="rounded-xl border border-white/10 bg-[#212b3c] p-4 text-xs text-slate-300">O catálogo está indisponível. A ajuda guiada acima continua funcionando.</p>}
        </section>

        <details id="sos-library" className="group min-w-0 scroll-mt-28 overflow-hidden rounded-3xl border border-white/10 bg-[#172133] text-white">
          <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 sm:px-5 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-3">
              <span className="rounded-2xl border border-violet-400/20 bg-violet-400/10 p-3"><BookOpen className="h-5 w-5 text-violet-300"/></span>
              <span className="min-w-0">
                <strong className="block text-sm font-bold sm:text-base">Explorar biblioteca de técnicas</strong>
                <span className="mt-1 block text-xs leading-relaxed text-slate-400">Busque pelo nome, filtre por objetivo e descubra outras práticas.</span>
              </span>
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 text-violet-200 transition-transform group-open:rotate-180"/>
          </summary>
          <section className="min-w-0 space-y-4 border-t border-white/10 p-3 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                Ferramentas SOS avançadas
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                Escolha uma técnica, clique em <strong>“Iniciar agora”</strong> e siga o passo a passo.
                Se encontrar uma técnica útil, salve como favorita. Mostramos opções aos poucos para facilitar sua escolha.
              </p>
            </div>

            <Link
              href="/sos/history"
              className="inline-flex items-center gap-1 px-3 py-2 text-xs sm:text-sm rounded-full bg-white/80 dark:bg-gray-900/80 border border-gray-200/60 dark:border-gray-700/80 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Clock className="w-4 h-4" />
              Ver histórico completo
            </Link>
          </div>

          {/* Histórico resumido */}
          <div className="bg-white/90 dark:bg-gray-900/70 border border-gray-200/60 dark:border-gray-700/80 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Seu histórico recente
              </div>
              {logsLoading && (
                <div className="text-xs text-gray-500 dark:text-gray-400">Carregando…</div>
              )}
            </div>

            {!supabaseUser ? (
              <div className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                Faça login para salvar histórico e curtir ferramentas.
                <Link href="/login" className="ml-2 underline font-semibold">
                  Entrar / Criar conta
                </Link>
              </div>
            ) : recentLogs.length === 0 ? (
              <div className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                Nenhuma sessão registrada ainda. Depois de praticar pelo menos {MIN_SECONDS_TO_LOG}s, confirme a conclusão para guardar no seu histórico.
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {recentLogs.map((l) => {
                  const tool = tools.find((t) => t.id === Number(l.tool_id));
                  const title = tool?.title || 'Técnica SOS';
                  const secs = Number(l.duration || 0);
                  return (
                    <div
                      key={String(l.id)}
                      className="rounded-xl border border-gray-200/60 dark:border-gray-700/80 bg-white/70 dark:bg-gray-900/50 p-3"
                    >
                      <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
                        {title}
                      </div>
                      <div className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">
                        {secs > 0 ? `Duração: ~${secs}s` : 'Duração: —'}
                      </div>
                      <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                        {formatRelativeTime(l.used_at)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {toolsLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full" />
            </div>
          ) : tools.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 text-center text-sm text-gray-600 dark:text-gray-300">
              Ainda não há ferramentas cadastradas na tabela <strong>sos_tools</strong>.
            </div>
          ) : (
            <>
              {/* Barra de organização */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setSortMode('popular')}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs sm:text-sm border transition ${
                      sortMode === 'popular'
                        ? 'bg-black/80 text-white border-white/10'
                        : 'bg-white/80 dark:bg-gray-900/60 text-gray-700 dark:text-gray-200 border-gray-200/60 dark:border-gray-700/80 hover:bg-white'
                    }`}
                  >
                    <Flame className="w-4 h-4" />
                    Mais curtidas
                  </button>

                  <button
                    onClick={() => setSortMode('favorites')}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs sm:text-sm border transition ${
                      sortMode === 'favorites'
                        ? 'bg-black/80 text-white border-white/10'
                        : 'bg-white/80 dark:bg-gray-900/60 text-gray-700 dark:text-gray-200 border-gray-200/60 dark:border-gray-700/80 hover:bg-white'
                    }`}
                    title={!supabaseUser ? 'Faça login para ver favoritas' : 'Suas curtidas'}
                  >
                    <Heart className="w-4 h-4" />
                    Favoritas
                  </button>

                  <button
                    onClick={() => setSortMode('recent')}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs sm:text-sm border transition ${
                      sortMode === 'recent'
                        ? 'bg-black/80 text-white border-white/10'
                        : 'bg-white/80 dark:bg-gray-900/60 text-gray-700 dark:text-gray-200 border-gray-200/60 dark:border-gray-700/80 hover:bg-white'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    Recentes
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar técnica..."
                      className="w-full sm:w-60 pl-9 pr-3 py-2 rounded-full border border-gray-200/60 dark:border-gray-700/80 bg-white/90 dark:bg-gray-900/60 text-sm text-gray-800 dark:text-gray-100 outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <select
                      value={activeCategory}
                      onChange={(e) => setActiveCategory(e.target.value)}
                      className="w-full sm:w-52 px-3 py-2 rounded-full border border-gray-200/60 dark:border-gray-700/80 bg-white/90 dark:bg-gray-900/60 text-sm text-gray-800 dark:text-gray-100 outline-none"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Lista */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTools.slice(0, visibleCount).map((t) => {
                  const isToolPremium = !!t.premium_only;
                  const locked = isToolPremium && !isPremium;

                  const likedByMe = myLikes.has(t.id);
                  const likeCount = Number(t.likes_count || 0);

                  return (
                    <article
                      key={t.id}
                      className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md flex flex-col gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-purple-100 via-pink-50 to-red-100 dark:from-purple-900 dark:via-gray-900 dark:to-red-900 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="text-3xl">{getEmojiForTool(t)}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 truncate">
                                {t.title || 'Ferramenta SOS'}
                              </h3>
                              {t.category && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {t.category}
                                </p>
                              )}
                            </div>

                            {/* Curtidas globais */}
                            <button
                              onClick={() => void toggleLike(t.id)}
                              disabled={likesBusy.has(t.id) || !likesReady}
                              aria-label={likedByMe ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] transition ${
                                likedByMe
                                  ? 'border-rose-400/60 bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-200'
                                  : 'border-gray-200/60 bg-white/70 text-gray-700 dark:border-gray-700/80 dark:bg-gray-900/40 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/60'
                              }`}
                              title={!supabaseUser ? 'Faça login para curtir' : likedByMe ? 'Você curtiu' : 'Curtir'}
                            >
                              <Heart className={`w-3.5 h-3.5 ${likedByMe ? 'fill-current' : ''}`} />
                              <span>{likeCount}</span>
                            </button>
                          </div>

                          {t.duration_minutes && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {t.duration_minutes} min
                            </span>
                          )}

                          {t.description && (
                            <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                              {t.description}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => !locked && setSelectedTool(t)}
                              disabled={locked}
                              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm inline-flex items-center gap-2 border ${
                                locked
                                  ? 'border-gray-300 dark:border-gray-600 text-gray-400 cursor-not-allowed bg-gray-50 dark:bg-gray-900'
                                  : 'border-purple-500/60 text-purple-700 dark:text-purple-200 bg-purple-50/60 dark:bg-purple-900/40 hover:bg-purple-100 dark:hover:bg-purple-900/60'
                              }`}
                            >
                              {locked ? (
                                <>
                                  <Lock className="w-3 h-3" />
                                  Somente Premium
                                </>
                              ) : (
                                <>
                                  <Heart className="w-3 h-3 fill-red-500/80 text-red-500/80" />
                                  Iniciar agora
                                </>
                              )}
                            </button>

                            {isToolPremium && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-200 border border-yellow-300/60 dark:border-yellow-800/80">
                                <Crown className="w-3 h-3" />
                                Premium
                              </span>
                            )}
                          </div>

                          {t.tags && t.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {t.tags.map((tag, i) => (
                                <span
                                  key={`${t.id}-tag-${i}`}
                                  className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-900 text-[11px] text-gray-600 dark:text-gray-300"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                    </article>
                  );
                })}
              </div>

              {filteredTools.length > visibleCount && (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                  <p className="text-xs text-slate-400">Mostrando {Math.min(visibleCount, filteredTools.length)} de {filteredTools.length} técnicas.</p>
                  <button type="button" onClick={() => setVisibleCount(count => count + 12)}
                    className="min-h-11 rounded-xl border border-violet-400/40 bg-violet-500/15 px-5 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-500/25">
                    Ver mais 12 técnicas
                  </button>
                </div>
              )}

              {filteredTools.length === 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 text-center text-sm text-gray-600 dark:text-gray-300">
                  Nenhuma ferramenta encontrada com esses filtros.
                </div>
              )}
            </>
          )}
        </section>
        </details>
      </main>
      {selectedTool && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#080c1a]/90 p-3 backdrop-blur-md sm:p-6" role="presentation">
          <div role="dialog" aria-modal="true" aria-label={'Técnica SOS: ' + selectedTool.title}
            className="dark max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/15 bg-[#151d30] p-3 text-white shadow-2xl sm:p-5">
            <div className="flex justify-end">
              <button type="button" onClick={()=>setSelectedTool(null)}
                aria-label="Fechar técnica" className="flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-semibold text-slate-200 hover:bg-white/10">
                Fechar <span aria-hidden="true">×</span>
              </button>
            </div>
            <SosPlayer tool={selectedTool}
              onComplete={async seconds => {
                const success = await handleSosComplete(selectedTool, seconds ?? 0);
                if (success) setSelectedTool(null);
                return success;
              }}
              onCancel={()=>setSelectedTool(null)}/>
          </div>
        </div>
      )}
    </div>
  );
}
