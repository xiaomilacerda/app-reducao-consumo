'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/storage';
import { UserData } from '@/lib/types';
import { Share2, ArrowLeft, Download, Trophy, TrendingUp, Heart } from 'lucide-react';
import Link from 'next/link';
import { calculateCleanDays, formatCleanTime, calculateSavings, formatCurrency } from '@/lib/utils-recovery';

export default function ShareProgressPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const data = storage.getUserData();
    
    if (!data || !data.onboardingCompleted) {
      router.push('/onboarding');
      return;
    }

    setUserData(data);
  }, [router]);

  const shareCard = async () => {
    if (!cardRef.current) return;

    // Simular compartilhamento (em produção, usar html2canvas ou similar)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Meu Progresso de Recuperação',
          text: 'Veja meu progresso incrível! 💪',
          url: window.location.href,
        });
      } catch (err) {
        console.log('Compartilhamento cancelado');
      }
    } else {
      alert('Compartilhamento não suportado neste navegador. Use o botão de Download!');
    }
  };

  const downloadCard = () => {
    alert('Funcionalidade de download será implementada com html2canvas em produção!');
  };

  if (!mounted || !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  const cleanDays = calculateCleanDays(userData.startDate, userData.lastRelapseDate);
  const timeInfo = formatCleanTime(cleanDays);
  const savings = calculateSavings(cleanDays, userData.dailyCost || 0);
  const achievements = storage.getAchievements().filter(a => a.unlocked).length;

  return (
    <div className={`min-h-screen ${userData.themeMode === 'focus' ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900' : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900'}`}>
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </Link>
            <Share2 className="w-8 h-8 text-purple-500" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Compartilhar Progresso
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Descrição */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-8 shadow-2xl text-white text-center">
          <h2 className="text-3xl font-bold mb-4">
            Compartilhe Sua Vitória! 🎉
          </h2>
          <p className="text-lg opacity-90">
            Inspire outras pessoas compartilhando seu progresso nas redes sociais.
          </p>
        </div>

        {/* Card de Progresso */}
        <div ref={cardRef} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-2xl">
          {/* Header do Card */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-8 text-white">
            <div className="text-center">
              <Trophy className="w-16 h-16 mx-auto mb-4" />
              <h3 className="text-3xl font-bold mb-2">Meu Progresso</h3>
              <p className="text-lg opacity-90">Jornada de Recuperação</p>
            </div>
          </div>

          {/* Conteúdo do Card */}
          <div className="p-8 space-y-6">
            {/* Tempo Limpo */}
            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Tempo Limpo</p>
              <p className="text-5xl font-bold text-green-600 dark:text-green-400 mb-2">
                {timeInfo.value}
              </p>
              <p className="text-2xl font-semibold text-green-700 dark:text-green-300">
                {timeInfo.unit}
              </p>
            </div>

            {/* Estatísticas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
                <TrendingUp className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Economizado</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(savings)}
                </p>
              </div>

              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-center">
                <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Conquistas</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {achievements}
                </p>
              </div>
            </div>

            {/* Mensagem Motivacional */}
            <div className="p-6 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl text-center">
              <Heart className="w-12 h-12 text-purple-500 mx-auto mb-3" />
              <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                "Cada dia é uma vitória. Continue forte!" 💪
              </p>
            </div>

            {/* Marca d'água */}
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              Gerado pelo App de Recuperação
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={shareCard}
            className="flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
          >
            <Share2 className="w-6 h-6" />
            <span>Compartilhar</span>
          </button>

          <button
            onClick={downloadCard}
            className="flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
          >
            <Download className="w-6 h-6" />
            <span>Baixar Imagem</span>
          </button>
        </div>

        {/* Dica */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border-2 border-blue-400 dark:border-blue-600">
          <p className="text-blue-800 dark:text-blue-300 text-center">
            💡 <strong>Dica:</strong> Compartilhar seu progresso aumenta sua motivação e inspira outras pessoas!
          </p>
        </div>
      </main>
    </div>
  );
}
