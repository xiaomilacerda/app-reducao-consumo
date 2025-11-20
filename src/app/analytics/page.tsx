'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/storage';
import { UserData } from '@/lib/types';
import { 
  calculateCleanDays, 
  calculateSavings, 
  formatCurrency,
  calculateDailyFrequency,
  calculateGramsAvoided,
  calculateHealthMetrics
} from '@/lib/utils-recovery';
import { BarChart3, ArrowLeft, TrendingUp, TrendingDown, Calendar, Clock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function AnalyticsPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [cleanDays, setCleanDays] = useState(0);

  useEffect(() => {
    setMounted(true);
    const data = storage.getUserData();
    
    if (!data || !data.onboardingCompleted) {
      router.push('/onboarding');
      return;
    }

    setUserData(data);
    const days = calculateCleanDays(data.startDate, data.lastRelapseDate);
    setCleanDays(days);
  }, [router]);

  if (!mounted || !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  const savings = calculateSavings(cleanDays, userData.dailyCost || 0);
  const dailyFrequency = calculateDailyFrequency(userData.frequencyAmount || 0, userData.frequencyPeriod || 'day');
  const gramsAvoided = calculateGramsAvoided(cleanDays, userData.gramsPerJoint || 0, dailyFrequency);
  const healthMetrics = calculateHealthMetrics(cleanDays);
  const avgHealthScore = healthMetrics.reduce((sum, m) => sum + m.value, 0) / healthMetrics.length;

  // Análise de horários (simulado - em produção viria do histórico real)
  const totalRelapses = userData.totalRelapses || 0;
  const peakHours = [
    { hour: '18:00 - 20:00', count: Math.floor(totalRelapses * 0.3), percentage: 30 },
    { hour: '20:00 - 22:00', count: Math.floor(totalRelapses * 0.25), percentage: 25 },
    { hour: '14:00 - 16:00', count: Math.floor(totalRelapses * 0.20), percentage: 20 },
    { hour: '22:00 - 00:00', count: Math.floor(totalRelapses * 0.15), percentage: 15 },
    { hour: 'Outros', count: Math.floor(totalRelapses * 0.10), percentage: 10 },
  ];

  // Comparação semanal (simulado)
  const weeklyComparison = [
    { week: 'Semana 1', relapses: Math.max(0, totalRelapses - 3), improvement: 0 },
    { week: 'Semana 2', relapses: Math.max(0, totalRelapses - 2), improvement: 33 },
    { week: 'Semana 3', relapses: Math.max(0, totalRelapses - 1), improvement: 50 },
    { week: 'Semana Atual', relapses: totalRelapses, improvement: 0 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </Link>
            <BarChart3 className="w-8 h-8 text-blue-500" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Análises e Histórico
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Resumo Geral */}
        <div className="bg-gradient-to-r from-blue-500 to-cyan-600 rounded-2xl p-6 shadow-xl text-white">
          <h2 className="text-2xl font-bold mb-3">
            Resumo da Sua Jornada
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-3xl font-bold">{Math.floor(cleanDays)}</div>
              <div className="text-sm opacity-90">Dias Limpo</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{totalRelapses}</div>
              <div className="text-sm opacity-90">Recaídas</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{formatCurrency(savings)}</div>
              <div className="text-sm opacity-90">Economizado</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{Math.round(avgHealthScore)}%</div>
              <div className="text-sm opacity-90">Saúde Geral</div>
            </div>
          </div>
        </div>

        {/* Histórico de Recaídas */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-6 h-6 text-purple-500" />
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">
              Histórico de Recaídas
            </h3>
          </div>
          
          {!Array.isArray(userData.relapseHistory) || userData.relapseHistory.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎉</div>
              <p className="text-gray-600 dark:text-gray-400">
                Nenhuma recaída registrada! Continue assim!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {userData.relapseHistory.slice(-10).reverse().map((relapse) => (
                <div
                  key={relapse.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-gray-200">
                        {new Date(relapse.date).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {relapse.time}
                      </div>
                    </div>
                  </div>
                  {relapse.notes && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {relapse.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Horários Mais Comuns */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-orange-500" />
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">
              Horários de Maior Risco
            </h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Identifique os horários em que você mais teve recaídas para se preparar melhor.
          </p>
          
          <div className="space-y-3">
            {peakHours.map((peak, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {peak.hour}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {peak.count} recaídas ({peak.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-red-600 transition-all duration-300"
                    style={{ width: `${peak.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border-2 border-orange-400 dark:border-orange-600">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-orange-800 dark:text-orange-300 mb-1">
                  Dica Personalizada
                </h4>
                <p className="text-sm text-orange-700 dark:text-orange-400">
                  Seus horários de maior risco são no final da tarde e noite. 
                  Planeje atividades alternativas para esses períodos!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Comparação Semanal */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-green-500" />
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">
              Progresso Semanal
            </h3>
          </div>
          
          <div className="space-y-4">
            {weeklyComparison.map((week, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {week.week}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {week.relapses} recaídas
                    </span>
                    {week.improvement > 0 && (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm font-semibold">
                        <TrendingUp className="w-4 h-4" />
                        {week.improvement}% melhor
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      week.improvement > 0
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-600'
                    }`}
                    style={{ width: `${Math.max(10, 100 - week.relapses * 10)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Estatísticas Gerais */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            Estatísticas Gerais
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Gramas Evitadas
              </div>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {gramsAvoided.toFixed(1)}g
              </div>
            </div>
            <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Economia Média/Dia
              </div>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(userData.dailyCost || 0)}
              </div>
            </div>
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Frequência Anterior
              </div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {userData.frequencyAmount || 0}x/{userData.frequencyPeriod === 'day' ? 'dia' : userData.frequencyPeriod === 'week' ? 'sem' : 'mês'}
              </div>
            </div>
            <div className="p-4 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Potência THC
              </div>
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                {userData.thcPotency || 0}%
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
