'use client';

import { HealthMetric } from '@/lib/types';

interface HealthBarsProps {
  metrics: HealthMetric[];
}

// Formata o valor em percentual, começando em 0,01% e com 2 casas decimais
function formatPercentage(value: number): string {
  if (!Number.isFinite(value)) return '0,01%';

  // valor vem em escala 0–100; para exibição não queremos nada menor que 0,01
  const minDisplay = 0.01;
  const safe = Math.max(minDisplay, value);

  return safe.toFixed(2).replace('.', ',') + '%';
}

export default function HealthBars({ metrics }: HealthBarsProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
        Indicadores de Saúde
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {metrics.map((metric) => {
          const rawValue = Number.isFinite(metric.value) ? metric.value : 0;
          const max = Number.isFinite(metric.maxValue) ? metric.maxValue : 100;

          // Garante que a barra nunca passe de 0–100
          const safeValue = Math.min(Math.max(rawValue, 0), max);
          const width = `${safeValue}%`;

          return (
            <div
              key={metric.id}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md dark:shadow-none border border-gray-100 dark:border-gray-700 transition-all duration-300 hover:shadow-xl hover:scale-105"
            >
              {/* Título + valor */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{metric.icon}</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {metric.name}
                  </span>
                </div>

                <span className="text-lg font-bold text-gray-700 dark:text-gray-300">
                  {formatPercentage(safeValue)}
                </span>
              </div>

              {/* Barra de progresso */}
              <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`absolute top-0 left-0 h-full bg-gradient-to-r ${metric.color} rounded-full transition-all duration-1000 ease-out`}
                  style={{ width }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>

              {/* Mensagem motivacional */}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {safeValue < 25 && 'Começando a recuperar...'}
                {safeValue >= 25 && safeValue < 50 && 'Progresso visível!'}
                {safeValue >= 50 && safeValue < 75 && 'Ótima evolução!'}
                {safeValue >= 75 && safeValue < 100 && 'Quase lá!'}
                {safeValue === 100 && 'Recuperação completa! 🎉'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
