'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function RedefinirSenhaPage() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    // PKCE / email recovery links are processed by the Supabase browser client.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setAuthorized(true);
        setChecking(false);
      }
    });
    void supabase.auth.getUser().then(({ data, error: authError }: any) => {
      if (!active) return;
      // Do not overwrite a PASSWORD_RECOVERY event with a stale getUser result.
      if (!authError && data.user) setAuthorized(true);
      setChecking(false);
    }).catch(() => { if (active) setChecking(false); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !authorized) return;
    setError('');
    if (password.length < 10) {
      setError('Use uma senha com pelo menos 10 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As duas senhas precisam ser iguais.');
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      setPassword('');
      setConfirm('');
      await supabase.auth.signOut();
    } catch {
      setError('Não foi possível atualizar a senha. Solicite um novo link e tente novamente.');
    } finally {
      setSaving(false);
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
        <h1 className="text-2xl font-bold">Definir nova senha</h1>
        {done ? (
          <div role="status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            <ShieldCheck className="mb-2 h-5 w-5" aria-hidden="true" />
            Sua senha foi atualizada. Entre novamente com a nova senha.
            <Link href="/login" className="mt-3 block font-semibold underline underline-offset-2">Ir para o login</Link>
          </div>
        ) : checking ? (
          <p role="status" className="mt-4 text-sm text-slate-300">Verificando o link de recuperação...</p>
        ) : !authorized ? (
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <p>Este link expirou ou não pôde ser validado.</p>
            <Link href="/recuperar-senha" className="inline-flex min-h-11 items-center font-semibold text-violet-200 underline">Solicitar outro link</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <p className="text-sm text-slate-300">Crie uma senha com pelo menos 10 caracteres.</p>
            <label htmlFor="new-password" className="block text-sm font-medium">Nova senha</label>
            <input id="new-password" type="password" autoComplete="new-password" required minLength={10}
              value={password} onChange={e => setPassword(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-white/20 bg-black/20 px-3 text-sm outline-none focus:border-violet-300" />
            <label htmlFor="confirm-password" className="block text-sm font-medium">Confirmar nova senha</label>
            <input id="confirm-password" type="password" autoComplete="new-password" required minLength={10}
              value={confirm} onChange={e => setConfirm(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-white/20 bg-black/20 px-3 text-sm outline-none focus:border-violet-300" />
            {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
            <button type="submit" disabled={saving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-300 px-4 font-bold text-[#1a122e] disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? 'Salvando...' : 'Atualizar minha senha'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
