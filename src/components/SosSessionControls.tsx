'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useProcessSosTriggers } from '@/hooks/use-process-sos-triggers';
import RewardModal from './RewardModal';
import SosPlayer from './SosPlayer';

type SosSessionControlsProps = {
  toolId: number;
  toolTitle: string;
};

export default function SosSessionControls({
  toolId,
  toolTitle,
}: SosSessionControlsProps) {
  const [loadingUser, setLoadingUser] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [lastDuration, setLastDuration] = useState<number | undefined>(undefined);

  const { processTriggers, processing } = useProcessSosTriggers();

  // ===========================
  // 1) Carregar sessão/usuário
  // ===========================
  useEffect(() => {
    let active = true;

    async function loadAuth() {
      try {
        // Primeiro checa se existe sessão
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) {
          console.error('Erro getSession SOS:', sessionError);
        }

        if (!sessionData?.session) {
          // Sem sessão → ninguém logado, NÃO chama getUser (evita AuthSessionMissingError)
          if (active) {
            setUserId(null);
            setLoadingUser(false);
          }
          return;
        }

        // Agora sim podemos chamar getUser, pois já há sessão em memória
        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError) {
          console.error('Erro getUser SOS:', userError);
          if (active) setUserId(null);
        } else if (active) {
          setUserId(userData.user?.id ?? null);
        }
      } catch (err) {
        console.error('Erro inesperado auth SOS:', err);
        if (active) setUserId(null);
      } finally {
        if (active) setLoadingUser(false);
      }
    }

    loadAuth();

    return () => {
      active = false;
    };
  }, []);

  // ===========================
  // 2) Início da sessão
  // ===========================
  const handleStart = () => {
    setIsRunning(true);
  };

  // ===========================
  // 3) Fim da sessão
  // ===========================
  const handleComplete = async (durationSeconds: number) => {
    setIsRunning(false);
    setLastDuration(durationSeconds);

    // Se tiver usuário logado, grava no banco e dispara gatilhos
    if (userId) {
      try {
        const { error } = await supabase.from('sos_usage').insert({
          user_id: userId,
          sos_id: toolId,
          duration_seconds: durationSeconds,
          metadata: {
            source: 'sos_page',
          },
        });

        if (error) {
          console.error('Erro ao registrar sos_usage:', error);
        }

        // Processa missões / recompensas ligadas ao SOS
        await processTriggers({
          userId,
          toolId,
          durationSeconds,
        });
      } catch (err) {
        console.error('Erro pós-sessão SOS:', err);
      }
    }

    // Abre modal de recompensa
    setShowReward(true);
  };

  // ===========================
  // 4) UI
  // ===========================
  if (loadingUser) {
    return (
      <div className="mt-4 rounded-xl border border-purple-500/20 bg-black/40 px-4 py-3 text-sm text-purple-100">
        Verificando sua sessão...
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="mt-4 rounded-xl border border-yellow-500/20 bg-black/40 px-4 py-3 text-sm text-yellow-100">
        Para registrar seu progresso e salvar as sessões do Modo SOS, você
        precisa estar logado.
        <br />
        <span className="text-xs text-yellow-200/80">
          Dica: use o menu de Perfil para fazer login e voltar aqui. Você ainda
          pode praticar as técnicas mesmo sem registro.
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-purple-500/30 bg-black/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-purple-300/80">
              Sessão SOS
            </p>
            <p className="text-sm font-semibold text-white">
              {toolTitle || 'Ferramenta SOS'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleStart}
            disabled={isRunning || processing}
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRunning
              ? 'Sessão em andamento...'
              : processing
              ? 'Processando...'
              : 'Iniciar sessão'}
          </button>
        </div>

        {/* Player que controla a duração e chama handleComplete */}
        <SosPlayer
          toolId={toolId}
          toolTitle={toolTitle}
          isRunning={isRunning}
          onComplete={handleComplete}
        />
      </div>

      <RewardModal
        open={showReward}
        onOpenChange={setShowReward}
        seconds={lastDuration}
        toolTitle={toolTitle}
      />
    </>
  );
}
