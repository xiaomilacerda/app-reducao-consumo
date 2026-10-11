'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Users, MessageSquareWarning, Upload, Activity, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getSupabaseBrowserClient } from './_lib/supabase';

type Metric = { label: string; value: string; hint?: string; icon?: any; href?: string };

type ReportRow = {
  id: string;
  reporter_id?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  reason?: string | null;
  status?: string | null;
  created_at?: string | null;
  resolved_at?: string | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

async function tryFirst<T>(
  attempts: Array<() => Promise<{ data: T[] | null; error: any; count?: number | null }>>
) {
  for (const fn of attempts) {
    const res = await fn();
    if (!res.error) return res;
  }
  return attempts[0]();
}

export default function AdminDashboardPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [latestReports, setLatestReports] = useState<ReportRow[]>([]);
  const [tables, setTables] = useState<{ posts?: string; reports?: string }>({});

  const POSTS_TABLES = ['community_posts', 'mural_posts', 'posts'];
  const REPORTS_TABLES = ['community_reports', 'mural_reports', 'reports', 'community_flags'];

  async function load() {
    setBusy(true);
    setError(null);
    try {
      // users count
      const usersCountRes = await supabase.from('profiles').select('id', { count: 'exact', head: true } as any);
      const totalUsers = (usersCountRes as any).count ?? null;

      // posts count (detect table)
      let usedPosts = '';
      const postsCountRes = await tryFirst<any>(
        POSTS_TABLES.map((t) => async () => {
          const res = await supabase.from(t).select('id', { count: 'exact', head: true } as any);
          if (!res.error) usedPosts = t;
          return res as any;
        })
      );
      const totalPosts = (postsCountRes as any).count ?? null;

      // reports count (detect table)
      let usedReports = '';
      const reportsCountRes = await tryFirst<any>(
        REPORTS_TABLES.map((t) => async () => {
          const res = await supabase.from(t).select('id', { count: 'exact', head: true } as any);
          if (!res.error) usedReports = t;
          return res as any;
        })
      );
      const totalReports = (reportsCountRes as any).count ?? null;

      // pending reports (best effort)
      let pending = null as number | null;
      if (usedReports) {
        const pendingRes = await supabase
          .from(usedReports)
          .select('id', { count: 'exact', head: true } as any)
          .or('status.is.null,status.ilike.%pend%,status.ilike.%open%');
        pending = (pendingRes as any).count ?? null;
      }

      // latest reports list
      let latest: ReportRow[] = [];
      if (usedReports) {
        const listRes = await supabase
          .from(usedReports)
          .select('id,reporter_id,user_id,target_type,target_id,post_id,comment_id,reason,status,created_at,resolved_at')
          .order('created_at', { ascending: false })
          .limit(8);

        if (!listRes.error && listRes.data) {
          latest = (listRes.data as any[]).map((r) => ({
            ...r,
            reporter_id: (r as any).reporter_id ?? (r as any).user_id ?? null,
            target_id: (r as any).target_id ?? (r as any).post_id ?? (r as any).comment_id ?? null,
            target_type: (r as any).target_type ?? ((r as any).comment_id ? 'comment' : (r as any).post_id ? 'post' : null),
          }));
        }
      }

      setTables({ posts: usedPosts || POSTS_TABLES[0], reports: usedReports || REPORTS_TABLES[0] });

      const m: Metric[] = [
        { label: 'Usuários', value: totalUsers === null ? '—' : String(totalUsers), icon: Users, href: '/admin/users' },
        { label: 'Posts do mural', value: totalPosts === null ? '—' : String(totalPosts), icon: MessageSquareWarning, href: '/admin/community', hint: usedPosts ? `Tabela: ${usedPosts}` : 'Tabela não detectada' },
        { label: 'Denúncias', value: totalReports === null ? '—' : String(totalReports), icon: AlertTriangle, href: '/admin/community', hint: pending !== null ? `Pendentes: ${pending}` : undefined },
        { label: 'SOS Analytics', value: 'Ver', icon: Activity, href: '/admin/sos-analytics' },
      ];

      setMetrics(m);
      setLatestReports(latest);
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar dashboard.');
    } finally {
      setBusy(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Visão geral rápida do app + atalhos para moderação e gestão.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Detectado: posts=<span className="text-slate-400">{tables.posts || '—'}</span> • denúncias=<span className="text-slate-400">{tables.reports || '—'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 disabled:opacity-50"
            disabled={busy}
          >
            <RefreshCw className={cx('h-4 w-4', busy && 'animate-spin')} />
            Atualizar
          </button>
          <Link
            href="/admin/import"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/20 px-4 py-2 text-sm hover:bg-slate-900/40"
          >
            <Upload className="h-4 w-4" />
            Importações
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 text-rose-200">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.label}
              href={m.href || '/admin'}
              className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4 hover:bg-slate-900/35 transition"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-400">{m.label}</div>
                {Icon && <Icon className="h-5 w-5 text-indigo-300" />}
              </div>
              <div className="mt-2 text-3xl font-semibold">{m.value}</div>
              {m.hint && <div className="mt-2 text-xs text-slate-500">{m.hint}</div>}
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Atalhos</div>
              <div className="mt-1 text-xs text-slate-500">Ações principais do dia a dia</div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link href="/admin/community" className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 hover:bg-slate-950/45 transition">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquareWarning className="h-4 w-4 text-amber-300" />
                Moderação do mural
              </div>
              <div className="mt-1 text-xs text-slate-400">Resolver denúncias, ocultar/restaurar, bloquear abusos.</div>
            </Link>

            <Link href="/admin/users" className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 hover:bg-slate-950/45 transition">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-indigo-300" />
                Gestão de usuários
              </div>
              <div className="mt-1 text-xs text-slate-400">Editar perfil, premium/admin, permissões de comentar/denunciar.</div>
            </Link>

            <Link href="/admin/import" className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 hover:bg-slate-950/45 transition">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Upload className="h-4 w-4 text-slate-200" />
                Importações
              </div>
              <div className="mt-1 text-xs text-slate-400">Ajustes e import de tabelas (missões, SOS, etc.).</div>
            </Link>

            <Link href="/admin/sos-analytics" className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 hover:bg-slate-950/45 transition">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Activity className="h-4 w-4 text-emerald-200" />
                SOS Analytics
              </div>
              <div className="mt-1 text-xs text-slate-400">Ver uso e eficácia do SOS.</div>
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Últimas denúncias</div>
              <div className="mt-1 text-xs text-slate-500">Acompanhe o que está chegando agora</div>
            </div>
            <Link
              href="/admin/community"
              className="text-sm text-indigo-300 hover:text-indigo-200"
            >
              Abrir moderação →
            </Link>
          </div>

          <div className="mt-4 space-y-2">
            {loading ? (
              <div className="text-sm text-slate-400">Carregando…</div>
            ) : latestReports.length === 0 ? (
              <div className="text-sm text-slate-400">Nenhuma denúncia recente.</div>
            ) : (
              latestReports.map((r) => {
                const resolved = (r.status || '').toLowerCase().includes('resolv') || Boolean(r.resolved_at);
                return (
                  <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">
                          {r.target_type || 'alvo'} • <span className="text-slate-500">{r.target_id || r.id}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-400">{fmtDate(r.created_at)}</div>
                        {r.reason && <div className="mt-2 text-xs text-slate-300">Motivo: {r.reason}</div>}
                      </div>
                      {resolved ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-700/50 bg-emerald-900/20 px-2 py-0.5 text-xs text-emerald-200">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Resolvida
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-700/40 bg-amber-900/20 px-2 py-0.5 text-xs text-amber-200">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Aberta
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 text-xs text-slate-600">
            Quer bloquear denúncia falsa e comentário indevido? Vá em <Link href="/admin/community" className="text-slate-300 hover:text-white">Mural & Denúncias</Link>.
          </div>
        </div>
      </div>
    </div>
  );
}
