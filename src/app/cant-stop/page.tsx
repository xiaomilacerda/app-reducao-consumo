'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/storage';
import { UserData, Recipe, AntiRelapseMethod, DailyLimit, AccessTip } from '@/lib/types';
import { Heart, ArrowLeft, Lock, Crown, Coffee, Wind, Target, AlertCircle, Clock, Bell, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function CantStopPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'recipes' | 'methods' | 'alarm' | 'tips'>('recipes');
  
  // Dados
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [methods, setMethods] = useState<AntiRelapseMethod[]>([]);
  const [accessTips, setAccessTips] = useState<AccessTip[]>([]);
  const [dailyLimit, setDailyLimit] = useState<DailyLimit | null>(null);
  const [newLimit, setNewLimit] = useState('');

  useEffect(() => {
    setMounted(true);
    const data = storage.getUserData();
    
    if (!data || !data.onboardingCompleted) {
      router.push('/onboarding');
      return;
    }

    setUserData(data);
    loadData();
  }, [router]);

  const loadData = () => {
    setRecipes(storage.getRecipes());
    setMethods(storage.getMethods());
    setAccessTips(storage.getAccessTips());
    setDailyLimit(storage.getDailyLimit());
  };

  const handleSetLimit = () => {
    if (!newLimit || parseInt(newLimit) <= 0) return;
    const limit = storage.setDailyLimit(parseInt(newLimit));
    setDailyLimit(limit);
    setNewLimit('');
  };

  const handleIncrementLimit = () => {
    const updatedLimit = storage.incrementDailyLimit();
    setDailyLimit(updatedLimit);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </Link>
              <Heart className="w-8 h-8 text-red-500" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
                Não Consigo Parar
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
        {/* Descrição */}
        <div className="bg-gradient-to-r from-red-500 to-pink-600 rounded-2xl p-6 shadow-xl text-white">
          <h2 className="text-2xl font-bold mb-3">
            Recursos para Momentos Difíceis
          </h2>
          <p className="text-lg opacity-90">
            Ferramentas práticas e comprovadas para te ajudar quando a vontade aparecer.
            Você não está sozinho, e você é capaz de superar isso! 💪
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-2 shadow-xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button
              onClick={() => setActiveTab('recipes')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'recipes'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Coffee className="w-5 h-5" />
              <span className="hidden sm:inline">Receitas</span>
            </button>
            <button
              onClick={() => setActiveTab('methods')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'methods'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Wind className="w-5 h-5" />
              <span className="hidden sm:inline">Métodos</span>
            </button>
            <button
              onClick={() => setActiveTab('alarm')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'alarm'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span className="hidden sm:inline">Despertador</span>
            </button>
            <button
              onClick={() => setActiveTab('tips')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'tips'
                  ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <AlertCircle className="w-5 h-5" />
              <span className="hidden sm:inline">Dicas</span>
            </button>
          </div>
        </div>

        {/* Conteúdo das Tabs */}
        
        {/* TAB: RECEITAS ALTERNATIVAS */}
        {activeTab === 'recipes' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                Receitas Alternativas
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Substitua o ato de fumar por algo saudável e gostoso!
              </p>
            </div>

            {recipes.map((recipe) => (
              <div
                key={recipe.id}
                className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl ${
                  recipe.isPremium && !isPremium ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-1">
                      {recipe.title}
                    </h4>
                    <span className="inline-block px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-semibold">
                      {recipe.category === 'juice' && '🥤 Suco'}
                      {recipe.category === 'smoothie' && '🍹 Smoothie'}
                      {recipe.category === 'vitamin' && '🥛 Vitamina'}
                      {recipe.category === 'tea' && '☕ Chá'}
                    </span>
                  </div>
                  {recipe.isPremium && (
                    <div className="flex items-center gap-1 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-sm font-semibold">
                      <Crown className="w-4 h-4" />
                      <span>Premium</span>
                    </div>
                  )}
                </div>

                {(!recipe.isPremium || isPremium) ? (
                  <>
                    <div className="mb-4">
                      <h5 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Ingredientes:
                      </h5>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                        {recipe.ingredients.map((ingredient, idx) => (
                          <li key={idx}>{ingredient}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="mb-4">
                      <h5 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Modo de preparo:
                      </h5>
                      <p className="text-gray-600 dark:text-gray-400">
                        {recipe.instructions}
                      </p>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                      <h5 className="font-semibold text-blue-700 dark:text-blue-400 mb-1">
                        Benefícios:
                      </h5>
                      <p className="text-blue-600 dark:text-blue-300 text-sm">
                        {recipe.benefits}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl flex items-center gap-3">
                    <Lock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                    <p className="text-yellow-700 dark:text-yellow-400">
                      Atualize para Premium para ver esta receita completa!
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB: MÉTODOS ANTI-RECAÍDA */}
        {activeTab === 'methods' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                Métodos Anti-Recaída
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Técnicas comprovadas para controlar a fissura e prevenir recaídas.
              </p>
            </div>

            {methods.map((method) => (
              <div
                key={method.id}
                className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl ${
                  method.isPremium && !isPremium ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-1">
                      {method.title}
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                      {method.description}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-semibold">
                        {method.category === 'breathing' && '🌬️ Respiração'}
                        {method.category === 'grounding' && '🧘 Grounding'}
                        {method.category === 'distraction' && '🎯 Distração'}
                        {method.category === 'mindfulness' && '🧠 Mindfulness'}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ⏱️ {method.duration}
                      </span>
                    </div>
                  </div>
                  {method.isPremium && (
                    <div className="flex items-center gap-1 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-sm font-semibold">
                      <Crown className="w-4 h-4" />
                      <span>Premium</span>
                    </div>
                  )}
                </div>

                {(!method.isPremium || isPremium) ? (
                  <div className="mt-4">
                    <h5 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Passos:
                    </h5>
                    <ol className="space-y-2">
                      {method.steps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400 pt-0.5">
                            {step}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl flex items-center gap-3">
                    <Lock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                    <p className="text-yellow-700 dark:text-yellow-400">
                      Atualize para Premium para ver este método completo!
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB: DESPERTADOR DE LIMITES */}
        {activeTab === 'alarm' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                Despertador de Limites
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Defina um limite diário e receba alertas quando estiver próximo de atingi-lo.
              </p>
              {!isPremium && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border-2 border-yellow-400 dark:border-yellow-600">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    <span className="font-semibold text-yellow-800 dark:text-yellow-300">
                      Recurso Premium
                    </span>
                  </div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    O despertador avançado está disponível apenas para usuários Premium.
                  </p>
                </div>
              )}
            </div>

            {isPremium && (
              <>
                {/* Configurar Limite */}
                {!dailyLimit && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
                    <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
                      Definir Limite de Hoje
                    </h4>
                    <div className="flex gap-3">
                      <input
                        type="number"
                        value={newLimit}
                        onChange={(e) => setNewLimit(e.target.value)}
                        placeholder="Ex: 3"
                        className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                      />
                      <button
                        onClick={handleSetLimit}
                        disabled={!newLimit || parseInt(newLimit) <= 0}
                        className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Definir
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Quantas vezes você quer fumar hoje?
                    </p>
                  </div>
                )}

                {/* Limite Ativo */}
                {dailyLimit && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                        Limite de Hoje
                      </h4>
                      {dailyLimit.completed ? (
                        <span className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full font-semibold">
                          Limite Atingido!
                        </span>
                      ) : (
                        <span className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-semibold">
                          Dentro do Limite
                        </span>
                      )}
                    </div>

                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-600 dark:text-gray-400">Progresso:</span>
                        <span className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                          {dailyLimit.currentUses} / {dailyLimit.maxUses}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            dailyLimit.completed
                              ? 'bg-gradient-to-r from-red-500 to-pink-600'
                              : 'bg-gradient-to-r from-green-500 to-emerald-600'
                          }`}
                          style={{
                            width: `${Math.min((dailyLimit.currentUses / dailyLimit.maxUses) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleIncrementLimit}
                      disabled={dailyLimit.completed}
                      className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Registrar Uso
                    </button>

                    {dailyLimit.currentUses >= dailyLimit.maxUses - 1 && !dailyLimit.completed && (
                      <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border-2 border-orange-400 dark:border-orange-600">
                        <div className="flex items-center gap-2">
                          <Bell className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                          <span className="font-semibold text-orange-800 dark:text-orange-300">
                            Atenção! Você está próximo do seu limite!
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB: DICAS DE DIFICULTAR ACESSO */}
        {activeTab === 'tips' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                Dicas para Dificultar o Acesso
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Pequenas mudanças no ambiente que podem fazer grande diferença!
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accessTips.map((tip) => (
                <div
                  key={tip.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">
                        {tip.title}
                      </h4>
                      <p className="text-gray-600 dark:text-gray-400 mb-3">
                        {tip.description}
                      </p>
                      <span className="inline-block px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full text-sm font-semibold">
                        {tip.category === 'environment' && '🏠 Ambiente'}
                        {tip.category === 'storage' && '📦 Armazenamento'}
                        {tip.category === 'routine' && '🔄 Rotina'}
                        {tip.category === 'social' && '👥 Social'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
