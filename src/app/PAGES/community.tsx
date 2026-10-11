'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MessagesSquare,
  ArrowLeft,
  AlertTriangle,
  Heart,
  MessageCircle,
  ArrowUpRight,
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

type SupabaseClient = ReturnType<typeof createBrowserClient>;

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

type CommunityLike = {
  id: string;
  post_id: string;
  user_id: string;
};

type PostWithMeta = CommunityPost & {
  likeCount: number;
  userHasLiked: boolean;
  comments: CommunityComment[];
  commentsOpen: boolean;
  userHasCommented: boolean;
};

const MAX_REPORTS_PER_DAY = 1;

const BLOCKED_WORDS = [
  'sexo',
  'pinto',
  'pênis',
  'penis',
  'buceta',
  'xoxota',
  'gay',
  'viado',
  'veado',
  'corno',
  'puto',
  'puta',
  'merda',
  'caralho',
  'porra',
  'arrombado',
  'otário',
  'otario',
];

function hasProfanity(text: string): boolean {
  const lowered = text.toLowerCase();
  return BLOCKED_WORDS.some((w) => lowered.includes(w));
}

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

export default function CommunityPage() {
  const router = useRouter();
  const supabase = useMemo(createClient, []);
  const [user, setUser] = useState<any | null>(null);

  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [orderBy, setOrderBy] = useState<'recent' | 'top'>('recent');

  const [newPost, setNewPost] = useState('');
  const [sendingPost, setSendingPost] = useState(false);
  const [hasPostedToday, setHasPostedToday] = useState(false);

  const [replyByPostId, setReplyByPostId] = useState<Record<string, string>>({});
  const [sendingReplyFor, setSendingReplyFor] = useState<string | null>(null);

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalInfo, setGlobalInfo] = useState<string | null>(null);

  const [themeMode, setThemeMode] = useState<'focus' | 'normal'>('normal');
  const [reloadFlag, setReloadFlag] = useState(0);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: userResult } = await supabase.auth.getUser();
        const currentUser = userResult?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_premium, theme_mode')
            .eq('id', currentUser.id)
            .maybeSingle();

          setIsPremium(!!profile?.is_premium);
          setThemeMode(profile?.theme_mode ?? 'normal');

          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);

          const { data: todaysPosts } = await supabase
            .from('community_posts')
            .select('id')
            .eq('user_id', currentUser.id)
            .gte('created_at', startOfDay.toISOString());

          setHasPostedToday((todaysPosts ?? []).length > 0);
        } else {
          setIsPremium(false);
          setHasPostedToday(false);
        }
      } catch (err) {}
    };

    fetchUser();
  }, [supabase]);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      setGlobalError(null);

      try {
        const { data: postsData } = await supabase
          .from('community_posts')
          .select('id, user_id, content, created_at, status')
          .order('created_at', { ascending: false });

        let safePosts: CommunityPost[] = (postsData ?? []).filter(
          (p) => !p.status || p.status === 'published'
        );

        if (!safePosts.length) {
          setPosts([]);
          setLoading(false);
          return;
        }

        const postIds = safePosts.map((p) => p.id);

        const { data: likesData } = await supabase
          .from('community_likes')
          .select('id, post_id, user_id')
          .in('post_id', postIds);

        const likeMap: Record<string, number> = {};
        const userLikeSet = new Set<string>();

        (likesData as CommunityLike[] | null)?.forEach((l) => {
          likeMap[l.post_id] = (likeMap[l.post_id] || 0) + 1;
          if (user && l.user_id === user.id) {
            userLikeSet.add(l.post_id);
          }
        });

        const { data: commentsData } = await supabase
          .from('community_comments')
          .select('id, post_id, user_id, content, created_at')
          .in('post_id', postIds);

        const allComments = (commentsData ?? []) as CommunityComment[];
        const commentIds = allComments.map((c) => c.id);

        const { data: postReports } = await supabase
          .from('community_reports')
          .select('post_id')
          .in('post_id', postIds)
          .not('post_id', 'is', null);

        const { data: commentReports } = await supabase
          .from('community_reports')
          .select('comment_id')
          .in('comment_id', commentIds)
          .not('comment_id', 'is', null);

        const reportedPostIds = new Set(
          (postReports ?? [])
            .map((r: any) => r.post_id as string | null)
            .filter(Boolean) as string[]
        );

        const reportedCommentIds = new Set(
          (commentReports ?? [])
            .map((r: any) => r.comment_id as string | null)
            .filter(Boolean) as string[]
        );

        safePosts = safePosts.filter((p) => !reportedPostIds.has(p.id));

        const commentsByPost: Record<string, CommunityComment[]> = {};
        allComments.forEach((c) => {
          if (reportedCommentIds.has(c.id)) return;
          if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
          commentsByPost[c.post_id].push(c);
        });

        const userCommentSet = new Set<string>();
        if (user) {
          allComments.forEach((c) => {
            if (c.user_id === user.id) userCommentSet.add(c.post_id);
          });
        }

        let enriched: PostWithMeta[] = safePosts.map((p) => ({
          ...p,
          likeCount: likeMap[p.id] || 0,
          userHasLiked: userLikeSet.has(p.id),
          comments: commentsByPost[p.id] || [],
          commentsOpen: false,
          userHasCommented: userCommentSet.has(p.id),
        }));

        if (orderBy === 'top') {
          enriched = enriched
            .slice()
            .sort((a, b) => {
              if (b.likeCount !== a.likeCount)
                return b.likeCount - a.likeCount;
              return (
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
              );
            });
        }

        setPosts(enriched);
      } catch (err: any) {
        setGlobalError('Erro ao carregar a comunidade.');
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [supabase, user, orderBy, reloadFlag]);

  function showInfo(msg: string) {
    setGlobalInfo(msg);
    setTimeout(() => setGlobalInfo(null), 3500);
  }

  const handleCreatePost = async () => {
    if (!user) {
      setGlobalError('Faça login para publicar.');
      return;
    }
    if (!isPremium) {
      setGlobalError('Apenas membros Premium podem publicar.');
      return;
    }
    if (hasPostedToday) {
      setGlobalError('Você já publicou um post hoje.');
      return;
    }
    if (!newPost.trim()) return;
    if (hasProfanity(newPost)) {
      setGlobalError('O texto contém palavras bloqueadas.');
      return;
    }

    try {
      setSendingPost(true);
      const { error } = await supabase.from('community_posts').insert({
        user_id: user.id,
        content: newPost.trim(),
        status: 'published',
      });
      if (error) {
        setGlobalError('Erro ao publicar.');
        return;
      }

      setNewPost('');
      setHasPostedToday(true);
      showInfo('Post publicado!');
      setOrderBy('recent');
      setReloadFlag((v) => v + 1);
    } catch (err) {
      setGlobalError('Erro inesperado.');
    } finally {
      setSendingPost(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    if (!user) {
      setGlobalError('Faça login para curtir.');
      return;
    }

    try {
      const { data: existing } = await supabase
        .from('community_likes')
        .select('id')
        .eq('user_id', user.id)
        .eq('post_id', postId);

      if (existing && existing.length > 0) {
        await supabase
          .from('community_likes')
          .delete()
          .in(
            'id',
            existing.map((l: any) => l.id)
          );

        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, likeCount: p.likeCount - 1, userHasLiked: false }
              : p
          )
        );
      } else {
        await supabase.from('community_likes').insert({
          user_id: user.id,
          post_id: postId,
        });

        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, likeCount: p.likeCount + 1, userHasLiked: true }
              : p
          )
        );
      }
    } catch (err) {
      setGlobalError('Erro ao curtir/descurtir.');
    }
  };

  const handleSendReply = async (postId: string) => {
    if (!user) {
      setGlobalError('Faça login para responder.');
      return;
    }

    const text = replyByPostId[postId]?.trim() || '';
    if (!text) return;

    if (!isPremium) {
      setGlobalError('Apenas membros Premium podem responder.');
      return;
    }

    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    if (post.userHasCommented) {
      setGlobalError('Você já respondeu esse post.');
      return;
    }

    if (hasProfanity(text)) {
      setGlobalError('A resposta contém palavras bloqueadas.');
      return;
    }

    try {
      setSendingReplyFor(postId);

      const { data, error } = await supabase
        .from('community_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: text,
        })
        .select('*')
        .maybeSingle();

      if (error || !data) {
        setGlobalError('Erro ao enviar resposta.');
        return;
      }

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                comments: [...p.comments, data],
                userHasCommented: true,
                commentsOpen: true,
              }
            : p
        )
      );

      setReplyByPostId((prev) => ({ ...prev, [postId]: '' }));
    } catch (err) {
      setGlobalError('Erro inesperado.');
    } finally {
      setSendingReplyFor(null);
    }
  };

  const handleReport = async (opts: { postId?: string; commentId?: string }) => {
    if (!user) {
      setGlobalError('Faça login para denunciar.');
      return;
    }

    const { postId, commentId } = opts;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todaysReports } = await supabase
        .from('community_reports')
        .select('id,created_at')
        .eq('user_id', user.id)
        .gte('created_at', today.toISOString());

      if ((todaysReports ?? []).length >= MAX_REPORTS_PER_DAY) {
        setGlobalError('Você atingiu o limite diário de denúncias.');
        return;
      }

      const query = supabase
        .from('community_reports')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (postId) query.eq('post_id', postId);
      if (commentId) query.eq('comment_id', commentId);

      const { data: existing } = await query;
      if ((existing ?? []).length > 0) {
        setGlobalError('Você já denunciou isso.');
        return;
      }

      await supabase.from('community_reports').insert({
        user_id: user.id,
        post_id: postId ?? null,
        comment_id: commentId ?? null,
        reason: 'Inadequado',
      });

      if (postId) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      } else if (commentId) {
        setPosts((prev) =>
          prev.map((p) => ({
            ...p,
            comments: p.comments.filter((c) => c.id !== commentId),
          }))
        );
      }

      showInfo('Denúncia enviada. Obrigado por ajudar!');
    } catch (err) {
      setGlobalError('Erro ao denunciar.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${
        themeMode === 'focus'
          ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900'
          : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900'
      }`}
    >
      {/* HEADER */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </Link>

            <MessagesSquare className="w-8 h-8 text-purple-500" />

            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Sua Comunidade
            </h1>
          </div>

          {isPremium && (
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-white font-semibold">
              ⭐ Premium
            </div>
          )}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">

        {/* BLOCO INTRODUTÓRIO */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-7 shadow-2xl text-white space-y-3">
          <h2 className="text-3xl font-bold">Compartilhe. Inspire. Apoie.</h2>
          <p className="text-lg opacity-90">
            Este é o seu espaço seguro para deixar recados, desabafar ou motivar outras
            pessoas na jornada sem fumar.  
          </p>

          <ul className="text-sm opacity-90 space-y-1">
            <li>• Respeito sempre, sem exceção.</li>
            <li>• Conteúdo ofensivo ou explícito é removido.</li>
            <li>• Publicações e respostas são anônimas para seu conforto.</li>
            <li>• Membros Premium podem postar e responder.</li>
          </ul>
        </div>

        {/* MENSAGENS */}
        {(globalError || globalInfo) && (
          <div className="space-y-2">
            {globalError && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
                <AlertTriangle className="w-4 h-4" />
                {globalError}
              </div>
            )}
            {globalInfo && (
              <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 px-4 py-3 rounded-xl text-sm">
                <ArrowUpRight className="w-4 h-4" />
                {globalInfo}
              </div>
            )}
          </div>
        )}

        {/* CAIXA DE POSTAGEM */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Deixe uma mensagem motivacional ou um desabafo para a comunidade.
          </p>

          <textarea
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 outline-none"
            placeholder={
              !user
                ? 'Faça login para publicar...'
                : !isPremium
                ? 'Apenas membros Premium podem publicar...'
                : hasPostedToday
                ? 'Você já publicou hoje.'
                : 'Escreva algo que você gostaria de ler num dia difícil...'
            }
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            disabled={!user || !isPremium || hasPostedToday}
            rows={4}
          />

          <button
            onClick={handleCreatePost}
            disabled={
              !user || !isPremium || hasPostedToday || sendingPost || !newPost.trim()
            }
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendingPost ? 'Publicando...' : 'Publicar no Mural'}
          </button>
        </div>

        {/* FILTRO */}
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            Postagens da Comunidade
          </span>

          <div className="bg-white dark:bg-gray-800 p-1 rounded-full flex shadow-sm">
            <button
              className={`px-4 py-1.5 rounded-full ${
                orderBy === 'recent'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
              onClick={() => setOrderBy('recent')}
            >
              Recentes
            </button>

            <button
              className={`px-4 py-1.5 rounded-full ${
                orderBy === 'top'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
              onClick={() => setOrderBy('top')}
            >
              Mais curtidos
            </button>
          </div>
        </div>

        {/* LISTA DE POSTS */}
        <div className="space-y-5 pb-10">
          {posts.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 text-sm py-10">
              Ainda não há postagens. Seja o primeiro a deixar uma mensagem! 💬
            </p>
          )}

          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    Anônimo
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(post.created_at)}
                  </p>
                </div>

                <button
                  onClick={() => handleReport({ postId: post.id })}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Denunciar
                </button>
              </div>

              <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                {post.content}
              </p>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleToggleLike(post.id)}
                  className="flex items-center gap-1 text-gray-500 dark:text-gray-300 hover:text-pink-500 text-sm"
                >
                  <Heart
                    className={`w-5 h-5 ${
                      post.userHasLiked
                        ? 'fill-pink-500 text-pink-500'
                        : ''
                    }`}
                  />
                  {post.likeCount}
                </button>

                <button
                  onClick={() =>
                    setPosts((prev) =>
                      prev.map((p) =>
                        p.id === post.id
                          ? { ...p, commentsOpen: !p.commentsOpen }
                          : p
                      )
                    )
                  }
                  className="flex items-center gap-1 text-purple-600 dark:text-purple-300 text-xs"
                >
                  <MessageCircle className="w-4 h-4" />
                  {post.commentsOpen
                    ? `Ocultar comentários (${post.comments.length})`
                    : `Comentários (${post.comments.length})`}
                </button>
              </div>

              {post.commentsOpen && (
                <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <textarea
                    value={replyByPostId[post.id] || ''}
                    onChange={(e) =>
                      setReplyByPostId((prev) => ({
                        ...prev,
                        [post.id]: e.target.value,
                      }))
                    }
                    disabled={!isPremium || post.userHasCommented}
                    placeholder={
                      !user
                        ? 'Faça login para responder'
                        : !isPremium
                        ? 'Resposta permitida apenas para Premium'
                        : post.userHasCommented
                        ? 'Você já respondeu este post'
                        : 'Escreva uma resposta...'
                    }
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-xs text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50"
                  />

                  <div className="flex justify-end">
                    <button
                      onClick={() => handleSendReply(post.id)}
                      disabled={
                        !isPremium ||
                        post.userHasCommented ||
                        !replyByPostId[post.id]?.trim() ||
                        sendingReplyFor === post.id
                      }
                      className="px-4 py-2 bg-purple-600 text-white rounded-full text-xs hover:bg-purple-700 disabled:opacity-50"
                    >
                      {sendingReplyFor === post.id
                        ? 'Enviando...'
                        : 'Responder'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {post.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="bg-purple-50 dark:bg-purple-900/20 px-4 py-3 rounded-xl text-xs"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            Resposta anônima
                          </span>
                          <button
                            onClick={() =>
                              handleReport({ commentId: comment.id })
                            }
                            className="text-red-500 text-[10px] flex gap-1"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            Denunciar
                          </button>
                        </div>

                        <p className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                          {comment.content}
                        </p>

                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
