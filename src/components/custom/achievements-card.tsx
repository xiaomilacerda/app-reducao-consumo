'use client';

import { Achievement } from '@/lib/types';
import { CheckCircle2, ChevronDown, Lock, Trophy } from 'lucide-react';

interface AchievementsCardProps {
  achievements: Achievement[];
}

export default function AchievementsCard({ achievements }: AchievementsCardProps) {
  const unlocked = achievements.filter((item) => item.unlocked);
  const total = achievements.length;

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-300/15 bg-[#1b182c] text-white shadow-sm">
      <details className="group">
        <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-white/[.04] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-violet-300 sm:px-6 [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-300/10">
              <Trophy className="h-5 w-5 text-violet-200" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold sm:text-base">Suas conquistas</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {unlocked.length} de {total} desbloqueadas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-violet-200">
            <span className="hidden sm:inline">Ver todas</span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
          </div>
        </summary>
        <div className="border-t border-white/10 px-4 pb-4 pt-4 sm:px-6 sm:pb-6">
          <p className="mb-3 text-xs text-slate-400">
            Toque em uma conquista para ver seu nome e descrição.
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                tabIndex={0}
                role="group"
                aria-label={achievement.title + (achievement.unlocked ? ', desbloqueada' : ', bloqueada') + '. ' + achievement.description}
                className={
                  'relative flex min-h-[62px] items-center justify-center rounded-xl border p-2 outline-none focus-visible:border-violet-300 focus-visible:ring-2 focus-visible:ring-violet-300/30 ' +
                  (achievement.unlocked
                    ? 'border-violet-300/30 bg-violet-400/15'
                    : 'border-white/5 bg-black/15')
                }
                title={achievement.title + ': ' + achievement.description}
              >
                {achievement.unlocked ? (
                  <span aria-hidden="true" className="text-2xl">{achievement.icon}</span>
                ) : (
                  <Lock aria-hidden="true" className="h-5 w-5 text-slate-500" />
                )}
                {achievement.unlocked && (
                  <CheckCircle2 aria-hidden="true" className="absolute right-1 top-1 h-3.5 w-3.5 text-emerald-300" />
                )}
              </div>
            ))}
          </div>
        </div>
      </details>
    </section>
  );
}
