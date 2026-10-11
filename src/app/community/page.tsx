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
  Bell,
  CheckCheck,
  X,
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

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


type CommunityNotification = {
  id: string;
  user_id: string;
  post_id: string;
  comment_id: string | null;
  actor_id: string | null;
  created_at: string;
  is_read: boolean;
  read_at: string | null;

  // preenchido no client (fallback quando não dá join)
  post_content?: string | null;
  comment_content?: string | null;
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

function safeGetThemeModeFromStorage(): 'focus' | 'normal' {
  if (typeof window === 'undefined') return 'normal';
  const v = window.localStorage.getItem('theme_mode');
  return v === 'focus' || v === 'normal' ? v : 'normal';
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
  const [orderBy, setOrderBy] = useState<'recent' | 'top'>('recent');

  const [feedFilter, setFeedFilter] = useState<'all' | 'my_comments'>('all');

  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxItems, setInboxItems] = useState<CommunityNotification[]>([]);
  const [inboxUnread, setInboxUnread] = useState(0);

  const [commentViewByPostId, setCommentViewByPostId] = useState<Record<string, 'all' | 'mine'>>({});

  const [newPost, setNewPost] = useState('');
  const [sendingPost, setSendingPost] = useState(false);
  const [hasPostedToday, setHasPostedToday] = useState(false);

  const [replyByPostId, setReplyByPostId] = useState<Record<string, string>>({});
  const [sendingReplyFor, setSendingReplyFor] = useState<string | null>(null);

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalInfo, setGlobalInfo] = useState<string | null>(null);

  const [themeMode, setThemeMode] = useState<'focus' | 'normal'>('normal');
  const [reloadFlag, setReloadFlag] = useState(0);

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

          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);

          const { data: todaysPosts, error: todayErr } = await supabase
            .from('community_posts')
            .select('id')
            .eq('user_id', currentUser.id)
            .gte('created_at', startOfDay.toISOString());

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
          .select('id, post_id, user_id, content, created_at, status, author_icon')
          .in('post_id', postIds);

        if (ctry1.error) {
          const ctry2 = await supabase
            .from('community_comments')
            .select('id, post_id, user_id, content, created_at, status')
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

  const loadInbox = async (silent = false) => {
    if (!user) return;

    if (!silent) setInboxLoading(true);

    try {
      // Tenta fazer join direto (funciona se existirem relacionamentos / FK reconhecidos pelo PostgREST)
      const j = await supabase
        .from('community_notifications')
        .select(
          'id, user_id, post_id, comment_id, actor_id, created_at, is_read, read_at, post:community_posts(content), comment:community_comments(content)'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      let rows: any[] = [];

      if (!j.error) {
        rows = (j.data || []).map((r: any) => ({
          id: r.id,
          user_id: r.user_id,
          post_id: r.post_id,
          comment_id: r.comment_id ?? null,
          actor_id: r.actor_id ?? null,
          created_at: r.created_at,
          is_read: !!r.is_read,
          read_at: r.read_at ?? null,
          post_content: r.post?.content ?? null,
          comment_content: r.comment?.content ?? null,
        }));
      } else {
        // Fallback sem join
        const b = await supabase
          .from('community_notifications')
          .select('id, user_id, post_id, comment_id, actor_id, created_at, is_read, read_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (b.error) throw b.error;

        rows = (b.data || []).map((r: any) => ({
          id: r.id,
          user_id: r.user_id,
          post_id: r.post_id,
          comment_id: r.comment_id ?? null,
          actor_id: r.actor_id ?? null,
          created_at: r.created_at,
          is_read: !!r.is_read,
          read_at: r.read_at ?? null,
          post_content: null,
          comment_content: null,
        }));

        const postIds = Array.from(new Set(rows.map((r) => r.post_id).filter(Boolean)));
        const commentIds = Array.from(new Set(rows.map((r) => r.comment_id).filter(Boolean)));

        if (postIds.length > 0) {
          const p = await supabase.from('community_posts').select('id, content').in('id', postIds as any);
          if (!p.error && p.data) {
            const map: Record<string, string> = {};
            for (const it of p.data as any[]) map[it.id] = it.content;
            rows = rows.map((r) => ({ ...r, post_content: map[r.post_id] ?? r.post_content }));
          }
        }

        if (commentIds.length > 0) {
          const c = await supabase.from('community_comments').select('id, content').in('id', commentIds as any);
          if (!c.error && c.data) {
            const map: Record<string, string> = {};
            for (const it of c.data as any[]) map[it.id] = it.content;
            rows = rows.map((r) => ({ ...r, comment_content: map[r.comment_id] ?? r.comment_content }));
          }
        }
      }

      setInboxItems(rows as any);
      setInboxUnread((rows || []).filter((r: any) => !r.is_read).length);
    } catch (e) {
      console.warn('Erro ao carregar inbox', e);
    } finally {
      if (!silent) setInboxLoading(false);
    }
  };

  const markAllInboxAsRead = async () => {
    if (!user) return;

    try {
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from('community_notifications')
        .update({ is_read: true, read_at: nowIso })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setInboxItems((prev) =>
        prev.map((n) => (n.is_read ? n : { ...n, is_read: true, read_at: nowIso }))
      );
      setInboxUnread(0);
    } catch (e) {
      console.warn('Erro ao marcar tudo como lido', e);
    }
  };

  const openNotification = async (n: CommunityNotification) => {
    // Marca como lida (se necessário)
    try {
      if (!n.is_read && user) {
        const nowIso = new Date().toISOString();
        const { error } = await supabase
          .from('community_notifications')
          .update({ is_read: true, read_at: nowIso })
          .eq('id', n.id)
          .eq('user_id', user.id);

        if (!error) {
          setInboxItems((prev) =>
            prev.map((x) => (x.id === n.id ? { ...x, is_read: true, read_at: nowIso } : x))
          );
          setInboxUnread((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (e) {
      // não bloquear navegação por isso
    }

    setInboxOpen(false);

    // Abre o post e scrolla
    try {
      setPosts((prev) =>
        prev.map((p) => (p.id === n.post_id ? { ...p, commentsOpen: true } : p))
      );

      setTimeout(() => {
        const el = document.getElementById(`post-${n.post_id}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch {}
  };

  useEffect(() => {
    if (!user) {
      setInboxItems([]);
      setInboxUnread(0);
      return;
    }

    loadInbox(true);

    const t = setInterval(() => {
      loadInbox(true);
    }, 25000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    if (inboxOpen) loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboxOpen, user?.id]);


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

      // ✅ FIX: enviar campos que podem estar NOT NULL/sem default na tabela
      const payload: any = {
        user_id: user.id,
        content: newPost.trim(),
        status: 'published',
        is_premium_post: true,
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
    if (!text) return;

    if (!isPremium) {
      setGlobalError('Apenas membros Premium podem responder.');
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

      const payload: any = {
        post_id: postId,
        user_id: user.id,
        content: text,
        author_icon: myIcon || DEFAULT_ICON,
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
                userHasCommented: true,
                commentsOpen: true,
              }
            : p
        )
      );

      setReplyByPostId((prev) => ({ ...prev, [postId]: '' }));
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

          <div className="flex items-center gap-3">
            {user && (
              <div className="relative">
                <button
                  className="relative px-3 py-2 rounded-full bg-white/70 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-900 transition"
                  onClick={() => {
                    setInboxOpen((v) => !v);
                  }}
                  title="Notificações"
                >
                  <Bell className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                  {inboxUnread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-purple-600 text-white text-[11px] font-bold flex items-center justify-center">
                      {inboxUnread > 99 ? '99+' : inboxUnread}
                    </span>
                  )}
                </button>

                {inboxOpen && (
                  <div className="absolute right-0 mt-2 w-[92vw] max-w-[440px] z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                          Notificações
                        </span>
                        {inboxUnread > 0 && (
                          <span className="text-xs text-purple-700 dark:text-purple-300">
                            ({inboxUnread} não lidas)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                          onClick={async () => {
                            await markAllInboxAsRead();
                          }}
                          disabled={inboxItems.length === 0 || inboxUnread === 0}
                          title="Marcar todas como lidas"
                        >
                          <CheckCheck className="w-4 h-4 inline-block -mt-[2px] mr-1" />
                          Ler tudo
                        </button>

                        <button
                          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                          onClick={() => setInboxOpen(false)}
                          title="Fechar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[360px] overflow-auto">
                      {inboxLoading ? (
                        <div className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                          Carregando...
                        </div>
                      ) : inboxItems.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                          Nenhuma notificação ainda.
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                          {inboxItems.map((n) => (
                            <button
                              key={n.id}
                              className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition ${
                                !n.is_read ? 'bg-purple-50/50 dark:bg-purple-900/20' : ''
                              }`}
                              onClick={async () => {
                                await openNotification(n);
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`mt-1 w-2 h-2 rounded-full ${!n.is_read ? 'bg-purple-600' : 'bg-transparent'}`} />
                                <div className="flex-1">
                                  <div className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                                    <span className="font-semibold">Novo comentário</span>{' '}
                                    em uma publicação sua
                                  </div>

                                  {n.comment_content && (
                                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                                      “{n.comment_content}”
                                    </div>
                                  )}

                                  <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                                    {new Date(n.created_at).toLocaleString('pt-BR')}
                                  </div>
                                </div>

                                <div className="text-[11px] text-purple-700 dark:text-purple-300">
                                  Ver
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isPremium && (
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-white font-semibold">
                ⭐ Premium
              </div>
            )}
          </div>

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
          {posts.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 text-sm py-10">
              {feedFilter === 'my_comments'
                ? 'Você ainda não comentou em nenhuma postagem ainda. Comente em algum post e ele vai aparecer aqui.'
                : 'Ainda não há postagens. Seja o primeiro a deixar uma mensagem! 💬'}
            </p>
          )}

          {posts.map((post) => {
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
                        Anônimo
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(post.created_at)}
                      </p>
                    </div>
                  </div>

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
                    <textarea
                      value={replyByPostId[post.id] || ''}
                      onChange={(e) =>
                        setReplyByPostId((prev) => ({
                          ...prev,
                          [post.id]: e.target.value,
                        }))
                      }
                      disabled={!user || !isPremium || post.userHasCommented || !mod.canComment || isBlockedUntil(mod.commentBlockedUntil)}
                      placeholder={
                        !user
                          ? 'Faça login para responder'
                          : !isPremium
                          ? 'Resposta permitida apenas para Premium'
                          : !mod.canComment
                          ? 'Comentários desativados para sua conta'
                          : isBlockedUntil(mod.commentBlockedUntil)
                          ? `Comentários bloqueados até ${formatDateTimeBR(mod.commentBlockedUntil!)}`
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
                          !mod.canComment ||
                          isBlockedUntil(mod.commentBlockedUntil) ||
                          post.userHasCommented ||
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
                          ? post.comments.filter((c) => c.user_id === user.id)
                          : post.comments;

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
                          {visible.map((comment) => {
                            const cIcon = resolveIcon(comment.author_icon);
                          
                            return (
                              <div
                                key={comment.id}
                                className="bg-purple-50 dark:bg-purple-900/20 px-4 py-3 rounded-xl text-xs"
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
                                    <span>Resposta anônima</span>
                                  </span>
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
                          
                                <p className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                                  {comment.content}
                                </p>
                          
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                  {formatDate(comment.created_at)}
                                </span>
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
