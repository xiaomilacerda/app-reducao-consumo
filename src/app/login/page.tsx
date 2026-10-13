'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';

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

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1) Se já existe sessão → manda para /profile
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        router.replace(getSafeAfterLoginPath());
        return;
      }
      setLoading(false);
    };
    checkSession();
  }, [router]);

  // 2) Após login, garantir perfil & status premium sincronizados
  const syncProfile = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;

      const user = data.user;

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
        });
      }

      // Garantir que exista uma carteira (evita moedas "0" em telas que leem user_wallet)
      try {
        const { error: wErr } = await supabase.from('user_wallet').upsert({
          user_id: user.id,
          coins: 0,
          updated_at: new Date().toISOString(),
        } as any);
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

      storage.saveUserData({
        ...(storage.getUserData() ?? {}),
        onboardingCompleted: true,
      });
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
        setErrorMsg(error.message);
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
      setErrorMsg(err.message ?? 'Erro inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  // LOADING
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center text-white gap-3">
          <div className="h-10 w-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span>Carregando...</span>
        </div>
      </div>
    );
  }

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
              <label className="text-gray-300 text-xs">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-gray-300 text-xs">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none text-sm"
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
