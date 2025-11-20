'use client';

import { HealthMetric } from '@/lib/types';

interface HealthBarsProps {
  metrics: HealthMetric[];
}

export default function HealthBars({ metrics }: HealthBarsProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
        Indicadores de Saúde
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg border border-gray-100 dark:border-gray-700 transition-all duration-300 hover:shadow-xl hover:scale-105"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{metric.icon}</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {metric.name}
                </span>
              </div>
              <span className="text-lg font-bold text-gray-700 dark:text-gray-300">
                {metric.value}%
              </span>
            </div>
            
            {/* Barra de progresso */}
            <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`absolute top-0 left-0 h-full bg-gradient-to-r ${metric.color} rounded-full transition-all duration-1000 ease-out`}
                style={{ width: `${metric.value}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
            
            {/* Mensagem motivacional */}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {metric.value < 25 && 'Começando a recuperar...'}
              {metric.value >= 25 && metric.value < 50 && 'Progresso visível!'}
              {metric.value >= 50 && metric.value < 75 && 'Ótima evolução!'}
              {metric.value >= 75 && metric.value < 100 && 'Quase lá!'}
              {metric.value === 100 && 'Recuperação completa! 🎉'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
