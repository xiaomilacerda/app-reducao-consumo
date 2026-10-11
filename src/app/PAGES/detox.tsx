'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/storage';
import { UserData, DetoxMetric } from '@/lib/types';
import { Droplet, ArrowLeft, Lock, Crown, Moon, Dumbbell, TrendingDown, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function DetoxCyclePage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [detoxDays, setDetoxDays] = useState(0);
  const [detoxMetrics, setDetoxMetrics] = useState<DetoxMetric[]>([]);

  useEffect(() => {
    setMounted(true);
    const data = storage.getUserData();
    
    if (!data || !data.onboardingCompleted) {
      router.push('/onboarding');
      return;
    }

    setUserData(data);
    
    if (data.detoxCycleActive && data.detoxCycleStartDate) {
      const start = new Date(data.detoxCycleStartDate);
      const now = new Date();
      const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      setDetoxDays(days);
      generateDetoxMetrics(days, data.thcPotency || 15);
    }
  }, [router]);

  const generateDetoxMetrics = (days: number, thcPotency: number) => {
    const metrics: DetoxMetric[] = [];
    
    for (let day = 0; day <= Math.min(days, 30); day++) {
      // THC diminui exponencialmente
      const thcLevel = 100 * Math.exp(-0.1 * day);
      
      metrics.push({
        day,
        thcLevel: Math.max(thcLevel, 0),
        hydrationGoal: 3000, // 3L por dia
        sleepGoal: 8, // 8 horas
        exerciseMinutes: 30, // 30 min
      });
    }
    
    setDetoxMetrics(metrics);
  };

  const activateDetoxCycle = () => {
    if (!userData) return;
    
    const updatedData = {
      ...userData,
      detoxCycleActive: true,
      detoxCycleStartDate: new Date().toISOString(),
    };
    
    storage.saveUserData(updatedData);
    setUserData(updatedData);
    setDetoxDays(0);
    generateDetoxMetrics(0, userData.thcPotency || 15);
  };

  if (!mounted || !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  const isPremium = userData.isPremium;
  const currentMetric = detoxMetrics[detoxDays] || detoxMetrics[0];

  return (
    <div className={`min-h-screen ${userData.themeMode === 'focus' ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900' : 'bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900'}`}>
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </Link>
              <Droplet className="w-8 h-8 text-cyan-500" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                Ciclo de Limpeza
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
      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Bloqueio Premium */}
        {!isPremium && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-8 shadow-2xl text-white">
            <div className="flex items-center gap-4 mb-4">
              <Lock className="w-12 h-12" />
              <div>
                <h2 className="text-2xl font-bold">Recurso Super Premium</h2>
                <p className="text-lg opacity-90">
                  O Ciclo de Limpeza completo está disponível apenas para usuários Premium.
                </p>
              </div>
            </div>
            <button className="w-full mt-4 py-4 bg-white text-orange-600 font-bold rounded-xl hover:bg-gray-100 transition-colors">
              Assinar Premium Agora
            </button>
          </div>
        )}

        {isPremium && !userData.detoxCycleActive && (
          <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl p-8 shadow-2xl text-white">
            <h2 className="text-3xl font-bold mb-4">Ativar Ciclo de Limpeza</h2>
            <p className="text-lg opacity-90 mb-6">
              Inicie um ciclo de 30 dias para acelerar a limpeza do THC do seu corpo.
              Você receberá recomendações diárias personalizadas!
            </p>
            <button
              onClick={activateDetoxCycle}
              className="w-full py-4 bg-white text-cyan-600 font-bold rounded-xl hover:bg-gray-100 transition-colors"
            >
              Iniciar Ciclo Agora
            </button>
          </div>
        )}

        {isPremium && userData.detoxCycleActive && (
          <>
            {/* Progresso do Ciclo */}
            <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl p-8 shadow-2xl text-white">
              <h2 className="text-3xl font-bold mb-4">Dia {detoxDays} de 30</h2>
              <div className="w-full bg-white/20 rounded-full h-4 mb-4">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${(detoxDays / 30) * 100}%` }}
                />
              </div>
              <p className="text-lg opacity-90">
                {30 - detoxDays} dias restantes para completar o ciclo
              </p>
            </div>

            {/* Nível de THC */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <TrendingDown className="w-8 h-8 text-green-500" />
                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                  Nível de THC Estimado
                </h3>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Redução de THC:</span>
                  <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {currentMetric ? Math.round(100 - currentMetric.thcLevel) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${currentMetric ? 100 - currentMetric.thcLevel : 100}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">THC Restante</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {currentMetric ? Math.round(currentMetric.thcLevel) : 100}%
                  </p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <p className="text-sm text-green-600 dark:text-green-400 mb-1">Previsão de Limpeza</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {Math.max(30 - detoxDays, 0)} dias
                  </p>
                </div>
              </div>
            </div>

            {/* Recomendações Diárias */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6">
                Recomendações para Hoje
              </h3>

              <div className="space-y-4">
                {/* Hidratação */}
                <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-blue-400 dark:border-blue-600">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Droplet className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-2">
                        Hidratação
                      </h4>
                      <p className="text-blue-700 dark:text-blue-400 mb-3">
                        Beba pelo menos {currentMetric?.hydrationGoal || 3000}ml de água hoje
                      </p>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm text-blue-600 dark:text-blue-400">
                          A água acelera a eliminação de toxinas
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sono */}
                <div className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-xl border-2 border-purple-400 dark:border-purple-600">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Moon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-purple-800 dark:text-purple-300 mb-2">
                        Sono de Qualidade
                      </h4>
                      <p className="text-purple-700 dark:text-purple-400 mb-3">
                        Durma pelo menos {currentMetric?.sleepGoal || 8} horas esta noite
                      </p>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <span className="text-sm text-purple-600 dark:text-purple-400">
                          O sono profundo regenera o corpo
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Exercício */}
                <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-xl border-2 border-green-400 dark:border-green-600">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Dumbbell className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-green-800 dark:text-green-300 mb-2">
                        Exercício Físico
                      </h4>
                      <p className="text-green-700 dark:text-green-400 mb-3">
                        Faça pelo menos {currentMetric?.exerciseMinutes || 30} minutos de atividade física
                      </p>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <span className="text-sm text-green-600 dark:text-green-400">
                          Exercícios aceleram o metabolismo e a limpeza
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dicas Extras */}
            <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl p-8 shadow-2xl text-white">
              <h3 className="text-2xl font-bold mb-4">Dicas para Acelerar a Limpeza</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-2xl">🥗</span>
                  <span>Coma alimentos ricos em fibras (frutas, vegetais, grãos integrais)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl">🏃</span>
                  <span>Pratique exercícios aeróbicos para suar e eliminar toxinas</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl">🧘</span>
                  <span>Medite para reduzir o estresse e melhorar o sono</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl">🚫</span>
                  <span>Evite álcool e alimentos processados</span>
                </li>
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
