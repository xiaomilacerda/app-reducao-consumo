'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, Users, MessageSquareWarning, Upload, Activity, LayoutDashboard, LogIn } from 'lucide-react';
import { getSupabaseBrowserClient } from '../_lib/supabase';

type AdminCheck =
  | { ok: true; userId: string; email?: string | null }
  | { ok: false; reason: 'not_logged_in' | 'not_admin' | 'error'; message?: string };

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [state, setState] = useState<AdminCheck | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const user = authData.user;
        if (!user) {
          if (!cancelled) setState({ ok: false, reason: 'not_logged_in' });
          return;
        }

        // Prefer profiles.is_admin; fallback to admin_users table if present
        let isAdmin = false;

        const profileRes = await supabase
          .from('profiles')
          .select('id, email, is_admin')
          .eq('id', user.id)
          .maybeSingle();

        if (!profileRes.error && profileRes.data) {
          isAdmin = Boolean((profileRes.data as any).is_admin);
        } else {
          // fallback admin_users table
          const adminRes = await supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
          if (!adminRes.error && adminRes.data) isAdmin = true;
        }

        if (!isAdmin) {
          if (!cancelled) setState({ ok: false, reason: 'not_admin' });
          return;
        }

        if (!cancelled) setState({ ok: true, userId: user.id, email: user.email });
      } catch (e: any) {
        if (!cancelled) setState({ ok: false, reason: 'error', message: e?.message || 'Erro ao verificar admin' });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const nav = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Usuários', icon: Users },
    { href: '/admin/community', label: 'Mural & Denúncias', icon: MessageSquareWarning },
    { href: '/admin/import', label: 'Importações', icon: Upload },
    { href: '/admin/sos-analytics', label: 'SOS Analytics', icon: Activity },
  ];

  if (state === null) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-200">
          <Shield className="h-5 w-5" />
          <span>Carregando painel admin…</span>
        </div>
      </div>
    );
  }

  if (!state.ok) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6" />
            <h1 className="text-lg font-semibold">Acesso restrito</h1>
          </div>

          <p className="mt-3 text-slate-300">
            {state.reason === 'not_logged_in' && 'Você precisa estar logado para acessar o painel.'}
            {state.reason === 'not_admin' && 'Sua conta não tem permissão de administrador.'}
            {state.reason === 'error' && (state.message || 'Erro ao validar permissão de admin.')}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
            >
              Voltar
            </Link>
            <button
              onClick={() => router.refresh()}
              className="rounded-xl bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600"
            >
              Tentar novamente
            </button>
            {state.reason === 'not_logged_in' && (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm hover:bg-indigo-500"
              >
                <LogIn className="h-4 w-4" />
                Ir para login
              </Link>
            )}
          </div>

          <div className="mt-4 text-xs text-slate-500">
            Dica: se você já é admin no banco, verifique se <code className="text-slate-300">profiles.is_admin</code> está <code className="text-slate-300">true</code> ou se existe uma linha em <code className="text-slate-300">admin_users</code>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-900 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-300" />
            <span className="font-semibold">Admin</span>
            <span className="text-xs text-slate-400">• {state.email || state.userId}</span>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/" className="text-sm text-slate-300 hover:text-white">
              App
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-3">
          <nav className="flex flex-wrap gap-2">
            {nav.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(item.href + '/');
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
                    active
                      ? 'border-indigo-500/50 bg-indigo-600/15 text-white'
                      : 'border-slate-800 bg-slate-900/20 text-slate-200 hover:bg-slate-900/40'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
