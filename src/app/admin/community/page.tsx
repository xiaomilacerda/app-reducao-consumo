'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  MessageSquare,
  RefreshCw,
  Search,
  Shield,
  UserX,
  XCircle,
} from 'lucide-react';

import { getSupabaseBrowserClient } from '../_lib/supabase';

/**
 * Admin • Comunidade (versão completa)
 * - Mantém o painel "Mural & Denúncias" com abas (Denúncias / Posts / Comentários / Usuário)
 * - Não remove funcionalidades: adiciona valor com moderação robusta + fallback automático
 * - Prioriza RPCs admin_* (quando existirem) e faz fallback para leitura/updates diretos (quando seu RLS permitir)
 */

type SupabaseClient = ReturnType<typeof getSupabaseBrowserClient>;

type MinimalProfile = {
  id: string;
  email?: string | null;
  is_admin?: boolean | null;
  is_premium?: boolean | null;

  // moderação
  can_report?: boolean | null;
  report_blocked_until?: string | null;
  can_comment?: boolean | null;
  comment_blocked_until?: string | null;
  report_strikes?: number | null;
  comment_strikes?: number | null;
};

type CommunityPost = {
  id: string;
  user_id: string | null;
  content: string | null;
  created_at: string;
  status?: string | null;
  hidden?: boolean | null;
  is_deleted?: boolean | null;
};

type CommunityComment = {
  id: string;
  post_id: string | null;
  user_id: string | null;
  content: string | null;
  created_at: string;
  status?: string | null;
  hidden?: boolean | null;
  is_deleted?: boolean | null;
};

type CommunityReport = {
  id: string;
  created_at: string;

  // legado / genérico
  user_id?: string | null; // algumas bases usam "user_id" no report como denunciante
  reporter_id?: string | null; // preferido
  reporter_email?: string | null;

  reason?: string | null;
  status?: string | null; // open/resolved/ignored
  resolution?: string | null;
  admin_note?: string | null;

  // alvo
  target_type?: string | null; // "post" | "comment"
  target_id?: string | null; // id do post/comment
  target_user_id?: string | null;
  target_user_email?: string | null;

  // compat com schemas comuns
  post_id?: string | null;
  comment_id?: string | null;

  // enriquecido (RPC)
  post_content?: string | null;
  comment_content?: string | null;
};

type RpcReportRow = {
  id: string;
  created_at: string;
  status: string | null;
  reason: string | null;
  resolution: string | null;

  report_type: string | null; // 'comment' | 'post'
  reporter_id: string | null;
  reporter_email: string | null;

  target_user_id: string | null;
  target_user_email: string | null;

  post_id: string | null;
  comment_id: string | null;

  post_content: string | null;
  comment_content: string | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function shortId(id?: string | null) {
  if (!id) return '—';
  return id.length > 10 ? id.slice(0, 6) + '…' + id.slice(-4) : id;
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

function addDaysISO(days: number) {
  const ms = Date.now() + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

async function tryFirst<T>(attempts: Array<() => Promise<{ data: T[] | null; error: any }>>) {
  for (const fn of attempts) {
    const res = await fn();
    if (!res.error) return res;
  }
  return attempts[0]();
}

export default function AdminCommunityPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [me, setMe] = useState<MinimalProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [usedTables, setUsedTables] = useState<{ posts?: string; comments?: string; reports?: string }>({});
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, MinimalProfile>>({});

  // Abas
  const [tab, setTab] = useState<'reports' | 'posts' | 'comments' | 'user'>('reports');

  // Filtros denúncias (mantém compatibilidade; se não usar, fica neutro)
  const [reportQuery, setReportQuery] = useState('');
  const [reportStatus, setReportStatus] = useState<'open' | 'resolved' | 'ignored' | 'all'>('open');

  // Busca por usuário (aba "Usuário")
  const [userQuery, setUserQuery] = useState('');
  const [userMatch, setUserMatch] = useState<MinimalProfile | null>(null);
  const [userPosts, setUserPosts] = useState<CommunityPost[]>([]);
  const [userComments, setUserComments] = useState<CommunityComment[]>([]);

  // Detectores de tabela (não remove: compat com seu histórico / renomes)
  const POSTS_TABLES = ['community_posts', 'mural_posts', 'posts'];
  const COMMENTS_TABLES = ['community_comments', 'mural_comments', 'comments'];
  const REPORTS_TABLES = ['community_reports', 'mural_reports', 'reports', 'community_flags'];

  // -------------------------
  // Boot (garante admin)
  // -------------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        const user = userData?.user;
        if (!user) {
          router.push('/login');
          return;
        }

        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select(
            'id,email,is_admin,is_premium,can_report,report_blocked_until,can_comment,comment_blocked_until,report_strikes,comment_strikes'
          )
          .eq('id', user.id)
          .maybeSingle();

        if (profErr) throw profErr;
        if (!prof?.is_admin) {
          router.push('/profile');
          return;
        }

        if (!mounted) return;
        setMe(prof as any);

        await loadAll(true);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Erro ao carregar admin.');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------
  // Helpers: perfil / badges
  // -------------------------
  function profileLabel(userId?: string | null) {
    if (!userId) return '—';
    const p = profilesById[userId];
    if (p?.email) return p.email;
    return shortId(userId);
  }

  function moderationHint(p?: MinimalProfile | null) {
    if (!p) return null;

    const commentBlocked =
      (p.comment_blocked_until && new Date(p.comment_blocked_until) > new Date()) || p.can_comment === false;
    const reportBlocked =
      (p.report_blocked_until && new Date(p.report_blocked_until) > new Date()) || p.can_report === false;

    const parts: string[] = [];
    if (commentBlocked) parts.push(`comentários bloqueados até ${fmtDate(p.comment_blocked_until)}`);
    if (reportBlocked) parts.push(`denúncias bloqueadas até ${fmtDate(p.report_blocked_until)}`);

    if (p.comment_strikes) parts.push(`strikes comentário: ${p.comment_strikes}`);
    if (p.report_strikes) parts.push(`strikes denúncia: ${p.report_strikes}`);

    return parts.length ? parts.join(' • ') : null;
  }

  // -------------------------
  // Carregamento principal
  // -------------------------
  async function loadAll(keepCurrentTab: boolean = false) {
    setLoading(true);
    setError(null);

    try {
      // POSTS
      let usedPosts = '';
      const postsRes = await tryFirst<CommunityPost>(
        POSTS_TABLES.map((t) => async () => {
          const res = await supabase
            .from(t)
            .select('id,user_id,content,created_at,status,hidden,is_deleted')
            .order('created_at', { ascending: false })
            .limit(120);
          if (!res.error) usedPosts = t;
          return res as any;
        })
      );

      // COMMENTS
      let usedComments = '';
      const commentsRes = await tryFirst<CommunityComment>(
        COMMENTS_TABLES.map((t) => async () => {
          const res = await supabase
            .from(t)
            .select('id,post_id,user_id,content,created_at,status,hidden,is_deleted')
            .order('created_at', { ascending: false })
            .limit(200);
          if (!res.error) usedComments = t;
          return res as any;
        })
      );

      // REPORTS — prioridade RPC (enriquecida) + fallback (compat)
      let usedReports = '';
      let reportsData: CommunityReport[] = [];

      // 1) tenta RPC (se existir)
      const p_query = reportQuery.trim() ? reportQuery.trim() : null;
      const p_status = reportStatus === 'all' ? null : reportStatus;

      const rpc = await supabase.rpc('admin_list_community_reports', {
        p_limit: 200,
        p_offset: 0,
        p_query,
        p_status,
      });

      if (!rpc.error && Array.isArray(rpc.data)) {
        usedReports = 'community_reports';
        reportsData = (rpc.data as RpcReportRow[]).map((r) => ({
          id: r.id as any,
          created_at: r.created_at as any,
          status: r.status,
          reason: r.reason,
          resolution: r.resolution,
          reporter_id: r.reporter_id,
          reporter_email: r.reporter_email,
          target_user_id: r.target_user_id,
          target_user_email: r.target_user_email,
          post_id: r.post_id,
          comment_id: r.comment_id,
          // normaliza para o layout antigo (target_id/type)
          target_type: r.report_type,
          target_id: r.report_type === 'comment' ? r.comment_id : r.report_type === 'post' ? r.post_id : null,
          post_content: r.post_content,
          comment_content: r.comment_content,
        }));
      } else {
        // 2) fallback: detecta qual tabela existe e lê direto
        const reportsRes = await tryFirst<CommunityReport>(
          REPORTS_TABLES.map((t) => async () => {
            const res = await supabase
              .from(t)
              .select(
                [
                  'id',
                  'created_at',
                  'status',
                  'reason',
                  'resolution',
                  'admin_note',
                  'user_id',
                  'reporter_id',
                  'reporter_email',
                  'target_type',
                  'target_id',
                  'target_user_id',
                  'post_id',
                  'comment_id',
                ].join(',')
              )
              .order('created_at', { ascending: false })
              .limit(250);

            if (!res.error) usedReports = t;
            return res as any;
          })
        );

        reportsData = ((reportsRes.data as any[]) || []).map((r) => ({
          ...r,
          // tenta normalizar "reporter_id" (se tiver só user_id)
          reporter_id: r.reporter_id || r.user_id || null,
          // tenta normalizar target_id/type com post/comment
          target_type:
            r.target_type ||
            (r.comment_id ? 'comment' : r.post_id ? 'post' : null),
          target_id:
            r.target_id ||
            (r.comment_id ? r.comment_id : r.post_id ? r.post_id : null),
        }));
      }

      // aplica states
      setUsedTables({ posts: usedPosts || POSTS_TABLES[0], comments: usedComments || COMMENTS_TABLES[0], reports: usedReports || REPORTS_TABLES[0] });
      setPosts((postsRes.data as any[]) || []);
      setComments((commentsRes.data as any[]) || []);
      setReports(reportsData);

      // perfis (envolvidos)
      const ids = new Set<string>();
      for (const p of (postsRes.data as any[]) || []) if (p?.user_id) ids.add(p.user_id);
      for (const c of (commentsRes.data as any[]) || []) if (c?.user_id) ids.add(c.user_id);
      for (const r of reportsData || []) {
        const reporter = (r.reporter_id || r.user_id) as string | null;
        if (reporter) ids.add(reporter);
        if (r.target_user_id) ids.add(r.target_user_id);
        const author = targetAuthorId(r, (commentsRes.data as any[]) || [], (postsRes.data as any[]) || []);
        if (author) ids.add(author);
      }

      if (ids.size) {
        const { data: profs } = await supabase
          .from('profiles')
          .select(
            'id,email,is_admin,is_premium,can_report,report_blocked_until,can_comment,comment_blocked_until,report_strikes,comment_strikes'
          )
          .in('id', Array.from(ids).slice(0, 500)); // limite defensivo

        const map: Record<string, MinimalProfile> = {};
        for (const p of (profs as any[]) || []) map[p.id] = p;
        setProfilesById(map);
      } else {
        setProfilesById({});
      }

      // manter tab atual (só evita reset visual; opcional)
      if (!keepCurrentTab) setTab('reports');
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }

  // -------------------------
  // Denúncias: preview/autor
  // -------------------------
  function targetPreview(r: CommunityReport) {
    // RPC já traz o conteúdo
    if ((r.target_type || '').toLowerCase().includes('comment')) {
      if (r.comment_content) return r.comment_content;
    }
    if ((r.target_type || '').toLowerCase().includes('post')) {
      if (r.post_content) return r.post_content;
    }

    // fallback: busca em listas carregadas
    const t = (r.target_type || '').toLowerCase();
    const id = r.target_id || '';

    if (t.includes('comment')) {
      const c = comments.find((x) => x.id === id || x.id === (r.comment_id || ''));
      return c?.content || 'Comentário não encontrado';
    }
    if (t.includes('post')) {
      const p = posts.find((x) => x.id === id || x.id === (r.post_id || ''));
      return p?.content || 'Post não encontrado';
    }

    // fallback extra
    const c = comments.find((x) => x.id === id);
    if (c) return c.content || 'Comentário';
    const p = posts.find((x) => x.id === id);
    if (p) return p.content || 'Post';
    return 'Alvo não encontrado';
  }

  function targetAuthorId(r: CommunityReport, localComments = comments, localPosts = posts): string | null {
    // se veio enriquecido
    if (r.target_user_id) return r.target_user_id;

    const t = (r.target_type || '').toLowerCase();
    const id = r.target_id || '';

    if (t.includes('comment')) {
      const c = localComments.find((x) => x.id === id || x.id === (r.comment_id || ''));
      return c?.user_id || null;
    }
    if (t.includes('post')) {
      const p = localPosts.find((x) => x.id === id || x.id === (r.post_id || ''));
      return p?.user_id || null;
    }

    const c = localComments.find((x) => x.id === id);
    if (c) return c.user_id;
    const p = localPosts.find((x) => x.id === id);
    if (p) return p.user_id || null;
    return null;
  }

  // -------------------------
  // Ações — wrappers
  // -------------------------
  async function doAction(key: string, fn: () => Promise<void>, okMessage?: string) {
    setBusyKey(key);
    setError(null);
    setToast(null);
    try {
      await fn();
      if (okMessage) setToast(okMessage);
      // recarrega mantendo filtros/tab
      await loadAll(true);
    } catch (e: any) {
      setError(e?.message || 'Erro na ação.');
    } finally {
      setBusyKey(null);
      window.setTimeout(() => setToast(null), 2500);
    }
  }

  // -------------------------
  // Report: resolver / ignorar
  // -------------------------
  async function resolveReport(reportId: string, resolution: 'resolved' | 'ignored') {
    // 1) prefer RPC segura
    const rpc = await supabase.rpc('admin_resolve_report', {
      p_report_id: reportId,
      p_resolution: resolution,
      p_note: resolution === 'ignored' ? 'Denúncia falsa/mal-intencionada' : 'Ação tomada',
    });

    if (!rpc.error) return;

    // 2) fallback update direto (se seu RLS permitir)
    const reportsTable = usedTables.reports || REPORTS_TABLES[0];
    await supabase
      .from(reportsTable)
      .update({
        status: resolution,
        resolution,
        resolved_at: new Date().toISOString(),
      } as any)
      .eq('id', reportId);
  }

  // -------------------------
  // Conteúdo: ocultar/restaurar
  // -------------------------
  async function tryUpdateTarget(table: string, id: string, action: 'hide' | 'restore') {
    // 1) prefer RPC segura
    const isComment = table.includes('comment');
    const rpcName = isComment ? 'admin_set_comment_status' : 'admin_set_post_status';
    const argKey = isComment ? 'p_comment_id' : 'p_post_id';
    const newStatus = action === 'hide' ? 'hidden' : 'active';

    const rpc = await supabase.rpc(rpcName, {
      [argKey]: id,
      p_status: newStatus,
      p_note: action === 'hide' ? 'Ocultado via admin' : 'Restaurado via admin',
    } as any);

    if (!rpc.error) return;

    // 2) fallback: tenta vários formatos comuns
    const payloads =
      action === 'hide'
        ? [
            { status: 'hidden' },
            { hidden: true },
            { is_deleted: true },
          ]
        : [
            { status: 'active' },
            { hidden: false },
            { is_deleted: false },
          ];

    for (const payload of payloads) {
      const res = await supabase.from(table).update(payload as any).eq('id', id);
      if (!res.error) return;
    }

    // 3) se chegou aqui, estoura o último erro
    throw new Error('Não consegui atualizar o conteúdo (verifique colunas/RLS).');
  }

  // -------------------------
  // Perfil: bloqueios (comentário/denúncia) + fallback
  // -------------------------
  async function updateProfileFlags(userId: string, payloads: any[], successMessage: string) {
    for (const payload of payloads) {
      const res = await supabase.from('profiles').update(payload).eq('id', userId);
      if (!res.error) return { ok: true as const, message: successMessage };
    }
    return { ok: false as const, message: 'Não consegui atualizar o profile (verifique colunas/RLS).' };
  }

  async function blockReporting(userId: string, days: number | 'permanent') {
    const until = days === 'permanent' ? '2999-12-31T00:00:00.000Z' : addDaysISO(days);
    // 1) prefer RPC segura
    const rpc = await supabase.rpc('admin_set_profile_block', {
      p_user_id: userId,
      p_block: 'report',
      p_until: until,
      p_reason: days === 'permanent' ? 'Bloqueio permanente (abuso)' : 'Denúncias falsas / abuso',
      p_strike_inc: 1,
    });

    if (!rpc.error) return { ok: true as const, message: days === 'permanent' ? 'Denúncias bloqueadas (sempre).' : `Denúncias bloqueadas por ${days} dias.` };

    // 2) fallback direto
    const payloads =
      days === 'permanent'
        ? [{ can_report: false }, { report_blocked_until: '2999-12-31T00:00:00.000Z' }]
        : [{ report_blocked_until: until }, { can_report: false }];

    return updateProfileFlags(userId, payloads, days === 'permanent' ? 'Denúncias bloqueadas (sempre).' : `Denúncias bloqueadas por ${days} dias.`);
  }

  async function blockCommenting(userId: string, days: number | 'permanent') {
    const until = days === 'permanent' ? '2999-12-31T00:00:00.000Z' : addDaysISO(days);

    // 1) prefer RPC segura
    const rpc = await supabase.rpc('admin_set_profile_block', {
      p_user_id: userId,
      p_block: 'comment',
      p_until: until,
      p_reason: days === 'permanent' ? 'Bloqueio permanente (abuso)' : 'Conteúdo impróprio / abuso',
      p_strike_inc: 1,
    });

    if (!rpc.error) return { ok: true as const, message: days === 'permanent' ? 'Comentários bloqueados (sempre).' : `Comentários bloqueados por ${days} dias.` };

    // 2) fallback direto
    const payloads =
      days === 'permanent'
        ? [{ can_comment: false }, { comment_blocked_until: '2999-12-31T00:00:00.000Z' }]
        : [{ comment_blocked_until: until }, { can_comment: false }];

    return updateProfileFlags(userId, payloads, days === 'permanent' ? 'Comentários bloqueados (sempre).' : `Comentários bloqueados por ${days} dias.`);
  }

  async function unblockUser(userId: string, kind: 'comment' | 'report') {
    const payload =
      kind === 'comment'
        ? { can_comment: true, comment_blocked_until: null }
        : { can_report: true, report_blocked_until: null };
    const res = await supabase.from('profiles').update(payload as any).eq('id', userId);
    if (res.error) throw res.error;
  }

  // -------------------------
  // Aba Usuário: busca
  // -------------------------
  async function searchUser() {
    const q = userQuery.trim();
    if (!q) return;

    const key = `user:search:${q}`;
    setBusyKey(key);
    setError(null);
    setToast(null);

    try {
      // tenta por email
      let p: MinimalProfile | null = null;
      const byEmail = await supabase
        .from('profiles')
        .select(
          'id,email,is_admin,is_premium,can_report,report_blocked_until,can_comment,comment_blocked_until,report_strikes,comment_strikes'
        )
        .ilike('email', q.includes('@') ? q : `%${q}%`)
        .limit(1);

      if (!byEmail.error && byEmail.data?.length) p = byEmail.data[0] as any;

      // fallback por id (uuid/parte)
      if (!p) {
        const byId = await supabase
          .from('profiles')
          .select(
            'id,email,is_admin,is_premium,can_report,report_blocked_until,can_comment,comment_blocked_until,report_strikes,comment_strikes'
          )
          .eq('id', q)
          .maybeSingle();

        if (!byId.error && byId.data) p = byId.data as any;
      }

      setUserMatch(p);

      if (p?.id) {
        const postsTable = usedTables.posts || POSTS_TABLES[0];
        const commentsTable = usedTables.comments || COMMENTS_TABLES[0];

        const [pRes, cRes] = await Promise.all([
          supabase
            .from(postsTable)
            .select('id,user_id,content,created_at,status,hidden,is_deleted')
            .eq('user_id', p.id)
            .order('created_at', { ascending: false })
            .limit(100),
          supabase
            .from(commentsTable)
            .select('id,post_id,user_id,content,created_at,status,hidden,is_deleted')
            .eq('user_id', p.id)
            .order('created_at', { ascending: false })
            .limit(150),
        ]);

        setUserPosts((pRes.data as any[]) || []);
        setUserComments((cRes.data as any[]) || []);
      } else {
        setUserPosts([]);
        setUserComments([]);
      }
    } catch (e: any) {
      setError(e?.message || 'Erro ao buscar usuário.');
    } finally {
      setBusyKey(null);
    }
  }

  // -------------------------
  // UI helpers
  // -------------------------
  const SectionButton = ({ active, onClick, icon: Icon, children }: any) => (
    <button
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
        active ? 'border-indigo-500/50 bg-indigo-600/15' : 'border-slate-800 bg-slate-900/20 hover:bg-slate-900/40'
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );

  // -------------------------
  // Render
  // -------------------------
  if (!me) {
    // enquanto valida admin no boot
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-slate-300" />
            <div className="text-xl font-semibold">Admin • Comunidade</div>
          </div>
          <div className="mt-6 text-sm text-slate-400">{loading ? 'Carregando…' : 'Sem acesso.'}</div>
          {error && <div className="mt-4 rounded-xl border border-rose-900/50 bg-rose-950/20 p-3 text-sm text-rose-200">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Mural &amp; Denúncias</h1>
            <p className="mt-1 text-sm text-slate-400">
              Modere posts/comentários, resolva denúncias e bloqueie abusos (denúncia falsa / comentário indevido).
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Tabelas detectadas: posts=<span className="text-slate-400">{usedTables.posts || '—'}</span> • comentários=
              <span className="text-slate-400">{usedTables.comments || '—'}</span> • denúncias=
              <span className="text-slate-400">{usedTables.reports || '—'}</span>
              {me?.email ? <span className="ml-2 text-slate-500">• logado: {me.email}</span> : null}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadAll(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
              disabled={loading}
            >
              <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} />
              Atualizar
            </button>

            <Link
              href="/admin/users"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/20 px-4 py-2 text-sm hover:bg-slate-900/40"
            >
              <Search className="h-4 w-4" />
              Usuários
            </Link>
          </div>
        </div>

        {toast && (
          <div className="mt-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3 text-sm text-emerald-200">
            {toast}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-rose-900/50 bg-rose-950/20 p-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          <SectionButton active={tab === 'reports'} onClick={() => setTab('reports')} icon={AlertTriangle}>
            Denúncias
          </SectionButton>
          <SectionButton active={tab === 'posts'} onClick={() => setTab('posts')} icon={FileText}>
            Posts
          </SectionButton>
          <SectionButton active={tab === 'comments'} onClick={() => setTab('comments')} icon={MessageSquare}>
            Comentários
          </SectionButton>
          <SectionButton active={tab === 'user'} onClick={() => setTab('user')} icon={Search}>
            Usuário
          </SectionButton>
        </div>

        {/* Reports */}
        {tab === 'reports' ? (
          <div className="mt-6">
            {/* filtros (adiciona valor; não quebra caso você ignore) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    value={reportQuery}
                    onChange={(e) => setReportQuery(e.target.value)}
                    placeholder="Buscar por e-mail, motivo ou conteúdo..."
                    className="w-full rounded-xl bg-slate-950/40 border border-slate-800 pl-9 pr-3 py-2 text-sm outline-none focus:border-slate-700"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {(['open', 'resolved', 'ignored', 'all'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setReportStatus(s)}
                      className={cx(
                        'rounded-xl px-3 py-2 text-sm border transition',
                        reportStatus === s
                          ? 'border-indigo-500/50 bg-indigo-600/15'
                          : 'border-slate-800 bg-slate-900/20 hover:bg-slate-900/35'
                      )}
                    >
                      {s === 'open' ? 'Abertas' : s === 'resolved' ? 'Resolvidas' : s === 'ignored' ? 'Ignoradas' : 'Todas'}
                    </button>
                  ))}

                  <button
                    onClick={() => loadAll(true)}
                    className="rounded-xl px-3 py-2 text-sm border border-slate-800 bg-slate-900/20 hover:bg-slate-900/35"
                    disabled={loading}
                  >
                    Aplicar
                  </button>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-500">
                Dica: o filtro usa RPC <code className="text-slate-300">admin_list_community_reports</code> quando ela existir (mais completa).
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {reports.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 text-slate-400">
                  Nenhuma denúncia encontrada.
                </div>
              ) : (
                reports.map((r) => {
                  const reportKey = `report:${r.id}`;
                  const isBusy = (suffix: string) => busyKey === `${reportKey}:${suffix}`;

                  const reporterId = (r.reporter_id || r.user_id) as string | null;
                  const authorId = targetAuthorId(r);

                  const status = (r.status || 'open').toLowerCase();
                  const isResolved = status === 'resolved';
                  const isIgnored = status === 'ignored';

                  const authorProfile = authorId ? profilesById[authorId] : null;
                  const reporterProfile = reporterId ? profilesById[reporterId] : null;

                  return (
                    <div key={r.id} className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-[260px]">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-300/90" />
                            <div className="font-semibold">
                              Denúncia • <span className="text-slate-500">{fmtDate(r.created_at)}</span>
                            </div>

                            <span
                              className={cx(
                                'ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs border',
                                isResolved
                                  ? 'border-emerald-700/40 bg-emerald-900/20 text-emerald-200'
                                  : isIgnored
                                  ? 'border-amber-700/40 bg-amber-900/20 text-amber-200'
                                  : 'border-slate-700 bg-slate-950/40 text-slate-300'
                              )}
                            >
                              {isResolved ? 'resolvida' : isIgnored ? 'ignorada (falsa)' : 'aberta'}
                            </span>
                          </div>

                          <div className="mt-2 text-sm text-slate-200 whitespace-pre-wrap break-words">{r.reason || '—'}</div>

                          <div className="mt-2 text-xs text-slate-500">
                            Denunciante:{' '}
                            <span className="text-slate-300">
                              {r.reporter_email || profileLabel(reporterId)}
                            </span>{' '}
                            • Autor do conteúdo:{' '}
                            <span className="text-slate-300">
                              {r.target_user_email || profileLabel(authorId)}
                            </span>
                          </div>

                          {moderationHint(reporterProfile) ? (
                            <div className="mt-1 text-xs text-amber-200/80">{`⚠ ${moderationHint(reporterProfile)}`}</div>
                          ) : null}

                          {moderationHint(authorProfile) ? (
                            <div className="mt-1 text-xs text-rose-200/80">{`⚠ ${moderationHint(authorProfile)}`}</div>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() =>
                              doAction(`${reportKey}:resolve`, async () => {
                                await resolveReport(r.id, 'resolved');
                              }, 'Denúncia marcada como resolvida.')
                            }
                            disabled={loading || isBusy('resolve')}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600/90 px-3 py-2 text-sm hover:bg-emerald-600 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Resolver
                          </button>

                          <button
                            onClick={() =>
                              doAction(`${reportKey}:ignore`, async () => {
                                await resolveReport(r.id, 'ignored');
                                // reforço: se denunciar falso, bloqueia denunciante (7d) com 1 strike
                                if (reporterId) await blockReporting(reporterId, 7);
                              }, 'Denúncia marcada como falsa/ignorada.')
                            }
                            disabled={loading || isBusy('ignore')}
                            className="inline-flex items-center gap-2 rounded-xl border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-sm hover:bg-amber-900/30 disabled:opacity-50"
                          >
                            <AlertTriangle className="h-4 w-4" />
                            Marcar falsa
                          </button>

                          {r.target_id && (
                            <>
                              <button
                                onClick={() =>
                                  doAction(`${reportKey}:hide`, async () => {
                                    const targetTable =
                                      (r.target_type || '').toLowerCase().includes('comment')
                                        ? usedTables.comments || COMMENTS_TABLES[0]
                                        : usedTables.posts || POSTS_TABLES[0];
                                    await tryUpdateTarget(targetTable, r.target_id!, 'hide');
                                  }, 'Conteúdo ocultado.')
                                }
                                disabled={loading || isBusy('hide')}
                                className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700 disabled:opacity-50"
                              >
                                <EyeOff className="h-4 w-4" />
                                Ocultar
                              </button>

                              <button
                                onClick={() =>
                                  doAction(`${reportKey}:restore`, async () => {
                                    const targetTable =
                                      (r.target_type || '').toLowerCase().includes('comment')
                                        ? usedTables.comments || COMMENTS_TABLES[0]
                                        : usedTables.posts || POSTS_TABLES[0];
                                    await tryUpdateTarget(targetTable, r.target_id!, 'restore');
                                  }, 'Conteúdo restaurado.')
                                }
                                disabled={loading || isBusy('restore')}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/20 px-3 py-2 text-sm hover:bg-slate-900/40 disabled:opacity-50"
                              >
                                <Eye className="h-4 w-4" />
                                Restaurar
                              </button>
                            </>
                          )}

                          {reporterId && (
                            <>
                              <button
                                onClick={() =>
                                  doAction(`${reportKey}:banReporter7`, async () => {
                                    const r = await blockReporting(reporterId, 7);
                                    if (!r.ok) throw new Error(r.message);
                                  }, 'Denunciante bloqueado de denunciar por 7 dias.')
                                }
                                disabled={loading || isBusy('banReporter7')}
                                className="inline-flex items-center gap-2 rounded-xl bg-amber-600/90 px-3 py-2 text-sm hover:bg-amber-600 disabled:opacity-50"
                              >
                                <UserX className="h-4 w-4" />
                                Bloquear denúncias (7d)
                              </button>

                              <button
                                onClick={() =>
                                  doAction(`${reportKey}:banReporter30`, async () => {
                                    const r = await blockReporting(reporterId, 30);
                                    if (!r.ok) throw new Error(r.message);
                                  }, 'Denunciante bloqueado de denunciar por 30 dias.')
                                }
                                disabled={loading || isBusy('banReporter30')}
                                className="inline-flex items-center gap-2 rounded-xl border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-sm hover:bg-amber-900/30 disabled:opacity-50"
                              >
                                <UserX className="h-4 w-4" />
                                Bloquear denúncias (30d)
                              </button>

                              <button
                                onClick={() =>
                                  doAction(`${reportKey}:unbanReporter`, async () => {
                                    await unblockUser(reporterId, 'report');
                                  }, 'Denunciante desbloqueado para denunciar.')
                                }
                                disabled={loading || isBusy('unbanReporter')}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/20 px-3 py-2 text-sm hover:bg-slate-900/40 disabled:opacity-50"
                              >
                                <Shield className="h-4 w-4" />
                                Desbloquear denunciante
                              </button>
                            </>
                          )}

                          {authorId && (
                            <>
                              <button
                                onClick={() =>
                                  doAction(`${reportKey}:banAuthor7`, async () => {
                                    const r = await blockCommenting(authorId, 7);
                                    if (!r.ok) throw new Error(r.message);
                                  }, 'Autor bloqueado de comentar por 7 dias.')
                                }
                                disabled={loading || isBusy('banAuthor7')}
                                className="inline-flex items-center gap-2 rounded-xl bg-rose-600/90 px-3 py-2 text-sm hover:bg-rose-600 disabled:opacity-50"
                              >
                                <UserX className="h-4 w-4" />
                                Bloquear comentários (7d)
                              </button>

                              <button
                                onClick={() =>
                                  doAction(`${reportKey}:banAuthor30`, async () => {
                                    const r = await blockCommenting(authorId, 30);
                                    if (!r.ok) throw new Error(r.message);
                                  }, 'Autor bloqueado de comentar por 30 dias.')
                                }
                                disabled={loading || isBusy('banAuthor30')}
                                className="inline-flex items-center gap-2 rounded-xl border border-rose-700/50 bg-rose-900/20 px-3 py-2 text-sm hover:bg-rose-900/30 disabled:opacity-50"
                              >
                                <UserX className="h-4 w-4" />
                                Bloquear comentários (30d)
                              </button>

                              <button
                                onClick={() =>
                                  doAction(`${reportKey}:unbanAuthor`, async () => {
                                    await unblockUser(authorId, 'comment');
                                  }, 'Autor desbloqueado para comentar.')
                                }
                                disabled={loading || isBusy('unbanAuthor')}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/20 px-3 py-2 text-sm hover:bg-slate-900/40 disabled:opacity-50"
                              >
                                <Shield className="h-4 w-4" />
                                Desbloquear autor
                              </button>

                              <Link
                                href={`/admin/users/${authorId}`}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/20 px-3 py-2 text-sm hover:bg-slate-900/40"
                              >
                                Ver usuário
                              </Link>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                        <div className="flex items-center gap-2 mb-2 text-xs text-slate-500">
                          {(r.target_type || '').toLowerCase().includes('comment') ? (
                            <>
                              <MessageSquare className="h-4 w-4" /> Conteúdo: Comentário
                            </>
                          ) : (
                            <>
                              <FileText className="h-4 w-4" /> Conteúdo: Post
                            </>
                          )}
                        </div>
                        <div className="text-sm text-slate-200 whitespace-pre-wrap break-words">{targetPreview(r)}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        {/* Posts */}
        {tab === 'posts' ? (
          <div className="mt-6 space-y-3">
            {posts.map((p) => {
              const key = `post:${p.id}`;
              const author = p.user_id;
              const authorProfile = author ? profilesById[author] : null;

              return (
                <div key={p.id} className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-[240px]">
                      <div className="font-semibold">
                        Post • <span className="text-slate-500">{shortId(p.id)}</span> •{' '}
                        <span className="text-slate-500">{fmtDate(p.created_at)}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Autor: <span className="text-slate-300">{profileLabel(author)}</span>
                      </div>
                      {moderationHint(authorProfile) ? (
                        <div className="mt-1 text-xs text-rose-200/80">{`⚠ ${moderationHint(authorProfile)}`}</div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          doAction(`${key}:hide`, async () => {
                            const t = usedTables.posts || POSTS_TABLES[0];
                            await tryUpdateTarget(t, p.id, 'hide');
                          }, 'Post ocultado.')
                        }
                        disabled={loading || busyKey === `${key}:hide`}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700 disabled:opacity-50"
                      >
                        <EyeOff className="h-4 w-4" />
                        Ocultar
                      </button>

                      <button
                        onClick={() =>
                          doAction(`${key}:restore`, async () => {
                            const t = usedTables.posts || POSTS_TABLES[0];
                            await tryUpdateTarget(t, p.id, 'restore');
                          }, 'Post restaurado.')
                        }
                        disabled={loading || busyKey === `${key}:restore`}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/20 px-3 py-2 text-sm hover:bg-slate-900/40 disabled:opacity-50"
                      >
                        <Eye className="h-4 w-4" />
                        Restaurar
                      </button>

                      {author ? (
                        <>
                          <button
                            onClick={() =>
                              doAction(`${key}:banAuthor7`, async () => {
                                const r = await blockCommenting(author, 7);
                                if (!r.ok) throw new Error(r.message);
                              }, 'Autor bloqueado de comentar por 7 dias.')
                            }
                            disabled={loading || busyKey === `${key}:banAuthor7`}
                            className="inline-flex items-center gap-2 rounded-xl bg-rose-600/90 px-3 py-2 text-sm hover:bg-rose-600 disabled:opacity-50"
                          >
                            <UserX className="h-4 w-4" />
                            Bloquear comentários (7d)
                          </button>

                          <Link
                            href={`/admin/users/${author}`}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/20 px-3 py-2 text-sm hover:bg-slate-900/40"
                          >
                            Ver usuário
                          </Link>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-200 whitespace-pre-wrap break-words">
                    {p.content || '—'}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Comments */}
        {tab === 'comments' ? (
          <div className="mt-6 space-y-3">
            {comments.map((c) => {
              const key = `comment:${c.id}`;
              const author = c.user_id;
              const authorProfile = author ? profilesById[author] : null;

              return (
                <div key={c.id} className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-[240px]">
                      <div className="font-semibold">
                        Comentário • <span className="text-slate-500">{shortId(c.id)}</span> •{' '}
                        <span className="text-slate-500">{fmtDate(c.created_at)}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Autor: <span className="text-slate-300">{profileLabel(author)}</span> • Post:{' '}
                        <span className="text-slate-400">{shortId(c.post_id)}</span>
                      </div>
                      {moderationHint(authorProfile) ? (
                        <div className="mt-1 text-xs text-rose-200/80">{`⚠ ${moderationHint(authorProfile)}`}</div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          doAction(`${key}:hide`, async () => {
                            const t = usedTables.comments || COMMENTS_TABLES[0];
                            await tryUpdateTarget(t, c.id, 'hide');
                          }, 'Comentário ocultado.')
                        }
                        disabled={loading || busyKey === `${key}:hide`}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700 disabled:opacity-50"
                      >
                        <EyeOff className="h-4 w-4" />
                        Ocultar
                      </button>

                      <button
                        onClick={() =>
                          doAction(`${key}:restore`, async () => {
                            const t = usedTables.comments || COMMENTS_TABLES[0];
                            await tryUpdateTarget(t, c.id, 'restore');
                          }, 'Comentário restaurado.')
                        }
                        disabled={loading || busyKey === `${key}:restore`}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/20 px-3 py-2 text-sm hover:bg-slate-900/40 disabled:opacity-50"
                      >
                        <Eye className="h-4 w-4" />
                        Restaurar
                      </button>

                      {author ? (
                        <>
                          <button
                            onClick={() =>
                              doAction(`${key}:banAuthor7`, async () => {
                                const r = await blockCommenting(author, 7);
                                if (!r.ok) throw new Error(r.message);
                              }, 'Autor bloqueado de comentar por 7 dias.')
                            }
                            disabled={loading || busyKey === `${key}:banAuthor7`}
                            className="inline-flex items-center gap-2 rounded-xl bg-rose-600/90 px-3 py-2 text-sm hover:bg-rose-600 disabled:opacity-50"
                          >
                            <UserX className="h-4 w-4" />
                            Bloquear comentários (7d)
                          </button>

                          <Link
                            href={`/admin/users/${author}`}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/20 px-3 py-2 text-sm hover:bg-slate-900/40"
                          >
                            Ver usuário
                          </Link>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-200 whitespace-pre-wrap break-words">
                    {c.content || '—'}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* User */}
        {tab === 'user' ? (
          <div className="mt-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Buscar usuário por e-mail ou UUID..."
                    className="w-full rounded-xl bg-slate-950/40 border border-slate-800 pl-9 pr-3 py-2 text-sm outline-none focus:border-slate-700"
                  />
                </div>

                <button
                  onClick={() => searchUser()}
                  disabled={busyKey === `user:search:${userQuery.trim()}` || !userQuery.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 disabled:opacity-50"
                >
                  <Search className="h-4 w-4" />
                  Buscar
                </button>
              </div>

              {userMatch ? (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-400">Usuário</div>
                      <div className="text-lg font-semibold">{userMatch.email || shortId(userMatch.id)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        id: <span className="text-slate-300">{userMatch.id}</span>
                      </div>
                      {moderationHint(userMatch) ? (
                        <div className="mt-2 text-xs text-amber-200/80">{`⚠ ${moderationHint(userMatch)}`}</div>
                      ) : (
                        <div className="mt-2 text-xs text-slate-500">Sem bloqueios atuais.</div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          doAction(`user:${userMatch.id}:banReport7`, async () => {
                            const r = await blockReporting(userMatch.id, 7);
                            if (!r.ok) throw new Error(r.message);
                          }, 'Usuário bloqueado de denunciar por 7 dias.')
                        }
                        disabled={busyKey === `user:${userMatch.id}:banReport7`}
                        className="inline-flex items-center gap-2 rounded-xl bg-amber-600/90 px-3 py-2 text-sm hover:bg-amber-600 disabled:opacity-50"
                      >
                        <Ban className="h-4 w-4" />
                        Bloquear denúncias (7d)
                      </button>

                      <button
                        onClick={() =>
                          doAction(`user:${userMatch.id}:banComment7`, async () => {
                            const r = await blockCommenting(userMatch.id, 7);
                            if (!r.ok) throw new Error(r.message);
                          }, 'Usuário bloqueado de comentar por 7 dias.')
                        }
                        disabled={busyKey === `user:${userMatch.id}:banComment7`}
                        className="inline-flex items-center gap-2 rounded-xl bg-rose-600/90 px-3 py-2 text-sm hover:bg-rose-600 disabled:opacity-50"
                      >
                        <Ban className="h-4 w-4" />
                        Bloquear comentários (7d)
                      </button>

                      <button
                        onClick={() =>
                          doAction(`user:${userMatch.id}:unbanReport`, async () => {
                            await unblockUser(userMatch.id, 'report');
                          }, 'Usuário desbloqueado para denunciar.')
                        }
                        disabled={busyKey === `user:${userMatch.id}:unbanReport`}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/20 px-3 py-2 text-sm hover:bg-slate-900/40 disabled:opacity-50"
                      >
                        <Shield className="h-4 w-4" />
                        Desbloquear denúncias
                      </button>

                      <button
                        onClick={() =>
                          doAction(`user:${userMatch.id}:unbanComment`, async () => {
                            await unblockUser(userMatch.id, 'comment');
                          }, 'Usuário desbloqueado para comentar.')
                        }
                        disabled={busyKey === `user:${userMatch.id}:unbanComment`}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/20 px-3 py-2 text-sm hover:bg-slate-900/40 disabled:opacity-50"
                      >
                        <Shield className="h-4 w-4" />
                        Desbloquear comentários
                      </button>

                      <Link
                        href={`/admin/users/${userMatch.id}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/20 px-3 py-2 text-sm hover:bg-slate-900/40"
                      >
                        Ver usuário
                      </Link>
                    </div>
                  </div>

                  {/* Conteúdo do usuário */}
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-3">
                      <div className="text-sm font-semibold">Posts recentes</div>
                      <div className="mt-2 space-y-2">
                        {userPosts.length === 0 ? (
                          <div className="text-sm text-slate-500">Sem posts.</div>
                        ) : (
                          userPosts.slice(0, 10).map((p) => (
                            <div key={p.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                              <div className="text-xs text-slate-500">{fmtDate(p.created_at)}</div>
                              <div className="mt-1 text-sm text-slate-200 whitespace-pre-wrap break-words">{p.content || '—'}</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  onClick={() =>
                                    doAction(`userpost:${p.id}:hide`, async () => {
                                      const t = usedTables.posts || POSTS_TABLES[0];
                                      await tryUpdateTarget(t, p.id, 'hide');
                                    }, 'Post ocultado.')
                                  }
                                  disabled={busyKey === `userpost:${p.id}:hide`}
                                  className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700 disabled:opacity-50"
                                >
                                  <EyeOff className="h-3.5 w-3.5" />
                                  Ocultar
                                </button>
                                <button
                                  onClick={() =>
                                    doAction(`userpost:${p.id}:restore`, async () => {
                                      const t = usedTables.posts || POSTS_TABLES[0];
                                      await tryUpdateTarget(t, p.id, 'restore');
                                    }, 'Post restaurado.')
                                  }
                                  disabled={busyKey === `userpost:${p.id}:restore`}
                                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/20 px-2 py-1 text-xs hover:bg-slate-900/40 disabled:opacity-50"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Restaurar
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-3">
                      <div className="text-sm font-semibold">Comentários recentes</div>
                      <div className="mt-2 space-y-2">
                        {userComments.length === 0 ? (
                          <div className="text-sm text-slate-500">Sem comentários.</div>
                        ) : (
                          userComments.slice(0, 15).map((c) => (
                            <div key={c.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                              <div className="text-xs text-slate-500">
                                {fmtDate(c.created_at)} • post {shortId(c.post_id)}
                              </div>
                              <div className="mt-1 text-sm text-slate-200 whitespace-pre-wrap break-words">{c.content || '—'}</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  onClick={() =>
                                    doAction(`usercomment:${c.id}:hide`, async () => {
                                      const t = usedTables.comments || COMMENTS_TABLES[0];
                                      await tryUpdateTarget(t, c.id, 'hide');
                                    }, 'Comentário ocultado.')
                                  }
                                  disabled={busyKey === `usercomment:${c.id}:hide`}
                                  className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700 disabled:opacity-50"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Ocultar
                                </button>
                                <button
                                  onClick={() =>
                                    doAction(`usercomment:${c.id}:restore`, async () => {
                                      const t = usedTables.comments || COMMENTS_TABLES[0];
                                      await tryUpdateTarget(t, c.id, 'restore');
                                    }, 'Comentário restaurado.')
                                  }
                                  disabled={busyKey === `usercomment:${c.id}:restore`}
                                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/20 px-2 py-1 text-xs hover:bg-slate-900/40 disabled:opacity-50"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Restaurar
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-slate-500">Nenhum usuário selecionado.</div>
              )}
            </div>
          </div>
        ) : null}

        {/* Rodapé útil */}
        <div className="mt-10 text-xs text-slate-600">
          Observação: para o painel ficar &quot;impecável&quot; (e-mails no admin, bloquear falso denunciante, ocultar/restaurar com segurança),
          rode o SQL do patch (RPCs admin_*). Este arquivo mantém fallback para quando RPC/colunas não existirem.
        </div>
      </div>
    </div>
  );
}
