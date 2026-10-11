'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  Shield,
  Users,
  Crown,
  UserX,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  Edit2,
  Eye,
} from 'lucide-react';

type SupabaseClient = ReturnType<typeof createBrowserClient>;

type ProfileRow = {
  id: string;
  created_at: string;
  is_premium: boolean | null;
  display_name?: string | null;
  full_name?: string | null;
  email?: string | null; // 👈 NOVO CAMPO
};

type CommunityPost = {
  id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  status?: string | null;
};

type CommunityComment = {
  id: string;
  post_id: string;
  user_id: string | null;
  content: string;
  created_at: string;
};

type CommunityReport = {
  id: string;
  user_id: string;
  post_id: string | null;
  comment_id: string | null;
  reason: string | null;
  created_at: string;
};

type ReportItem = CommunityReport & {
  post?: CommunityPost | null;
  comment?: CommunityComment | null;
};

type AdminTab = 'users' | 'reports' | 'content';

function createClient(): SupabaseClient {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function formatDate(dateString: string) {
  const d = new Date(dateString);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = useMemo(createClient, []);

  const [tab, setTab] = useState<AdminTab>('users');

  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<CommunityComment[]>([]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Para pequenas atualizações manuais, tipo "recarregar"
  const [refreshToken, setRefreshToken] = useState(0);

  // Estatísticas rápidas
  const totalUsers = profiles.length;
  const premiumUsers = profiles.filter((p) => !!p.is_premium).length;
  const freeUsers = totalUsers - premiumUsers;
  const pendingReportsCount = reports.length;

  // Carrega tudo
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        // 1. Confere se usuário logado existe
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        // (Opcional) travar para admin por e-mail
        const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean);

        if (adminEmails.length > 0 && !adminEmails.includes(user.email ?? '')) {
          if (!cancelled) {
            setErrorMessage(
              'Acesso restrito. Esta área é apenas para administradores.'
            );
            setLoading(false);
          }
          return;
        }

        // 2. Busca profiles (AGORA BUSCA EMAIL TAMBÉM)
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, created_at, is_premium, display_name, full_name, email')
          .order('created_at', { ascending: true });

        if (profilesError) throw profilesError;

        // 3. Busca denúncias
        const { data: reportsData, error: reportsError } = await supabase
          .from('community_reports')
          .select('id, user_id, post_id, comment_id, reason, created_at')
          .order('created_at', { ascending: false })
          .limit(200);

        if (reportsError) throw reportsError;

        const postIds = Array.from(
          new Set(
            (reportsData ?? [])
              .map((r) => r.post_id)
              .filter((id): id is string => !!id)
          )
        );
        const commentIds = Array.from(
          new Set(
            (reportsData ?? [])
              .map((r) => r.comment_id)
              .filter((id): id is string => !!id)
          )
        );

        let postsById: Record<string, CommunityPost> = {};
        let commentsById: Record<string, CommunityComment> = {};

        if (postIds.length > 0) {
          const { data: postsData, error: postsError } = await supabase
            .from('community_posts')
            .select('id, user_id, content, created_at, status')
            .in('id', postIds);

          if (postsError) throw postsError;

          (postsData ?? []).forEach((p) => {
            postsById[p.id] = p;
          });
        }

        if (commentIds.length > 0) {
          const { data: commentsData, error: commentsError } = await supabase
            .from('community_comments')
            .select('id, post_id, user_id, content, created_at')
            .in('id', commentIds);

          if (commentsError) throw commentsError;

          (commentsData ?? []).forEach((c) => {
            commentsById[c.id] = c;
          });
        }

        const enrichedReports: ReportItem[] = (reportsData ?? []).map((r) => ({
          ...r,
          post: r.post_id ? postsById[r.post_id] ?? null : null,
          comment: r.comment_id ? commentsById[r.comment_id] ?? null : null,
        }));

        // 4. Lista de posts para aba "Conteúdo"
        const { data: allPosts, error: allPostsError } = await supabase
          .from('community_posts')
          .select('id, user_id, content, created_at, status')
          .order('created_at', { ascending: false })
          .limit(100);

        if (allPostsError) throw allPostsError;

        // 5. Lista de comentários para aba "Conteúdo"
        const { data: allComments, error: allCommentsError } = await supabase
          .from('community_comments')
          .select('id, post_id, user_id, content, created_at')
          .order('created_at', { ascending: false })
          .limit(100);

        if (allCommentsError) throw allCommentsError;

        if (!cancelled) {
          setProfiles(profilesData ?? []);
          setReports(enrichedReports);
          setPosts(allPosts ?? []);
          setComments(allComments ?? []);
        }
      } catch (err: any) {
        console.error('ERRO REAL DO PAINEL ADMIN:', err);

        const msg =
          err?.message ||
          err?.details ||
          err?.hint ||
          JSON.stringify(err, null, 2);

        if (!cancelled) {
          setErrorMessage('Erro ao carregar painel admin: ' + msg);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, router, refreshToken]);

  function showInfo(msg: string) {
    setInfoMessage(msg);
    setTimeout(() => setInfoMessage(null), 4000);
  }

  // ---------- AÇÕES DE USUÁRIO ----------

  const handleTogglePremium = async (profileId: string, current: boolean) => {
    try {
      setLoadingAction(true);
      setErrorMessage(null);

      const { error } = await supabase
        .from('profiles')
        .update({ is_premium: !current })
        .eq('id', profileId);

      if (error) throw error;

      setProfiles((prev) =>
        prev.map((p) =>
          p.id === profileId ? { ...p, is_premium: !current } : p
        )
      );
      showInfo(
        !current
          ? 'Usuário marcado como Premium.'
          : 'Usuário voltou para plano gratuito.'
      );
    } catch (err) {
      console.error(err);
      setErrorMessage('Não foi possível atualizar o status Premium do usuário.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeleteUserContent = async (profileId: string) => {
    const confirmed = window.confirm(
      'Isso irá remover TODOS os posts e comentários deste usuário. Tem certeza?'
    );
    if (!confirmed) return;

    try {
      setLoadingAction(true);
      setErrorMessage(null);

      await supabase.from('community_comments').delete().eq('user_id', profileId);
      await supabase.from('community_posts').delete().eq('user_id', profileId);

      showInfo('Conteúdos do usuário removidos com sucesso.');
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao remover conteúdo do usuário.');
    } finally {
      setLoadingAction(false);
    }
  };

  // ---------- AÇÕES DE DENÚNCIA ----------

  const handleResolveReportIgnore = async (reportId: string) => {
    try {
      setLoadingAction(true);
      setErrorMessage(null);

      await supabase.from('community_reports').delete().eq('id', reportId);

      setReports((prev) => prev.filter((r) => r.id !== reportId));
      showInfo('Denúncia arquivada (conteúdo mantido).');
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao arquivar denúncia.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleResolveReportRemove = async (report: ReportItem) => {
    const confirmed = window.confirm(
      'Remover conteúdo denunciado? Posts serão ocultados, comentários serão apagados.'
    );
    if (!confirmed) return;

    try {
      setLoadingAction(true);
      setErrorMessage(null);

      if (report.post_id) {
        await supabase
          .from('community_posts')
          .update({ status: 'hidden' })
          .eq('id', report.post_id);

        setPosts((prev) =>
          prev.map((p) =>
            p.id === report.post_id ? { ...p, status: 'hidden' } : p
          )
        );
      }

      if (report.comment_id) {
        await supabase
          .from('community_comments')
          .delete()
          .eq('id', report.comment_id);

        setComments((prev) =>
          prev.filter((c) => c.id !== report.comment_id)
        );
      }

      if (report.post_id) {
        await supabase
          .from('community_reports')
          .delete()
          .eq('post_id', report.post_id);
      } else if (report.comment_id) {
        await supabase
          .from('community_reports')
          .delete()
          .eq('comment_id', report.comment_id);
      } else {
        await supabase.from('community_reports').delete().eq('id', report.id);
      }

      setReports((prev) =>
        prev.filter(
          (r) =>
            r.id !== report.id &&
            r.post_id !== report.post_id &&
            r.comment_id !== report.comment_id
        )
      );

      showInfo('Conteúdo denunciado removido com sucesso.');
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao remover conteúdo denunciado.');
    } finally {
      setLoadingAction(false);
    }
  };

  // ---------- GERENCIAMENTO DE POSTS / COMENTÁRIOS ----------

  const handleTogglePostStatus = async (post: CommunityPost) => {
    const newStatus = post.status === 'hidden' ? 'published' : 'hidden';

    try {
      setLoadingAction(true);
      setErrorMessage(null);

      const { error } = await supabase
        .from('community_posts')
        .update({ status: newStatus })
        .eq('id', post.id);

      if (error) throw error;

      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, status: newStatus } : p
        )
      );
      showInfo(
        newStatus === 'hidden'
          ? 'Post ocultado. Ele não aparecerá mais na comunidade.'
          : 'Post publicado novamente.'
      );
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao atualizar status do post.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    const confirmed = window.confirm(
      'Remover totalmente este post e seus comentários? Esta ação não pode ser desfeita.'
    );
    if (!confirmed) return;

    try {
      setLoadingAction(true);
      setErrorMessage(null);

      await supabase.from('community_comments').delete().eq('post_id', postId);
      await supabase.from('community_posts').delete().eq('id', postId);
      await supabase.from('community_reports').delete().eq('post_id', postId);

      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setReports((prev) => prev.filter((r) => r.post_id !== postId));

      showInfo('Post removido com sucesso.');
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao remover post.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleEditPost = async (post: CommunityPost) => {
    const newContent = window.prompt(
      'Edite o conteúdo do post:',
      post.content
    );
    if (newContent == null || newContent.trim() === post.content.trim()) return;

    try {
      setLoadingAction(true);
      setErrorMessage(null);

      const { error } = await supabase
        .from('community_posts')
        .update({ content: newContent.trim() })
        .eq('id', post.id);

      if (error) throw error;

      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, content: newContent.trim() } : p
        )
      );
      showInfo('Post atualizado com sucesso.');
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao editar post.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const confirmed = window.confirm(
      'Remover este comentário? Esta ação não pode ser desfeita.'
    );
    if (!confirmed) return;

    try {
      setLoadingAction(true);
      setErrorMessage(null);

      const { error: deleteCommentError } = await supabase
        .from('community_comments')
        .delete()
        .eq('id', commentId);

      if (deleteCommentError) throw deleteCommentError;

      const { error: deleteReportsError } = await supabase
        .from('community_reports')
        .delete()
        .eq('comment_id', commentId);

      if (deleteReportsError) throw deleteReportsError;

      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setReports((prev) => prev.filter((r) => r.comment_id !== commentId));

      showInfo('Comentário removido com sucesso.');
    } catch (err) {
      console.error('Erro ao remover comentário', err);
      setErrorMessage('Erro ao remover comentário.');
    } finally {
      setLoadingAction(false);
    }
  };

  // ---------- RENDER ----------

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-900 dark:to-black">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
          <p className="text-xs text-gray-500 dark:text-gray-300">
            Carregando painel administrativo...
          </p>
        </div>
      </div>
    );
  }

  if (
    errorMessage &&
    errorMessage.includes('apenas para administradores')
  ) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-900 dark:to-black px-4">
        <Shield className="w-10 h-10 text-purple-600 mb-3" />
        <p className="text-sm text-gray-800 dark:text-gray-100 text-center max-w-md">
          {errorMessage}
        </p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600 text-white text-xs font-semibold shadow hover:opacity-90"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para o app
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-900 dark:to-black">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Painel Administrativo
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Gerencie usuários, Premium, comunidade e denúncias.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setRefreshToken((x) => x + 1)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/80 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 shadow hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className="w-3 h-3" />
            Recarregar
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Mensagens globais */}
        {(errorMessage || infoMessage) && (
          <div className="space-y-2">
            {errorMessage && (
              <div className="flex items-center gap-2 text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-2xl dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                <AlertTriangle className="w-4 h-4" />
                <span>{errorMessage}</span>
              </div>
            )}
            {infoMessage && (
              <div className="flex items-center gap-2 text-xs bg-purple-50 border border-purple-200 text-purple-700 px-3 py-2 rounded-2xl dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-100">
                <CheckCircle2 className="w-4 h-4" />
                <span>{infoMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Cards de resumo */}
        <section className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="bg-white/90 dark:bg-gray-900/90 rounded-3xl shadow-sm px-4 py-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Users className="w-4 h-4 text-purple-500" />
              Usuários totais
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {totalUsers}
            </p>
          </div>

          <div className="bg-white/90 dark:bg-gray-900/90 rounded-3xl shadow-sm px-4 py-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Crown className="w-4 h-4 text-yellow-500" />
              Premium
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {premiumUsers}
            </p>
          </div>

          <div className="bg-white/90 dark:bg-gray-900/90 rounded-3xl shadow-sm px-4 py-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <UserX className="w-4 h-4 text-blue-500" />
              Gratuitos
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {freeUsers}
            </p>
          </div>

          <div className="bg-white/90 dark:bg-gray-900/90 rounded-3xl shadow-sm px-4 py-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Denúncias pendentes
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {pendingReportsCount}
            </p>
          </div>
        </section>

        {/* Abas */}
        <section className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setTab('users')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full shadow-sm ${
              tab === 'users'
                ? 'bg-purple-600 text-white'
                : 'bg-white/80 dark:bg-gray-900/80 text-gray-700 dark:text-gray-200'
            }`}
          >
            <Users className="w-3 h-3" />
            Usuários
          </button>
          <button
            onClick={() => setTab('reports')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full shadow-sm ${
              tab === 'reports'
                ? 'bg-purple-600 text-white'
                : 'bg-white/80 dark:bg-gray-900/80 text-gray-700 dark:text-gray-200'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Denúncias
          </button>
          <button
            onClick={() => setTab('content')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full shadow-sm ${
              tab === 'content'
                ? 'bg-purple-600 text-white'
                : 'bg-white/80 dark:bg-gray-900/80 text-gray-700 dark:text-gray-200'
            }`}
          >
            <MessageSquare className="w-3 h-3" />
            Conteúdos
          </button>

          {loadingAction && (
            <span className="ml-auto text-[11px] text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Processando...
            </span>
          )}
        </section>

        {/* Conteúdo das abas */}
        {tab === 'users' && (
          <section className="bg-white/95 dark:bg-gray-900/95 rounded-3xl shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Usuários (tabela profiles)</span>
              <span>{profiles.length} registros</span>
            </div>

            {profiles.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Nenhum usuário encontrado na tabela <code>profiles</code>.
              </p>
            ) : (
              <div className="space-y-2">
                {profiles.map((p) => {
                  const displayName =
                    p.display_name ||
                    p.full_name ||
                    p.email ||
                    (p.id ? `Usuário ${p.id.slice(0, 8)}` : 'Usuário');

                  return (
                    <div
                      key={p.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-gray-100 dark:border-gray-800 rounded-2xl px-3 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                            {displayName}
                          </p>

                          {p.email && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              Email: <span>{p.email}</span>
                            </p>
                          )}

                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            ID: <span className="font-mono">{p.id}</span>
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Criado em: {formatDate(p.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-start sm:items-end gap-2 text-[11px]">
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px]">
                          <Crown
                            className={`w-3 h-3 ${
                              p.is_premium ? 'text-yellow-500' : 'text-gray-400'
                            }`}
                          />
                          {p.is_premium ? 'Premium' : 'Gratuito'}
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleTogglePremium(p.id, !!p.is_premium)
                            }
                            className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[11px] hover:bg-purple-100"
                          >
                            {p.is_premium
                              ? 'Remover Premium'
                              : 'Tornar Premium'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteUserContent(p.id)}
                            className="px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-[11px] hover:bg-red-100 inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Remover conteúdo
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              • Este painel mostra usuários que possuem linha na tabela{' '}
              <code>profiles</code>. Contas criadas que não inseriram registro
              em <code>profiles</code> não aparecem aqui.  
              • A remoção de usuário no Auth (excluir conta) exige chave
              secreta e deve ser feita via backend / painel Supabase.
            </p>
          </section>
        )}

        {tab === 'reports' && (
          <section className="bg-white/95 dark:bg-gray-900/95 rounded-3xl shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Denúncias (tabela community_reports)</span>
              <span>{reports.length} em análise</span>
            </div>

            {reports.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Nenhuma denúncia pendente no momento.
              </p>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => {
                  const tipo = r.post_id ? 'Post' : r.comment_id ? 'Comentário' : 'Outro';

                  return (
                    <div
                      key={r.id}
                      className="border border-gray-100 dark:border-gray-800 rounded-2xl px-3 py-3 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                          <span>
                            {tipo} denunciado em {formatDate(r.created_at)}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-400">
                          Reporter:{' '}
                          <span className="font-mono">{r.user_id}</span>
                        </span>
                      </div>

                      {r.post && (
                        <div className="bg-purple-50/80 dark:bg-purple-900/20 rounded-2xl px-3 py-2 space-y-1">
                          <p className="font-semibold text-[11px] text-gray-700 dark:text-gray-100">
                            Conteúdo do post
                          </p>
                          <p className="text-[11px] text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                            {r.post.content}
                          </p>
                        </div>
                      )}

                      {r.comment && (
                        <div className="bg-blue-50/80 dark:bg-blue-900/20 rounded-2xl px-3 py-2 space-y-1">
                          <p className="font-semibold text-[11px] text-gray-700 dark:text-gray-100">
                            Conteúdo do comentário
                          </p>
                          <p className="text-[11px] text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                            {r.comment.content}
                          </p>
                        </div>
                      )}

                      {r.reason && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          Motivo informado: {r.reason}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleResolveReportIgnore(r.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200 text-[11px] hover:bg-gray-100"
                        >
                          <XCircle className="w-3 h-3" />
                          Manter conteúdo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolveReportRemove(r)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-[11px] hover:bg-red-100"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remover conteúdo
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              • Ao remover um post denunciado, ele é marcado como{' '}
              <code>status = "hidden"</code> em <code>community_posts</code>.  
              • Comentários denunciados são apagados da tabela{' '}
              <code>community_comments</code>.  
              • As denúncias relacionadas são automaticamente removidas.
            </p>
          </section>
        )}

        {tab === 'content' && (
          <section className="space-y-4">
            {/* POSTS */}
            <div className="bg-white/95 dark:bg-gray-900/95 rounded-3xl shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>Posts da comunidade (tabela community_posts)</span>
                <span>{posts.length} últimos registros</span>
              </div>

              {posts.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Nenhum post encontrado.
                </p>
              ) : (
                <div className="space-y-2">
                  {posts.map((p) => (
                    <div
                      key={p.id}
                      className="border border-gray-100 dark:border-gray-800 rounded-2xl px-3 py-3 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            ID: <span className="font-mono">{p.id}</span>
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Criado em: {formatDate(p.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px]">
                            <MessageCircle className="w-3 h-3" />
                            {p.status === 'hidden' ? 'Oculto' : 'Publicado'}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-gray-800 dark:text-gray-100 line-clamp-3 whitespace-pre-wrap">
                        {p.content}
                      </p>

                      <div className="flex flex-wrap gap-2 justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => window.alert(p.content)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200 text-[11px] hover:bg-gray-100"
                        >
                          <Eye className="w-3 h-3" />
                          Ver completo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditPost(p)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[11px] hover:bg-purple-100"
                        >
                          <Edit2 className="w-3 h-3" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePostStatus(p)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] hover:bg-blue-100"
                        >
                          {p.status === 'hidden' ? 'Publicar' : 'Ocultar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePost(p.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-[11px] hover:bg-red-100"
                        >
                          <Trash2 className="w-3 h-3" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* COMENTÁRIOS */}
            <div className="bg-white/95 dark:bg-gray-900/95 rounded-3xl shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>Comentários (tabela community_comments)</span>
                <span>{comments.length} últimos registros</span>
              </div>

              {comments.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Nenhum comentário encontrado.
                </p>
              ) : (
                <div className="space-y-2">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className="border border-gray-100 dark:border-gray-800 rounded-2xl px-3 py-3 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            ID comentário:{' '}
                            <span className="font-mono">{c.id}</span>
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            ID post:{' '}
                            <span className="font-mono">{c.post_id}</span>
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Criado em: {formatDate(c.created_at)}
                          </p>
                        </div>
                      </div>

                      <p className="text-[11px] text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                        {c.content}
                      </p>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(c.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-[11px] hover:bg-red-100"
                        >
                          <Trash2 className="w-3 h-3" />
                          Excluir comentário
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
