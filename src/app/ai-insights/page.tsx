'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/storage';
import { UserData, AIInsight, RelapseRecord } from '@/lib/types';
import { Brain, ArrowLeft, AlertTriangle, TrendingUp, Clock, Lock, Crown } from 'lucide-react';
import Link from 'next/link';

export default function AIInsightsPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>('low');

  useEffect(() => {
    setMounted(true);
    const data = storage.getUserData();
    
    if (!data || !data.onboardingCompleted) {
      router.push('/onboarding');
      return;
    }

    setUserData(data);
    generateAIInsights(data);
  }, [router]);

  const generateAIInsights = (data: UserData) => {
    const generatedInsights: AIInsight[] = [];
    const relapseHistory = data.relapseHistory || [];
    
    // Análise de padrões de horário
    if (relapseHistory.length >= 3) {
      const hourCounts: { [key: number]: number } = {};
      
      relapseHistory.forEach((relapse) => {
        const hour = parseInt(relapse.time.split(':')[0]);
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      const peakHours = Object.entries(hourCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([hour]) => parseInt(hour));

      if (peakHours.length > 0) {
        generatedInsights.push({
          id: `insight_${Date.now()}_1`,
          type: 'pattern',
          title: 'Horários de Maior Risco',
          description: `Você costuma ter recaídas entre ${peakHours[0]}h e ${peakHours[0] + 2}h. Prepare-se antes desse período com técnicas de respiração ou distrações.`,
          timestamp: new Date().toISOString(),
          priority: 'high',
        });
      }
    }

    // Análise de frequência recente
    const recentRelapses = relapseHistory.filter((r) => {
      const relapseDate = new Date(r.date);
      const daysDiff = Math.floor((Date.now() - relapseDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff <= 7;
    });

    if (recentRelapses.length >= 3) {
      setRiskLevel('high');
      generatedInsights.push({
        id: `insight_${Date.now()}_2`,
        type: 'relapse-risk',
        title: 'Nível de Risco Alto',
        description: `Você teve ${recentRelapses.length} recaídas nos últimos 7 dias. Seu nível de risco está alto. Considere usar o Modo SOS ou conversar com alguém de confiança.`,
        timestamp: new Date().toISOString(),
        priority: 'high',
      });
    } else if (recentRelapses.length >= 1) {
      setRiskLevel('medium');
      generatedInsights.push({
        id: `insight_${Date.now()}_3`,
        type: 'relapse-risk',
        title: 'Nível de Risco Moderado',
        description: 'Você teve recaídas recentes. Mantenha-se atento aos seus gatilhos e use as ferramentas disponíveis.',
        timestamp: new Date().toISOString(),
        priority: 'medium',
      });
    } else {
      setRiskLevel('low');
      generatedInsights.push({
        id: `insight_${Date.now()}_4`,
        type: 'achievement',
        title: 'Nível de Risco Baixo',
        description: 'Parabéns! Você está mantendo um bom controle. Continue assim!',
        timestamp: new Date().toISOString(),
        priority: 'low',
      });
    }

    // Análise de gatilhos
    const triggers: { [key: string]: number } = {};
    relapseHistory.forEach((relapse) => {
      if (relapse.trigger) {
        triggers[relapse.trigger] = (triggers[relapse.trigger] || 0) + 1;
      }
    });

    const topTrigger = Object.entries(triggers).sort(([, a], [, b]) => b - a)[0];
    if (topTrigger) {
      generatedInsights.push({
        id: `insight_${Date.now()}_5`,
        type: 'pattern',
        title: 'Gatilho Principal Identificado',
        description: `Seu gatilho mais comum é: "${topTrigger[0]}". Tente evitar ou preparar-se melhor para essas situações.`,
        timestamp: new Date().toISOString(),
        priority: 'medium',
      });
    }

    // Análise de progresso
    const daysSinceStart = Math.floor((Date.now() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24));
    const avgDaysBetweenRelapses = relapseHistory.length > 0 ? daysSinceStart / relapseHistory.length : daysSinceStart;

    if (avgDaysBetweenRelapses > 7) {
      generatedInsights.push({
        id: `insight_${Date.now()}_6`,
        type: 'achievement',
        title: 'Progresso Excelente',
        description: `Em média, você fica ${Math.round(avgDaysBetweenRelapses)} dias entre recaídas. Isso é um progresso incrível!`,
        timestamp: new Date().toISOString(),
        priority: 'low',
      });
    }

    setInsights(generatedInsights);
  };

  if (!mounted || !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  const isPremium = userData.isPremium;

  return (
    <div className={`min-h-screen ${userData.themeMode === 'focus' ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900' : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900'}`}>
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </Link>
              <Brain className="w-8 h-8 text-purple-500" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                IA de Prevenção
              </h1>
            </div>
            {isPremium && (
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-white font-semibold">
                <Crown className="w-5 h-5" />
                <span className="hidden sm:inline">Premium</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Bloqueio Premium */}
        {!isPremium && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-8 shadow-2xl text-white">
            <div className="flex items-center gap-4 mb-4">
              <Lock className="w-12 h-12" />
              <div>
                <h2 className="text-2xl font-bold">Recurso Premium</h2>
                <p className="text-lg opacity-90">
                  A IA de Prevenção de Recaída está disponível apenas para usuários Premium.
                </p>
              </div>
            </div>
            <button className="w-full mt-4 py-4 bg-white text-orange-600 font-bold rounded-xl hover:bg-gray-100 transition-colors">
              Assinar Premium Agora
            </button>
          </div>
        )}

        {isPremium && (
          <>
            {/* Nível de Risco */}
            <div className={`rounded-2xl p-8 shadow-2xl text-white ${
              riskLevel === 'high'
                ? 'bg-gradient-to-r from-red-500 to-pink-600'
                : riskLevel === 'medium'
                ? 'bg-gradient-to-r from-yellow-500 to-orange-600'
                : 'bg-gradient-to-r from-green-500 to-emerald-600'
            }`}>
              <div className="flex items-center gap-4 mb-4">
                <AlertTriangle className="w-12 h-12" />
                <div>
                  <h2 className="text-3xl font-bold">
                    Nível de Risco: {riskLevel === 'high' ? 'Alto' : riskLevel === 'medium' ? 'Moderado' : 'Baixo'}
                  </h2>
                  <p className="text-lg opacity-90">
                    {riskLevel === 'high' && 'Atenção! Considere usar o Modo SOS agora.'}
                    {riskLevel === 'medium' && 'Mantenha-se atento aos seus gatilhos.'}
                    {riskLevel === 'low' && 'Você está indo muito bem! Continue assim.'}
                  </p>
                </div>
              </div>

              {riskLevel === 'high' && (
                <Link
                  href="/sos"
                  className="block w-full py-4 bg-white text-red-600 font-bold rounded-xl hover:bg-gray-100 transition-colors text-center mt-4"
                >
                  Abrir Modo SOS Agora
                </Link>
              )}
            </div>

            {/* Insights de IA */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <Brain className="w-8 h-8 text-purple-500" />
                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                  Insights Personalizados
                </h3>
              </div>

              <div className="space-y-4">
                {insights.map((insight) => (
                  <div
                    key={insight.id}
                    className={`p-6 rounded-xl border-2 ${
                      insight.priority === 'high'
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-600'
                        : insight.priority === 'medium'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 dark:border-yellow-600'
                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        insight.priority === 'high'
                          ? 'bg-red-500'
                          : insight.priority === 'medium'
                          ? 'bg-yellow-500'
                          : 'bg-blue-500'
                      }`}>
                        {insight.type === 'relapse-risk' && <AlertTriangle className="w-6 h-6 text-white" />}
                        {insight.type === 'pattern' && <Clock className="w-6 h-6 text-white" />}
                        {insight.type === 'achievement' && <TrendingUp className="w-6 h-6 text-white" />}
                      </div>
                      <div className="flex-1">
                        <h4 className={`text-lg font-bold mb-2 ${
                          insight.priority === 'high'
                            ? 'text-red-800 dark:text-red-300'
                            : insight.priority === 'medium'
                            ? 'text-yellow-800 dark:text-yellow-300'
                            : 'text-blue-800 dark:text-blue-300'
                        }`}>
                          {insight.title}
                        </h4>
                        <p className={`${
                          insight.priority === 'high'
                            ? 'text-red-700 dark:text-red-400'
                            : insight.priority === 'medium'
                            ? 'text-yellow-700 dark:text-yellow-400'
                            : 'text-blue-700 dark:text-blue-400'
                        }`}>
                          {insight.description}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                          {new Date(insight.timestamp).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {insights.length === 0 && (
                  <div className="text-center py-12">
                    <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 text-lg">
                      Continue registrando seu progresso para receber insights personalizados!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Recomendações */}
            <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-8 shadow-2xl text-white">
              <h3 className="text-2xl font-bold mb-4">Recomendações da IA</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-2xl">✅</span>
                  <span>Registre seu humor diariamente para melhorar a precisão dos insights</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl">✅</span>
                  <span>Use o Modo SOS quando sentir que o risco está aumentando</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl">✅</span>
                  <span>Complete missões diárias para fortalecer sua disciplina</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl">✅</span>
                  <span>Evite seus horários e gatilhos de maior risco</span>
                </li>
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
