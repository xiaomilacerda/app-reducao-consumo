'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  RefreshCw,
  UserCog,
  ShieldCheck,
  Shield,
  Crown,
  UserX,
  Save,
  X,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '../_lib/supabase';

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

export default function AdminUsersPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);

  const [editing, setEditing] = useState<Profile | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Profile>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // basic list; filter by query if provided
      const q = query.trim();
      let req = supabase
        .from('profiles')
        .select('id,email,display_name,timezone,is_admin,is_premium,can_report,can_comment,report_blocked_until,comment_blocked_until,created_at,updated_at')
        .order('updated_at', { ascending: false })
        .limit(200);

      if (q) {
        // Try exact id; else email contains
        const isUuid = q.length >= 32 && q.includes('-');
        if (isUuid) req = req.eq('id', q);
        else req = req.ilike('email', q.includes('%') ? q : `%${q}%`);
      }

      const res = await req;
      if (res.error) throw res.error;

      setUsers((res.data as any[]) || []);
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEdit(u: Profile) {
    setEditing(u);
    setEditDraft({
      display_name: u.display_name ?? '',
      email: u.email ?? '',
      timezone: u.timezone ?? '',
      is_admin: Boolean(u.is_admin),
      is_premium: Boolean(u.is_premium),
      can_report: u.can_report ?? true,
      can_comment: u.can_comment ?? true,
      report_blocked_until: u.report_blocked_until ?? '',
      comment_blocked_until: u.comment_blocked_until ?? '',
    });
  }

  function closeEdit() {
    setEditing(null);
    setEditDraft({});
  }

  async function saveEdit() {
    if (!editing) return;
    setBusyId(editing.id);
    setError(null);
    try {
      const payload: any = {
        display_name: editDraft.display_name ?? null,
        email: editDraft.email ?? null,
        timezone: editDraft.timezone ?? null,
        is_admin: Boolean(editDraft.is_admin),
        is_premium: Boolean(editDraft.is_premium),
        can_report: editDraft.can_report ?? null,
        can_comment: editDraft.can_comment ?? null,
        report_blocked_until: editDraft.report_blocked_until ? editDraft.report_blocked_until : null,
        comment_blocked_until: editDraft.comment_blocked_until ? editDraft.comment_blocked_until : null,
        updated_at: new Date().toISOString(),
      };

      const res = await supabase.from('profiles').update(payload).eq('id', editing.id);
      if (res.error) throw res.error;

      await load();
      closeEdit();
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar.');
    } finally {
      setBusyId(null);
    }
  }

  async function quickToggle(userId: string, field: 'is_admin' | 'is_premium', next: boolean) {
    setBusyId(userId);
    setError(null);
    try {
      const res = await supabase.from('profiles').update({ [field]: next, updated_at: new Date().toISOString() } as any).eq('id', userId);
      if (res.error) throw res.error;
      await load();
    } catch (e: any) {
      setError(e?.message || 'Erro ao atualizar.');
    } finally {
      setBusyId(null);
    }
  }

  async function block(userId: string, kind: 'report' | 'comment', days: number | 'permanent') {
    setBusyId(userId);
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
        if (!res.error) { ok = true; break; }
      }
      if (!ok) throw new Error('Não consegui atualizar (colunas/RLS).');

      await load();
    } catch (e: any) {
      setError(e?.message || 'Erro ao aplicar bloqueio.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Usuários</h1>
          <p className="mt-1 text-sm text-slate-400">
            Busca por e-mail/ID, edição completa de perfil, premium/admin e bloqueios de comentar/denunciar.
          </p>
        </div>

        <div className="flex flex-1 items-center gap-2 sm:max-w-xl">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por e-mail (ex.: @gmail.com) ou UUID"
              className="w-full rounded-xl border border-slate-700 bg-slate-950/60 pl-9 pr-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
            disabled={loading}
          >
            <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} />
            Buscar
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 text-rose-200">
          {error}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-slate-900/40 text-slate-300">
              <tr>
                <th className="px-4 py-3 text-left">Usuário (e-mail)</th>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Premium</th>
                <th className="px-4 py-3 text-left">Admin</th>
                <th className="px-4 py-3 text-left">Permissões</th>
                <th className="px-4 py-3 text-left">Atualizado</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-slate-950/30">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-slate-300">
                    Carregando…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-slate-300">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const busy = busyId === u.id;
                  return (
                    <tr key={u.id} className="border-t border-slate-900">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{u.email || u.id}</div>
                        <div className="text-xs text-slate-500">{u.id}</div>
                      </td>
                      <td className="px-4 py-3">{u.display_name || '—'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => quickToggle(u.id, 'is_premium', !u.is_premium)}
                          disabled={busy}
                          className={cx(
                            'inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs',
                            u.is_premium
                              ? 'border-amber-600/40 bg-amber-900/20 text-amber-200'
                              : 'border-slate-800 bg-slate-900/20 text-slate-300 hover:bg-slate-900/35'
                          )}
                        >
                          <Crown className="h-3.5 w-3.5" />
                          {u.is_premium ? 'Premium' : 'Free'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => quickToggle(u.id, 'is_admin', !u.is_admin)}
                          disabled={busy}
                          className={cx(
                            'inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs',
                            u.is_admin
                              ? 'border-indigo-500/40 bg-indigo-700/15 text-indigo-200'
                              : 'border-slate-800 bg-slate-900/20 text-slate-300 hover:bg-slate-900/35'
                          )}
                        >
                          {u.is_admin ? <ShieldCheck className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                          {u.is_admin ? 'Admin' : 'Usuário'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        <div>
                          Denúncias: <span className={cx(u.can_report === false && 'text-amber-200')}>{u.can_report === false ? 'bloqueado' : 'ok'}</span>
                          {u.report_blocked_until && <span className="text-slate-500"> • até {fmtDate(u.report_blocked_until)}</span>}
                        </div>
                        <div className="mt-1">
                          Comentários: <span className={cx(u.can_comment === false && 'text-rose-200')}>{u.can_comment === false ? 'bloqueado' : 'ok'}</span>
                          {u.comment_blocked_until && <span className="text-slate-500"> • até {fmtDate(u.comment_blocked_until)}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(u.updated_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-1.5 text-xs hover:bg-slate-900/35"
                          >
                            <UserCog className="h-3.5 w-3.5" />
                            Detalhes
                          </Link>
                          <button
                            onClick={() => openEdit(u)}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700 disabled:opacity-50"
                          >
                            <UserCog className="h-3.5 w-3.5" />
                            Editar
                          </button>
                          <button
                            onClick={() => block(u.id, 'report', 30)}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-xl bg-amber-600/90 px-3 py-1.5 text-xs hover:bg-amber-600 disabled:opacity-50"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            Ban denúncias (30d)
                          </button>
                          <button
                            onClick={() => block(u.id, 'comment', 30)}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-xl bg-rose-600/90 px-3 py-1.5 text-xs hover:bg-rose-600 disabled:opacity-50"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            Ban comentários (30d)
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Editar usuário</div>
                <div className="mt-1 text-xs text-slate-400">{editing.email || editing.id}</div>
              </div>
              <button onClick={closeEdit} className="rounded-xl border border-slate-800 bg-slate-900/20 p-2 hover:bg-slate-900/35">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-slate-300">Nome</span>
                <input
                  value={String(editDraft.display_name ?? '')}
                  onChange={(e) => setEditDraft((s) => ({ ...s, display_name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-300">E-mail</span>
                <input
                  value={String(editDraft.email ?? '')}
                  onChange={(e) => setEditDraft((s) => ({ ...s, email: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-300">Timezone</span>
                <input
                  value={String(editDraft.timezone ?? '')}
                  onChange={(e) => setEditDraft((s) => ({ ...s, timezone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </label>

              <div className="grid gap-2">
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-2 text-sm">
                  <span>Admin</span>
                  <input
                    type="checkbox"
                    checked={Boolean(editDraft.is_admin)}
                    onChange={(e) => setEditDraft((s) => ({ ...s, is_admin: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-2 text-sm">
                  <span>Premium</span>
                  <input
                    type="checkbox"
                    checked={Boolean(editDraft.is_premium)}
                    onChange={(e) => setEditDraft((s) => ({ ...s, is_premium: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </label>
              </div>

              <div className="grid gap-2">
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-2 text-sm">
                  <span>Pode denunciar</span>
                  <input
                    type="checkbox"
                    checked={Boolean(editDraft.can_report)}
                    onChange={(e) => setEditDraft((s) => ({ ...s, can_report: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-2 text-sm">
                  <span>Pode comentar</span>
                  <input
                    type="checkbox"
                    checked={Boolean(editDraft.can_comment)}
                    onChange={(e) => setEditDraft((s) => ({ ...s, can_comment: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </label>
              </div>

              <label className="text-sm">
                <span className="text-slate-300">report_blocked_until</span>
                <input
                  value={String(editDraft.report_blocked_until ?? '')}
                  onChange={(e) => setEditDraft((s) => ({ ...s, report_blocked_until: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-300">comment_blocked_until</span>
                <input
                  value={String(editDraft.comment_blocked_until ?? '')}
                  onChange={(e) => setEditDraft((s) => ({ ...s, comment_blocked_until: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button onClick={closeEdit} className="rounded-xl bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700">
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm hover:bg-indigo-500 disabled:opacity-50"
                disabled={busyId === editing.id}
              >
                <Save className="h-4 w-4" />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
