'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/storage';
import { UserData, BodyEvolution } from '@/lib/types';
import { Heart, ArrowLeft, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { calculateCleanDays } from '@/lib/utils-recovery';

const BODY_EVOLUTION: BodyEvolution[] = [
  {
    hours: 24,
    title: '24 Horas',
    description: 'Seus receptores CB1 começam a normalizar. A ansiedade pode aumentar temporariamente.',
    icon: '🌱',
    completed: false,
  },
  {
    hours: 48,
    title: '48 Horas',
    description: 'Seu apetite começa a estabilizar. O sono pode estar irregular, mas vai melhorar.',
    icon: '🌿',
    completed: false,
  },
  {
    hours: 72,
    title: '72 Horas',
    description: 'Pico de desintoxicação. Você pode sentir irritabilidade, mas é temporário.',
    icon: '💪',
    completed: false,
  },
  {
    hours: 168,
    title: '1 Semana',
    description: 'Seu humor começa a melhorar significativamente. Clareza mental aumenta.',
    icon: '⭐',
    completed: false,
  },
  {
    hours: 336,
    title: '2 Semanas',
    description: 'Memória e concentração melhoram. Energia física aumenta notavelmente.',
    icon: '🔥',
    completed: false,
  },
  {
    hours: 720,
    title: '1 Mês',
    description: 'Seus pulmões estão mais limpos. Sono profundo e reparador. Você se sente renovado!',
    icon: '👑',
    completed: false,
  },
  {
    hours: 2160,
    title: '3 Meses',
    description: 'Função pulmonar melhorou 30%. Circulação sanguínea normalizada.',
    icon: '💎',
    completed: false,
  },
  {
    hours: 4320,
    title: '6 Meses',
    description: 'Risco de problemas respiratórios reduzido drasticamente. Você está incrível!',
    icon: '🌟',
    completed: false,
  },
  {
    hours: 8760,
    title: '1 Ano',
    description: 'Seu corpo está completamente renovado. Parabéns pela jornada extraordinária!',
    icon: '🎖️',
    completed: false,
  },
];

export default function BodyEvolutionPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [evolution, setEvolution] = useState<BodyEvolution[]>(BODY_EVOLUTION);
  const [cleanHours, setCleanHours] = useState(0);

  useEffect(() => {
    setMounted(true);
    const data = storage.getUserData();
    
    if (!data || !data.onboardingCompleted) {
      router.push('/onboarding');
      return;
    }

    setUserData(data);
    
    // Calcular horas limpas
    const days = calculateCleanDays(data.startDate, data.lastRelapseDate);
    const hours = days * 24;
    setCleanHours(hours);

    // Atualizar evolução
    const updatedEvolution = BODY_EVOLUTION.map(stage => ({
      ...stage,
      completed: hours >= stage.hours,
    }));
    setEvolution(updatedEvolution);
  }, [router]);

  if (!mounted || !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  const completedStages = evolution.filter(s => s.completed).length;
  const nextStage = evolution.find(s => !s.completed);

  return (
    <div className={`min-h-screen ${userData.themeMode === 'focus' ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900' : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900'}`}>
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </Link>
            <Heart className="w-8 h-8 text-red-500" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
              Evolução do Seu Corpo
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Progresso Geral */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-8 shadow-2xl text-white">
          <h2 className="text-3xl font-bold mb-4">Seu Progresso</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-lg opacity-90 mb-2">Tempo Limpo</p>
              <p className="text-4xl font-bold">{Math.floor(cleanHours / 24)} dias</p>
              <p className="text-lg opacity-75">{cleanHours} horas</p>
            </div>
            <div>
              <p className="text-lg opacity-90 mb-2">Etapas Completadas</p>
              <p className="text-4xl font-bold">{completedStages}/{evolution.length}</p>
              <p className="text-lg opacity-75">{Math.round((completedStages / evolution.length) * 100)}% completo</p>
            </div>
          </div>

          {nextStage && (
            <div className="mt-6 pt-6 border-t border-white/20">
              <p className="text-lg opacity-90 mb-2">Próxima Etapa:</p>
              <p className="text-2xl font-bold">{nextStage.title}</p>
              <p className="text-lg opacity-75">
                Em {Math.ceil((nextStage.hours - cleanHours) / 24)} dias
              </p>
            </div>
          )}
        </div>

        {/* Timeline de Evolução */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6">
            Timeline de Recuperação
          </h3>

          <div className="space-y-6">
            {evolution.map((stage, index) => (
              <div key={index} className="relative">
                {/* Linha conectora */}
                {index < evolution.length - 1 && (
                  <div
                    className={`absolute left-6 top-16 w-0.5 h-full ${
                      stage.completed ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                )}

                <div
                  className={`flex items-start gap-4 p-6 rounded-xl transition-all ${
                    stage.completed
                      ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-400 dark:border-green-600'
                      : 'bg-gray-50 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {/* Ícone */}
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      stage.completed
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {stage.completed ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <Clock className="w-6 h-6" />
                    )}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                        {stage.icon} {stage.title}
                      </h4>
                      {stage.completed && (
                        <span className="px-3 py-1 bg-green-500 text-white rounded-full text-sm font-semibold">
                          Completado!
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">
                      {stage.description}
                    </p>
                    {!stage.completed && (
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                        {cleanHours < stage.hours
                          ? `Faltam ${Math.ceil((stage.hours - cleanHours) / 24)} dias`
                          : 'Próxima etapa!'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mensagem Motivacional */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-8 shadow-2xl text-white text-center">
          <h3 className="text-2xl font-bold mb-4">
            Você está fazendo história! 🎉
          </h3>
          <p className="text-lg opacity-90">
            Cada hora que passa, seu corpo se recupera e se fortalece.
            Continue assim e você verá transformações incríveis!
          </p>
        </div>
      </main>
    </div>
  );
}
