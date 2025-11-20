'use client';

import { AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface RelapseButtonProps {
  onRelapse: () => void;
}

export default function RelapseButton({ onRelapse }: RelapseButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClick = () => {
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    onRelapse();
    setShowConfirm(false);
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-8 h-8 text-orange-500" />
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">
              Registrar Recaída?
            </h3>
          </div>

          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Tudo bem, recaídas fazem parte do processo. O importante é não desistir.
            Vamos recomeçar juntos?
          </p>

          <div className="space-y-3">
            <button
              onClick={handleConfirm}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105"
            >
              Sim, registrar recaída
            </button>
            <button
              onClick={handleCancel}
              className="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300"
            >
              Cancelar
            </button>
          </div>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
              💡 Dica: Antes de confirmar, que tal tentar uma técnica de respiração ou dar uma
              caminhada rápida?
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="w-full bg-gradient-to-r from-orange-400 to-red-500 text-white font-bold py-4 px-8 rounded-2xl shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
    >
      <AlertCircle className="w-6 h-6" />
      <span>Registrar Recaída</span>
    </button>
  );
}
