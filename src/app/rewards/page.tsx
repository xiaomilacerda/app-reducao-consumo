'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/storage';
import { UserData, Reward } from '@/lib/types';
import { ShoppingBag, ArrowLeft, Lock, Crown, Star, Zap, CheckCircle } from 'lucide-react';
import Link from 'next/link';

const REWARDS: Reward[] = [
  {
    id: 'badge_warrior',
    title: 'Badge Guerreiro',
    description: 'Badge exclusivo de guerreiro da recuperação',
    type: 'badge',
    xpCost: 500,
    unlocked: false,
    imageUrl: '🛡️',
  },
  {
    id: 'badge_champion',
    title: 'Badge Campeão',
    description: 'Badge dourado de campeão',
    type: 'badge',
    xpCost: 1000,
    unlocked: false,
    imageUrl: '🏆',
  },
  {
    id: 'card_gradient',
    title: 'Card Gradiente',
    description: 'Card de progresso com gradiente especial',
    type: 'card',
    xpCost: 300,
    unlocked: false,
    imageUrl: '🌈',
  },
  {
    id: 'card_gold',
    title: 'Card Dourado',
    description: 'Card de progresso dourado premium',
    type: 'card',
    xpCost: 750,
    unlocked: false,
    imageUrl: '✨',
  },
  {
    id: 'frame_silver',
    title: 'Moldura Prata',
    description: 'Moldura prateada para avatar',
    type: 'avatar-frame',
    xpCost: 400,
    unlocked: false,
    imageUrl: '⭕',
  },
  {
    id: 'frame_gold',
    title: 'Moldura Ouro',
    description: 'Moldura dourada premium para avatar',
    type: 'avatar-frame',
    xpCost: 800,
    unlocked: false,
    imageUrl: '🔆',
  },
  {
    id: 'theme_ocean',
    title: 'Tema Oceano',
    description: 'Tema azul oceano para o app',
    type: 'theme',
    xpCost: 600,
    unlocked: false,
    imageUrl: '🌊',
  },
  {
    id: 'theme_sunset',
    title: 'Tema Pôr do Sol',
    description: 'Tema laranja e rosa',
    type: 'theme',
    xpCost: 600,
    unlocked: false,
    imageUrl: '🌅',
  },
  {
    id: 'icon_star',
    title: 'Ícone Estrela',
    description: 'Ícone de estrela para perfil',
    type: 'icon',
    xpCost: 200,
    unlocked: false,
    imageUrl: '⭐',
  },
  {
    id: 'icon_fire',
    title: 'Ícone Fogo',
    description: 'Ícone de fogo para perfil',
    type: 'icon',
    xpCost: 200,
    unlocked: false,
    imageUrl: '🔥',
  },
];

export default function RewardsStorePage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [rewards, setRewards] = useState<Reward[]>(REWARDS);
  const [totalXP, setTotalXP] = useState(0);
  const [filter, setFilter] = useState<'all' | 'badge' | 'card' | 'avatar-frame' | 'theme' | 'icon'>('all');

  useEffect(() => {
    setMounted(true);
    const data = storage.getUserData();
    
    if (!data || !data.onboardingCompleted) {
      router.push('/onboarding');
      return;
    }

    setUserData(data);
    loadRewards();
    
    const xp = localStorage.getItem('total_xp');
    if (xp) setTotalXP(parseInt(xp));
  }, [router]);

  const loadRewards = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rewards');
      if (saved) {
        setRewards(JSON.parse(saved));
      } else {
        localStorage.setItem('rewards', JSON.stringify(REWARDS));
      }
    }
  };

  const unlockReward = (rewardId: string) => {
    const reward = rewards.find(r => r.id === rewardId);
    if (!reward || reward.unlocked || totalXP < reward.xpCost) return;

    const updatedRewards = rewards.map(r =>
      r.id === rewardId ? { ...r, unlocked: true } : r
    );

    setRewards(updatedRewards);
    localStorage.setItem('rewards', JSON.stringify(updatedRewards));

    const newXP = totalXP - reward.xpCost;
    setTotalXP(newXP);
    localStorage.setItem('total_xp', newXP.toString());

    if (userData) {
      const updatedData = {
        ...userData,
        xp: newXP,
        unlockedRewards: [...(userData.unlockedRewards || []), rewardId],
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

  const isPremium = userData.isPremium;
  const filteredRewards = filter === 'all' ? rewards : rewards.filter(r => r.type === filter);
  const unlockedCount = rewards.filter(r => r.unlocked).length;

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
              <ShoppingBag className="w-8 h-8 text-purple-500" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Loja de Recompensas
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
                <h2 className="text-2xl font-bold">Recurso Premium</h2>
                <p className="text-lg opacity-90">
                  A Loja de Recompensas está disponível apenas para usuários Premium.
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
            {/* Saldo de XP */}
            <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-8 shadow-2xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold mb-2">Seu Saldo</h2>
                  <p className="text-5xl font-bold">{totalXP} XP</p>
                </div>
                <div className="text-right">
                  <p className="text-lg opacity-90 mb-2">Recompensas Desbloqueadas</p>
                  <p className="text-4xl font-bold">{unlockedCount}/{rewards.length}</p>
                </div>
              </div>
            </div>

            {/* Filtros */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-xl">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    filter === 'all'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFilter('badge')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    filter === 'badge'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Badges
                </button>
                <button
                  onClick={() => setFilter('card')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    filter === 'card'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Cards
                </button>
                <button
                  onClick={() => setFilter('avatar-frame')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    filter === 'avatar-frame'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Molduras
                </button>
                <button
                  onClick={() => setFilter('theme')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    filter === 'theme'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Temas
                </button>
                <button
                  onClick={() => setFilter('icon')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    filter === 'icon'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Ícones
                </button>
              </div>
            </div>

            {/* Grid de Recompensas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRewards.map((reward) => (
                <div
                  key={reward.id}
                  className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl transition-all ${
                    reward.unlocked
                      ? 'border-2 border-green-400 dark:border-green-600'
                      : 'hover:shadow-2xl'
                  }`}
                >
                  <div className="text-center mb-4">
                    <div className="text-6xl mb-3">{reward.imageUrl}</div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                      {reward.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {reward.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm font-semibold">
                      {reward.type === 'badge' && '🏅 Badge'}
                      {reward.type === 'card' && '🎴 Card'}
                      {reward.type === 'avatar-frame' && '🖼️ Moldura'}
                      {reward.type === 'theme' && '🎨 Tema'}
                      {reward.type === 'icon' && '⭐ Ícone'}
                    </span>
                    <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                      {reward.xpCost} XP
                    </span>
                  </div>

                  {reward.unlocked ? (
                    <div className="flex items-center justify-center gap-2 py-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl font-semibold">
                      <CheckCircle className="w-5 h-5" />
                      <span>Desbloqueado</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => unlockReward(reward.id)}
                      disabled={totalXP < reward.xpCost}
                      className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {totalXP < reward.xpCost ? 'XP Insuficiente' : 'Desbloquear'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
