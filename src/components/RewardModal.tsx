'use client';

import React from 'react';
import { X, Sparkles, Trophy } from 'lucide-react';

type RewardModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seconds?: number;
  toolTitle?: string;
};

const RewardModal: React.FC<RewardModalProps> = ({
  open,
  onOpenChange,
  seconds = 60,
  toolTitle = 'ferramenta SOS',
}) => {
  if (!open) return null;

  const minutes = Math.max(1, Math.round(seconds / 60));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="relative w-full max-w-sm rounded-2xl bg-gray-900 text-white p-6 shadow-2xl border border-purple-500/40">
        {/* Botão fechar */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 p-1 rounded-full hover:bg-white/10"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-300" />
            <Trophy className="w-6 h-6 text-yellow-300" />
          </div>

          <h2 className="text-lg font-bold">
            Muito bem! 🎉
          </h2>

          <p className="text-sm text-gray-300">
            Você concluiu uma sessão da{' '}
            <span className="font-semibold text-purple-300">{toolTitle}</span>{' '}
            e se manteve firme por cerca de{' '}
            <span className="font-semibold">{minutes} minuto(s)</span>.
          </p>

          <p className="text-xs text-gray-400">
            Cada vez que você usa o Modo SOS em vez de acender um, você reforça
            um novo caminho no cérebro. Continue repetindo isso: pequenas
            vitórias constroem uma grande mudança. 💚
          </p>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 text-white text-sm font-semibold hover:opacity-90"
          >
            Continuar minha jornada
          </button>
        </div>
      </div>
    </div>
  );
};

export default RewardModal;
