'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  ArrowLeft,
  Crown,
  Flame,
  Lock,
  CheckCircle2,
  Calendar,
  Award,
  Sparkles,
  Loader2,
} from 'lucide-react';

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type JourneyDay = {
  id: number;
  user_id: string;
  day_index: number;
  day_date: string;
  notes: string | null;
  reward_xp: number | null;
  reward_coins: number | null;
  created_at: string;
};

function getRewardsForDay(day: number) {
  // Modelo otimizado pra conversão: dá recompensa todo dia
  // e bônus forte nos marcos (7, 30, 60, 90, 180, 365...)
  let rewardXp = 5; // base diária
  let rewardCoins = 0;

  if ([1, 2, 3].includes(day)) {
    rewardXp += 5;
  }

  if ([7, 14].includes(day)) {
    rewardXp += 15;
    rewardCoins += 5;
  }

  if ([21, 30].includes(day)) {
    rewardXp += 25;
    rewardCoins += 10;
  }

  if ([60, 90].includes(day)) {
    rewardXp += 35;
    rewardCoins += 20;
  }

  if ([180].includes(day)) {
    rewardXp += 50;
    rewardCoins += 40;
  }

  if ([365].includes(day)) {
    rewardXp += 100;
    rewardCoins += 80;
  }

  return { rewardXp, rewardCoins };
}

export default function JourneyPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [journeyDays, setJourneyDays] = useState<JourneyDay[]>([]);
  const [todayRegistered, setTodayRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;
        if (!user) {
          router.push('/login');
          return;
        }

        if (!isMounted) return;
        setUserId(user.id);

        // Carrega perfil (para saber se é Premium)
        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('is_premium')
          .eq('id', user.id)
          .single();

        if (profErr) throw profErr;

        if (!isMounted) return;
        setIsPremium(!!profile?.is_premium);

        // Carrega jornada
        const { data: days, error: daysErr } = await supabase
          .from('journey_days')
          .select('*')
          .eq('user_id', user.id)
          .order('day_index', { ascending: true });

        if (daysErr && daysErr.code !== '42P01') {
          // 42P01 seria "tabela não existe"; se for outro erro, lança
          throw daysErr;
        }

        const safeDays = (days as JourneyDay[]) || [];
        if (!isMounted) return;

        setJourneyDays(safeDays);

        const todayStr = new Date().toISOString().slice(0, 10);
        setTodayRegistered(safeDays.some((d) => d.day_date === todayStr));
      } catch (err) {
        console.error('Erro ao carregar jornada', err);
        if (!isMounted) return;
        setError(
          'Ocorreu um erro ao carregar sua Jornada 365 dias. Tente novamente em alguns instantes.'
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [supabase, router]);

  const totalDays = journeyDays.length;
  const completionPercent = Math.min(100, (totalDays / 365) * 100);

  const nextDayIndex = (journeyDays[journeyDays.length - 1]?.day_index || 0) + 1;
  const nextReward = getRewardsForDay(nextDayIndex);

  async function handleRegisterDay() {
    if (!userId || saving) return;

    setError(null);
    setSuccess(null);

    // Conversão: só Premium registra dia
    if (!isPremium) {
      setError('A Jornada 365 dias é exclusiva para membros Premium.');
      return;
    }

    if (todayRegistered) {
      setError('Você já registrou o dia de hoje na sua jornada.');
      return;
    }

    setSaving(true);

    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const currentIndex = journeyDays[journeyDays.length - 1]?.day_index || 0;
      const newIndex = currentIndex + 1;

      const { rewardXp, rewardCoins } = getRewardsForDay(newIndex);

      // Insere o dia na tabela journey_days
      const { data: inserted, error: insertErr } = await supabase
        .from('journey_days')
        .insert({
          user_id: userId,
          day_index: newIndex,
          day_date: todayStr,
          reward_xp: rewardXp,
          reward_coins: rewardCoins,
        })
        .select('*')
        .single();

      if (insertErr) throw insertErr;

      setJourneyDays((prev) => [...prev, inserted as JourneyDay]);
      setTodayRegistered(true);

      // Credita recompensas usando a função de segurança já existente
      if (rewardXp || rewardCoins) {
        await supabase.rpc('credit_user_rewards_security', {
          p_user: userId,
          p_mission_id: null,
          p_mission_title: `Jornada 365 - Dia ${newIndex}`,
          p_reward_xp: rewardXp,
          p_reward_coins: rewardCoins,
          p_metadata: {
            source: 'journey_365',
            day_index: newIndex,
          },
        });
      }

      const coinsText = rewardCoins ? ` e +${rewardCoins} moedas` : '';
      setSuccess(`Dia ${newIndex} registrado! +${rewardXp} XP${coinsText}`);
    } catch (err) {
      console.error('Erro ao registrar dia da jornada', err);
      setError('Não foi possível registrar o dia. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-sm text-slate-300">
            Carregando sua Jornada 365 dias...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-6 pb-20">
        {/* Cabeçalho */}
        <header className="flex items-center justify-between gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-slate-100 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-300">
              Jornada 365 dias
            </span>
          </div>
        </header>

        {/* Hero / Overview */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-purple-600/20 p-5 md:p-6 mb-6">
          <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_top,_#22c55e33,_transparent_60%),_radial-gradient(circle_at_bottom,_#a855f733,_transparent_55%)]" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-xl md:text-2xl font-semibold">
                Um ano inteiro de transformação.
              </h1>
              <p className="text-sm text-slate-200/80 max-w-xl">
                A Jornada 365 dias acompanha, dia a dia, sua caminhada para uma
                vida com menos dependência e mais controle. Cada dia conta:
                você acumula XP, moedas e marcos épicos de evolução.
              </p>

              {/* Progresso */}
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-200/80">
                  <span>
                    Progresso: <strong>{totalDays}</strong> / 365 dias
                  </span>
                  <span>{completionPercent.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-amber-300 transition-all"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Card lateral com próximo dia */}
            <div className="relative shrink-0 md:w-60 rounded-2xl border border-emerald-500/40 bg-slate-950/70 px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
                <Flame className="w-4 h-4" />
                Próximo passo da sua jornada
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-semibold">Dia {nextDayIndex}</span>
              </div>
              <p className="text-xs text-slate-300/90">
                Recompensa prevista:{' '}
                <span className="font-semibold text-emerald-300">
                  +{nextReward.rewardXp} XP
                </span>
                {nextReward.rewardCoins ? (
                  <>
                    {' '}
                    <span className="text-slate-400"> • </span>{' '}
                    <span className="font-semibold text-amber-300">
                      +{nextReward.rewardCoins} moedas
                    </span>
                  </>
                ) : null}
              </p>
              <p className="text-[11px] text-slate-400">
                Bônus extras em marcos importantes como 7, 30, 60, 90, 180 e 365
                dias.
              </p>
            </div>
          </div>
        </section>

        {/* Alertas / mensagens */}
        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100 flex items-start gap-2">
            <span className="mt-0.5 text-base">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5" />
            <p>{success}</p>
          </div>
        )}

        {/* Bloco de conversão Premium */}
        {!isPremium && (
          <section className="mb-5 rounded-3xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-slate-900 to-purple-500/10 px-4 py-4 flex gap-3">
            <div className="mt-1">
              <Crown className="w-6 h-6 text-amber-300" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-amber-100">
                Jornada 365 dias – exclusivo para membros Premium
              </h2>
              <p className="text-xs text-amber-50/90">
                Você pode visualizar a ideia da jornada, mas para registrar
                cada dia, acumular XP, moedas e liberar todos os marcos, é
                necessário ser Premium.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Link
                  href="/profile"
                  className="inline-flex items-center justify-center rounded-full bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm hover:bg-amber-300 transition"
                >
                  Ver planos e tornar-se Premium
                </Link>
                <Link
                  href="/store"
                  className="inline-flex items-center justify-center rounded-full border border-amber-300/60 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-400/10 transition"
                >
                  Ver recompensas e loja
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Ações principais */}
        <section className="mb-6 rounded-3xl border border-slate-800 bg-slate-950/70 px-4 py-4 md:px-5 md:py-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-300" />
              <h2 className="text-sm font-semibold">
                Registrar dia da jornada
              </h2>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <Sparkles className="w-3 h-3" />
              <span>Cada dia conta para seu avanço e recompensas.</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <button
              type="button"
              onClick={handleRegisterDay}
              disabled={saving || todayRegistered || !isPremium}
              className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition shadow-sm
                ${
                  !isPremium
                    ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                    : todayRegistered
                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/60 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-400 to-emerald-500 text-slate-950 hover:from-emerald-300 hover:to-emerald-400'
                }`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Registrando dia...
                </>
              ) : !isPremium ? (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Exclusivo para Premium
                </>
              ) : todayRegistered ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Dia de hoje já registrado
                </>
              ) : (
                <>
                  <Flame className="w-4 h-4 mr-2" />
                  Registrar dia {nextDayIndex}
                </>
              )}
            </button>

            <p className="text-xs text-slate-400 md:max-w-sm">
              Você só pode registrar um dia por vez. Se ficar um tempo sem
              registrar, a jornada continua do ponto em que parou – sem culpa,
              apenas próximo passo.
            </p>
          </div>
        </section>

        {/* Histórico resumido + marcos */}
        <section className="space-y-4 mb-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-300" />
              <h2 className="text-sm font-semibold">Sua linha do tempo</h2>
            </div>
            <span className="text-[11px] text-slate-400">
              Mostrando últimos {Math.min(journeyDays.length, 10)} dias
            </span>
          </div>

          {journeyDays.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4 text-sm text-slate-300 flex gap-3">
              <span className="text-lg">🌱</span>
              <div>
                <p className="font-medium text-slate-100">
                  Sua jornada ainda não começou.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Assim que você registrar o primeiro dia, esta linha do tempo
                  vai mostrar seus marcos, recompensas e constância.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {journeyDays
                .slice(-10)
                .reverse()
                .map((day) => {
                  const isMilestone = [
                    1, 3, 7, 14, 21, 30, 60, 90, 180, 365,
                  ].includes(day.day_index);

                  return (
                    <div
                      key={day.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold
                          ${
                            isMilestone
                              ? 'border-emerald-400/70 bg-emerald-500/10 text-emerald-200'
                              : 'border-slate-700 bg-slate-900 text-slate-200'
                          }`}
                        >
                          {day.day_index}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            Dia {day.day_index}
                            {isMilestone && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300 border border-emerald-500/30">
                                Marco
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">
                            Registrado em{' '}
                            {new Date(day.day_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-slate-300">
                        {day.reward_xp ? (
                          <div>+{day.reward_xp} XP</div>
                        ) : null}
                        {day.reward_coins ? (
                          <div className="text-amber-300">
                            +{day.reward_coins} moedas
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {/* Preview bloqueado para Free: visão do futuro */}
        {!isPremium && (
          <section className="mb-6 rounded-3xl border border-slate-800 bg-slate-950/70 px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-slate-300" />
              <h2 className="text-sm font-semibold">
                Preview da sua Jornada 365 dias
              </h2>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Ao se tornar Premium, você desbloqueia a jornada completa com
              marcos especiais em 7, 30, 60, 90, 180 e 365 dias, recompensas
              crescentes e registro guiado diariamente.
            </p>

            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="rounded-2xl border border-emerald-400/60 bg-emerald-500/10 px-2 py-2">
                <div className="font-semibold text-emerald-200">Dia 7</div>
                <div className="text-slate-200">Primeira grande virada</div>
                <div className="mt-1 text-emerald-300">Bônus XP + moedas</div>
              </div>
              <div className="rounded-2xl border border-emerald-400/60 bg-emerald-500/10 px-2 py-2">
                <div className="font-semibold text-emerald-200">Dia 30</div>
                <div className="text-slate-200">Um mês de consistência</div>
                <div className="mt-1 text-emerald-300">Recompensa elevada</div>
              </div>
              <div className="rounded-2xl border border-amber-400/70 bg-amber-500/10 px-2 py-2">
                <div className="font-semibold text-amber-200">Dia 365</div>
                <div className="text-slate-50">Ano lendário</div>
                <div className="mt-1 text-amber-300">
                  Recompensa máx. + título
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Rodapé pequeno */}
        <footer className="mt-6 text-center text-[11px] text-slate-500">
          <p>
            A Jornada 365 dias não é sobre perfeição. É sobre continuar
            caminhando — um dia de cada vez.
          </p>
        </footer>
      </div>
    </main>
  );
}
