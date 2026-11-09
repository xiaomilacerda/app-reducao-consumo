"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, MessageCircle, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type Notice = {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  type: string | null;
  created_at: string;
  is_read: boolean;
  content?: string | null;
};

function uniqueNotices(rows: Notice[]) {
  const grouped = new Map<string, Notice>();
  for (const notice of rows) {
    const key = notice.comment_id || notice.id;
    const old = grouped.get(key);
    if (!old) grouped.set(key, notice);
    else if (!notice.is_read) grouped.set(key, { ...old, is_read: false });
  }
  return Array.from(grouped.values());
}

export default function NotificationBell() {
  const client = getSupabaseClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void client.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id || null);
    }).catch(() => { if (active) setUserId(null); });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setUserId(session?.user.id || null);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [client]);

  const refresh = useCallback(async (showLoading = false) => {
    if (!userId) return;
    if (showLoading) setLoading(true);
    try {
      const { data, error: queryError } = await client
        .from("community_notifications")
        .select("id,post_id,comment_id,type,created_at,is_read")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(75);
      if (queryError) throw queryError;
      const rows = uniqueNotices((data || []) as Notice[]);
      const ids = rows.map((row) => row.comment_id).filter(Boolean) as string[];
      if (ids.length) {
        const { data: comments } = await client.from("community_comments")
          .select("id,content").in("id", ids);
        const map = new Map((comments || []).map((row: any) => [row.id, row.content]));
        rows.forEach((row) => { row.content = map.get(row.comment_id || "") || null; });
      }
      setNotices(rows);
      setError(null);
    } catch (cause) {
      console.warn("Falha ao consultar notificações", cause);
      setError("Não foi possível atualizar os avisos.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [client, userId]);

  useEffect(() => {
    setNotices([]);
    setOpen(false);
    if (!userId) return;
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 20000);
    const focus = () => { void refresh(); };
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [userId, refresh]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (!userId) return null;
  const unread = notices.filter((n) => !n.is_read).length;

  async function markRead(item: Notice) {
    if (!userId) return;
    const now = new Date().toISOString();
    let query = client.from("community_notifications")
      .update({ is_read: true, read_at: now }).eq("user_id", userId);
    query = item.comment_id ? query.eq("comment_id", item.comment_id) : query.eq("id", item.id);
    const { error: mutationError } = await query;
    if (mutationError) { setError("Não foi possível marcar como lida."); return; }
    setNotices((previous) => previous.map((n) =>
      (item.comment_id ? n.comment_id === item.comment_id : n.id === item.id)
        ? { ...n, is_read: true } : n
    ));
  }

  async function markAllRead() {
    if (!userId) return;
    const { error: mutationError } = await client.from("community_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", userId).eq("is_read", false);
    if (mutationError) { setError("Não foi possível marcar todos como lidos."); return; }
    setNotices((previous) => previous.map((n) => ({ ...n, is_read: true })));
  }

  return (
    <div ref={container} className="relative">
      <button type="button" aria-haspopup="dialog" aria-expanded={open}
        aria-label={unread ? "Notificações não lidas: " + unread : "Abrir notificações"}
        onClick={() => { setOpen((value) => !value); void refresh(true); }}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-violet-300/20 bg-white/5 text-violet-100 hover:bg-violet-400/15">
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-400 px-1 text-[10px] font-bold text-[#160e2b]">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Notificações da comunidade"
          className="absolute right-0 top-full z-[70] mt-2 w-[min(390px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-violet-300/20 bg-[#19152d] shadow-[0_28px_90px_rgba(0,0,0,.6)]">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <div><h2 className="text-sm font-semibold text-white">Notificações</h2><p className="text-[11px] text-[#c5bed8]">{unread ? unread + " não lidas" : "Tudo em dia"}</p></div>
            <div className="flex items-center gap-1">
              {unread > 0 && <button type="button" onClick={() => { void markAllRead(); }} className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs text-violet-200 hover:bg-white/10"><CheckCheck className="h-4 w-4" /> Ler tudo</button>}
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10"><X className="h-4 w-4" /></button>
            </div>
          </div>
          {error && <p role="alert" className="px-4 py-2 text-xs text-rose-200">{error}</p>}
          <div className="max-h-[min(430px,65dvh)] overflow-y-auto">
            {loading && notices.length === 0 ? <p className="px-4 py-6 text-sm text-[#c5bed8]">Carregando...</p> :
             notices.length === 0 ? <p className="px-4 py-8 text-center text-sm text-[#c5bed8]">Nenhuma notificação ainda.</p> :
             <ul className="divide-y divide-white/10">{notices.map((item) => (
               <li key={item.id}><button type="button"
                 onClick={async () => {
                   if (!item.is_read) await markRead(item);
                   setOpen(false);
                   if (item.post_id) window.location.assign("/community?post=" + encodeURIComponent(item.post_id) + (item.comment_id ? "&comment=" + encodeURIComponent(item.comment_id) : ""));
                 }}
                 className={"flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-violet-400/10 " + (!item.is_read ? "bg-violet-400/10" : "")}>
                 <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                 <span className="min-w-0 flex-1">
                   <span className="block text-sm font-semibold text-white">{item.type === "reply_to_comment" ? "Responderam ao seu comentário" : "Comentaram sua publicação"}</span>
                   {item.content && <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-[#cec8e0]">{item.content}</span>}
                   <span className="mt-2 block text-[11px] text-[#a8a0bd]">{new Date(item.created_at).toLocaleString("pt-BR")}</span>
                 </span>
                 {!item.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-300" aria-label="Não lida" />}
               </button></li>
             ))}</ul>}
          </div>
        </div>
      )}
    </div>
  );
}
