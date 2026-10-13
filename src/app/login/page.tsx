'use client';

import { traduzirErro } from '@/lib/traduzir-erro';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import { prepareLocalAccount, readPrivateState, restoreJourney, snapshotJourney, updatePrivateState } from '@/lib/private-state';

function getSafeAfterLoginPath(): string {
  if (typeof window === 'undefined') return '/profile';
  const target = new URLSearchParams(window.location.search).get('next');
  // Only allow same-origin paths; never pass user-controlled external URLs to router.replace.
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.includes('\\')) {
    return '/profile';
  }
  return target;
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Não bloqueie a tela esperando getSession(): uma sessão local obsoleta
  // pode causar um loop com a proteção SSR de /profile.
  // O usuário sempre terá acesso ao formulário de login.

  // 2) Após login, garantir perfil & status premium sincronizados
  const syncProfile = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;

      const user = data.user;
      prepareLocalAccount(user.id);

      // Ao entrar, a conta no Supabase assume a prioridade sobre o cache local.
      try {
        const cloud = await readPrivateState(user.id);
        const local = storage.getUserData();
        if (cloud?.userData && Object.keys(cloud.userData).length > 0) {
          restoreJourney(cloud, local);
        } else if (local?.onboardingCompleted) {
          // Migra dados locais antigos somente quando ainda não existe registro na nuvem.
          await updatePrivateState({ userData: snapshotJourney(local) });
        }
      } catch (syncError) {
        console.warn('Sincronização da jornada pendente:', syncError);
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile) {
        await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          is_premium: false,
          created_at: new Date().toISOString(),
          full_name: typeof user.user_metadata?.full_name === 'string'
            ? user.user_metadata.full_name : null,
          display_name: typeof user.user_metadata?.display_name === 'string'
            ? user.user_metadata.display_name : null,
        });
      } else if (!profile.full_name && typeof user.user_metadata?.full_name === 'string') {
        // O trigger de cadastro antigo criava perfis sem nome; recupere-o com
        // os metadados da conta sem alterar moedas, XP ou o status premium.
        const name = user.user_metadata.full_name.trim();
        if (name) {
          await supabase.from('profiles')
            .update({ full_name: name, display_name: profile.display_name || name })
            .eq('id', user.id);
        }
      }

      // Garantir que exista uma carteira (evita moedas "0" em telas que leem user_wallet)
      try {
        // Insere a carteira somente se ainda não existir: jamais zere moedas no login.
        const { error: wErr } = await supabase.from('user_wallet').upsert(
          { user_id: user.id, coins: 0, updated_at: new Date().toISOString() },
          { onConflict: 'user_id', ignoreDuplicates: true }
        );
        if (wErr) console.warn('user_wallet upsert (login) error:', wErr);
      } catch (err) {
        console.warn('user_wallet upsert (login) catch:', err);
      }

      const current = storage.getUserData();
      if (current) {
        storage.saveUserData({
          ...current,
          isPremium: profile?.is_premium ?? false,
        });
      }

      // O login não deve marcar o onboarding como concluído nem substituir
      // os dados locais quando o usuário ainda não configurou sua jornada.
    } catch (err) {
      console.error('Erro syncProfile:', err);
    }
  };

  // 3) Função de login
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(traduzirErro(error));
        setSubmitting(false);
        return;
      }

      if (!data.session) {
        setErrorMsg('Erro: sessão não criada.');
        setSubmitting(false);
        return;
      }

      await syncProfile();
      router.replace(getSafeAfterLoginPath());
    } catch (err: any) {
      console.error(err);
      setErrorMsg(traduzirErro(err, 'Não foi possível entrar. Tente novamente.'));
    } finally {
      setSubmitting(false);
    }
  };

  // UI PRINCIPAL
  return (
    <div className="min-h-screen text-white px-4 py-8 relative z-10">
      <div className="max-w-5xl mx-auto grid gap-8 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-center">
        {/* Lado de apresentação do app */}
        <section className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-purple-300/80 mb-1">
              WEEDRESET
            </p>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">
              Sua jornada de{' '}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                redução e liberdade
              </span>{' '}
              em um só lugar.
            </h1>
            <p className="mt-3 text-sm text-purple-100/80 max-w-lg">
              Acompanhe seu tempo limpo, o dinheiro economizado e o impacto na sua saúde,
              com ferramentas pensadas para quem quer um relacionamento mais leve com o
              próprio consumo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-2xl border border-purple-500/40 bg-purple-900/30 px-4 py-3">
              <p className="font-semibold text-purple-100 mb-1">Tempo limpo</p>
              <p className="text-purple-200/80">
                Veja a evolução da sua jornada dia após dia, com metas claras e visão de
                progresso.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-900/20 px-4 py-3">
              <p className="font-semibold text-emerald-100 mb-1">Economia real</p>
              <p className="text-emerald-100/80">
                Descubra quanto dinheiro você já deixou de gastar e projeções mensais.
              </p>
            </div>
            <div className="rounded-2xl border border-pink-500/40 bg-pink-900/25 px-4 py-3">
              <p className="font-semibold text-pink-100 mb-1">Ferramentas de apoio</p>
              <p className="text-pink-100/80">
                SOS, missão diária, evolução do corpo e comunidade anônima focada em apoio.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-purple-200/80 max-w-sm">
            Ao criar sua conta, você começa no plano gratuito e pode testar as principais
            funcionalidades. Se fizer sentido, você pode migrar para o Premium dentro do
            próprio app.
          </p>

          <div className="hidden md:flex items-center gap-2 text-[11px] text-purple-200/70">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Seus dados são tratados com sigilo e foco em privacidade.</span>
          </div>
        </section>

        {/* Lado do formulário de login */}
        <section className="w-full max-w-md mx-auto bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-2xl p-7 border border-purple-500/20">
          <div className="mb-5 text-center">
            <h2 className="text-xl font-semibold">Entrar na sua conta</h2>
            <p className="text-gray-400 text-xs mt-1">
              Continue exatamente de onde parou na sua jornada.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 text-red-300 bg-red-900/40 border border-red-600/50 rounded-lg px-3 py-2 text-xs">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="login-email" className="text-sm font-medium text-slate-200">E-mail</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="wr-auth-input w-full h-11 rounded-xl border border-slate-600/80 bg-[#0b1220] px-4 text-sm text-slate-50 placeholder:text-slate-400 outline-none shadow-sm transition-colors hover:border-slate-500 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/35"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="login-password" className="text-sm font-medium text-slate-200">Senha</label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className="wr-auth-input w-full h-11 rounded-xl border border-slate-600/80 bg-[#0b1220] px-4 text-sm text-slate-50 placeholder:text-slate-400 outline-none shadow-sm transition-colors hover:border-slate-500 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/35"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 transition"
            >
              {submitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-4 text-center text-xs text-gray-300">
            <span>Ainda não tem conta? </span>
            <Link
              href="/signup"
              className="text-purple-300 hover:text-purple-100 underline underline-offset-2"
            >
              Criar conta gratuita
            </Link>
          </div>

          <div className="mt-5 border-t border-gray-800 pt-3 space-y-2">
            <p className="text-[11px] text-gray-500 text-center leading-relaxed">
              Ao entrar, você declara que leu e concorda com os{' '}
              <Link
                href="/terms"
                className="text-purple-300 hover:text-purple-100 underline"
              >
                Termos de Uso
              </Link>{' '}
              e com a{' '}
              <Link
                href="/privacy"
                className="text-purple-300 hover:text-purple-100 underline"
              >
                Política de Privacidade
              </Link>
              .
            </p>

            <div className="text-center">
              <Link href="/" className="text-[11px] text-gray-500 hover:text-gray-300">
                Voltar para a Home
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
