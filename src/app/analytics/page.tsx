'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { storage } from '@/lib/storage';
import { UserData, HealthMetric } from '@/lib/types';

import {
  calculateCleanDays,
  calculateSavings,
  formatCurrency,
  calculateHealthMetrics,
  calculateGramsAvoided,
  calculateTHCAvoided,
  calculateJointsAvoided,
  calculateDailyFrequency,
} from '@/lib/utils-recovery';

import {
  BarChart3,
  ArrowLeft,
  Activity,
  Leaf,
  Cigarette,
  Zap,
  Calendar,
  Wallet,
  TrendingUp,
  Brain,
  Info,
} from 'lucide-react';

// Formata porcentagens de forma amigável (0,01% mínimo e 2 casas)
function formatPercentage(value: number): string {
  if (!Number.isFinite(value)) return '0,01%';
  const safe = Math.max(0.01, value); // valor já em escala 0–100
  return safe.toFixed(2).replace('.', ',') + '%';
}

// Formata números grandes (ex.: 1234 -> "1.234")
function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('pt-BR');
}

// Média de um grupo de indicadores
function averageMetrics(ids: string[], metrics: HealthMetric[]): number | null {
  const selected = metrics.filter((m) => ids.includes(m.id));
  if (!selected.length) return null;
  const sum = selected.reduce(
    (acc, m) => acc + (Number.isFinite(m.value) ? m.value : 0),
    0
  );
  return sum / selected.length;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const data = storage.getUserData();

    if (!data) {
      // fallback mínimo se não tiver nada salvo
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
      return;
    }

    const safeData: UserData = {
      ...data,
      startDate: data.startDate || new Date().toISOString(),
      lastRelapseDate: data.lastRelapseDate ?? null,
      dailyCost:
        typeof data.dailyCost === 'number' && !Number.isNaN(data.dailyCost)
          ? data.dailyCost
          : 20,
      gramsPerJoint:
        typeof data.gramsPerJoint === 'number' &&
        !Number.isNaN(data.gramsPerJoint)
          ? data.gramsPerJoint
          : 0.5,
      pricePerGram:
        typeof (data as any).pricePerGram === 'number' &&
        !Number.isNaN((data as any).pricePerGram)
          ? (data as any).pricePerGram
          : 10,
      frequencyAmount:
        typeof data.frequencyAmount === 'number' &&
        !Number.isNaN(data.frequencyAmount)
          ? data.frequencyAmount
          : 4,
      frequencyPeriod: data.frequencyPeriod || 'day',
      thcPotency:
        typeof data.thcPotency === 'number' && !Number.isNaN(data.thcPotency)
          ? data.thcPotency
          : 5,
    };

    setUserData(safeData);
  }, []);

  if (!mounted || !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  // ===== Cálculos principais (sempre seguros) =====
  const cleanDaysRaw = calculateCleanDays(
    userData.startDate,
    userData.lastRelapseDate
  );
  const cleanDays = Number.isFinite(cleanDaysRaw) ? cleanDaysRaw : 0;

  const dailyFrequencyRaw = calculateDailyFrequency(
    Number(userData.frequencyAmount) || 0,
    userData.frequencyPeriod || 'day'
  );
  const dailyFrequency = Number.isFinite(dailyFrequencyRaw)
    ? dailyFrequencyRaw
    : 0;

  const dailyCost = Number(userData.dailyCost) || 0;

  const savings = calculateSavings(cleanDays, dailyCost);

  const healthMetrics = calculateHealthMetrics(cleanDays);

  const gramsAvoidedRaw = calculateGramsAvoided(
    cleanDays,
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

  const jointsAvoidedRaw = calculateJointsAvoided(cleanDays, dailyFrequency);
  const jointsAvoided = Number.isFinite(jointsAvoidedRaw)
    ? Math.max(0, Math.round(jointsAvoidedRaw))
    : 0;

  // ===== Projeções futuras (se continuar sem fumar) =====
  const projectionWindows = [
    { id: '30d', label: 'Próximos 30 dias', days: 30 },
    { id: '90d', label: 'Próximos 90 dias', days: 90 },
    { id: '180d', label: 'Próximos 6 meses', days: 180 },
    { id: '365d', label: 'Próximos 12 meses', days: 365 },
  ];

  const projections = projectionWindows.map((w) => {
    const projSavings = dailyCost * w.days;
    const projJoints = dailyFrequency * w.days;
    const projGrams = projJoints * (Number(userData.gramsPerJoint) || 0);

    return {
      ...w,
      projSavings,
      projJoints,
      projGrams,
    };
  });

  // ===== Agrupamento de saúde física x mental =====
  const physicalIds = ['lungs', 'energy', 'sleep'];
  const mentalIds = ['focus', 'mood', 'clarity'];

  const physicalScore = averageMetrics(physicalIds, healthMetrics);
  const mentalScore = averageMetrics(mentalIds, healthMetrics);

  // ===== Separar indicadores principais x outros =====
  const mainIds = ['lungs', 'energy', 'focus', 'sleep', 'mood', 'clarity'];

  const lungs = healthMetrics.find((m) => m.id === 'lungs');
  const energy = healthMetrics.find((m) => m.id === 'energy');
  const focus = healthMetrics.find((m) => m.id === 'focus');
  const sleep = healthMetrics.find((m) => m.id === 'sleep');
  const mood = healthMetrics.find((m) => m.id === 'mood');
  const clarity = healthMetrics.find((m) => m.id === 'clarity');

  const extraMetrics = healthMetrics.filter((m) => !mainIds.includes(m.id));

  // ===== Progresso rumo a 1 ano limpo (gráfico simples de linha do tempo) =====
  const yearlyTarget = 365;
  const yearlyProgress = Math.min(
    100,
    yearlyTarget > 0 ? (cleanDays / yearlyTarget) * 100 : 0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* HEADER */}
      <header className="bg-black/40 backdrop-blur-xl shadow-lg sticky top-0 z-40 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Voltar para o Dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-white/80" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-7 h-7 text-purple-500" />
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Análises da Sua Jornada
                </h1>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Esta tela mostra projeções e indicadores com base no seu tempo
                limpo. São estimativas internas do aplicativo e não substituem
                avaliação profissional de saúde.
              </p>
            </div>
          </div>

          <Link
            href="/profile"
            className="px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-purple-600 dark:text-purple-300"
          >
            <Brain className="w-4 h-4" />
            <span>Perfil & Configurações</span>
          </Link>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Resumo principal */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-6 shadow-xl text-white">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Dias limpos</h2>
            </div>
            <div className="text-5xl font-bold mb-1">
              {formatNumber(cleanDays)}
            </div>
            <p className="text-sm opacity-80">
              Tempo total desde o início da sua jornada registrada
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 shadow-xl text-white">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Economia acumulada</h2>
            </div>
            <div className="text-4xl font-bold mb-1">
              {formatCurrency(savings)}
            </div>
            <p className="text-sm opacity-80">
              Baseado no custo diário informado no seu perfil
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-6 shadow-xl text-white">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Baseados evitados</h2>
            </div>
            <div className="text-4xl font-bold mb-1">
              {formatNumber(jointsAvoided)}
            </div>
            <p className="text-sm opacity-80">
              Quantidade estimada que você decidiu não fumar
            </p>
          </div>
        </section>

        {/* Progresso rumo a 1 ano limpo */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-500" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Caminho até 1 ano limpo
              </h3>
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {formatNumber(cleanDays)} / {yearlyTarget} dias
            </span>
          </div>

          <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-full transition-all duration-700"
              style={{ width: `${yearlyProgress}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>7d</span>
            <span>30d</span>
            <span>90d</span>
            <span>180d</span>
            <span>365d</span>
          </div>

          <p className="mt-3 text-xs flex items-start gap-2 text-gray-500 dark:text-gray-400">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            Este gráfico mostra apenas o seu progresso dentro da meta de 1 ano
            do aplicativo. Ele não representa um prazo médico oficial de
            recuperação.
          </p>
        </section>

        {/* Projeções futuras */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-green-500" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Se você continuar assim, nos próximos...
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {projections.map((p) => (
              <div
                key={p.id}
                className="rounded-xl p-4 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 flex flex-col gap-2"
              >
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {p.label}
                </span>

                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-500" />
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Vai economizar cerca de
                    </span>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                      {formatCurrency(p.projSavings)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Cigarette className="w-4 h-4 text-red-500" />
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Vai deixar de fumar
                    </span>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                      {formatNumber(Math.round(p.projJoints))} baseados
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Leaf className="w-4 h-4 text-green-600" />
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Equivalente a
                    </span>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                      {p.projGrams.toFixed(1)}g de erva
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            As projeções consideram as informações que você preencheu no
            cadastro (custo diário, frequência e quantidade). Você pode ajustar
            esses dados na página de Perfil para ter estimativas mais fiéis à
            sua realidade.
          </p>
        </section>

        {/* Bloco de consumo e THC (histórico até agora) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Leaf className="w-5 h-5 text-green-500" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Gramas evitadas até agora
              </h3>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              {gramsAvoided.toFixed(1)}g
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Quantidade total estimada de erva que você não consumiu nesse
              período limpo.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-yellow-500" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                THC evitado até agora
              </h3>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              {(thcAvoided / 1000).toFixed(1)}g
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Estimativa baseada na potência de THC informada no perfil.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Cigarette className="w-5 h-5 text-red-500" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Seu padrão antigo
              </h3>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              {userData.frequencyAmount || 0}x /{' '}
              {userData.frequencyPeriod === 'day'
                ? 'dia'
                : userData.frequencyPeriod === 'week'
                ? 'semana'
                : 'mês'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Comparação com o padrão de consumo que você registrou ao entrar
              no aplicativo.
            </p>
          </div>
        </section>

        {/* Saúde física x saúde mental */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Saúde física (interno do app)
              </h3>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Este agrupamento considera indicadores como pulmões, energia e
              sono dentro da lógica do aplicativo.
            </p>

            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Pontuação média
              </span>
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {physicalScore !== null
                  ? formatPercentage(physicalScore)
                  : '—'}
              </span>
            </div>

            <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-700"
                style={{
                  width: `${
                    physicalScore !== null
                      ? Math.min(Math.max(physicalScore, 0), 100)
                      : 0
                  }%`,
                }}
              />
            </div>

            <ul className="mt-4 text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <li>• Pulmões, energia e sono são puxados pelo tempo limpo.</li>
              <li>
                • Não é um laudo médico, é apenas um termômetro interno para
                acompanhar sua evolução.
              </li>
            </ul>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-5 h-5 text-purple-500" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Saúde mental (interno do app)
              </h3>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Aqui entram indicadores como foco, humor e clareza mental dentro
              da escala do app.
            </p>

            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Pontuação média
              </span>
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {mentalScore !== null ? formatPercentage(mentalScore) : '—'}
              </span>
            </div>

            <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-700"
                style={{
                  width: `${
                    mentalScore !== null
                      ? Math.min(Math.max(mentalScore, 0), 100)
                      : 0
                  }%`,
                }}
              />
            </div>

            <ul className="mt-4 text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <li>
                • A evolução tende a ficar mais perceptível conforme você
                acumula mais dias limpo.
              </li>
              <li>
                • Use esses números como motivação, não como diagnóstico.
              </li>
            </ul>
          </div>
        </section>

        {/* Indicadores de saúde principais em detalhe */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Indicadores de Saúde (escala interna)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[lungs, energy, focus, sleep, mood, clarity]
              .filter(Boolean)
              .map((metric) => {
                const value = Number.isFinite(metric!.value)
                  ? metric!.value
                  : 0;
                const width = `${Math.min(Math.max(value, 0), 100)}%`;

                return (
                  <div
                    key={metric!.id}
                    className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-gray-100 dark:border-gray-600"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{metric!.icon}</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-100">
                          {metric!.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                        {formatPercentage(value)}
                      </span>
                    </div>

                    <div className="relative w-full h-2.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className={`absolute top-0 left-0 h-full bg-gradient-to-r ${metric!.color} rounded-full transition-all duration-700`}
                        style={{ width }}
                      />
                    </div>

                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {value < 25 && 'Começando a recuperar...'}
                      {value >= 25 && value < 50 && 'Progresso visível!'}
                      {value >= 50 && value < 75 && 'Ótima evolução em curso.'}
                      {value >= 75 && value < 100 && 'Quase totalmente recuperado.'}
                      {value === 100 && 'Indicador totalmente recuperado! 🎉'}
                    </p>
                  </div>
                );
              })}
          </div>

          {extraMetrics.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Outros indicadores monitorados pelo app
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {extraMetrics.map((metric) => {
                  const value = Number.isFinite(metric.value)
                    ? metric.value
                    : 0;
                  return (
                    <div
                      key={metric.id}
                      className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2 border border-gray-100 dark:border-gray-600"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{metric.icon}</span>
                        <span className="text-sm text-gray-700 dark:text-gray-200">
                          {metric.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                        {formatPercentage(value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            Todos os indicadores desta seção são calculados apenas com base no
            tempo limpo dentro da lógica do Weed Reset. Eles servem para ajudar
            na motivação e organização da jornada e não devem ser interpretados
            como diagnóstico médico.
          </p>
        </section>
      </main>
    </div>
  );
}
