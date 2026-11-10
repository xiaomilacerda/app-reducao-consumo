'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { prepareLocalAccount, readPrivateState, restoreJourney, snapshotJourney, updatePrivateState } from '@/lib/private-state';
import { UserData, Achievement } from '@/lib/types';

import {
  calculateCleanDays,
  formatCleanTime,
  calculateSavings,
  formatCurrency,
  calculateHealthMetrics,
  calculateGramsAvoided,
  calculateTHCAvoided,
  calculateJointsAvoided,
  calculateDailyFrequency,
} from '@/lib/utils-recovery';

import HealthBars from '@/components/custom/health-bars';
import AchievementsCard from '@/components/custom/achievements-card';
import PageSkeleton from '@/components/ui/page-skeleton';
import RelapseButton from '@/components/custom/relapse-button';

import {
  Sparkles,
  TrendingUp,
  Trophy,
  Leaf,
  Zap,
  Cigarette,
  Users,
  Heart,
  BarChart3,
  User as UserIcon,
  Brain,
  Smile,
  Target,
  Share2,
  ShoppingBag,
  Droplet,
  Activity,
  AlertCircle,
  Crown,
  ChevronRight,
  LayoutGrid,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [cleanDays, setCleanDays] = useState(0);
  const [dailyMessage, setDailyMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const latestData = useRef<UserData | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // ======================
  // BANCO DE FRASES
  // ======================
  const frasesBaseadasNoHumor: Record<string, string[]> = {
    happy: [
      'Hoje você está brilhando — continue iluminando sua evolução! ✨',
      'Seu sorriso é sua força. Mantenha o foco! 😄',
      'Seu progresso inspira até quem você não conhece! 🔥',
    ],
    neutral: [
      'Cada passo conta, mesmo quando parece pequeno. 🌱',
      'A constância sempre vence a intensidade. Você está indo bem. ⚡',
      'Hoje é um bom dia para continuar vencendo você mesmo. 💪',
    ],
    sad: [
      'Dias difíceis constroem pessoas fortes. Você já venceu muito. 💜',
      'Respire. Você está no controle, mesmo quando parece que não. 🌬️',
      'Tudo passa — inclusive esse momento. Continue firme. 🌄',
    ],
    stressed: [
      'Você já superou muito mais do que imagina. Segure firme. 💛',
      'Seu esforço de hoje vai virar orgulho amanhã. 🧠',
      'A calma te traz clareza. Você consegue. ✨',
    ],
  };

  function gerarMensagemDiaria(humor: string | null) {
    const lista = frasesBaseadasNoHumor[humor || 'neutral'];
    return lista[Math.floor(Math.random() * lista.length)];
  }

  useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    setMounted(true);

    const startHome = async () => {
      let data = storage.getUserData();

      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (auth.user) {
          prepareLocalAccount(auth.user.id);
          data = storage.getUserData();
          const cloud = await readPrivateState(auth.user.id);
          if (cloud?.userData && Object.keys(cloud.userData).length > 0) {
            data = restoreJourney(cloud, data);
          } else if (data?.onboardingCompleted) {
            // Importação única dos dados antigos que ainda existiam só no aparelho.
            await updatePrivateState({ userData: snapshotJourney(data) });
          } else {
            // Contas criadas antes da sincronização podem ter o último uso no profile.
            const { data: profile } = await supabase.from('profiles')
              .select('last_use, daily_cost, thc_potency, grams_per_joint, currency')
              .eq('id', auth.user.id).maybeSingle();
            if (profile?.last_use) {
              data = {
                ...(data ?? {}),
                startDate: profile.last_use,
                lastUseDateTime: profile.last_use,
                dailyCost: profile.daily_cost ?? data?.dailyCost ?? 0,
                thcPotency: profile.thc_potency ?? data?.thcPotency ?? 5,
                gramsPerJoint: profile.grams_per_joint ?? data?.gramsPerJoint ?? 0.5,
                currency: profile.currency ?? data?.currency ?? 'BRL',
              } as UserData;
            }
          }

          // Plano e XP devem vir da tabela oficial, nunca de dados editáveis locais.
          const { data: officialProfile } = await supabase.from('profiles')
            .select('is_premium, xp').eq('id', auth.user.id).maybeSingle();
          if (data && officialProfile) {
            data = {
              ...data,
              isPremium: !!officialProfile.is_premium,
              xp: Number(officialProfile.xp ?? data.xp ?? 0),
            };
          }
        }
      } catch (err) {
        console.error('Não foi possível carregar a jornada da nuvem:', err);
        if (active) setSyncError('Sem sincronização com a nuvem. Confira a conexão antes de trocar de dispositivo.');
      }

      if (!active) return;
      const nowIso = new Date().toISOString();
      const safeData: UserData = {
        ...(data ?? {}),
        startDate: data?.startDate || data?.lastUseDateTime || nowIso,
        lastRelapseDate: data?.lastRelapseDate ?? null,
        dailyCost: typeof data?.dailyCost === 'number' ? data.dailyCost : 0,
        gramsPerJoint: typeof data?.gramsPerJoint === 'number' ? data.gramsPerJoint : 0.5,
        pricePerGram: typeof data?.pricePerGram === 'number' ? data.pricePerGram : 0,
        frequencyAmount: typeof data?.frequencyAmount === 'number' ? data.frequencyAmount : 1,
        frequencyPeriod: data?.frequencyPeriod || 'day',
        thcPotency: typeof data?.thcPotency === 'number' ? data.thcPotency : 5,
        lastMood: (data as any)?.lastMood || 'neutral',
      } as UserData;

      storage.saveUserData(safeData);
      latestData.current = safeData;
      setUserData(safeData);
      setDailyMessage(gerarMensagemDiaria((safeData as any).lastMood || null));
      loadAchievements(safeData);

      interval = setInterval(() => {
        const latest = latestData.current;
        if (!latest) return;
        const days = calculateCleanDays(latest.startDate, latest.lastRelapseDate);
        setCleanDays(Number.isFinite(days) ? days : 0);
        checkAndUnlockAchievements(days, latest);
      }, 1000);
    };

    void startHome();
    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAchievements = (data: UserData) => {
    const days = calculateCleanDays(data.startDate, data.lastRelapseDate);
    setCleanDays(Number.isFinite(days) ? days : 0);
    checkAndUnlockAchievements(days, data);
  };

  const checkAndUnlockAchievements = (days: number, data: UserData) => {
    const safeDays = Number.isFinite(days) ? days : 0;
    const currentAchievements = storage.getAchievements();
    const savings = calculateSavings(safeDays, data.dailyCost || 0);
    let updated = false;

    const updatedAchievements = currentAchievements.map((achievement) => {
      if (!achievement.unlocked) {
        if (
          achievement.category === 'time' &&
          typeof achievement.daysRequired === 'number' && safeDays >= achievement.daysRequired
        ) {
          updated = true;
          return {
            ...achievement,
            unlocked: true,
            unlockedAt: new Date().toISOString(),
          };
        }

        if (achievement.category === 'savings') {
          if (achievement.id === 'save100' && savings >= 100) {
            updated = true;
            return {
              ...achievement,
              unlocked: true,
              unlockedAt: new Date().toISOString(),
            };
          }
          if (achievement.id === 'save500' && savings >= 500) {
            updated = true;
            return {
              ...achievement,
              unlocked: true,
              unlockedAt: new Date().toISOString(),
            };
          }
          if (achievement.id === 'save1000' && savings >= 1000) {
            updated = true;
            return {
              ...achievement,
              unlocked: true,
              unlockedAt: new Date().toISOString(),
            };
          }
        }
      }
      return achievement;
    });

    if (updated) storage.updateAchievements(updatedAchievements);
    setAchievements(updatedAchievements);
  };

  const handleRelapse = async () => {
    if (!userData) return;
    const now = new Date();
    const updatedData = {
      ...userData,
      lastRelapseDate: now.toISOString(),
      lastUseDateTime: now.toISOString(),
      totalRelapses: (userData.totalRelapses || 0) + 1,
      relapseHistory: [
        ...(userData.relapseHistory || []),
        {
          id: `relapse_${now.getTime()}`,
          date: now.toISOString().slice(0, 10),
          time: now.toTimeString().split(' ')[0],
        },
      ],
    } as UserData;

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        await updatePrivateState({ userData: snapshotJourney(updatedData) });
      }
      storage.saveUserData(updatedData);
      storage.resetAchievements();
      latestData.current = updatedData;
      setUserData(updatedData);
      setCleanDays(0);
      loadAchievements(updatedData);
      setSyncError(null);
    } catch (error) {
      console.error('Falha ao registrar recaída:', error);
      setSyncError('Não foi possível salvar o registro na nuvem. Tente novamente.');
    }
  };

  const toggleTheme = async () => {
    if (!userData) return;
    const newTheme = userData.themeMode === 'default' ? 'focus' : 'default';
    const updatedData = { ...userData, themeMode: newTheme } as UserData;
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        await updatePrivateState({ userData: { themeMode: newTheme } });
      }
      storage.saveUserData(updatedData);
      latestData.current = updatedData;
      setUserData(updatedData);
      setSyncError(null);
    } catch (error) {
      console.error('Erro ao salvar tema:', error);
      setSyncError('Não foi possível salvar o tema na nuvem.');
    }
  };

  if (!mounted || !userData) {
    return <PageSkeleton label="Carregando seu painel" />;
  }
  // =========
  // CÁLCULOS
  // =========
  const safeCleanDays = Number.isFinite(cleanDays) ? cleanDays : 0;

  const dailyFrequencyRaw = calculateDailyFrequency(
    Number(userData.frequencyAmount) || 0,
    userData.frequencyPeriod || 'day'
  );
  const dailyFrequency = Number.isFinite(dailyFrequencyRaw)
    ? dailyFrequencyRaw
    : 0;

  const savings = calculateSavings(
    safeCleanDays,
    Number(userData.dailyCost) || 0
  );

  const healthMetrics = calculateHealthMetrics(safeCleanDays);
  const gramsAvoidedRaw = calculateGramsAvoided(
    safeCleanDays,
    Number(userData.gramsPerJoint) || 0,
    dailyFrequency
  );
  const gramsAvoided = Number.isFinite(gramsAvoidedRaw)
    ? gramsAvoidedRaw
    : 0;

  const thcAvoidedRaw = calculateTHCAvoided(
    gramsAvoided,
    Number(userData.thcPotency) || 0
  );
  const thcAvoided = Number.isFinite(thcAvoidedRaw) ? thcAvoidedRaw : 0;

  const jointsAvoidedRaw = calculateJointsAvoided(
    safeCleanDays,
    dailyFrequency
  );
  const jointsAvoided = Number.isFinite(jointsAvoidedRaw)
    ? Math.max(0, Math.round(jointsAvoidedRaw))
    : 0;

  const timeInfo = formatCleanTime(safeCleanDays);

  // Indicadores extras (número par: 8)
  const extraIndicators = [	
    {
      label: 'Economia acumulada',
      value: formatCurrency(savings),
      description: 'Total estimado economizado até agora.',
    },
    {
      label: 'Doses evitadas',
      value: `${jointsAvoided}`,
      description: 'Número aproximado de vezes que você não consumiu.',
    },
    {
      label: 'THC evitado',
      value: `${(thcAvoided / 1000).toFixed(1)} g`,
      description: 'Quantidade aproximada de THC que seu corpo deixou de receber.',
    },
    {
      label: 'Recaídas registradas',
      value: `${userData.totalRelapses || 0}`,
      description: 'Ajuda você a enxergar evolução, não perfeição.',
    },
  ];

  return (
    <div
      className={`wr-screen wr-home-screen min-h-screen ${
        userData.themeMode === 'focus'
          ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900'
          : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900'
      } bg-transparent`}
    >
      {/* MAIN */}
      <main className="wr-home-main mx-auto max-w-6xl space-y-4 px-3 py-4 sm:space-y-5 sm:px-6 lg:px-8">
        <div className="flex min-h-9 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="text-lg font-extrabold tracking-tight text-white sm:text-xl">Meu painel</h1>
            {userData.isPremium && <Crown className="h-4 w-4 text-amber-300" aria-label="Premium" />}
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={userData.themeMode === 'focus' ? 'Desativar modo foco' : 'Ativar modo foco'}
            title={userData.themeMode === 'focus' ? 'Desativar modo foco' : 'Ativar modo foco'}
            className="flex min-h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[.045] px-3 text-xs font-medium text-slate-300 hover:bg-white/10"
          >
            <Sparkles className="h-4 w-4 text-violet-300" aria-hidden="true" />
            {userData.themeMode === 'focus' ? 'Modo foco ativo' : 'Modo foco'}
          </button>
        </div>
        {syncError && (
          <div role="alert" className="rounded-xl border border-amber-400/50 bg-amber-950/75 px-4 py-3 text-sm text-amber-100">
            {syncError}
          </div>
        )}
        {/* Indicador principal: compacto no celular e com o dado em destaque */}
        <section className="wr-home-progress relative overflow-hidden rounded-2xl border border-violet-400/25 bg-[#201931] px-4 py-4 text-white shadow-[0_10px_32px_rgba(3,2,14,.24)] sm:px-6 sm:py-6" aria-label="Seu tempo de progresso">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-semibold text-violet-200">
                <Trophy className="h-4 w-4" aria-hidden="true" />
                Tempo de progresso
              </p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[42px] font-extrabold leading-none tracking-tight tabular-nums sm:text-5xl">{timeInfo.value}</span>
                <span className="text-lg font-semibold text-violet-100 sm:text-xl">{timeInfo.unit}</span>
              </p>
              <p className="mt-2 text-xs text-slate-300 sm:text-sm">{timeInfo.detail}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-300/10 sm:h-16 sm:w-16">
              <Sparkles className="h-6 w-6 text-violet-200 sm:h-8 sm:w-8" aria-hidden="true" />
            </div>
          </div>
        </section>

        {/* Três ações principais: todas as demais funções estão em Explorar. */}
        <nav className="wr-home-primary-actions space-y-2.5" aria-label="Ações principais">
          <div className="grid grid-cols-2 gap-2.5">
            <Link href="/mood" className="flex min-h-[66px] items-center gap-2.5 rounded-xl border border-violet-300/25 bg-violet-400/10 px-3.5 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-400/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-400/15">
                <Smile className="h-5 w-5 text-violet-200" aria-hidden="true" />
              </span>
              <span className="leading-snug">Registrar humor</span>
            </Link>
            <Link href="/missions" className="flex min-h-[66px] items-center gap-2.5 rounded-xl border border-emerald-300/20 bg-emerald-300/[.07] px-3.5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-300/[.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-300/10">
                <Target className="h-5 w-5 text-emerald-200" aria-hidden="true" />
              </span>
              <span className="leading-snug">Missão de hoje</span>
            </Link>
          </div>
          <Link href="/jornada" className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-[#1b192c] px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#282239] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">
            <Crown className="h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
            <span className="min-w-0 flex-1">Continuar Jornada 365</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          </Link>
          <div className="flex items-center justify-between gap-2 px-1">
            <Link href="/analytics" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-violet-200 hover:bg-violet-400/10">
              <BarChart3 className="h-4 w-4" aria-hidden="true" /> Ver estatísticas
            </Link>
            <Link href="/explorar" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-violet-200 hover:bg-violet-400/10">
              <LayoutGrid className="h-4 w-4" aria-hidden="true" /> Todas as funções
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </nav>

        {/* FRASE DO DIA */}
        {dailyMessage && (
          <div className="wr-home-daily-note rounded-xl border border-violet-300/15 bg-[#1b182b] p-3 shadow-sm sm:p-4">
            <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold text-violet-200 sm:text-sm">
              <Sparkles className="w-5 h-5" />
              Mensagem do Dia
            </h3>
            <p className="text-sm leading-relaxed text-slate-300">
              {dailyMessage}
            </p>
          </div>
        )}

        <section className="wr-home-summary rounded-2xl border border-white/10 bg-[#19172a] px-4 py-4 sm:px-5 sm:py-5" aria-labelledby="wr-summary-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="wr-summary-title" className="flex items-center gap-2 text-sm font-bold text-white sm:text-base">
              <Sparkles className="h-4 w-4 text-violet-300" aria-hidden="true" />
              Seu resumo
            </h2>
            <Link href="/analytics" className="text-xs font-semibold text-violet-200 hover:underline">Ver detalhes</Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="min-w-0 rounded-xl border border-white/[.07] bg-white/[.045] px-3 py-3">
              <p className="text-[11px] font-medium text-slate-400">Economia acumulada</p>
              <p className="mt-1 break-words text-lg font-extrabold tracking-tight text-emerald-200 sm:text-xl">{formatCurrency(savings)}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-white/[.07] bg-white/[.045] px-3 py-3">
              <p className="text-[11px] font-medium text-slate-400">Humor atual</p>
              <p className="mt-1 truncate text-lg font-extrabold text-white sm:text-xl">{userData.lastMood || '—'}</p>
            </div>
          </div>
        </section>
        <details className="group rounded-2xl border border-white/10 bg-[#19172a]">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-white hover:bg-white/[.04] focus-visible:outline-2 focus-visible:outline-violet-300 [&::-webkit-details-marker]:hidden">
            <span>Mais informações do meu registro</span>
            <ChevronRight className="h-4 w-4 text-violet-200 transition-transform group-open:rotate-90" aria-hidden="true" />
          </summary>
        {/* ESTATÍSTICAS DETALHADAS */}
        <div className="px-3 pb-3 pt-1 sm:px-5 sm:pb-5">
          <p className="mb-3 text-xs text-slate-400">Informações adicionais sobre seu registro.</p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">
                Total de recaídas:
              </span>
              <span className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                {userData.totalRelapses || 0}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">
                Métodos:
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {Array.isArray(userData.consumptionMethods) &&
                userData.consumptionMethods.length > 0
                  ? userData.consumptionMethods.join(', ')
                  : 'Não informado'}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">
                Frequência anterior:
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {userData.frequencyAmount || 0}x por{' '}
                {userData.frequencyPeriod === 'day'
                  ? 'dia'
                  : userData.frequencyPeriod === 'week'
                  ? 'semana'
                  : 'mês'}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">
                Potência THC:
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {userData.thcPotency || 0}%
              </span>
            </div>
          </div>
        </div>

        </details>

        <details className="group rounded-2xl border border-white/10 bg-[#19172a]">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-white hover:bg-white/[.04] focus-visible:outline-2 focus-visible:outline-violet-300 [&::-webkit-details-marker]:hidden">
            <span>Indicadores de bem-estar <span className="text-xs font-normal text-slate-400">(estimativas)</span></span>
            <ChevronRight className="h-4 w-4 shrink-0 text-violet-200 transition-transform group-open:rotate-90" aria-hidden="true" />
          </summary>
          <div className="border-t border-white/10 p-3 sm:p-5">
            <HealthBars metrics={healthMetrics} />
          </div>
        </details>

        {/* COMPONENTE DE CONQUISTAS ORIGINAL */}
        <AchievementsCard achievements={achievements} />

        {/* BOTÃO DE RECAÍDA */}
        <div className="pb-8">
          <RelapseButton onRelapse={handleRelapse} />
        </div>
      </main>
    </div>
  );
}
