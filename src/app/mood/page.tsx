'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/storage';
import { UserData, MoodEntry, AIInsight } from '@/lib/types';
import { Smile, Frown, Meh, AlertTriangle, Sparkles, ArrowLeft, TrendingUp, Brain } from 'lucide-react';
import Link from 'next/link';

const MOODS = [
  { id: 'great', label: 'Ótimo', icon: '😄', color: 'from-green-500 to-emerald-600' },
  { id: 'good', label: 'Bem', icon: '😊', color: 'from-blue-500 to-cyan-600' },
  { id: 'normal', label: 'Normal', icon: '😐', color: 'from-gray-500 to-gray-600' },
  { id: 'calm', label: 'Calmo', icon: '😌', color: 'from-purple-500 to-pink-600' },
  { id: 'anxious', label: 'Ansioso', icon: '😰', color: 'from-yellow-500 to-orange-600' },
  { id: 'very-anxious', label: 'Muito Ansioso', icon: '😨', color: 'from-orange-500 to-red-600' },
  { id: 'irritated', label: 'Irritado', icon: '😠', color: 'from-red-500 to-pink-600' },
];

export default function MoodTrackerPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>([]);
  const [aiInsights, setAIInsights] = useState<AIInsight[]>([]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
    const data = storage.getUserData();
    
    if (!data || !data.onboardingCompleted) {
      router.push('/onboarding');
      return;
    }

    setUserData(data);
    loadMoodData();
  }, [router]);

  const loadMoodData = () => {
    if (typeof window !== 'undefined') {
      const entries = localStorage.getItem('mood_entries');
      const insights = localStorage.getItem('ai_insights');
      
      if (entries) setMoodEntries(JSON.parse(entries));
      if (insights) setAIInsights(JSON.parse(insights));
    }
  };

  const saveMood = () => {
    if (!selectedMood) return;

    const newEntry: MoodEntry = {
      id: `mood_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0],
      mood: selectedMood as any,
      notes,
    };

    const updatedEntries = [newEntry, ...moodEntries];
    setMoodEntries(updatedEntries);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('mood_entries', JSON.stringify(updatedEntries));
    }

    // Gerar insights de IA
    generateAIInsights(updatedEntries);

    setShowSuccess(true);
    setSelectedMood(null);
    setNotes('');

    setTimeout(() => setShowSuccess(false), 3000);
  };

  const generateAIInsights = (entries: MoodEntry[]) => {
    if (entries.length < 3) return;

    const insights: AIInsight[] = [];

    // Análise de padrões de humor
    const recentMoods = entries.slice(0, 7);
    const positiveMoods = recentMoods.filter(e => ['great', 'good', 'calm'].includes(e.mood)).length;
    const negativeMoods = recentMoods.filter(e => ['anxious', 'very-anxious', 'irritated'].includes(e.mood)).length;

    if (positiveMoods > negativeMoods) {
      insights.push({
        id: `insight_${Date.now()}_1`,
        type: 'mood',
        title: 'Tendência Positiva',
        description: `Seu humor está melhorando! ${Math.round((positiveMoods / recentMoods.length) * 100)}% dos seus últimos registros foram positivos.`,
        timestamp: new Date().toISOString(),
        priority: 'low',
      });
    }

    // Análise de horários
    const morningMoods = entries.filter(e => {
      const hour = parseInt(e.time.split(':')[0]);
      return hour >= 6 && hour < 12;
    });

    if (morningMoods.length >= 3) {
      const morningPositive = morningMoods.filter(e => ['great', 'good', 'calm'].includes(e.mood)).length;
      const morningPercentage = Math.round((morningPositive / morningMoods.length) * 100);
      
      if (morningPercentage > 60) {
        insights.push({
          id: `insight_${Date.now()}_2`,
          type: 'pattern',
          title: 'Manhãs Positivas',
          description: `Você tende a se sentir melhor pela manhã (${morningPercentage}% de humor positivo).`,
          timestamp: new Date().toISOString(),
          priority: 'medium',
        });
      }
    }

    // Análise de risco de recaída
    const recentAnxiety = entries.slice(0, 3).filter(e => ['very-anxious', 'anxious'].includes(e.mood)).length;
    
    if (recentAnxiety >= 2) {
      insights.push({
        id: `insight_${Date.now()}_3`,
        type: 'relapse-risk',
        title: 'Nível de Risco Elevado',
        description: 'Você está se sentindo ansioso com frequência. Considere usar o Modo SOS ou técnicas de respiração.',
        timestamp: new Date().toISOString(),
        priority: 'high',
      });
    }

    setAIInsights(insights);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_insights', JSON.stringify(insights));
    }
  };

  if (!mounted || !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${userData.themeMode === 'focus' ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900' : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900'}`}>
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </Link>
            <Smile className="w-8 h-8 text-purple-500" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Rastreador de Humor
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Pergunta Diária */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-8 shadow-2xl text-white">
          <h2 className="text-3xl font-bold mb-4 text-center">
            Como você está se sentindo hoje?
          </h2>
          <p className="text-lg opacity-90 text-center">
            Registre seu humor para receber insights personalizados
          </p>
        </div>

        {/* Seleção de Humor */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            Selecione seu humor:
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {MOODS.map((mood) => (
              <button
                key={mood.id}
                onClick={() => setSelectedMood(mood.id)}
                className={`p-4 rounded-xl transition-all ${
                  selectedMood === mood.id
                    ? `bg-gradient-to-br ${mood.color} text-white scale-105 shadow-lg`
                    : 'bg-gray-100 dark:bg-gray-700 hover:shadow-md'
                }`}
              >
                <div className="text-4xl mb-2">{mood.icon}</div>
                <div className={`text-sm font-semibold ${
                  selectedMood === mood.id ? 'text-white' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {mood.label}
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Notas (opcional):
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="O que está acontecendo? Como você se sente?"
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 resize-none"
                rows={3}
              />
            </div>

            <button
              onClick={saveMood}
              disabled={!selectedMood}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Registrar Humor
            </button>
          </div>

          {showSuccess && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border-2 border-green-400 dark:border-green-600">
              <p className="text-green-700 dark:text-green-400 font-semibold text-center">
                ✅ Humor registrado com sucesso!
              </p>
            </div>
          )}
        </div>

        {/* Insights de IA */}
        {aiInsights.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="w-8 h-8 text-purple-500" />
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                Insights de IA
              </h3>
            </div>

            <div className="space-y-4">
              {aiInsights.map((insight) => (
                <div
                  key={insight.id}
                  className={`p-4 rounded-xl border-2 ${
                    insight.priority === 'high'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-600'
                      : insight.priority === 'medium'
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 dark:border-yellow-600'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Sparkles className={`w-6 h-6 flex-shrink-0 ${
                      insight.priority === 'high'
                        ? 'text-red-600 dark:text-red-400'
                        : insight.priority === 'medium'
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`} />
                    <div>
                      <h4 className={`font-bold mb-1 ${
                        insight.priority === 'high'
                          ? 'text-red-800 dark:text-red-300'
                          : insight.priority === 'medium'
                          ? 'text-yellow-800 dark:text-yellow-300'
                          : 'text-blue-800 dark:text-blue-300'
                      }`}>
                        {insight.title}
                      </h4>
                      <p className={`text-sm ${
                        insight.priority === 'high'
                          ? 'text-red-700 dark:text-red-400'
                          : insight.priority === 'medium'
                          ? 'text-yellow-700 dark:text-yellow-400'
                          : 'text-blue-700 dark:text-blue-400'
                      }`}>
                        {insight.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Histórico de Humor */}
        {moodEntries.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-8 h-8 text-blue-500" />
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                Histórico Recente
              </h3>
            </div>

            <div className="space-y-3">
              {moodEntries.slice(0, 10).map((entry) => {
                const mood = MOODS.find(m => m.id === entry.mood);
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">{mood?.icon}</div>
                      <div>
                        <div className="font-semibold text-gray-800 dark:text-gray-200">
                          {mood?.label}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(entry.date).toLocaleDateString('pt-BR')} às {entry.time.slice(0, 5)}
                        </div>
                        {entry.notes && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {entry.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
