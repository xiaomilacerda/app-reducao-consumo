'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock, Heart, ListChecks, Info } from 'lucide-react';

type SosTool = {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  duration_minutes: number | null;
  thumbnail: string | null;
  tags: string[] | null;
  premium_only: boolean | null;
  steps_json: string[] | null;
};

interface SosPlayerProps {
  tool: SosTool;
  onComplete?: (elapsedSeconds?: number) => boolean | void | Promise<boolean | void>;
  onCancel?: () => void;
}

// tempo mínimo obrigatório antes de poder concluir (em segundos)
const MIN_SECONDS_REQUIRED = 30;

const SosPlayer: React.FC<SosPlayerProps> = ({ tool, onComplete, onCancel }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState(false);
  const [saveError, setSaveError] = useState('');

  // reinicia o cronômetro sempre que trocar de técnica
  useEffect(() => {
    setElapsedSeconds(0);
    setRunning(true);
    setFinishing(false);
    setFinished(false);
    setSaveError('');
  }, [tool?.id]);

  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [running]);

  const minutesDisplay = Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, '0');
  const secondsDisplay = (elapsedSeconds % 60).toString().padStart(2, '0');

  const canFinish = elapsedSeconds >= MIN_SECONDS_REQUIRED;
  const remainingToUnlock = Math.max(0, MIN_SECONDS_REQUIRED - elapsedSeconds);

  const steps: string[] = Array.isArray(tool.steps_json)
    ? tool.steps_json
    : [];

  const progressPercent = (() => {
    if (!tool.duration_minutes || tool.duration_minutes <= 0) return 0;
    const totalSeconds = tool.duration_minutes * 60;
    const p = (elapsedSeconds / totalSeconds) * 100;
    return Math.max(0, Math.min(100, p));
  })();

  const handleFinish = async () => {
    if (!canFinish || finishing || finished) return;
    setRunning(false);
    setFinishing(true);
    setSaveError('');
    try {
      const saved = await onComplete?.(elapsedSeconds);
      if (saved === false) {
        setSaveError('O histórico ainda não foi salvo. Você pode tentar novamente sem refazer o exercício.');
      } else {
        setFinished(true);
      }
    } catch (err) {
      console.error('Erro em onComplete do SosPlayer:', err);
      setSaveError('Falha ao confirmar a conclusão. Tente salvar novamente.');
    } finally {
      setFinishing(false);
    }
  };

  const handleCancel = () => {
    setRunning(false);
    onCancel?.();
  };

  return (
    <div className="mt-3 rounded-2xl bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 border border-purple-100 dark:border-purple-900/50 p-4 sm:p-5 space-y-4">
      {/* Cabeçalho da técnica */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white shadow-md">
          <Heart className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
            {tool.title || 'Técnica SOS'}
          </h3>
          {tool.category && (
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
              {tool.category}
            </p>
          )}
        </div>
      </div>

      {/* Timer + texto de tempo mínimo */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="px-3 py-2 rounded-xl bg-black/80 text-white flex items-baseline gap-1 font-mono">
            <Clock className="w-4 h-4 mr-1 text-yellow-300" />
            <span className="text-lg">
              {minutesDisplay}:{secondsDisplay}
            </span>
          </div>
          <div className="text-[11px] text-gray-600 dark:text-gray-400">
            Mantenha a técnica por pelo menos{' '}
            <span className="font-semibold">
              {MIN_SECONDS_REQUIRED} segundos
            </span>{' '}
            para que ela conte no histórico.
          </div>
        </div>

        {tool.duration_minutes && (
          <div className="flex-1">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* BLOCO TEXTO COMPLETO DA TÉCNICA */}
      {tool.description && (
        <div className="mt-1 rounded-2xl bg-white/80 dark:bg-gray-900/80 border border-purple-100 dark:border-purple-800 px-3 py-3 text-xs sm:text-sm text-gray-700 dark:text-gray-200 flex gap-2">
          <div className="mt-0.5">
            <Info className="w-4 h-4 text-purple-500" />
          </div>
          <p className="whitespace-pre-line">
            {tool.description}
          </p>
        </div>
      )}

      {/* Lista de passos detalhados */}
      {steps.length > 0 && (
        <div className="mt-1">
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
              Passo a passo da técnica
            </span>
          </div>
          <ol className="space-y-1.5 text-xs sm:text-sm text-gray-700 dark:text-gray-200">
            {steps.map((s, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900 text-[10px] text-purple-700 dark:text-purple-200">
                  {idx + 1}
                </span>
                <span className="whitespace-pre-line">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {saveError && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{saveError}</p>}
      {/* Botões */}
      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={handleCancel}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <XCircle className="w-4 h-4" />
          Cancelar
        </button>

        <button
          type="button"
          onClick={handleFinish}
          disabled={!canFinish || finishing || finished}
          className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold shadow-md transition-colors ${
            canFinish && !finishing && !finished
              ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:opacity-90'
              : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-not-allowed'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          {finishing ? 'Confirmando...' : finished ? 'Concluído' : canFinish
            ? 'Concluir técnica'
            : `Aguarde ${remainingToUnlock}s`}
        </button>
      </div>
    </div>
  );
};

export default SosPlayer;
