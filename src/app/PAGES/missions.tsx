'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/storage';
import { UserData, Mission } from '@/lib/types';
import { Target, ArrowLeft, Trophy, Star, CheckCircle, Clock, Zap } from 'lucide-react';
import Link from 'next/link';

const DAILY_MISSIONS: Omit<Mission, 'id' | 'completed' | 'completedAt'>[] = [
  {
    title: 'Espere 5 Minutos',
    description: 'Quando sentir vontade, espere 5 minutos antes de fumar',
    type: 'daily',
    xpReward: 50,
    category: 'delay',
  },
  {
    title: 'Troque por um Suco',
    description: 'Substitua 1 baseado por um suco natural ou smoothie',
    type: 'daily',
    xpReward: 75,
    category: 'substitute',
  },
  {
    title: 'Não Fume no Primeiro Horário',
    description: 'Evite fumar logo ao acordar',
    type: 'daily',
    xpReward: 100,
    category: 'delay',
  },
  {
    title: 'Abra "Não Consigo Parar"',
    description: 'Visite a aba "Não Consigo Parar" pelo menos uma vez',
    type: 'daily',
    xpReward: 30,
    category: 'engage',
  },
  {
    title: 'Registre seu Humor',
    description: 'Registre como você está se sentindo hoje',
    type: 'daily',
    xpReward: 40,
    category: 'track',
  },
];

const WEEKLY_MISSIONS: Omit<Mission, 'id' | 'completed' | 'completedAt'>[] = [
  {
    title: 'Semana Sem Recaída',
    description: 'Complete 7 dias sem registrar recaída',
    type: 'weekly',
    xpReward: 500,
    category: 'delay',
  },
  {
    title: 'Mestre das Receitas',
    description: 'Experimente 3 receitas alternativas diferentes',
    type: 'weekly',
    xpReward: 300,
    category: 'substitute',
  },
  {
    title: 'Engajamento Total',
    description: 'Complete todas as missões diárias por 5 dias',
    type: 'weekly',
    xpReward: 400,
    category: 'engage',
  },
  {
    title: 'Rastreador Consistente',
    description: 'Registre seu humor todos os dias da semana',
    type: 'weekly',
    xpReward: 250,
    category: 'track',
  },
];

export default function MissionsPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dailyMissions, setDailyMissions] = useState<Mission[]>([]);
  const [weeklyMissions, setWeeklyMissions] = useState<Mission[]>([]);
  const [totalXP, setTotalXP] = useState(0);
  const [level, setLevel] = useState(1);

  useEffect(() => {
    setMounted(true);
    const data = storage.getUserData();
    
    if (!data || !data.onboardingCompleted) {
      router.push('/onboarding');
      return;
    }

    setUserData(data);
    loadMissions();
    calculateLevel(data.xp || 0);
  }, [router]);

  const loadMissions = () => {
    if (typeof window !== 'undefined') {
      const today = new Date().toISOString().split('T')[0];
      const savedDaily = localStorage.getItem(`missions_daily_${today}`);
      const savedWeekly = localStorage.getItem('missions_weekly');

      if (savedDaily) {
        setDailyMissions(JSON.parse(savedDaily));
      } else {
        const newDaily = DAILY_MISSIONS.map((m, idx) => ({
          ...m,
          id: `daily_${idx}_${Date.now()}`,
          completed: false,
        }));
        setDailyMissions(newDaily);
        localStorage.setItem(`missions_daily_${today}`, JSON.stringify(newDaily));
      }

      if (savedWeekly) {
        setWeeklyMissions(JSON.parse(savedWeekly));
      } else {
        const newWeekly = WEEKLY_MISSIONS.map((m, idx) => ({
          ...m,
          id: `weekly_${idx}_${Date.now()}`,
          completed: false,
        }));
        setWeeklyMissions(newWeekly);
        localStorage.setItem('missions_weekly', JSON.stringify(newWeekly));
      }

      const xp = localStorage.getItem('total_xp');
      if (xp) setTotalXP(parseInt(xp));
    }
  };

  const calculateLevel = (xp: number) => {
    const newLevel = Math.floor(xp / 500) + 1;
    setLevel(newLevel);
  };

  const completeMission = (missionId: string, type: 'daily' | 'weekly') => {
    const missions = type === 'daily' ? dailyMissions : weeklyMissions;
    const mission = missions.find(m => m.id === missionId);
    
    if (!mission || mission.completed) return;

    const updatedMissions = missions.map(m =>
      m.id === missionId
        ? { ...m, completed: true, completedAt: new Date().toISOString() }
        : m
    );

    if (type === 'daily') {
      setDailyMissions(updatedMissions);
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem(`missions_daily_${today}`, JSON.stringify(updatedMissions));
    } else {
      setWeeklyMissions(updatedMissions);
      localStorage.setItem('missions_weekly', JSON.stringify(updatedMissions));
    }

    // Adicionar XP
    const newXP = totalXP + mission.xpReward;
    setTotalXP(newXP);
    localStorage.setItem('total_xp', newXP.toString());
    calculateLevel(newXP);

    // Atualizar userData
    if (userData) {
      const updatedData = {
        ...userData,
        xp: newXP,
        level,
        completedMissions: [...(userData.completedMissions || []), missionId],
      };
      storage.saveUserData(updatedData);
      setUserData(updatedData);
    }
  };

  if (!mounted || !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  const dailyCompleted = dailyMissions.filter(m => m.completed).length;
  const weeklyCompleted = weeklyMissions.filter(m => m.completed).length;
  const xpToNextLevel = (level * 500) - totalXP;

  return (
    <div className={`min-h-screen ${userData.themeMode === 'focus' ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900' : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900'}`}>
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </Link>
            <Target className="w-8 h-8 text-purple-500" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Missões e Recompensas
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Progresso do Jogador */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-8 shadow-2xl text-white">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold mb-2">Nível {level}</h2>
              <p className="text-lg opacity-90">{totalXP} XP Total</p>
            </div>
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
              <Trophy className="w-10 h-10" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progresso para Nível {level + 1}</span>
              <span>{xpToNextLevel} XP restantes</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-4">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${((totalXP % 500) / 500) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-8 h-8 text-blue-500" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                Missões Diárias
              </h3>
            </div>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {dailyCompleted}/{dailyMissions.length}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Completadas hoje
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-2">
              <Star className="w-8 h-8 text-yellow-500" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                Missões Semanais
              </h3>
            </div>
            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {weeklyCompleted}/{weeklyMissions.length}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Completadas esta semana
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-8 h-8 text-purple-500" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                XP Disponível
              </h3>
            </div>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {dailyMissions.filter(m => !m.completed).reduce((sum, m) => sum + m.xpReward, 0) +
               weeklyMissions.filter(m => !m.completed).reduce((sum, m) => sum + m.xpReward, 0)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Para ganhar hoje
            </p>
          </div>
        </div>

        {/* Missões Diárias */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-8 h-8 text-blue-500" />
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              Missões Diárias
            </h3>
          </div>

          <div className="space-y-4">
            {dailyMissions.map((mission) => (
              <div
                key={mission.id}
                className={`p-6 rounded-xl border-2 transition-all ${
                  mission.completed
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-600'
                    : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-600'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {mission.completed ? (
                        <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                      ) : (
                        <div className="w-6 h-6 border-2 border-gray-400 dark:border-gray-500 rounded-full" />
                      )}
                      <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                        {mission.title}
                      </h4>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 ml-9">
                      {mission.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm font-semibold">
                      +{mission.xpReward} XP
                    </span>
                    {!mission.completed && (
                      <button
                        onClick={() => completeMission(mission.id, 'daily')}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all text-sm"
                      >
                        Completar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Missões Semanais */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <Star className="w-8 h-8 text-yellow-500" />
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              Missões Semanais
            </h3>
          </div>

          <div className="space-y-4">
            {weeklyMissions.map((mission) => (
              <div
                key={mission.id}
                className={`p-6 rounded-xl border-2 transition-all ${
                  mission.completed
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 dark:border-yellow-600'
                    : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-yellow-400 dark:hover:border-yellow-600'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {mission.completed ? (
                        <CheckCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                      ) : (
                        <div className="w-6 h-6 border-2 border-gray-400 dark:border-gray-500 rounded-full" />
                      )}
                      <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                        {mission.title}
                      </h4>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 ml-9">
                      {mission.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-sm font-semibold">
                      +{mission.xpReward} XP
                    </span>
                    {!mission.completed && (
                      <button
                        onClick={() => completeMission(mission.id, 'weekly')}
                        className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all text-sm"
                      >
                        Completar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
