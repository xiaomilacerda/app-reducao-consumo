'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Shield, MessageCircle, FileText, AlertTriangle, UserX, RefreshCw, Save } from 'lucide-react';
import { getSupabaseBrowserClient } from '../../_lib/supabase';

type Profile = {
  id: string;
  email?: string | null;
  display_name?: string | null;
  timezone?: string | null;
  is_admin?: boolean | null;
  is_premium?: boolean | null;
  can_report?: boolean | null;
  can_comment?: boolean | null;
  report_blocked_until?: string | null;
  comment_blocked_until?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [k: string]: any;
};

type Post = {
  id: string;
  user_id: string | null;
  content?: string | null;
  created_at?: string | null;
  status?: string | null;
  hidden?: boolean | null;
  is_deleted?: boolean | null;
};

type Comment = {
  id: string;
  post_id?: string | null;
  user_id: string | null;
  content?: string | null;
  created_at?: string | null;
  status?: string | null;
  hidden?: boolean | null;
  is_deleted?: boolean | null;
};

type Report = {
  id: string;
  reporter_id?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  reason?: string | null;
  status?: string | null;
  created_at?: string | null;
  resolved_at?: string | null;
  raw?: any;
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

async function tryFirstOne<T>(attempts: Array<() => Promise<{ data: T[] | null; error: any }>>) {
  for (const fn of attempts) {
    const res = await fn();
    if (!res.error) return res;
  }
  return attempts[0]();
}

export default function AdminUserDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const userId = (params as any)?.id as string | undefined;

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [tab, setTab] = useState<'profile' | 'posts' | 'comments' | 'reports'>('profile');

  const POSTS_TABLES = ['community_posts', 'mural_posts', 'posts'];
  const COMMENTS_TABLES = ['community_comments', 'mural_comments', 'comments'];
  const REPORTS_TABLES = ['community_reports', 'mural_reports', 'reports', 'community_flags'];

  const [edit, setEdit] = useState<{
    display_name?: string;
    email?: string;
    timezone?: string;
    is_admin?: boolean;
    is_premium?: boolean;
    can_report?: boolean;
    can_comment?: boolean;
    report_blocked_until?: string;
    comment_blocked_until?: string;
  }>({});

  async function load() {
    if (!userId) return;
    setLoading(true);
    setError(null);

    try {
      // profile
      const pRes = await supabase
        .from('profiles')
        .select('id,email,display_name,timezone,is_admin,is_premium,can_report,can_comment,report_blocked_until,comment_blocked_until,created_at,updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (pRes.error) throw pRes.error;
      const p = (pRes.data || null) as any as Profile;
      setProfile(p);

      setEdit({
        display_name: p?.display_name ?? '',
        email: p?.email ?? '',
        timezone: p?.timezone ?? '',
        is_admin: Boolean(p?.is_admin),
        is_premium: Boolean(p?.is_premium),
        can_report: p?.can_report ?? true,
        can_comment: p?.can_comment ?? true,
        report_blocked_until: p?.report_blocked_until ?? '',
        comment_blocked_until: p?.comment_blocked_until ?? '',
      });

      // activity: posts
      const postsRes = await tryFirstOne<Post>(
        POSTS_TABLES.map((t) => async () => {
          const res = await supabase
            .from(t)
            .select('id,user_id,content,created_at,status,hidden,is_deleted')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(200);
          return res as any;
        })
      );

      // activity: comments
      const commentsRes = await tryFirstOne<Comment>(
        COMMENTS_TABLES.map((t) => async () => {
          const res = await supabase
            .from(t)
            .select('id,post_id,user_id,content,created_at,status,hidden,is_deleted')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(300);
          return res as any;
        })
      );

      // reports: user as reporter OR user as target (best effort)
      const reportsRes = await tryFirstOne<any>(
        REPORTS_TABLES.map((t) => async () => {
          // Try schema A: reporter_id + target_id
          const a = await supabase
            .from(t)
            .select('id,reporter_id,target_type,target_id,post_id,comment_id,reason,status,created_at,resolved_at')
            .or(`reporter_id.eq.${userId},target_id.eq.${userId}`)
            .order('created_at', { ascending: false })
            .limit(300);
          if (!a.error) return a;

          // Try schema B: user_id as reporter + target_id
          const b = await supabase
            .from(t)
            .select('id,user_id,target_type,target_id,post_id,comment_id,reason,status,created_at,resolved_at')
            .or(`user_id.eq.${userId},target_id.eq.${userId}`)
            .order('created_at', { ascending: false })
            .limit(300);
          if (!b.error) return b;

          // Try schema C: user_id only (reports created by user)
          const c = await supabase
            .from(t)
            .select('id,user_id,post_id,comment_id,reason,status,created_at,resolved_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(300);
          return c;
        })
      );

      setPosts((postsRes.data as any[]) || []);
      setComments((commentsRes.data as any[]) || []);

      const rawReports = (reportsRes.data as any[]) || [];
      const normalized: Report[] = rawReports.map((r) => ({
        id: r.id,
        reporter_id: r.reporter_id ?? r.user_id ?? null,
        target_id: r.target_id ?? r.post_id ?? r.comment_id ?? null,
        target_type: r.target_type ?? (r.comment_id ? 'comment' : r.post_id ? 'post' : null),
        reason: r.reason ?? null,
        status: r.status ?? null,
        created_at: r.created_at ?? null,
        resolved_at: r.resolved_at ?? null,
        raw: r,
      }));
      setReports(normalized);
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar usuário.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function saveEdits() {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const payload: any = {
        display_name: edit.display_name ?? null,
        email: edit.email ?? null,
        timezone: edit.timezone ?? null,
        is_admin: Boolean(edit.is_admin),
        is_premium: Boolean(edit.is_premium),
        can_report: edit.can_report ?? null,
        can_comment: edit.can_comment ?? null,
        report_blocked_until: edit.report_blocked_until ? edit.report_blocked_until : null,
        comment_blocked_until: edit.comment_blocked_until ? edit.comment_blocked_until : null,
        updated_at: new Date().toISOString(),
      };

      const res = await supabase.from('profiles').update(payload).eq('id', userId);
      if (res.error) throw res.error;

      await load();
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar alterações.');
    } finally {
      setBusy(false);
    }
  }

  async function block(kind: 'report' | 'comment', days: number | 'permanent') {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const untilIso = days === 'permanent' ? '2999-12-31T00:00:00.000Z' : new Date(Date.now() + days * 86400000).toISOString();

      const payloadCandidates =
        kind === 'report'
          ? days === 'permanent'
            ? [{ can_report: false }, { report_blocked_until: untilIso }]
            : [{ report_blocked_until: untilIso }, { can_report: false }]
          : days === 'permanent'
            ? [{ can_comment: false }, { comment_blocked_until: untilIso }]
            : [{ comment_blocked_until: untilIso }, { can_comment: false }];

      let ok = false;
      for (const payload of payloadCandidates) {
        const res = await supabase.from('profiles').update(payload).eq('id', userId);
        if (!res.error) {
          ok = true;
          break;
        }
      }
      if (!ok) throw new Error('Não consegui atualizar profile (verifique colunas/RLS).');

      await load();
    } catch (e: any) {
      setError(e?.message || 'Erro ao aplicar bloqueio.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 text-slate-300">
        Carregando…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 text-slate-300">
        Usuário não encontrado.
        <div className="mt-3">
          <button onClick={() => router.back()} className="rounded-xl bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/users" className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-2 text-sm hover:bg-slate-900/40">
            <ArrowLeft className="h-4 w-4" />
            Usuários
          </Link>
          <div>
            <h1 className="text-xl font-semibold">{profile.email || profile.display_name || profile.id}</h1>
            <div className="mt-1 text-xs text-slate-400">
              ID: <span className="text-slate-200">{profile.id}</span> • Criado: {fmtDate(profile.created_at)} • Atualizado: {fmtDate(profile.updated_at)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
            disabled={busy}
          >
            <RefreshCw className={cx('h-4 w-4', busy && 'animate-spin')} />
            Atualizar
          </button>
          <button
            onClick={saveEdits}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm hover:bg-indigo-500 disabled:opacity-50"
            disabled={busy}
          >
            <Save className="h-4 w-4" />
            Salvar
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 text-rose-200">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setTab('profile')}
          className={cx('inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
            tab === 'profile' ? 'border-indigo-500/50 bg-indigo-600/15' : 'border-slate-800 bg-slate-900/20 hover:bg-slate-900/40')}
        >
          <User className="h-4 w-4" />
          Perfil
        </button>
        <button
          onClick={() => setTab('posts')}
          className={cx('inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
            tab === 'posts' ? 'border-indigo-500/50 bg-indigo-600/15' : 'border-slate-800 bg-slate-900/20 hover:bg-slate-900/40')}
        >
          <FileText className="h-4 w-4" />
          Posts ({posts.length})
        </button>
        <button
          onClick={() => setTab('comments')}
          className={cx('inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
            tab === 'comments' ? 'border-indigo-500/50 bg-indigo-600/15' : 'border-slate-800 bg-slate-900/20 hover:bg-slate-900/40')}
        >
          <MessageCircle className="h-4 w-4" />
          Comentários ({comments.length})
        </button>
        <button
          onClick={() => setTab('reports')}
          className={cx('inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
            tab === 'reports' ? 'border-indigo-500/50 bg-indigo-600/15' : 'border-slate-800 bg-slate-900/20 hover:bg-slate-900/40')}
        >
          <AlertTriangle className="h-4 w-4" />
          Denúncias ({reports.length})
        </button>
      </div>

      {tab === 'profile' ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Shield className="h-4 w-4 text-indigo-300" />
              Dados & Permissões
            </div>

            <div className="mt-4 grid gap-3">
              <label className="text-sm">
                <span className="text-slate-300">Nome</span>
                <input
                  value={edit.display_name || ''}
                  onChange={(e) => setEdit((s) => ({ ...s, display_name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </label>

              <label className="text-sm">
                <span className="text-slate-300">E-mail</span>
                <input
                  value={edit.email || ''}
                  onChange={(e) => setEdit((s) => ({ ...s, email: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </label>

              <label className="text-sm">
                <span className="text-slate-300">Timezone</span>
                <input
                  value={edit.timezone || ''}
                  onChange={(e) => setEdit((s) => ({ ...s, timezone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-sm">
                  <span>Admin</span>
                  <input
                    type="checkbox"
                    checked={Boolean(edit.is_admin)}
                    onChange={(e) => setEdit((s) => ({ ...s, is_admin: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-sm">
                  <span>Premium</span>
                  <input
                    type="checkbox"
                    checked={Boolean(edit.is_premium)}
                    onChange={(e) => setEdit((s) => ({ ...s, is_premium: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-sm">
                  <span>Pode denunciar</span>
                  <input
                    type="checkbox"
                    checked={Boolean(edit.can_report)}
                    onChange={(e) => setEdit((s) => ({ ...s, can_report: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-sm">
                  <span>Pode comentar</span>
                  <input
                    type="checkbox"
                    checked={Boolean(edit.can_comment)}
                    onChange={(e) => setEdit((s) => ({ ...s, can_comment: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="text-slate-300">report_blocked_until</span>
                  <input
                    value={edit.report_blocked_until || ''}
                    onChange={(e) => setEdit((s) => ({ ...s, report_blocked_until: e.target.value }))}
                    placeholder="ISO date ou vazio"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-300">comment_blocked_until</span>
                  <input
                    value={edit.comment_blocked_until || ''}
                    onChange={(e) => setEdit((s) => ({ ...s, comment_blocked_until: e.target.value }))}
                    placeholder="ISO date ou vazio"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={() => block('report', 30)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600/90 px-3 py-2 text-sm hover:bg-amber-600 disabled:opacity-50"
                >
                  <UserX className="h-4 w-4" />
                  Bloquear denúncias (30d)
                </button>
                <button
                  onClick={() => block('report', 'permanent')}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-sm hover:bg-amber-900/30 disabled:opacity-50"
                >
                  <UserX className="h-4 w-4" />
                  Bloquear denúncias (sempre)
                </button>
                <button
                  onClick={() => block('comment', 30)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600/90 px-3 py-2 text-sm hover:bg-rose-600 disabled:opacity-50"
                >
                  <UserX className="h-4 w-4" />
                  Bloquear comentários (30d)
                </button>
                <button
                  onClick={() => block('comment', 'permanent')}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-700/50 bg-rose-900/20 px-3 py-2 text-sm hover:bg-rose-900/30 disabled:opacity-50"
                >
                  <UserX className="h-4 w-4" />
                  Bloquear comentários (sempre)
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-300" />
              Resumo de atividade
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-xs text-slate-500">Posts</div>
                <div className="mt-1 text-2xl font-semibold">{posts.length}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-xs text-slate-500">Comentários</div>
                <div className="mt-1 text-2xl font-semibold">{comments.length}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-xs text-slate-500">Denúncias</div>
                <div className="mt-1 text-2xl font-semibold">{reports.length}</div>
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-500">
              Obs.: para bloqueio funcionar, o mural precisa validar <code className="text-slate-300">profiles.can_comment</code>/<code className="text-slate-300">can_report</code> e/ou *blocked_until* antes de permitir ações.
            </div>
          </div>
        </div>
      ) : tab === 'posts' ? (
        <div className="mt-6 space-y-3">
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 text-slate-300">
              Nenhum post encontrado para este usuário.
            </div>
          ) : (
            posts.map((p) => (
              <div key={p.id} className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
                <div className="text-xs text-slate-400">{fmtDate(p.created_at)} • {p.status ?? (p.hidden ? 'hidden' : p.is_deleted ? 'deleted' : '—')}</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{p.content || '—'}</div>
              </div>
            ))
          )}
        </div>
      ) : tab === 'comments' ? (
        <div className="mt-6 space-y-3">
          {comments.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 text-slate-300">
              Nenhum comentário encontrado para este usuário.
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
                <div className="text-xs text-slate-400">{fmtDate(c.created_at)} • post {c.post_id || '—'} • {c.status ?? (c.hidden ? 'hidden' : c.is_deleted ? 'deleted' : '—')}</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{c.content || '—'}</div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {reports.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 text-slate-300">
              Nenhuma denúncia encontrada envolvendo este usuário (como denunciante ou alvo).
            </div>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-400">
                    {fmtDate(r.created_at)} • {r.status || '—'} {r.resolved_at ? `• resolvida em ${fmtDate(r.resolved_at)}` : ''}
                  </div>
                  <div className="text-xs text-slate-500">
                    {r.target_type || 'alvo'}: <span className="text-slate-300">{r.target_id || '—'}</span>
                  </div>
                </div>
                {r.reason && <div className="mt-2 text-sm text-slate-200">Motivo: {r.reason}</div>}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">Ver raw</summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-200">
{JSON.stringify(r.raw ?? {}, null, 2)}
                  </pre>
                </details>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
