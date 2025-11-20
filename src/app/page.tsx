'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Sparkles, TrendingUp, Trophy, Leaf, Zap, Cigarette, Users, Heart, BarChart3, Settings,
  Brain, Smile, Target, Share2, ShoppingBag, Droplet, Activity, AlertCircle, Crown
} from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [cleanDays, setCleanDays] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const data = storage.getUserData();
    
    if (!data || !data.onboardingCompleted) {
      router.push('/onboarding');
      return;
    }

    setUserData(data);
    loadAchievements(data);

    // Atualizar a cada segundo
    const interval = setInterval(() => {
      const days = calculateCleanDays(data.startDate, data.lastRelapseDate);
      setCleanDays(days);
      checkAndUnlockAchievements(days, data);
    }, 1000);

    return () => clearInterval(interval);
  }, [router]);

  const loadAchievements = (data: UserData) => {
    const days = calculateCleanDays(data.startDate, data.lastRelapseDate);
    setCleanDays(days);
    checkAndUnlockAchievements(days, data);
  };

  const checkAndUnlockAchievements = (days: number, data: UserData) => {
    const currentAchievements = storage.getAchievements();
    const savings = calculateSavings(days, data.dailyCost || 0);
    let updated = false;

    const updatedAchievements = currentAchievements.map((achievement) => {
      if (!achievement.unlocked) {
        // Conquistas de tempo
        if (achievement.category === 'time' && days >= achievement.daysRequired) {
          updated = true;
          return {
            ...achievement,
            unlocked: true,
            unlockedAt: new Date().toISOString(),
          };
        }
        
        // Conquistas de economia
        if (achievement.category === 'savings') {
          if (achievement.id === 'save100' && savings >= 100) {
            updated = true;
            return { ...achievement, unlocked: true, unlockedAt: new Date().toISOString() };
          }
          if (achievement.id === 'save500' && savings >= 500) {
            updated = true;
            return { ...achievement, unlocked: true, unlockedAt: new Date().toISOString() };
          }
          if (achievement.id === 'save1000' && savings >= 1000) {
            updated = true;
            return { ...achievement, unlocked: true, unlockedAt: new Date().toISOString() };
          }
        }
      }
      return achievement;
    });

    if (updated) {
      storage.updateAchievements(updatedAchievements);
    }

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  const timeInfo = formatCleanTime(cleanDays);
  const savings = calculateSavings(cleanDays, userData.dailyCost || 0);
  const healthMetrics = calculateHealthMetrics(cleanDays);
  const dailyFrequency = calculateDailyFrequency(userData.frequencyAmount || 0, userData.frequencyPeriod || 'day');
  const gramsAvoided = calculateGramsAvoided(cleanDays, userData.gramsPerJoint || 0, dailyFrequency);
  const thcAvoided = calculateTHCAvoided(gramsAvoided, userData.thcPotency || 0);
  const jointsAvoided = calculateJointsAvoided(cleanDays, dailyFrequency);

  const isFocusMode = userData.themeMode === 'focus';

  return (
    <div className={`min-h-screen ${isFocusMode ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900' : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900'}`}>
      {/* Header com navegação */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-purple-500" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Sua Jornada
              </h1>
              {userData.isPremium && (
                <Crown className="w-6 h-6 text-yellow-500" />
              )}
            </div>
            
            {/* Navegação Desktop */}
            <nav className="hidden lg:flex items-center gap-2">
              <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-semibold text-sm">
                <Trophy className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <Link href="/community" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors text-sm">
                <Users className="w-4 h-4" />
                <span>Comunidade</span>
              </Link>
              <Link href="/cant-stop" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors text-sm">
                <Heart className="w-4 h-4" />
                <span>Não Consigo Parar</span>
              </Link>
              <Link href="/analytics" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors text-sm">
                <BarChart3 className="w-4 h-4" />
                <span>Análises</span>
              </Link>
            </nav>
            
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={isFocusMode ? 'Modo Padrão' : 'Modo Focus'}
              >
                {isFocusMode ? '🌙' : '☀️'}
              </button>
              <button
                onClick={() => {
                  if (confirm('Tem certeza que deseja resetar todos os dados?')) {
                    storage.clearAll();
                    router.push('/onboarding');
                  }
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
          
          {/* Navegação Mobile */}
          <nav className="lg:hidden flex items-center gap-2 mt-4 overflow-x-auto pb-2">
            <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-semibold whitespace-nowrap text-sm">
              <Trophy className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>
            <Link href="/community" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors whitespace-nowrap text-sm">
              <Users className="w-4 h-4" />
              <span>Comunidade</span>
            </Link>
            <Link href="/cant-stop" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors whitespace-nowrap text-sm">
              <Heart className="w-4 h-4" />
              <span>Não Consigo Parar</span>
            </Link>
            <Link href="/analytics" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors whitespace-nowrap text-sm">
              <BarChart3 className="w-4 h-4" />
              <span>Análises</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Recursos Avançados - Grid de Acesso Rápido */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <Link href="/sos" className="p-4 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl shadow-lg hover:shadow-2xl transition-all text-white text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">Modo SOS</p>
          </Link>
          
          <Link href="/mood" className="p-4 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg hover:shadow-2xl transition-all text-white text-center">
            <Smile className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">Humor</p>
          </Link>
          
          <Link href="/missions" className="p-4 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg hover:shadow-2xl transition-all text-white text-center">
            <Target className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">Missões</p>
          </Link>
          
          <Link href="/body-evolution" className="p-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg hover:shadow-2xl transition-all text-white text-center">
            <Activity className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">Evolução</p>
          </Link>
          
          <Link href="/detox" className="p-4 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg hover:shadow-2xl transition-all text-white text-center">
            <Droplet className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">Detox</p>
          </Link>
          
          <Link href="/share" className="p-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg hover:shadow-2xl transition-all text-white text-center">
            <Share2 className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">Compartilhar</p>
          </Link>
          
          <Link href="/rewards" className="p-4 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl shadow-lg hover:shadow-2xl transition-all text-white text-center">
            <ShoppingBag className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">Loja</p>
          </Link>
          
          <Link href="/ai-insights" className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg hover:shadow-2xl transition-all text-white text-center">
            <Brain className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">IA Insights</p>
          </Link>
        </div>

        {/* Contador Principal */}
        <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl p-8 shadow-2xl text-white">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Trophy className="w-8 h-8" />
              <h2 className="text-2xl font-bold">Tempo Limpo</h2>
            </div>
            
            <div className="space-y-2">
              <div className="text-7xl font-bold">
                {timeInfo.value}
              </div>
              <div className="text-3xl font-semibold opacity-90">
                {timeInfo.unit}
              </div>
              <div className="text-xl opacity-75">
                {timeInfo.detail}
              </div>
            </div>

            {cleanDays > 0 && (
              <div className="mt-6 pt-6 border-t border-white/20">
                <p className="text-lg opacity-90">
                  Você está fazendo um trabalho incrível! Continue assim! 💪
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Métricas Principais - Grid 2x2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Economia */}
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 shadow-xl text-white">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-8 h-8" />
              <h3 className="text-xl font-bold">Economia Total</h3>
            </div>
            <div className="text-5xl font-bold mb-2">
              {formatCurrency(savings)}
            </div>
            <p className="text-lg opacity-90">
              Dinheiro economizado desde o início
            </p>
          </div>

          {/* Gramas Evitadas */}
          <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-6 shadow-xl text-white">
            <div className="flex items-center gap-3 mb-4">
              <Leaf className="w-8 h-8" />
              <h3 className="text-xl font-bold">Gramas Evitadas</h3>
            </div>
            <div className="text-5xl font-bold mb-2">
              {gramsAvoided.toFixed(1)}g
            </div>
            <p className="text-lg opacity-90">
              Total de gramas não consumidas
            </p>
          </div>

          {/* THC Evitado */}
          <div className="bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl p-6 shadow-xl text-white">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-8 h-8" />
              <h3 className="text-xl font-bold">THC Evitado</h3>
            </div>
            <div className="text-5xl font-bold mb-2">
              {(thcAvoided / 1000).toFixed(1)}g
            </div>
            <p className="text-lg opacity-90">
              Total de THC não consumido
            </p>
          </div>

          {/* Baseados Evitados */}
          <div className="bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl p-6 shadow-xl text-white">
            <div className="flex items-center gap-3 mb-4">
              <Cigarette className="w-8 h-8" />
              <h3 className="text-xl font-bold">Baseados Evitados</h3>
            </div>
            <div className="text-5xl font-bold mb-2">
              {jointsAvoided}
            </div>
            <p className="text-lg opacity-90">
              Número de baseados não fumados
            </p>
          </div>
        </div>

        {/* Estatísticas Detalhadas */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            Estatísticas Detalhadas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">Total de recaídas:</span>
              <span className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                {userData.totalRelapses || 0}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">Métodos:</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {Array.isArray(userData.consumptionMethods) && userData.consumptionMethods.length > 0
                  ? userData.consumptionMethods.join(', ')
                  : 'Não informado'}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">Frequência anterior:</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {userData.frequencyAmount || 0}x por {userData.frequencyPeriod === 'day' ? 'dia' : userData.frequencyPeriod === 'week' ? 'semana' : 'mês'}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">Potência THC:</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {userData.thcPotency || 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Conquistas */}
        <AchievementsCard achievements={achievements} />

        {/* Barras de Saúde */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
          <HealthBars metrics={healthMetrics} />
        </div>

        {/* Botão de Recaída */}
        <div className="pb-8">
          <RelapseButton onRelapse={handleRelapse} />
        </div>
      </main>
    </div>
  );
}
