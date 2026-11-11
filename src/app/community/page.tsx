'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MessagesSquare,
  ArrowLeft,
  AlertTriangle,
  UserX,
  Heart,
  MessageCircle,
  ArrowUpRight,
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import PageSkeleton from '@/components/ui/page-skeleton';

type SupabaseClient = ReturnType<typeof createBrowserClient>;

type CommunityPost = {
  id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  status?: string | null;
  author_icon?: string | null;
};

type CommunityComment = {
  id: string;
  post_id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  author_icon?: string | null;
  parent_comment_id?: string | null;
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

type ModerationState = {
  canComment: boolean;
  canReport: boolean;
  commentBlockedUntil: string | null;
  reportBlockedUntil: string | null;
};


const MAX_REPORTS_PER_DAY = 1;

// Suporta avatares (A1..A20) além de ícones (emojis).
// A1 é o avatar padrão gratuito.
const DEFAULT_ICON = 'A1';



const ICON_EMOJI_MAP: Record<string, string> = {
  icon_leaf: '🌿',
  icon_fire: '🔥',
  icon_shield: '🛡️',
  icon_crystal: '💎',
  icon_trophy: '🏆',
  icon_rocket: '🚀',
  icon_compass: '🧭',
  icon_mountain: '⛰️',
  icon_star: '⭐',
  icon_heart: '💜',
};

function resolveIcon(raw: any): string {
  const v = String(raw ?? '').trim();
  if (!v) return DEFAULT_ICON;
  if (v.startsWith('icon_')) return ICON_EMOJI_MAP[v] ?? DEFAULT_ICON;
  return v;
}

function isAvatarId(v: string): boolean {
  const s = String(v ?? '').trim().toUpperCase();
  if (!s) return false;
  // A1..A20
  return /^A(?:[1-9]|1\d|20)$/.test(s);
}

function avatarSrc(avatarId: string): string {
  const s = String(avatarId ?? '').trim().toUpperCase();
  return `/avatars/${s}.png`;
}

function isBlockedUntil(until: string | null | undefined): boolean {
  if (!until) return false;
  const t = new Date(until).getTime();
  return Number.isFinite(t) && t > Date.now();
}

function formatDateTimeBR(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// Local pre-submission guard only. Server-side reports and human moderation remain
// necessary. Never classify an identity term (e.g. "gay") as profanity.
const BLOCKED_WORDS = new Set([
  'buceta', 'xoxota', 'viado', 'veado', 'corno', 'puto', 'puta',
  'merda', 'caralho', 'porra', 'arrombado', 'otario',
]);

function hasProfanity(text: string): boolean {
  // Tokenize whole words so e.g. "computador" is not rejected for "puta".
  // Normalize diacritics to handle common spelling variants.
  const words = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .match(/\p{L}+/gu) ?? [];
  return words.some((word) => BLOCKED_WORDS.has(word));
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

function safeGetThemeModeFromStorage(): 'focus' | 'normal' {
  if (typeof window === 'undefined') return 'normal';
  const v = window.localStorage.getItem('theme_mode');
  return v === 'focus' || v === 'normal' ? v : 'normal';
}


function orderCommunityThread(comments: CommunityComment[]): Array<{ comment: CommunityComment; depth: number }> {
  const ids = new Set(comments.map((comment) => comment.id));
  const children = new Map<string, CommunityComment[]>();
  const roots: CommunityComment[] = [];
  const output: Array<{ comment: CommunityComment; depth: number }> = [];
  const visited = new Set<string>();
  const sortOldest = (a: CommunityComment, b: CommunityComment) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

  for (const comment of comments) {
    if (comment.parent_comment_id && ids.has(comment.parent_comment_id)) {
      const group = children.get(comment.parent_comment_id) || [];
      group.push(comment);
      children.set(comment.parent_comment_id, group);
    } else {
      roots.push(comment);
    }
  }
  const visit = (comment: CommunityComment, depth: number) => {
    if (visited.has(comment.id)) return;
    visited.add(comment.id);
    output.push({ comment, depth });
    for (const child of (children.get(comment.id) || []).sort(sortOldest)) visit(child, depth + 1);
  };
  roots.sort(sortOldest).forEach((comment) => visit(comment, 0));
  comments.forEach((comment) => visit(comment, 0));
  return output;
}

export default function CommunityPage() {
  const router = useRouter();
  const supabase = useMemo(createClient, []);
  const [user, setUser] = useState<any | null>(null);

  const [isPremium, setIsPremium] = useState(false);
  const [mod, setMod] = useState<ModerationState>({
    canComment: true,
    canReport: true,
    commentBlockedUntil: null,
    reportBlockedUntil: null,
  });

  const [loading, setLoading] = useState(true);

  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [orderBy, setOrderBy] = useState<'recent' | 'top'>('recent');

  const [feedFilter, setFeedFilter] = useState<'all' | 'my_comments'>('all');

  const [commentViewByPostId, setCommentViewByPostId] = useState<Record<string, 'all' | 'mine'>>({});

  const [newPost, setNewPost] = useState('');
  const [sendingPost, setSendingPost] = useState(false);
  const [hasPostedToday, setHasPostedToday] = useState(false);

  const [replyByPostId, setReplyByPostId] = useState<Record<string, string>>({});
  const [replyTargetByPostId, setReplyTargetByPostId] = useState<Record<string, string | null>>({});
  const handledDeepLink = useRef<string | null>(null);
  const [sendingReplyFor, setSendingReplyFor] = useState<string | null>(null);

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalInfo, setGlobalInfo] = useState<string | null>(null);

  const [themeMode, setThemeMode] = useState<'focus' | 'normal'>('normal');
  const [reloadFlag, setReloadFlag] = useState(0);

  // Community user blocks are stored per account; blocked authors disappear
  // from the feed and from comment threads without affecting other readers.
  useEffect(() => {
    let live = true;
    if (!user?.id) { setBlockedIds([]); return; }
    void supabase.from("community_blocks").select("blocked_id")
      .eq("blocker_id", user.id).then(({ data, error }: any) => {
        if (!live) return;
        if (error) console.warn("Não foi possível consultar bloqueios da comunidade.");
        else setBlockedIds((data || []).map((row: any) => String(row.blocked_id)));
      });
    return () => { live = false; };
  }, [user?.id, supabase]);

  async function blockAuthor(targetId: string | null) {
    if (!user?.id || !targetId || targetId === user.id || blockedIds.includes(targetId)) return;
    if (!window.confirm("Bloquear esta pessoa? As publicações e comentários dela deixarão de aparecer para você.")) return;
    const { error } = await supabase.from("community_blocks")
      .insert({ blocker_id: user.id, blocked_id: targetId });
    if (error && error.code !== "23505") {
      setGlobalError("Não foi possível bloquear. Tente novamente.");
      return;
    }
    setBlockedIds((previous) => previous.includes(targetId) ? previous : [...previous, targetId]);
    setGlobalInfo("Pessoa bloqueada. Você pode desbloquear em Gerenciar bloqueios.");
  }

  async function unblockAuthor(targetId: string) {
    if (!user?.id) return;
    const { error } = await supabase.from("community_blocks")
      .delete().eq("blocker_id", user.id).eq("blocked_id", targetId);
    if (error) { setGlobalError("Não foi possível desbloquear."); return; }
    setBlockedIds((previous) => previous.filter((id) => id !== targetId));
    setGlobalInfo("Pessoa desbloqueada.");
  }

  // ✅ novo: ícone equipado do usuário (para gravar junto no post/comentário)
  const [myIcon, setMyIcon] = useState<string>(DEFAULT_ICON);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: userResult } = await supabase.auth.getUser();
        const currentUser = userResult?.user ?? null;
        setUser(currentUser);

        // tema por padrão (sem depender do DB)
        setThemeMode(safeGetThemeModeFromStorage());

        if (currentUser) {
          // ✅ Perfil / premium / ícone / permissões de moderação (resiliente)
          let premium = false;
          let icon = DEFAULT_ICON;

          let canComment = true;
          let canReport = true;
          let commentBlockedUntil: string | null = null;
          let reportBlockedUntil: string | null = null;

          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();

          if (profileErr) {
            console.warn('Erro carregando profile (community):', profileErr);
          } else if (profile) {
            premium = !!(profile as any).is_premium;
            icon = String((profile as any).equipped_icon ?? DEFAULT_ICON) || DEFAULT_ICON;

            // moderação (quando existir no schema)
            if ((profile as any).can_comment === false) canComment = false;
            if ((profile as any).can_report === false) canReport = false;

            commentBlockedUntil = ((profile as any).comment_blocked_until ?? null) as any;
            reportBlockedUntil = ((profile as any).report_blocked_until ?? null) as any;

            const t = (profile as any)?.theme_mode;
            if (t === 'focus' || t === 'normal') {
              setThemeMode(t);
              if (typeof window !== 'undefined') {
                window.localStorage.setItem('theme_mode', t);
              }
            }
          }

          setIsPremium(premium);
          setMyIcon(icon || DEFAULT_ICON);
          setMod({
            canComment,
            canReport,
            commentBlockedUntil,
            reportBlockedUntil,
          });

          const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

          const { data: todaysPosts, error: todayErr } = await supabase
            .from('community_posts')
            .select('id')
            .eq('user_id', currentUser.id)
            .gte('created_at', last24Hours.toISOString());

          if (todayErr) {
            // silencioso (não quebra a página)
            console.warn('Erro checando posts de hoje:', todayErr);
          }

          setHasPostedToday((todaysPosts ?? []).length > 0);
        } else {
          setIsPremium(false);
          setHasPostedToday(false);
          setThemeMode(safeGetThemeModeFromStorage());
          setMyIcon(DEFAULT_ICON);
        }
      } catch (err) {
        console.warn('Erro fetchUser:', err);
        setThemeMode(safeGetThemeModeFromStorage());
        setMyIcon(DEFAULT_ICON);
      }
    };

    fetchUser();
  }, [supabase]);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      setGlobalError(null);

      try {
        // ✅ tenta carregar também author_icon; se não existir, faz fallback sem quebrar

        let postsData: any[] | null = null;

        // (Filtro) Meus comentários: pega os post_ids onde eu comentei
        let myPostIds: string[] | null = null;
        if (feedFilter === 'my_comments') {
          if (!user) {
            postsData = [];
          } else {
            const { data: myRows, error: myErr } = await supabase
              .from('community_comments')
              .select('post_id, created_at')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(300);

            if (myErr) {
              console.warn('Erro ao buscar meus comentários', myErr);
              myPostIds = [];
            } else {
              const seen = new Set<string>();
              const uniq: string[] = [];
              for (const r of myRows || []) {
                const pid = (r as any).post_id as string | undefined;
                if (pid && !seen.has(pid)) {
                  seen.add(pid);
                  uniq.push(pid);
                }
              }
              myPostIds = uniq;
            }

            if (!myPostIds || myPostIds.length === 0) {
              postsData = [];
            }
          }
        }

        // ✅ tenta carregar também author_icon; se não existir, faz fallback
        let postsQuery1 = supabase
          .from('community_posts')
          .select('id, user_id, content, created_at, status, author_icon')
          .order('created_at', { ascending: false });

        if (myPostIds && myPostIds.length > 0) {
          postsQuery1 = postsQuery1.in('id', myPostIds as any);
        }

        const try1 = await postsQuery1;

        if (!try1.error) {
          postsData = try1.data;
        } else {
          let postsQuery2 = supabase
            .from('community_posts')
            .select('id, user_id, content, created_at, status')
            .order('created_at', { ascending: false });

          if (myPostIds && myPostIds.length > 0) {
            postsQuery2 = postsQuery2.in('id', myPostIds as any);
          }

          const try2 = await postsQuery2;

          if (try2.error) {
            throw try2.error;
          }

          postsData = try2.data;
        }

let safePosts: CommunityPost[] = (postsData ?? []).filter(
          (p: any) => !p.status || p.status === 'published' || p.status === 'active'
        );

        if (!safePosts.length) {
          setPosts([]);
          setLoading(false);
          return;
        }

        const postIds = safePosts.map((p) => p.id);

        const { data: likesData, error: likesErr } = await supabase
          .from('community_likes')
          .select('id, post_id, user_id')
          .in('post_id', postIds);

        if (likesErr) console.warn('Erro carregando likes:', likesErr);

        const likeMap: Record<string, number> = {};
        const userLikeSet = new Set<string>();

        (likesData as CommunityLike[] | null)?.forEach((l) => {
          likeMap[l.post_id] = (likeMap[l.post_id] || 0) + 1;
          if (user && l.user_id === user.id) {
            userLikeSet.add(l.post_id);
          }
        });

        // ✅ tenta carregar também author_icon; se não existir, fallback
        let commentsData: any[] | null = null;

        const ctry1 = await supabase
          .from('community_comments')
          .select('id, post_id, parent_comment_id, user_id, content, created_at, status, author_icon')
          .in('post_id', postIds);

        if (ctry1.error) {
          const ctry2 = await supabase
            .from('community_comments')
            .select('id, post_id, parent_comment_id, user_id, content, created_at, status')
            .in('post_id', postIds);

          if (ctry2.error) {
            console.warn('Erro carregando comentários:', ctry2.error);
            commentsData = [];
          } else {
            commentsData = ctry2.data as any[];
          }
        } else {
          commentsData = ctry1.data as any[];
        }

        const allComments = (commentsData ?? []) as CommunityComment[];
        const commentIds = allComments.map((c) => c.id);

        const { data: postReports, error: postRepErr } = await supabase
          .from('community_reports')
          .select('post_id, status')
          .in('post_id', postIds)
          .not('post_id', 'is', null);

        if (postRepErr) console.warn('Erro carregando reports de post:', postRepErr);

        // ✅ FIX: evitar .in com array vazio (isso pode quebrar e derrubar o load)
        let commentReports: any[] = [];
        if (commentIds.length > 0) {
          const { data: commentReportsData, error: comRepErr } = await supabase
            .from('community_reports')
            .select('comment_id, status')
            .in('comment_id', commentIds)
            .not('comment_id', 'is', null);

          if (comRepErr) console.warn('Erro carregando reports de comment:', comRepErr);
          commentReports = commentReportsData ?? [];
        }

        const reportedPostIds = new Set(
          (postReports ?? [])
            .filter((r: any) => {
              const st = (r as any).status as string | null | undefined;
              return !st || st === 'open';
            })
            .map((r: any) => r.post_id as string | null)
            .filter(Boolean) as string[]
        );

        const reportedCommentIds = new Set(
          (commentReports ?? [])
            .filter((r: any) => {
              const st = (r as any).status as string | null | undefined;
              return !st || st === 'open';
            })
            .map((r: any) => r.comment_id as string | null)
            .filter(Boolean) as string[]
        );

        safePosts = safePosts.filter((p) => !reportedPostIds.has(p.id));

        const commentsByPost: Record<string, CommunityComment[]> = {};
        allComments.forEach((c) => {
          if (reportedCommentIds.has(c.id)) return;
          const cStatus = (c as any).status as string | undefined;
          if (cStatus && cStatus !== 'active' && cStatus !== 'published') return;
          if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
          commentsByPost[c.post_id].push(c);
        });

        const userCommentSet = new Set<string>();
        if (user) {
          allComments.forEach((c) => {
            if (c.user_id === user.id && !c.parent_comment_id) userCommentSet.add(c.post_id);
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
              if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
              return (
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              );
            });
        }

        setPosts(enriched);
      } catch (err: any) {
        console.warn('Erro loadAll:', err);
        setGlobalError('Erro ao carregar a comunidade.');
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [supabase, user, orderBy, feedFilter, reloadFlag]);


  useEffect(() => {
    if (loading || posts.length === 0 || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const postId = params.get("post");
    const commentId = params.get("comment");
    if (!postId) return;
    const key = postId + ":" + (commentId || "");
    if (handledDeepLink.current === key) return;
    handledDeepLink.current = key;
    setPosts((current) => current.map((post) =>
      post.id === postId ? { ...post, commentsOpen: true } : post
    ));
    const timer = window.setTimeout(() => {
      const target = (commentId ? document.getElementById("comment-" + commentId) : null) ||
        document.getElementById("post-" + postId);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [loading, posts.length]);

  function showInfo(msg: string) {
    setGlobalInfo(msg);
    setTimeout(() => setGlobalInfo(null), 3500);
  }

  const handleCreatePost = async () => {
    setGlobalError(null);

    if (!user) {
      setGlobalError('Faça login para publicar.');
      return;
    }
    if (!mod.canComment || isBlockedUntil(mod.commentBlockedUntil)) {
      setGlobalError('Sua conta está temporariamente impedida de publicar. Confira as regras da comunidade.');
      return;
    }
    if (hasPostedToday) {
      setGlobalError('Você já publicou nas últimas 24 horas.');
      return;
    }
    if (newPost.trim().length < 3 || newPost.trim().length > 2000) {
      setGlobalError('Escreva entre 3 e 2000 caracteres para publicar.');
      return;
    }
    if (hasProfanity(newPost)) {
      setGlobalError('O texto contém palavras bloqueadas.');
      return;
    }

    try {
      setSendingPost(true);

      // ✅ FIX: enviar campos que podem estar NOT NULL/sem default na tabela
      const payload: any = {
        user_id: user.id,
        content: newPost.trim(),
        status: 'published',
        is_premium_post: isPremium,
        likes: 0,
        author_icon: myIcon || DEFAULT_ICON,
      };

      let { error } = await supabase.from('community_posts').insert(payload);

      // fallback se a coluna author_icon não existir ainda
      if (error && /author_icon/i.test(error.message || '')) {
        delete payload.author_icon;
        ({ error } = await supabase.from('community_posts').insert(payload));
      }

      if (error) {
        console.warn('Erro insert community_posts:', error);
        setGlobalError(error.message || 'Erro ao publicar.');
        return;
      }

      setNewPost('');
      setHasPostedToday(true);
      showInfo('Post publicado!');
      setOrderBy('recent');
      setReloadFlag((v) => v + 1);
    } catch (err) {
      console.warn('Erro handleCreatePost:', err);
      setGlobalError('Erro inesperado.');
    } finally {
      setSendingPost(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    setGlobalError(null);

    if (!user) {
      setGlobalError('Faça login para curtir.');
      return;
    }

    try {
      const { data: existing, error: exErr } = await supabase
        .from('community_likes')
        .select('id')
        .eq('user_id', user.id)
        .eq('post_id', postId);

      if (exErr) {
        console.warn('Erro buscando like existente:', exErr);
        setGlobalError('Erro ao curtir/descurtir.');
        return;
      }

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
              ? {
                  ...p,
                  likeCount: Math.max(0, p.likeCount - 1), // ✅ FIX: não deixar negativo
                  userHasLiked: false,
                }
              : p
          )
        );
      } else {
        const { error: insErr } = await supabase.from('community_likes').insert({
          user_id: user.id,
          post_id: postId,
        });

        if (insErr) {
          console.warn('Erro inserindo like:', insErr);
          setGlobalError('Erro ao curtir/descurtir.');
          return;
        }

        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, likeCount: p.likeCount + 1, userHasLiked: true }
              : p
          )
        );
      }
    } catch (err) {
      console.warn('Erro handleToggleLike:', err);
      setGlobalError('Erro ao curtir/descurtir.');
    }
  };

  const handleSendReply = async (postId: string) => {
    setGlobalError(null);

    if (!user) {
      setGlobalError('Faça login para responder.');
      return;
    }

    const text = replyByPostId[postId]?.trim() || '';
    if (!text || text.length > 800) {
      setGlobalError('A resposta deve ter entre 1 e 800 caracteres.');
      return;
    }

        // bloqueio/ban de comentários (via profiles)
    if (!mod.canComment) {
      setGlobalError('Comentários desativados para sua conta.');
      return;
    }
    if (isBlockedUntil(mod.commentBlockedUntil)) {
      setGlobalError(`Comentários bloqueados até ${formatDateTimeBR(mod.commentBlockedUntil!)}`);
      return;
    }

    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const replyToCommentId = replyTargetByPostId[postId] || null;
    if (!replyToCommentId && post.userHasCommented) {
      setGlobalError('Você já respondeu esse post.');
      return;
    }

    if (hasProfanity(text)) {
      setGlobalError('A resposta contém palavras bloqueadas.');
      return;
    }

    try {
      setSendingReplyFor(postId);

      const payload: any = {
        post_id: postId,
        user_id: user.id,
        content: text,
        author_icon: myIcon || DEFAULT_ICON,
        parent_comment_id: replyToCommentId,
      };

      let ins = await supabase.from('community_comments').insert(payload).select('*').maybeSingle();

      // fallback se a coluna author_icon não existir ainda
      if (ins.error && /author_icon/i.test(ins.error.message || '')) {
        delete payload.author_icon;
        ins = await supabase.from('community_comments').insert(payload).select('*').maybeSingle();
      }

      if (ins.error || !ins.data) {
        console.warn('Erro insert community_comments:', ins.error);
        setGlobalError(ins.error?.message || 'Erro ao enviar resposta.');
        return;
      }

      const data = ins.data as any;

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                comments: [...p.comments, data],
                userHasCommented: replyToCommentId ? p.userHasCommented : true,
                commentsOpen: true,
              }
            : p
        )
      );

      setReplyByPostId((prev) => ({ ...prev, [postId]: '' }));
      setReplyTargetByPostId((prev) => ({ ...prev, [postId]: null }));
    } catch (err) {
      console.warn('Erro handleSendReply:', err);
      setGlobalError('Erro inesperado.');
    } finally {
      setSendingReplyFor(null);
    }
  };

  const handleReport = async (opts: { postId?: string; commentId?: string }) => {
    setGlobalError(null);

    if (!user) {
      setGlobalError('Faça login para denunciar.');
      return;
    }

    // bloqueio/ban de denúncias (via profiles)
    if (!mod.canReport) {
      setGlobalError('Denúncias desativadas para sua conta.');
      return;
    }
    if (isBlockedUntil(mod.reportBlockedUntil)) {
      setGlobalError(`Denúncias bloqueadas até ${formatDateTimeBR(mod.reportBlockedUntil!)}`);
      return;
    }

    const { postId, commentId } = opts;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todaysReports, error: repErr } = await supabase
        .from('community_reports')
        .select('id,created_at')
        .eq('user_id', user.id)
        .gte('created_at', today.toISOString());

      if (repErr) console.warn('Erro checando limite reports:', repErr);

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
      console.warn('Erro handleReport:', err);
      setGlobalError('Erro ao denunciar.');
    }
  };

  if (loading) {
    return <PageSkeleton label="Carregando comunidade" />;
  }

  return (
    <div
      className={`wr-screen wr-community-screen min-h-screen ${
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

            <h1 className="text-lg font-bold text-white sm:text-xl">
              Sua Comunidade
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {isPremium && (
              <div className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
                ⭐ Premium
              </div>
            )}
          </div>

        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="wr-community-main mx-auto max-w-6xl space-y-4 px-3 py-4 sm:px-6 sm:py-6">
        {/* Orientações acessíveis e discretas, sem ocupar a tela inteira */}
        <section className="wr-community-intro rounded-2xl border border-violet-300/15 bg-[#1b182e] px-4 py-3 text-white sm:p-5" aria-label="Sobre a comunidade">
          <h2 className="text-base font-bold sm:text-lg">Compartilhe no seu ritmo</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-300 sm:text-sm">
            Um espaço de apoio para trocar experiências sem exibir nomes no mural.
          </p>
          <details className="mt-2 text-xs text-slate-300">
            <summary className="cursor-pointer py-1 font-semibold text-violet-200 hover:text-white">
              Regras e orientações
            </summary>
            <ul className="mt-2 space-y-1.5 border-t border-white/10 pt-3 leading-relaxed">
              <li>• Respeito sempre, sem exceção.</li>
              <li>• Não publique ofertas, pedidos de compra, venda ou entrega de cannabis ou outras substâncias controladas.</li>
              <li>• Não compartilhe dados pessoais de terceiros, ameaças, discurso de ódio ou instruções de autolesão.</li>
              <li>• Use as opções de denúncia e bloqueio se encontrar conteúdo inadequado. A moderação pode remover conteúdo e restringir contas.</li>
              <li>• Conteúdo ofensivo ou explícito é removido.</li>
              <li>• Nomes não são exibidos; identificadores técnicos são mantidos para segurança e moderação.</li>
              <li>• Publicar e responder é gratuito para contas autenticadas, respeitando os limites de segurança e moderação.</li>
            </ul>
          </details>
        </section>

        {blockedIds.length > 0 && (
          <details className="rounded-xl border border-white/10 bg-white/[.04] p-3 text-xs text-slate-200">
            <summary className="cursor-pointer font-semibold text-violet-200">Gerenciar bloqueios ({blockedIds.length})</summary>
            <p className="mt-2 text-slate-400">Contas bloqueadas não aparecem no seu mural. Para sua privacidade, exibimos apenas uma referência curta.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {blockedIds.map((id, index) => (
                <button key={id} type="button" onClick={() => void unblockAuthor(id)}
                  className="min-h-10 rounded-xl border border-white/15 px-3 text-xs font-semibold text-violet-200 hover:bg-white/10">
                  Desbloquear pessoa {index + 1}
                </button>
              ))}
            </div>
          </details>
        )}
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
        <div className="rounded-2xl border border-white/10 bg-[#1a192d] p-4 shadow-sm space-y-3 sm:p-5">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Deixe uma mensagem motivacional ou um desabafo para a comunidade.
          </p>

          <textarea
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 outline-none"
            placeholder={
              !user
                ? 'Faça login para publicar...'
                : hasPostedToday
                ? 'Você já publicou nas últimas 24 horas.'
                : 'Escreva algo que você gostaria de ler num dia difícil...'
            }
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            disabled={!user || hasPostedToday || !mod.canComment || isBlockedUntil(mod.commentBlockedUntil)}
            rows={3}
            maxLength={2000}
            aria-label="Escrever publicação na comunidade"
          />

          <button
            onClick={handleCreatePost}
            disabled={
              !user || hasPostedToday || sendingPost || newPost.trim().length < 3 || !mod.canComment || isBlockedUntil(mod.commentBlockedUntil)
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


            <button
              className={`px-4 py-1.5 rounded-full ${
                feedFilter === 'my_comments'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 dark:text-gray-300'
              } ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => {
                if (!user) return;
                setFeedFilter((prev) => (prev === 'my_comments' ? 'all' : 'my_comments'));
              }}
              title={!user ? 'Faça login para usar este filtro' : 'Mostrar posts onde você comentou'}
            >
              Meus comentários
            </button>
          </div>
        </div>

        {/* LISTA DE POSTS */}
        <div className="space-y-5 pb-10">
          {posts.filter((post) => !post.user_id || !blockedIds.includes(post.user_id)).length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 text-sm py-10">
              {feedFilter === 'my_comments'
                ? 'Você ainda não comentou em nenhuma postagem ainda. Comente em algum post e ele vai aparecer aqui.'
                : 'Ainda não há postagens. Seja o primeiro a deixar uma mensagem! 💬'}
            </p>
          )}

          {posts.filter((post) => !post.user_id || !blockedIds.includes(post.user_id)).map((post) => {
            const postIcon = resolveIcon(post.author_icon);

            return (
              <div
                key={post.id}
                id={`post-${post.id}`}
                className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                      {isAvatarId(postIcon) ? (
                        <img
                          src={avatarSrc(postIcon)}
                          alt={`Avatar ${postIcon}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-base">{postIcon}</span>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        Membro (nome oculto)
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(post.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {user && post.user_id && post.user_id !== user.id && (
                      <button type="button" onClick={() => void blockAuthor(post.user_id)}
                        title="Bloquear pessoa" aria-label="Bloquear autor desta publicação"
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs text-rose-300 hover:bg-rose-400/10">
                        <UserX className="h-3.5 w-3.5" aria-hidden="true"/> Bloquear
                      </button>
                    )}
                    <button
                    onClick={() => handleReport({ postId: post.id })}
                    disabled={!user || !mod.canReport || isBlockedUntil(mod.reportBlockedUntil)}
                    title={
                      !user
                        ? 'Faça login para denunciar'
                        : !mod.canReport
                        ? 'Denúncias desativadas para sua conta'
                        : isBlockedUntil(mod.reportBlockedUntil)
                        ? `Denúncias bloqueadas até ${formatDateTimeBR(mod.reportBlockedUntil!)}`
                        : 'Denunciar'
                    }
                    className={`flex items-center gap-1 text-xs ${
                      !user || !mod.canReport || isBlockedUntil(mod.reportBlockedUntil)
                        ? 'text-gray-500 opacity-60 cursor-not-allowed'
                        : 'text-gray-400 hover:text-red-500'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Denunciar
                  </button>
                  </div>
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
                        post.userHasLiked ? 'fill-pink-500 text-pink-500' : ''
                      }`}
                    />
                    {post.likeCount}
                  </button>

                  <button
                    onClick={() =>
                      setPosts((prev) =>
                        prev.map((p) =>
                          p.id === post.id ? { ...p, commentsOpen: !p.commentsOpen } : p
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
                    {replyTargetByPostId[post.id] && (
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-violet-400/30 bg-violet-400/10 px-3 py-2 text-xs text-violet-100">
                        <span>Respondendo a um comentário</span>
                        <button type="button" className="font-semibold text-violet-200 underline underline-offset-2" onClick={() => setReplyTargetByPostId((prev) => ({ ...prev, [post.id]: null }))}>Cancelar</button>
                      </div>
                    )}
                    <textarea
                      id={"comment-reply-input-" + post.id}
                      value={replyByPostId[post.id] || ''}
                      aria-label="Escrever resposta à publicação"
                      maxLength={800}
                      onChange={(e) =>
                        setReplyByPostId((prev) => ({
                          ...prev,
                          [post.id]: e.target.value,
                        }))
                      }
                      disabled={!user || (post.userHasCommented && !replyTargetByPostId[post.id]) || !mod.canComment || isBlockedUntil(mod.commentBlockedUntil)}
                      placeholder={
                        !user
                          ? 'Faça login para responder'
                          : !mod.canComment
                          ? 'Comentários desativados para sua conta'
                          : isBlockedUntil(mod.commentBlockedUntil)
                          ? `Comentários bloqueados até ${formatDateTimeBR(mod.commentBlockedUntil!)}`
                          : post.userHasCommented && !replyTargetByPostId[post.id]
                          ? 'Você já respondeu este post'
                          : 'Escreva uma resposta...'
                      }
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-xs text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50"
                    />

                    <div className="flex justify-end">
                      <button
                        onClick={() => handleSendReply(post.id)}
                        disabled={
                          !user ||
                          !mod.canComment ||
                          isBlockedUntil(mod.commentBlockedUntil) ||
                          (post.userHasCommented && !replyTargetByPostId[post.id]) ||
                          !replyByPostId[post.id]?.trim() ||
                          sendingReplyFor === post.id
                        }
                        className="px-4 py-2 bg-purple-600 text-white rounded-full text-xs hover:bg-purple-700 disabled:opacity-50"
                      >
                        {sendingReplyFor === post.id ? 'Enviando...' : 'Responder'}
                      </button>
                    </div>

                    <div className="space-y-2">
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          className={`px-3 py-1 rounded-full border ${
                            (commentViewByPostId[post.id] || 'all') === 'all'
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                          }`}
                          onClick={() =>
                            setCommentViewByPostId((prev) => ({
                              ...prev,
                              [post.id]: 'all',
                            }))
                          }
                        >
                          Todos
                        </button>

                        <button
                          className={`px-3 py-1 rounded-full border ${
                            (commentViewByPostId[post.id] || 'all') === 'mine'
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                          } ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={() => {
                            if (!user) return;
                            setCommentViewByPostId((prev) => ({
                              ...prev,
                              [post.id]: 'mine',
                            }));
                          }}
                          title={!user ? 'Faça login para filtrar' : 'Ver apenas meus comentários'}
                        >
                          Meus
                        </button>
                      </div>

                      {(commentViewByPostId[post.id] || 'all') === 'mine' && (
                        <span className="text-xs text-purple-700 dark:text-purple-300">
                          Filtrando: meus comentários
                        </span>
                      )}
                    </div>

                    {(() => {
                      const view = commentViewByPostId[post.id] || 'all';
                      const visible =
                        view === 'mine' && user
                          ? post.comments.filter((c) =>
                              (!c.user_id || !blockedIds.includes(c.user_id)) && (c.user_id === user.id ||
                              (!!c.parent_comment_id && post.comments.some((p) => p.id === c.parent_comment_id && p.user_id === user.id))))
                          : post.comments.filter((c) => !c.user_id || !blockedIds.includes(c.user_id));
                      const ordered = orderCommunityThread(visible);

                      if (visible.length === 0) {
                        return (
                          <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                            {view === 'mine'
                              ? 'Você ainda não comentou aqui.'
                              : 'Nenhum comentário ainda.'}
                          </div>
                        );
                      }

                      return (
                        <div className="mt-3 space-y-2">
                          {ordered.map(({ comment, depth }) => {
                            const cIcon = resolveIcon(comment.author_icon);
                          
                            return (
                              <div
                                key={comment.id}
                                id={"comment-" + comment.id}
                                className={"scroll-mt-32 rounded-xl border border-white/10 bg-violet-400/[.08] px-4 py-3 text-xs " + (depth > 0 ? "ml-4 border-l-2 border-l-violet-400/40 sm:ml-8" : "")}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-white/70 dark:bg-black/30 flex items-center justify-center overflow-hidden">
                                      {isAvatarId(cIcon) ? (
                                        <img
                                          src={avatarSrc(cIcon)}
                                          alt={cIcon}
                                          className="h-6 w-6 object-cover"
                                          loading="lazy"
                                        />
                                      ) : (
                                        <span className="text-sm">{cIcon}</span>
                                      )}
                                    </span>
                                    <span>{comment.parent_comment_id ? 'Resposta ao comentário' : 'Resposta sem nome'}</span>
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {user && comment.user_id && user.id !== comment.user_id && (
                                      <button type="button" onClick={() => void blockAuthor(comment.user_id)}
                                        title="Bloquear pessoa" aria-label="Bloquear autor deste comentário"
                                        className="inline-flex min-h-8 items-center gap-1 rounded-lg px-1.5 text-[10px] text-rose-300 hover:bg-rose-400/10">
                                        <UserX className="h-3 w-3" aria-hidden="true"/> Bloquear
                                      </button>
                                    )}
                                    <button
                                    onClick={() => handleReport({ commentId: comment.id })}
                                    disabled={!user || !mod.canReport || isBlockedUntil(mod.reportBlockedUntil)}
                                    title={
                                      !user
                                        ? 'Faça login para denunciar'
                                        : !mod.canReport
                                        ? 'Denúncias desativadas para sua conta'
                                        : isBlockedUntil(mod.reportBlockedUntil)
                                        ? `Denúncias bloqueadas até ${formatDateTimeBR(mod.reportBlockedUntil!)}`
                                        : 'Denunciar'
                                    }
                                    className={`text-[10px] flex gap-1 ${
                                      !user || !mod.canReport || isBlockedUntil(mod.reportBlockedUntil)
                                        ? 'text-gray-400 opacity-60 cursor-not-allowed'
                                        : 'text-red-500 hover:text-red-400'
                                    }`}
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                    Denunciar
                                  </button>
                                  </div>
                                </div>
                          
                                <p className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                                  {comment.content}
                                </p>
                          
                                <div className="mt-2 flex items-center justify-between gap-3">
                                  <span className="text-[10px] text-gray-400">{formatDate(comment.created_at)}</span>
                                  <button
                                    type="button"
                                    disabled={!user || !mod.canComment || isBlockedUntil(mod.commentBlockedUntil)}
                                    className="rounded-lg px-2 py-1 text-[11px] font-semibold text-violet-200 hover:bg-violet-300/10 disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={() => {
                                      setReplyTargetByPostId((prev) => ({ ...prev, [post.id]: comment.id }));
                                      setReplyByPostId((prev) => ({ ...prev, [post.id]: '' }));
                                      document.getElementById("comment-reply-input-" + post.id)?.focus();
                                    }}
                                  >Responder</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
