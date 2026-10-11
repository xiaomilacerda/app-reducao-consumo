'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Heart,
  Wind,
  Target,
  Volume2,
  Crown,
  Lock,
  Clock,
  Sparkles,
  Flame,
  Search,
  Filter,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import SosPlayer from '@/components/SosPlayer';

type ThemeMode = 'default' | 'focus';

const motivationalPhrases = [
  'Você é mais forte do que imagina.',
  'Esta vontade vai passar. Respire fundo.',
  'Cada segundo que você resiste é uma vitória.',
  'Você já chegou tão longe. Continue!',
  'Seu futuro eu agradece por esta escolha.',
  'A fissura é temporária. Sua força é permanente.',
  'Você não precisa disso. Você é completo.',
  'Respire. Você está no controle.',
];

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

  if (base.includes('visual')) return '👁️';
  if (base.includes('gatilho')) return '🛡️';
  if (base.includes('ansiedade') || base.includes('crise')) return '😰';
  if (base.includes('respira') || base.includes('respiração')) return '🌬️';
  if (base.includes('sono') || base.includes('dormir')) return '🌙';
  if (base.includes('corpo') || base.includes('tensão')) return '💆‍♂️';
  if (base.includes('pensamento') || base.includes('mental')) return '🧠';
  if (base.includes('urge') || base.includes('vontade')) return '🔥';

  return '💜';
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

  const [currentPhraseIndex] = useState(
    () => Math.floor(Math.random() * motivationalPhrases.length),
  );

  // ----- FERRAMENTAS SOS DO BANCO -----
  const [tools, setTools] = useState<SosTool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<SosTool | null>(null);

  // ----- NOVO: Curtidas globais + minhas curtidas -----
  const [myLikes, setMyLikes] = useState<Set<number>>(new Set());
  const [likesReady, setLikesReady] = useState(false);

  // ----- NOVO: Organização (busca, categoria, filtro) -----
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Todas');
  const [sortMode, setSortMode] = useState<'popular' | 'favorites' | 'recent'>(
    'popular',
  );

  // ----- NOVO: Histórico breve (mais claro) -----
  const [recentLogs, setRecentLogs] = useState<SosLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

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
      alert('Faça login para curtir ferramentas e salvar seu histórico.');
      return;
    }

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
    }
  }

  // ---------------- LÓGICA PARA REGISTRAR NO HISTÓRICO ----------------
  async function handleSosComplete(tool: SosTool, seconds: number) {
    if (!supabaseUser) {
      console.log('[SOS] Usuário não logado, sessão não será salva em sos_logs.');
      return;
    }

    const duration = Math.max(0, Math.round(seconds || 0));

    if (duration < MIN_SECONDS_TO_LOG) {
      console.log(
        `[SOS] Sessão muito curta (${duration}s). Não será registrada em sos_logs.`,
      );
      return;
    }

    try {
      // CORRIGIDO para seu schema: duration + used_at default
      const { error } = await supabase.from('sos_logs').insert([
        {
          user_id: supabaseUser.id,
          tool_id: tool.id,
          duration: duration,
        },
      ]);

      if (error) {
        console.error('Erro ao salvar sessão em sos_logs:', {
          message: (error as any)?.message,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
          code: (error as any)?.code,
        });
      } else {
        const nowIso = new Date().toISOString();
        console.log(
          `[SOS] Sessão da ferramenta "${tool.title}" registrada em sos_logs com ~${duration}s.`,
        );

        // Atualiza histórico rápido local
        setRecentLogs((prev) => [
          { id: `tmp-${nowIso}`, tool_id: tool.id, duration: duration, used_at: nowIso },
          ...prev,
        ].slice(0, 3));
      }
    } catch (err: any) {
      console.error('Erro inesperado ao registrar sessão SOS:', err?.message || err);
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
  }, [tools, activeCategory, search, sortMode, myLikes]);

  // ---------------- RENDER ----------------
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  const currentPhrase = motivationalPhrases[currentPhraseIndex];
  const isFocusMode = themeMode === 'focus';

  return (
    <div
      className={`min-h-screen ${
        isFocusMode
          ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900'
          : 'bg-gradient-to-br from-red-50 via-orange-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900'
      }`}
    >
      {/* HEADER */}
      <header className="bg-black/40 backdrop-blur-xl shadow-lg sticky top-0 z-40 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-white/80" />
            </Link>
            <Heart className="w-8 h-8 text-red-500 animate-pulse" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
                Modo SOS Anti-Fissura
              </h1>
              <p className="text-xs sm:text-sm text-white/70">
                Ferramentas rápidas para segurar a fissura agora
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* FRASE MOTIVACIONAL */}
        <section className="bg-gradient-to-r from-red-500 to-pink-600 rounded-3xl p-6 sm:p-8 shadow-2xl text-white text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="w-6 h-6" />
            <span className="uppercase tracking-wide text-xs sm:text-sm opacity-90">
              Lembrete importante
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold mb-4">
            “{currentPhrase}”
          </p>
          <p className="text-sm sm:text-lg opacity-90">
            Se você está em fissura agora, escolha um dos blocos abaixo e siga o
            passo a passo.
          </p>
        </section>

        {/* CARTÕES DE EXERCÍCIO RÁPIDO */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Respiração Guiada */}
          <button
            onClick={() => {
              setActiveExercise((prev) =>
                prev === 'breathing' ? null : 'breathing',
              );
              setBreathingPhase('inhale');
              setBreathingCount(4);
            }}
            className={`p-6 rounded-2xl shadow-xl transition-all text-left ${
              activeExercise === 'breathing'
                ? 'bg-gradient-to-br from-blue-500 to-cyan-600 text-white scale-105'
                : 'bg-white dark:bg-gray-800 hover:shadow-2xl'
            }`}
          >
            <Wind
              className={`w-10 h-10 mb-3 ${
                activeExercise === 'breathing'
                  ? 'text-white'
                  : 'text-blue-500'
              }`}
            />
            <h3
              className={`text-lg sm:text-xl font-bold mb-1 ${
                activeExercise === 'breathing'
                  ? 'text-white'
                  : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              Respiração 4-7-8
            </h3>
            <p
              className={`text-sm ${
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
            onClick={() => {
              setActiveExercise((prev) => (prev === 'focus' ? null : 'focus'));
              setFocusTimer(60);
            }}
            className={`p-6 rounded-2xl shadow-xl transition-all text-left ${
              activeExercise === 'focus'
                ? 'bg-gradient-to-br from-purple-500 to-pink-600 text-white scale-105'
                : 'bg-white dark:bg-gray-800 hover:shadow-2xl'
            }`}
          >
            <Target
              className={`w-10 h-10 mb-3 ${
                activeExercise === 'focus' ? 'text-white' : 'text-purple-500'
              }`}
            />
            <h3
              className={`text-lg sm:text-xl font-bold mb-1 ${
                activeExercise === 'focus'
                  ? 'text-white'
                  : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              Treino de Foco (1 min)
            </h3>
            <p
              className={`text-sm ${
                activeExercise === 'focus'
                  ? 'text-white/90'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Exercício de atenção plena para atravessar a fissura.
            </p>
          </button>

          {/* Áudio de Calma (placeholder) */}
          <button
            onClick={() =>
              setActiveExercise((prev) => (prev === 'calm' ? null : 'calm'))
            }
            className={`p-6 rounded-2xl shadow-xl transition-all text-left ${
              activeExercise === 'calm'
                ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white scale-105'
                : 'bg-white dark:bg-gray-800 hover:shadow-2xl'
            }`}
          >
            <Volume2
              className={`w-10 h-10 mb-3 ${
                activeExercise === 'calm' ? 'text-white' : 'text-green-500'
              }`}
            />
            <h3
              className={`text-lg sm:text-xl font-bold mb-1 ${
                activeExercise === 'calm'
                  ? 'text-white'
                  : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              Áudio de Calma
            </h3>
            <p
              className={`text-sm ${
                activeExercise === 'calm'
                  ? 'text-white/90'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Escolha sons relaxantes para desacelerar o corpo.
            </p>
          </button>
        </section>

        {/* BLOCO DO EXERCÍCIO ATIVO */}
        {activeExercise === 'breathing' && (
          <section className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl space-y-8">
            <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-4">
              Respiração 4-7-8
            </h2>

            <div className="flex flex-col items-center gap-8">
              <div className="relative w-64 h-64">
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
                  <div className="text-6xl font-bold mb-2">
                    {breathingCount}
                  </div>
                  <div className="text-2xl font-semibold">
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
          <section className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl space-y-8">
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
          <section className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl space-y-8">
            <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-4">
              Áudio de Calma
            </h2>

            <div className="flex flex-col items-center gap-8">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center animate-pulse shadow-lg">
                <Volume2 className="w-14 h-14 sm:w-16 h-16 text-white" />
              </div>

              <div className="text-center space-y-3 max-w-xl">
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Sons relaxantes para desacelerar o corpo
                </p>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                  Feche os olhos, coloque um fone e escolha um tipo de som.
                  Enquanto ouve, mantenha a atenção na respiração e no corpo.
                </p>
              </div>

              <div className="w-full max-w-md space-y-3">
                <button className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold hover:shadow-lg transition-all">
                  🌊 Som de Ondas (em breve)
                </button>
                <button className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold hover:shadow-lg transition-all">
                  🌲 Floresta / Natureza (em breve)
                </button>
                <button className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold hover:shadow-lg transition-all">
                  🌧️ Chuva Suave (em breve)
                </button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                **Nesta versão, os botões são placeholders visuais. Você pode
                conectar esses botões a áudios reais depois.**
              </p>
            </div>
          </section>
        )}

        {/* ÁREA AVANÇADA: FERRAMENTAS SOS DO BANCO */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                Ferramentas SOS avançadas
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                Escolha uma técnica, clique em <strong>“Iniciar agora”</strong> e siga o passo a passo.
                Se você gostar, curta ❤️ — as mais curtidas ficam no topo.
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
                Nenhuma sessão registrada ainda. Conclua uma técnica por pelo menos {MIN_SECONDS_TO_LOG}s para salvar.
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
                {filteredTools.map((t) => {
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
                              onClick={() => toggleLike(t.id)}
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

                      {/* Player embutido quando selecionado */}
                      {selectedTool?.id === t.id && !locked && (
                        <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                          <SosPlayer
                            tool={t}
                            onComplete={async (secs) => {
                              console.log(
                                `Sessão SOS "${t.title}" concluída em ~${secs}s`,
                              );
                              await handleSosComplete(t, secs ?? 0);
                              setSelectedTool(null);
                            }}
                            onCancel={() => setSelectedTool(null)}
                          />
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {filteredTools.length === 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 text-center text-sm text-gray-600 dark:text-gray-300">
                  Nenhuma ferramenta encontrada com esses filtros.
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
