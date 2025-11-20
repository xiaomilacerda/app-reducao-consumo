'use client';

import { Achievement } from '@/lib/types';
import { CheckCircle2, Lock } from 'lucide-react';

interface AchievementsCardProps {
  achievements: Achievement[];
}

export default function AchievementsCard({ achievements }: AchievementsCardProps) {
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;

  return (
    <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white">Conquistas</h3>
        <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
          <span className="text-white font-semibold">
            {unlockedCount}/{totalCount}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {achievements.map((achievement) => (
          <div
            key={achievement.id}
            className={`relative group ${
              achievement.unlocked
                ? 'bg-white/20 backdrop-blur-sm'
                : 'bg-black/20'
            } rounded-xl p-3 transition-all duration-300 hover:scale-110 cursor-pointer`}
          >
            {/* Ícone */}
            <div className="text-3xl text-center mb-1 filter">
              {achievement.unlocked ? (
                <span className="drop-shadow-lg">{achievement.icon}</span>
              ) : (
                <Lock className="w-6 h-6 mx-auto text-white/40" />
              )}
            </div>

            {/* Badge de desbloqueado */}
            {achievement.unlocked && (
              <div className="absolute -top-1 -right-1">
                <CheckCircle2 className="w-5 h-5 text-green-400 bg-white rounded-full" />
              </div>
            )}

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10 shadow-xl">
              <div className="font-semibold">{achievement.title}</div>
              <div className="text-gray-300 text-xs">{achievement.description}</div>
              {achievement.unlocked && achievement.unlockedAt && (
                <div className="text-green-400 text-xs mt-1">
                  ✓ Desbloqueado
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {unlockedCount > 0 && (
        <div className="mt-4 text-center">
          <p className="text-white/90 text-sm">
            Continue assim! Você está fazendo um trabalho incrível! 💪
          </p>
        </div>
      )}
    </div>
  );
}
