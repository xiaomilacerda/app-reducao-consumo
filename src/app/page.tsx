'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { storage } from '@/lib/storage';
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
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [cleanDays, setCleanDays] = useState(0);
  const [dailyMessage, setDailyMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

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
    setMounted(true);
    const data = storage.getUserData();

    if (!data) {
      const nowIso = new Date().toISOString();
      const defaultData: UserData = {
        ...storage.getUserData(),
        startDate: nowIso,
        lastRelapseDate: null,
        dailyCost: 20,
        gramsPerJoint: 0.5,
        pricePerGram: 10,
        frequencyAmount: 4,
        frequencyPeriod: 'day',
        thcPotency: 5,
      } as UserData;

      storage.saveUserData(defaultData);
      setUserData(defaultData);
      setDailyMessage(gerarMensagemDiaria(null));
      loadAchievements(defaultData);
      return;
    }

    const safeData: UserData = {
      ...data,
      startDate: data.startDate || new Date().toISOString(),
      lastRelapseDate: data.lastRelapseDate ?? null,
      dailyCost: typeof data.dailyCost === 'number' ? data.dailyCost : 20,
      gramsPerJoint:
        typeof data.gramsPerJoint === 'number' ? data.gramsPerJoint : 0.5,
      pricePerGram:
        typeof (data as any).pricePerGram === 'number'
          ? (data as any).pricePerGram
          : 10,
      frequencyAmount:
        typeof data.frequencyAmount === 'number' ? data.frequencyAmount : 4,
      frequencyPeriod: data.frequencyPeriod || 'day',
      thcPotency:
        typeof data.thcPotency === 'number' ? data.thcPotency : 5,
      lastMood: (data as any).lastMood || 'neutral',
    };

    setUserData(safeData);
    setDailyMessage(gerarMensagemDiaria(safeData.lastMood || null));
    loadAchievements(safeData);

    const interval = setInterval(() => {
      const days = calculateCleanDays(
        safeData.startDate,
        safeData.lastRelapseDate
      );
      setCleanDays(Number.isFinite(days) ? days : 0);
      checkAndUnlockAchievements(days, safeData);
    }, 1000);

    return () => clearInterval(interval);
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
          safeDays >= achievement.daysRequired
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

  const handleRelapse = () => {
    const updatedData = storage.registerRelapse();
    setUserData(updatedData);
    setCleanDays(0);
    loadAchievements(updatedData);
  };

  const toggleTheme = () => {
    if (!userData) return;
    const newTheme = userData.themeMode === 'default' ? 'focus' : 'default';
    const updatedData = { ...userData, themeMode: newTheme };
    storage.saveUserData(updatedData);
    setUserData(updatedData);
  };

  if (!mounted || !userData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent" />
        <div className="text-sm text-white/70">Carregando seu painel…</div>
      </div>
    );
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
      className={`min-h-screen ${
        userData.themeMode === 'focus'
          ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900'
          : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900'
      } bg-transparent`}
    >
      {/* HEADER */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg sticky top-0 z-40 bg-black/35 dark:bg-black/35 border-b border-white/10 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,.35)]">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* TÍTULO */}
            <div className="flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-purple-500" />
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  WEED RESET
                </h1>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Evolução real, dia após dia.
                </span>
              </div>

              {userData.isPremium && (
                <Crown className="w-6 h-6 text-yellow-500 ml-1" />
              )}
            </div>

            {/* MENU DESKTOP */}
            <nav className="hidden lg:flex items-center gap-2">
              <Link
                href="/"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-semibold text-sm"
              >
                <Trophy className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>

              <Link
                href="/jornada"
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm"
              >
                <Crown className="w-4 h-4" />
                <span>Jornada 365</span>
              </Link>

              <Link
                href="/analytics"
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Análises</span>
              </Link>
            </nav>

            {/* AÇÕES */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {userData.themeMode === 'focus' ? '🌙' : '☀️'}
              </button>

              <button
                onClick={() => router.push('/profile')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <UserIcon className="w-6 h-6 text-purple-500" />
              </button>
            </div>
          </div>

          {/* MOBILE NAV */}
          <nav className="lg:hidden flex items-center gap-2 mt-4 overflow-x-auto pb-2">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-100 text-purple-600 font-semibold whitespace-nowrap text-sm"
            >
              <Trophy className="w-4 h-4" />
              Dashboard
            </Link>

            <Link
              href="/jornada"
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 whitespace-nowrap text-sm"
            >
              <Crown className="w-4 h-4" />
              Jornada 365
            </Link>

            <Link
              href="/analytics"
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 whitespace-nowrap text-sm"
            >
              <BarChart3 className="w-4 h-4" />
              Análises
            </Link>

            <button
              onClick={() => router.push('/profile')}
              className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-purple-600 whitespace-nowrap text-sm"
            >
              <UserIcon className="w-4 h-4" />
              Perfil
            </button>
          </nav>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* FRASE DO DIA */}
        {dailyMessage && (
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-2xl p-5 border border-purple-100 dark:border-purple-900/40">
            <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-300 mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Mensagem do Dia
            </h3>
            <p className="text-gray-700 dark:text-gray-300 text-base leading-relaxed">
              {dailyMessage}
            </p>
          </div>
        )}

        {/* GRID PRINCIPAL (10 BOTÕES) */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <Link
            href="/sos"
            className="p-4 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl shadow-lg text-white text-center hover:shadow-2xl transition-all"
          >
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">Modo SOS</p>
          </Link>

          <Link
            href="/mood"
            className="p-4 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg text-white text-center hover:shadow-2xl transition-all"
          >
            <Smile className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">Humor</p>
          </Link>

          <Link
            href="/missions"
            className="p-4 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg text-white text-center hover:shadow-2xl transition-all"
          >
            <Target className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">Missões</p>
          </Link>

          <Link
            href="/body-evolution"
            className="p-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg text-white text-center hover:shadow-2xl transition-all"
          >
            <Activity className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">Evolução</p>
          </Link>

          <Link
            href="/detox"
            className="p-4 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg text-white text-center hover:shadow-2xl transition-all hidden lg:block"
          >
            <Droplet className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">Detox</p>
          </Link>

          <Link
            href="/share"
            className="p-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg text-white text-center hover:shadow-2xl transition-all"
          >
            <Share2 className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">Compartilhar</p>
          </Link>

          <Link
            href="/rewards"
            className="p-4 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl shadow-lg text-white text-center hover:shadow-2xl transition-all"
          >
            <ShoppingBag className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">Loja</p>
          </Link>

          <Link
            href="/ai-insights"
            className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg text-white text-center hover:shadow-2xl transition-all"
          >
            <Brain className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">IA de Prevenção</p>
          </Link>

          <Link
            href="/community"
            className="p-4 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl shadow-lg text-white text-center hover:shadow-2xl transition-all"
          >
            <Users className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">Comunidade</p>
          </Link>

          <Link
            href="/cant-stop"
            className="p-4 bg-gradient-to-br from-pink-500 to-red-600 rounded-xl shadow-lg text-white text-center hover:shadow-2xl transition-all"
          >
            <Heart className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">Não Consigo Parar</p>
          </Link>
        </div>

        {/* a */}
        <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl p-8 shadow-2xl text-white">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Trophy className="w-8 h-8" />
              <h2 className="text-2xl font-bold">Tempo Limpo</h2>
            </div>

            <div className="space-y-2">
              <div className="text-7xl font-bold">{timeInfo.value}</div>
              <div className="text-3xl font-semibold opacity-90">
                {timeInfo.unit}
              </div>
              <div className="text-xl opacity-75">{timeInfo.detail}</div>
            </div>

            {safeCleanDays > 0 && (
              <div className="mt-6 pt-6 border-t border-white/20">
                <p className="text-lg opacity-90">
                  Você está fazendo um trabalho incrível. Continue assim! 💪
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RESUMO DO DIA */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            Seu Resumo de Hoje
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex flex-col">
              <span className="text-gray-600 dark:text-gray-400 text-sm">
                Tempo limpo
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {timeInfo.value} {timeInfo.unit}
              </span>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex flex-col">
              <span className="text-gray-600 dark:text-gray-400 text-sm">
                Economia hoje
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(userData.dailyCost)}
              </span>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex flex-col">
              <span className="text-gray-600 dark:text-gray-400 text-sm">
                Gatilhos evitados
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {Math.floor(safeCleanDays / 1.2)}
              </span>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex flex-col">
              <span className="text-gray-600 dark:text-gray-400 text-sm">
                Humor atual
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {userData.lastMood || '—'}
              </span>
            </div>
          </div>
        </div>
        {/* MINI WIDGET — JORNADA 365 */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-700 p-6 rounded-2xl shadow-xl text-white">
          <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-300" />
            Jornada 365
          </h3>

          <p className="opacity-90 mb-4">
            Continue sua evolução diária. Cada missão te aproxima do seu melhor
            eu.
          </p>

          <Link
            href="/jornada"
            className="inline-block px-5 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition-all text-white font-semibold"
          >
            Continuar Jornada →
          </Link>
        </div>

        {/* ESTATÍSTICAS DETALHADAS */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            Estatísticas Detalhadas
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* BARRAS DE SAÚDE ORIGINAL */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
          <HealthBars metrics={healthMetrics} />
        </div>

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
