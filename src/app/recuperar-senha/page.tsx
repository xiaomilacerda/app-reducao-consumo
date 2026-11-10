'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Mail, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError('');
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/redefinir-senha',
      });
      if (authError) throw authError;
      // Avoid disclosing whether an account exists for this address.
      setSent(true);
    } catch {
      setError('Não foi possível enviar agora. Aguarde alguns minutos e tente novamente.');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="wr-screen flex min-h-screen items-center justify-center px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1b182b] p-6 shadow-xl sm:p-8">
        <Link href="/login" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-violet-200 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao login
        </Link>
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-400/10 text-violet-200">
          <KeyRound className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold">Recuperar minha senha</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Informe seu e-mail. Se houver uma conta vinculada, você receberá um link para criar outra senha.
        </p>
        {sent ? (
          <div role="status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            Solicitação recebida. Confira a caixa de entrada e o spam. O link pode levar alguns minutos.
            <Link href="/login" className="mt-3 block font-semibold underline underline-offset-2">Voltar ao login</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-slate-200" htmlFor="recovery-email">E-mail da conta</label>
            <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-black/20 px-3 focus-within:border-violet-300">
              <Mail className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input id="recovery-email" type="email" autoComplete="email" required maxLength={254}
                value={email} onChange={e => setEmail(e.target.value)}
                className="min-h-12 w-full min-w-0 bg-transparent text-sm text-white outline-none"
                placeholder="voce@exemplo.com" />
            </div>
            {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
            <button type="submit" disabled={sending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-300 px-4 font-bold text-[#1a122e] disabled:opacity-60">
              {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {sending ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
