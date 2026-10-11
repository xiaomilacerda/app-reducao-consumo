'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/storage';
import { UserData } from '@/lib/types';
import { Heart, ArrowLeft, Wind, Target, Volume2, Lock, Crown } from 'lucide-react';
import Link from 'next/link';

const motivationalPhrases = [
  "Você é mais forte do que imagina.",
  "Esta vontade vai passar. Respire fundo.",
  "Cada segundo que você resiste é uma vitória.",
  "Você já chegou tão longe. Continue!",
  "Seu futuro eu agradece por esta escolha.",
  "A fissura é temporária. Sua força é permanente.",
  "Você não precisa disso. Você é completo.",
  "Respire. Você está no controle.",
];

export default function SOSPage() {
  const router = useRouter();
  
  // TODOS OS HOOKS NO TOPO - SEMPRE NA MESMA ORDEM
  const [userData, setUserData] = useState<UserData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activeExercise, setActiveExercise] = useState<'breathing' | 'focus' | 'calm' | null>(null);
  const [breathingPhase, setBreathingPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [breathingCount, setBreathingCount] = useState(4);
  const [focusTimer, setFocusTimer] = useState(60);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(() =>
    Math.floor(Math.random() * motivationalPhrases.length)
  );

  useEffect(() => {
    setMounted(true);
    const data = storage.getUserData();
    
    if (!data || !data.onboardingCompleted) {
      router.push('/onboarding');
      return;
    }

    setUserData(data);
  }, [router]);

  // Animação de respiração
  useEffect(() => {
    if (activeExercise === 'breathing') {
      const interval = setInterval(() => {
        setBreathingCount((prev) => {
          if (prev <= 1) {
            if (breathingPhase === 'inhale') {
              setBreathingPhase('hold');
              return 7;
            } else if (breathingPhase === 'hold') {
              setBreathingPhase('exhale');
              return 8;
            } else {
              setBreathingPhase('inhale');
              return 4;
            }
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [activeExercise, breathingPhase]);

  // Timer de foco
  useEffect(() => {
    if (activeExercise === 'focus' && focusTimer > 0) {
      const interval = setInterval(() => {
        setFocusTimer((prev) => prev - 1);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [activeExercise, focusTimer]);

  // AGORA SIM PODEMOS FAZER RETURNS CONDICIONAIS
  if (!mounted || !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  const isPremium = userData.isPremium;
  const currentPhrase = motivationalPhrases[currentPhraseIndex];

  return (
    <div className={`min-h-screen ${userData.themeMode === 'focus' ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900' : 'bg-gradient-to-br from-red-50 via-orange-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900'}`}>
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </Link>
              <Heart className="w-8 h-8 text-red-500 animate-pulse" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
                Modo SOS Anti-Fissura
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
                  O Modo SOS completo está disponível apenas para usuários Premium.
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
            {/* Frase Motivacional */}
            <div className="bg-gradient-to-r from-red-500 to-pink-600 rounded-2xl p-8 shadow-2xl text-white text-center">
              <p className="text-3xl font-bold mb-4">
                "{currentPhrase}"
              </p>
              <p className="text-lg opacity-90">
                Escolha um exercício abaixo para controlar a fissura agora.
              </p>
            </div>

            {/* Exercícios */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Respiração Guiada */}
              <button
                onClick={() => {
                  setActiveExercise(activeExercise === 'breathing' ? null : 'breathing');
                  setBreathingPhase('inhale');
                  setBreathingCount(4);
                }}
                className={`p-6 rounded-2xl shadow-xl transition-all ${
                  activeExercise === 'breathing'
                    ? 'bg-gradient-to-br from-blue-500 to-cyan-600 text-white scale-105'
                    : 'bg-white dark:bg-gray-800 hover:shadow-2xl'
                }`}
              >
                <Wind className={`w-12 h-12 mx-auto mb-4 ${activeExercise === 'breathing' ? 'text-white' : 'text-blue-500'}`} />
                <h3 className={`text-xl font-bold mb-2 ${activeExercise === 'breathing' ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
                  Respiração Guiada
                </h3>
                <p className={`text-sm ${activeExercise === 'breathing' ? 'text-white opacity-90' : 'text-gray-600 dark:text-gray-400'}`}>
                  Técnica 4-7-8 para acalmar
                </p>
              </button>

              {/* Treino de Foco */}
              <button
                onClick={() => {
                  setActiveExercise(activeExercise === 'focus' ? null : 'focus');
                  setFocusTimer(60);
                }}
                className={`p-6 rounded-2xl shadow-xl transition-all ${
                  activeExercise === 'focus'
                    ? 'bg-gradient-to-br from-purple-500 to-pink-600 text-white scale-105'
                    : 'bg-white dark:bg-gray-800 hover:shadow-2xl'
                }`}
              >
                <Target className={`w-12 h-12 mx-auto mb-4 ${activeExercise === 'focus' ? 'text-white' : 'text-purple-500'}`} />
                <h3 className={`text-xl font-bold mb-2 ${activeExercise === 'focus' ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
                  Treino de Foco
                </h3>
                <p className={`text-sm ${activeExercise === 'focus' ? 'text-white opacity-90' : 'text-gray-600 dark:text-gray-400'}`}>
                  Concentre-se por 1 minuto
                </p>
              </button>

              {/* Áudio de Calma */}
              <button
                onClick={() => setActiveExercise(activeExercise === 'calm' ? null : 'calm')}
                className={`p-6 rounded-2xl shadow-xl transition-all ${
                  activeExercise === 'calm'
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white scale-105'
                    : 'bg-white dark:bg-gray-800 hover:shadow-2xl'
                }`}
              >
                <Volume2 className={`w-12 h-12 mx-auto mb-4 ${activeExercise === 'calm' ? 'text-white' : 'text-green-500'}`} />
                <h3 className={`text-xl font-bold mb-2 ${activeExercise === 'calm' ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
                  Áudio de Calma
                </h3>
                <p className={`text-sm ${activeExercise === 'calm' ? 'text-white opacity-90' : 'text-gray-600 dark:text-gray-400'}`}>
                  Sons relaxantes
                </p>
              </button>
            </div>

            {/* Área de Exercício Ativo */}
            {activeExercise === 'breathing' && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl">
                <h3 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-200 mb-8">
                  Respiração 4-7-8
                </h3>
                
                <div className="flex flex-col items-center space-y-8">
                  {/* Círculo Animado */}
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
                        boxShadow: '0 0 60px rgba(59, 130, 246, 0.5)',
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-white">
                        <div className="text-6xl font-bold mb-2">{breathingCount}</div>
                        <div className="text-2xl font-semibold">
                          {breathingPhase === 'inhale' && 'Inspire'}
                          {breathingPhase === 'hold' && 'Segure'}
                          {breathingPhase === 'exhale' && 'Expire'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-lg text-gray-600 dark:text-gray-400">
                      {breathingPhase === 'inhale' && 'Inspire profundamente pelo nariz'}
                      {breathingPhase === 'hold' && 'Segure a respiração'}
                      {breathingPhase === 'exhale' && 'Expire lentamente pela boca'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeExercise === 'focus' && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl">
                <h3 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-200 mb-8">
                  Treino de Foco
                </h3>
                
                <div className="flex flex-col items-center space-y-8">
                  <div className="text-8xl font-bold text-purple-600 dark:text-purple-400">
                    {focusTimer}s
                  </div>
                  
                  <div className="w-full max-w-md">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-600 rounded-full transition-all duration-1000"
                        style={{ width: `${((60 - focusTimer) / 60) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-center space-y-4">
                    <p className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                      Concentre-se em um ponto fixo
                    </p>
                    <p className="text-lg text-gray-600 dark:text-gray-400">
                      Não pense em nada. Apenas observe sua respiração.
                    </p>
                  </div>

                  {focusTimer === 0 && (
                    <div className="text-center p-6 bg-green-50 dark:bg-green-900/20 rounded-xl">
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                        Parabéns! 🎉
                      </p>
                      <p className="text-lg text-green-700 dark:text-green-300">
                        Você completou o treino de foco!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeExercise === 'calm' && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl">
                <h3 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-200 mb-8">
                  Áudio de Calma
                </h3>
                
                <div className="flex flex-col items-center space-y-8">
                  <div className="w-32 h-32 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center animate-pulse">
                    <Volume2 className="w-16 h-16 text-white" />
                  </div>

                  <div className="text-center space-y-4">
                    <p className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                      Sons Relaxantes
                    </p>
                    <p className="text-lg text-gray-600 dark:text-gray-400">
                      Feche os olhos e ouça os sons da natureza
                    </p>
                  </div>

                  <div className="w-full max-w-md space-y-3">
                    <button className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all">
                      🌊 Som de Ondas
                    </button>
                    <button className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all">
                      🌲 Floresta
                    </button>
                    <button className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all">
                      🌧️ Chuva Suave
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
