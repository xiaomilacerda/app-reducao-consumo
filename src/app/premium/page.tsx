'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Crown,
  Sparkles,
  CheckCircle2,
  Lock,
  Loader2,
  Star,
  ShieldCheck,
  HeartHandshake,
  Flame,
} from 'lucide-react';

import { useLocaleCurrency, formatCurrency } from '@/hooks/useLocaleCurrency';
import { PRICING_PLANS } from '@/config/pricing';
import type { SupportedCurrency } from '@/config/localization';

// 🔹 Mesma instância do app todo
import { supabase } from '@/lib/supabase';

// 🔹 IMPORTS PARA ESPELHAR NO STORAGE LOCAL
import { storage } from '@/lib/storage';
import type { UserData } from '@/lib/types';

export default function PremiumPage() {
  const router = useRouter();
  const { currency } = useLocaleCurrency();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const monthlyPlan = PRICING_PLANS.find((p) => p.id === 'monthly');
  const annualPlan = PRICING_PLANS.find((p) => p.id === 'annual');
  const lifetimePlan = PRICING_PLANS.find((p) => p.id === 'lifetime');

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        setError(null);

        // ✅ Usa a MESMA instância do app + getSession
        const {
          data: { session },
          error: sessionErr,
        } = await supabase.auth.getSession();

        if (sessionErr) throw sessionErr;

        const user = session?.user || null;

        if (!user) {
          if (!isMounted) return;
          setUserId(null);
          setIsPremium(false);
          setError('Você precisa estar logado para acessar a tela Premium.');
          return;
        }

        if (!isMounted) return;
        setUserId(user.id);

        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('is_premium')
          .eq('id', user.id)
          .single();

        if (profErr) throw profErr;
        if (!isMounted) return;

        const premiumFlag = !!profile?.is_premium;
        setIsPremium(premiumFlag);

        // 🔹 espelha no storage local (para telas antigas que usam storage)
        try {
          const local = storage.getUserData();
          if (local) {
            const updated: UserData = { ...local, isPremium: premiumFlag };
            storage.saveUserData(updated);
          }
        } catch (mirrorErr) {
          console.error(
            'Erro espelhando premium inicial no storage local:',
            mirrorErr
          );
        }
      } catch (err) {
        console.error('Erro carregando dados Premium', err);
        if (!isMounted) return;
        setError(
          'Não foi possível carregar seu status Premium. Tente novamente mais tarde.'
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  async function updatePremiumStatus(nextValue: boolean) {
    if (!userId || saving) return;

    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ is_premium: nextValue })
        .eq('id', userId);

      if (updateErr) throw updateErr;

      // 🔹 Atualiza estado da página
      setIsPremium(nextValue);

      // 🔹 Espelha no storage local (para Detox / Cant-Stop / etc.)
      try {
        const local = storage.getUserData();
        if (local) {
          const updated: UserData = { ...local, isPremium: nextValue };
          storage.saveUserData(updated);
        }
      } catch (mirrorErr) {
        console.error(
          'Erro espelhando isPremium no storage local após update:',
          mirrorErr
        );
      }

      setSuccess(
        nextValue
          ? 'Modo Premium (teste) ativado com sucesso. Agora você consegue testar todos os recursos avançados do app.'
          : 'Você voltou para o modo Free (teste). Assim fica fácil comparar a experiência.'
      );
    } catch (err) {
      console.error('Erro atualizando is_premium', err);
      setError(
        'Não foi possível atualizar seu status Premium. Verifique o console/log do Supabase se o erro persistir.'
      );
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
            Carregando detalhes dos planos...
          </p>
        </div>
      </main>
    );
  }

  function renderAllCurrencies(planId: 'monthly' | 'annual' | 'lifetime') {
    const plan = PRICING_PLANS.find((p) => p.id === planId);
    if (!plan) return null;

    const entries = Object.entries(plan.prices) as [SupportedCurrency, number][];
    return (
      <span className="text-[11px] text-slate-400">
        {entries
          .map(([cur, value]) => formatCurrency(value, cur))
          .join(' • ')}
      </span>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-6 pb-20">
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
              WeedReset Premium
            </span>
          </div>
        </header>

        {/* Hero */}
        <section className="relative mb-6 overflow-hidden rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-slate-900 to-purple-600/25 px-5 py-6 md:px-7 md:py-7">
          <div className="absolute inset-0 opacity-30 pointer-events-none bg-[radial-gradient(circle_at_top,_#fbbf2433,_transparent_60%),_radial-gradient(circle_at_bottom,_#a855f733,_transparent_55%)]" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 border border-amber-400/50">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span className="text-[11px] font-medium text-amber-100 uppercase tracking-[0.18em]">
                  Evolução guiada, não julgamento
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold leading-tight">
                Desbloqueie a versão mais estratégica da sua jornada.
              </h1>
              <p className="text-sm text-amber-50/90">
                Com o WeedReset Premium você ganha ferramentas para entender
                seus padrões, antecipar gatilhos e construir constância com
                apoio visual, recompensas e análise inteligente. Sem
                moralismo, só estratégia.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-amber-50/90">
                <div className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 border border-amber-400/30">
                  <Flame className="w-3 h-3 text-amber-300" />
                  Jornada 365 dias completa
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 border border-amber-400/30">
                  <ShieldCheck className="w-3 h-3 text-emerald-300" />
                  SOS avançado + histórico
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 border border-amber-400/30">
                  <Star className="w-3 h-3 text-purple-300" />
                  Missões extras & recompensas
                </div>
              </div>
            </div>

            <div className="relative shrink-0 w-full md:w-64 rounded-3xl border border-amber-400/60 bg-slate-950/80 px-4 py-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-amber-200 uppercase tracking-[0.15em]">
                  Seu status
                </span>
                <Crown
                  className={`w-5 h-5 ${
                    isPremium ? 'text-amber-300' : 'text-slate-500'
                  }`}
                />
              </div>
              <p className="text-sm font-semibold">
                {isPremium ? 'Você está em modo Premium' : 'Você está em modo Free'}
              </p>
              <p className="text-xs text-slate-400">
                Este controle é apenas para testes de desenvolvimento. Na
                versão final, ele será substituído pelo fluxo real de pagamento.
              </p>

              <button
                type="button"
                disabled={saving || !userId}
                onClick={() => updatePremiumStatus(!isPremium)}
                className={`mt-3 inline-flex items-center justify-center rounded-full px-3 py-2 text-xs font-semibold transition shadow-sm w-full
                  ${
                    isPremium
                      ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                      : 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:from-amber-300 hover:to-amber-400'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Atualizando...
                  </>
                ) : isPremium ? (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Voltar para modo Free (teste)
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4 mr-2" />
                    Ativar Premium (modo teste)
                  </>
                )}
              </button>

              <p className="mt-1 text-[11px] text-slate-500">
                Use esse botão para testar recursos avançados exclusivos para
                assinantes Premium, como jornada 365 completa, analytics
                aprofundado, SOS especial e mais.
              </p>
            </div>
          </div>
        </section>

        {/* Mensagens */}
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

        {/* Comparativo Free x Premium */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-emerald-300" />
            O que muda entre Free e Premium
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Free */}
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 px-4 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Plano Free
                </span>
              </div>
              <p className="text-sm text-slate-200">
                Para quem está testando o app ou quer o básico para se situar.
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
                <li>• Registro de humor e diário básico</li>
                <li>• Parte dos insights visuais de evolução</li>
                <li>• Acesso limitado às missões</li>
                <li>• SOS com ferramentas essenciais</li>
                <li>• Community com participação limitada</li>
              </ul>
            </div>

            {/* Premium */}
            <div className="rounded-3xl border border-amber-400/60 bg-gradient-to-br from-amber-500/15 via-slate-950 to-purple-600/20 px-4 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                  Premium Completo
                </span>
                <Crown className="w-4 h-4 text-amber-300" />
              </div>
              <p className="text-sm text-amber-50/95">
                Para quem quer usar o WeedReset como painel de controle da
                própria jornada.
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-amber-50/90">
                <li>• Jornada 365 dias com recompensas e marcos especiais</li>
                <li>• SOS avançado + histórico de “não aguento mais”</li>
                <li>• Analytics e AI Insights mais completos</li>
                <li>• Mais missões, mais XP e mais moedas</li>
                <li>• Avatares e personalizações extras no perfil</li>
                <li>• Planejamento de metas e métricas avançadas</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Planos */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Star className="w-4 h-4 text-purple-300" />
            Planos Premium (valores globais sugeridos)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {/* Mensal */}
            <div className="rounded-3xl border border-slate-800 bg-slate-950/80 px-4 py-4 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Premium Mensal
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <div className="text-2xl font-semibold">
                    {monthlyPlan
                      ? formatCurrency(
                          monthlyPlan.prices[currency],
                          currency
                        )
                      : '—'}
                  </div>
                  <span className="text-[11px] text-slate-400">/mês</span>
                </div>
                {monthlyPlan && (
                  <div className="mt-1">
                    {renderAllCurrencies('monthly')}
                  </div>
                )}
                <p className="mt-2 text-xs text-slate-300">
                  Ideal para testar o Premium por pouco tempo, mas é o plano com
                  menor vantagem no longo prazo.
                </p>
              </div>
              <button
                type="button"
                className="mt-3 inline-flex items-center justify-center rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition"
                onClick={() =>
                  alert(
                    'Aqui entraria o fluxo real de pagamento mensal (Stripe, Play Store, etc.). No momento, é apenas um mock.'
                  )
                }
              >
                Assinar Mensal (mock)
              </button>
            </div>

            {/* Anual */}
            <div className="rounded-3xl border border-amber-400/70 bg-gradient-to-b from-amber-500/20 via-slate-950 to-slate-950 px-4 py-4 flex flex-col justify-between shadow-lg shadow-amber-500/20">
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                    Premium Anual
                  </div>
                  <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-amber-100 border border-amber-400/60">
                    Mais escolhido
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <div className="text-2xl font-semibold">
                    {annualPlan
                      ? formatCurrency(annualPlan.prices[currency], currency)
                      : '—'}
                  </div>
                  <span className="text-[11px] text-amber-100">/ano</span>
                </div>
                {annualPlan && (
                  <div className="mt-1 text-[11px] text-amber-100">
                    {renderAllCurrencies('annual')}
                  </div>
                )}
                <p className="mt-2 text-xs text-amber-50/90">
                  Melhor custo-benefício: sai muito mais barato do que renovar
                  mensal durante o ano inteiro.
                </p>
              </div>
              <button
                type="button"
                className="mt-3 inline-flex items-center justify-center rounded-full bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 transition"
                onClick={() =>
                  alert(
                    'Mock de plano anual. Na versão final, aqui entra o fluxo de pagamento anual.'
                  )
                }
              >
                Assinar Anual (mock)
              </button>
            </div>

            {/* Vitalício */}
            <div className="rounded-3xl border border-purple-400/60 bg-gradient-to-b from-purple-500/20 via-slate-950 to-slate-950 px-4 py-4 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
                  Premium Vitalício
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <div className="text-2xl font-semibold">
                    {lifetimePlan
                      ? formatCurrency(
                          lifetimePlan.prices[currency],
                          currency
                        )
                      : '—'}
                  </div>
                  <span className="text-[11px] text-purple-100">
                    pagamento único
                  </span>
                </div>
                {lifetimePlan && (
                  <div className="mt-1 text-[11px] text-purple-100">
                    {renderAllCurrencies('lifetime')}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-purple-300">
                  Valor promocional de lançamento. Previsão futura: R$ 199,90.
                </p>
                <p className="mt-2 text-xs text-purple-50/90">
                  Para quem já decidiu que quer manter o WeedReset como aliado
                  permanente na vida. Paga uma vez, usa para sempre.
                </p>
              </div>
              <button
                type="button"
                className="mt-3 inline-flex items-center justify-center rounded-full border border-purple-400 px-3 py-2 text-xs text-purple-50 hover:bg-purple-500/20 transition"
                onClick={() =>
                  alert(
                    'Mock de plano vitalício. Na versão final, este botão levará ao fluxo de pagamento lifetime.'
                  )
                }
              >
                Comprar Vitalício (mock)
              </button>
            </div>
          </div>
        </section>

        <footer className="mt-4 text-center text-[11px] text-slate-500">
          <p>
            Os valores e planos aqui são rascunhos para desenvolvimento. Na
            versão final, esta tela será conectada ao sistema de pagamentos que
            você escolher (Play Store, Stripe, Pix, etc.).
          </p>
        </footer>
      </div>
    </main>
  );
}
