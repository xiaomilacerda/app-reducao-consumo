'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Loader2, UserPlus } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setLoading(true);

    try {
      const emailTrimmed = email.trim();
      const nomeTrimmed = nome.trim();

      if (!emailTrimmed || !nomeTrimmed) {
        setErro('Preencha nome e e-mail corretamente.');
        setLoading(false);
        return;
      }

      // 1) Criar usuário no Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: emailTrimmed,
        password: senha,
      });

      if (error) {
        setErro(error.message);
        setLoading(false);
        return;
      }

      if (!data.user) {
        setErro('Erro inesperado ao criar conta.');
        setLoading(false);
        return;
      }

      // Supabase pode exigir confirmação do e-mail e não criar sessão imediatamente.
      // Nesse caso, as políticas RLS impedem os writes abaixo.
      if (!data.session) {
        setSucesso('Conta criada! Confira seu e-mail e confirme o cadastro antes de entrar.');
        return;
      }

      // 2) Criar / atualizar perfil com o NOME DIGITADO
      // - full_name: nome completo
      // - display_name: nome/apelido que aparece no app
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: nomeTrimmed,
        display_name: nomeTrimmed,
        email: emailTrimmed,
        is_premium: false,
        created_at: new Date().toISOString(),
        preferred_language: 'pt',
      });

      if (profileError) {
        console.error('Erro ao criar perfil:', profileError.message);
        // não bloqueia o fluxo, só registra o erro
      }

      // Garantir a carteira do usuário (coins) logo na criação da conta
      try {
        const { error: walletError } = await supabase.from('user_wallet').upsert({
          user_id: data.user.id,
          coins: 0,
          updated_at: new Date().toISOString(),
        } as any);
        if (walletError) console.warn('Erro ao criar user_wallet:', walletError);
      } catch (err) {
        console.warn('user_wallet upsert catch:', err);
      }

      // opcional: salvar nome exibido localmente
      if (typeof window !== 'undefined') {
        localStorage.setItem('weedreset_display_name', nomeTrimmed);
      }

      router.push('/login');
    } catch (err: any) {
      console.error(err?.message ?? err);
      setErro('Não foi possível criar sua conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen text-white px-4 py-8 relative z-10">
      <div className="max-w-5xl mx-auto grid gap-8 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-center">
        {/* Lado de apresentação / benefícios da conta */}
        <section className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-purple-300/80 mb-1">
              CRIAR CONTA
            </p>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">
              Comece hoje a organizar sua relação com o consumo.
            </h1>
            <p className="mt-3 text-sm text-purple-100/80 max-w-lg">
              Com uma conta WeedReset, você salva seu progresso na nuvem,
              acessa o app em vários dispositivos e desbloqueia métricas
              personalizadas da sua jornada.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 h-5 w-5 rounded-full bg-purple-600/80 flex items-center justify-center text-[11px]">
                1
              </span>
              <div>
                <p className="font-semibold text-purple-100">
                  Configure seu ponto de partida
                </p>
                <p className="text-purple-100/80">
                  Defina como está seu consumo hoje, quanto gasta e qual é sua
                  meta principal.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="mt-0.5 h-5 w-5 rounded-full bg-purple-600/80 flex items-center justify-center text-[11px]">
                2
              </span>
              <div>
                <p className="font-semibold text-purple-100">
                  Acompanhe o tempo limpo e a economia
                </p>
                <p className="text-purple-100/80">
                  Veja as projeções mensais e o quanto você já deixou de
                  gastar.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="mt-0.5 h-5 w-5 rounded-full bg-purple-600/80 flex items-center justify-center text-[11px]">
                3
              </span>
              <div>
                <p className="font-semibold text-purple-100">
                  Use ferramentas de apoio nos momentos difíceis
                </p>
                <p className="text-purple-100/80">
                  SOS, jornada guiada, evolução do corpo e recursos extras
                  ajudam você a não caminhar sozinho.
                </p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-purple-200/80 max-w-sm">
            Você começa no plano gratuito. Se fizer sentido, poderá migrar para
            o Premium dentro do próprio aplicativo, sem compromisso.
          </p>
        </section>

        {/* Lado do formulário de cadastro */}
        <section className="w-full max-w-md mx-auto bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-2xl p-7 border border-purple-500/20">
          <div className="text-center mb-5">
            <h2 className="text-xl font-semibold text-white">
              Criar conta no WeedReset
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Leva menos de 1 minuto para começar.
            </p>
          </div>

          {sucesso && (
            <div role="status" className="text-xs text-emerald-200 bg-emerald-950/70 border border-emerald-500/40 rounded-lg px-3 py-3 mb-3">
              {sucesso} <Link href="/login" className="underline font-semibold">Ir para login</Link>
            </div>
          )}

          {erro && (
            <div className="text-xs text-red-300 bg-red-900/40 border border-red-600/50 rounded-lg px-3 py-2 mb-3">
              {erro}
            </div>
          )}

          <form className="space-y-3" onSubmit={handleSignup}>
            <div>
              <label className="text-xs text-gray-300">Nome completo</label>
              <input
                type="text"
                required
                className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 outline-none text-sm text-white focus:ring-2 focus:ring-purple-500"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-300">E-mail</label>
              <input
                type="email"
                required
                className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 outline-none text-sm text-white focus:ring-2 focus:ring-purple-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-300">Senha</label>
              <input
                type="password"
                required
                className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 outline-none text-sm text-white focus:ring-2 focus:ring-purple-500"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Use uma senha forte e que você não utilize em outros serviços.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 flex items-center justify-center gap-2 bg-gradient-to-r from-fuchsia-500 to-purple-600 px-4 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 transition"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Criar conta
                </>
              )}
            </button>
          </form>

          <div className="mt-4 text-center text-xs text-gray-300">
            Já tem conta?{' '}
            <Link
              href="/login"
              className="text-purple-300 hover:text-purple-100 underline underline-offset-2"
            >
              Entrar
            </Link>
          </div>

          <div className="mt-4 border-t border-gray-800 pt-3">
            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              Ao criar sua conta, você declara que leu e concorda com os{' '}
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
          </div>
        </section>
      </div>
    </div>
  );
}
