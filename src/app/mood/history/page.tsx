'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Edit3,
  Trash2,
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import ProfileActionNotice from '@/components/profile/ProfileActionNotice';

/**
 * Página: Diário Completo (history)
 * - Filtragem por texto e datas
 * - Paginação por dias (PAGE_SIZE)
 * - Mostra daily_message em caixa roxa
 * - Botões Editar / Excluir:
 *    -> Só funcionam se o usuário for Premium
 *    -> Usuário gratuito vê as opções com cadeado e,
 *       ao clicar, é direcionado para /premium
 */

const PAGE_SIZE = 12;
const MOOD_CHOICES = [
  {label:'Excelente',value:100},{label:'Maravilhoso',value:95},
  {label:'Ótimo',value:90},{label:'Feliz',value:80},
  {label:'Animado',value:75},{label:'Bem',value:65},
  {label:'Normal',value:55},{label:'Calmo',value:50},
  {label:'Preocupado',value:40},{label:'Ansioso',value:30},
  {label:'Muito ansioso',value:20},{label:'Irritado',value:15},
  {label:'Triste',value:8},{label:'Muito mal / raiva',value:3},
];

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function formatDate(d: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const [year, month, day] = d.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export default function MoodHistoryPage() {
  const supabase = useMemo(createClient, []);

  const [user, setUser] = useState<any | null>(null);

  const [entries, setEntries] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError,setLoadError] = useState('');

  // Busca + datas
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);

  // paginação por dias
  const [page, setPage] = useState(1);

  // expansão por dia
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [editId,setEditId] = useState<string|null>(null);
  const [editText,setEditText] = useState('');
  const [editMood,setEditMood] = useState('Normal');
  const [confirmDelete,setConfirmDelete] = useState<string|null>(null);
  const [busyId,setBusyId] = useState<string|null>(null);
  const [notice,setNotice] = useState('');
  const [actionError,setActionError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setLoadError('');
      try {
        const { data } = await supabase.auth.getUser();
        const currentUser = data?.user ?? null;

        if (!mounted) return;

        setUser(currentUser);
        if (!currentUser) {
          setLoading(false);
          return;
        }

        // carrega histórico de humor
        const { data: moods, error } = await supabase
          .from('mood_entries')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('date', { ascending: false })
          .order('time', { ascending: false });

        if (error) {
          console.error('Erro ao buscar moods', error);
          setLoadError('Não foi possível carregar seu diário. Confira a conexão e atualize esta página.');
        } else {
          setEntries(moods ?? []);
          setFiltered(moods ?? []);
        }
      } catch (err) {
        console.error('Erro ao carregar histórico:', err);
        setLoadError('Não foi possível sincronizar os registros. Tente novamente.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  // filtragem simples (texto + datas)
  useEffect(() => {
    let results = [...entries];
    const s = search.trim().toLowerCase();

    if (s) {
      results = results.filter(
        (e) =>
          String(e.mood ?? '').toLowerCase().includes(s) ||
          String(e.notes ?? '').toLowerCase().includes(s) ||
          String(e.daily_message ?? '').toLowerCase().includes(s)
      );
    }

    if (dateFrom) {
      results = results.filter((e) => String(e.date) >= dateFrom);
    }
    if (dateTo) {
      results = results.filter((e) => String(e.date) <= dateTo);
    }

    setFiltered(results);
    setPage(1);
  }, [search, entries, dateFrom, dateTo]);

  // agrupamento por dia
  const groupedByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const e of filtered) {
      const day = String(e.date).slice(0, 10);
      map[day] = map[day] ?? [];
      map[day].push(e);
    }
    const days = Object.keys(map).sort((a, b) => b.localeCompare(a)); // desc
    return days.map((d) => ({ date: d, items: map[d] }));
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(groupedByDay.length / PAGE_SIZE));

  const pagedDays = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return groupedByDay.slice(start, start + PAGE_SIZE);
  }, [groupedByDay, page]);

  // utilitário de emoji
  function moodValueToEmoji(value: number | null | undefined,mood?:string|null) {
    const emojis:Record<string,string>={
      excelente:'🤩', maravilhoso:'😍', 'ótimo':'😄', feliz:'🙂', animado:'😃',
      bem:'😊', normal:'😐', calmo:'😌', preocupado:'😕', ansioso:'😥',
      'muito ansioso':'😰', irritado:'😤', triste:'😢', 'muito mal / raiva':'😡',
    };
    const key=(mood||'').toLowerCase().trim();
    if(emojis[key])return emojis[key];
    const v=Number(value);
    const mapping:Record<number,string>={100:'🤩',95:'😍',90:'😄',80:'🙂',75:'😃',65:'😊',55:'😐',50:'😌',40:'😕',30:'😥',20:'😰',15:'😤',8:'😢',3:'😡'};
    return mapping[v]||'📝';
  }

  // Cada pessoa pode corrigir ou excluir seus próprios registros,
  // independentemente de ter uma assinatura. RLS verifica a propriedade no banco.
  async function handleDelete(id:string) {
    if (!user || busyId) return;
    setBusyId(id);setActionError('');setNotice('');
    try {
      const {data,error} = await supabase.from('mood_entries').delete()
        .eq('id',id).eq('user_id',user.id).select('id').single();
      if(error||!data)throw error??new Error('Exclusão não confirmada.');
      setEntries(prev=>prev.filter(e=>String(e.id)!==id));
      setFiltered(prev=>prev.filter(e=>String(e.id)!==id));
      setConfirmDelete(null);setEditId(null);
      setNotice('O registro foi excluído da sua conta.');
    }catch{setActionError('Não conseguimos confirmar a exclusão. Tente novamente.');}
    finally{setBusyId(null);}
  }

  async function handleEdit(id:string) {
    if(!user||busyId)return;
    if(editText.length>2000){setActionError('A anotação precisa ter até 2000 caracteres.');return;}
    setBusyId(id);setActionError('');setNotice('');
    try {
      const selected = MOOD_CHOICES.find(x=>x.label===editMood);
      if(!selected)throw new Error('Humor não encontrado.');
      const {data,error} = await supabase.from('mood_entries')
        .update({notes:editText.trim()||null,mood:selected.label,mood_value:selected.value,updated_at:new Date().toISOString()})
        .eq('id',id).eq('user_id',user.id).select('id,notes,mood,mood_value').single();
      if(error||!data)throw error??new Error('Salvamento não confirmado.');
      setEntries(prev=>prev.map(e=>String(e.id)===id?{...e,notes:data.notes,mood:data.mood,mood_value:data.mood_value}:e));
      setFiltered(prev=>prev.map(e=>String(e.id)===id?{...e,notes:data.notes,mood:data.mood,mood_value:data.mood_value}:e));
      setEditId(null);setEditText('');
      setNotice('Anotação atualizada e salva na sua conta.');
    }catch{setActionError('Não conseguimos salvar a anotação. Tente novamente.');}
    finally{setBusyId(null);}
  }

  function ActionButtons({entryId, entryNotes, entryMood}:{entryId:string|number;entryNotes?:string|null;entryMood?:string|null}) {
    const id=String(entryId),editing=editId===id,confirming=confirmDelete===id;
    return <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
      {editing ? <>
        <label className="w-full text-xs font-semibold text-slate-300">Corrigir sentimento
          <select value={editMood} onChange={e=>setEditMood(e.target.value)}
            className="mt-1 w-full rounded-lg border border-violet-400/40 bg-[#141323] p-2 text-sm text-white">
            {MOOD_CHOICES.map(m=><option key={m.label} value={m.label}>{m.label}</option>)}
          </select>
        </label>
        <label className="w-full text-xs font-semibold text-slate-300">Editar anotação
          <textarea value={editText} maxLength={2000}
            onChange={e=>setEditText(e.target.value)}
            className="mt-1 min-h-24 w-full resize-y rounded-lg border border-violet-400/40 bg-[#141323] p-2 text-sm text-white outline-none"/>
        </label>
        <button type="button" disabled={busyId!==null} onClick={()=>void handleEdit(id)}
          className="min-h-9 rounded-lg bg-violet-500 px-3 text-xs font-bold text-white disabled:opacity-50">
          {busyId===id?'Salvando...':'Salvar'}
        </button>
        <button type="button" onClick={()=>setEditId(null)}
          className="min-h-9 rounded-lg border border-white/20 px-3 text-xs text-slate-300">Cancelar</button>
      </> : <>
        <button type="button" disabled={busyId!==null}
          onClick={()=>{setEditId(id);setEditText(entryNotes??'');setEditMood(MOOD_CHOICES.find(m=>m.label.toLowerCase()===(entryMood??'').toLowerCase())?.label??'Normal');setConfirmDelete(null);}}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/15 px-2 text-xs text-violet-200 hover:bg-white/10 disabled:opacity-40">
          <Edit3 className="h-3.5 w-3.5"/> Editar
        </button>
        {confirming?<>
          <button type="button" disabled={busyId!==null} onClick={()=>void handleDelete(id)}
            className="min-h-9 rounded-lg bg-rose-500/20 px-3 text-xs font-semibold text-rose-200 disabled:opacity-40">
            {busyId===id?'Excluindo...':'Confirmar'}
          </button>
          <button type="button" onClick={()=>setConfirmDelete(null)}
            className="min-h-9 rounded-lg border border-white/15 px-2 text-xs text-slate-300">Cancelar</button>
        </>:<button type="button" disabled={busyId!==null}
          onClick={()=>{setConfirmDelete(id);setEditId(null);}}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-rose-400/20 px-2 text-xs text-rose-200 hover:bg-rose-500/10 disabled:opacity-40">
          <Trash2 className="h-3.5 w-3.5"/> Excluir
        </button>}
      </>}
    </div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <ProfileActionNotice success={notice} error={actionError}
        onDismiss={()=>{setNotice('');setActionError('');}}/>
      <header className="sticky top-0 z-40 bg-black/35 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/mood"
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-white/80" />
          </Link>

          <h1 className="text-lg font-semibold text-white">Diário Completo</h1>

          <div className="ml-auto text-sm text-white/60 hidden sm:block">
            Acesse seus registros pessoais de humor e notas.
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {loadError&&<p role="alert" className="rounded-2xl border border-rose-300/30 bg-rose-400/10 p-4 text-sm text-rose-100">
          {loadError}
        </p>}
        {!user&&!loading&&<p className="rounded-2xl border border-violet-400/20 bg-violet-400/10 p-4 text-sm text-slate-200">
          Entre na sua conta para consultar seus registros.
          <Link href="/login?next=%2Fmood%2Fhistory" className="mt-3 block rounded-xl bg-violet-400 p-3 text-center font-bold text-[#241232]">Entrar / Criar conta</Link>
        </p>}
        {user&&!loadError&&<p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
          Seu histórico é privado. Você pode corrigir uma anotação ou excluir seus próprios registros em qualquer plano.
        </p>}
        {/* Busca + introdução */}
        <div className="bg-black/30 p-4 rounded-2xl border border-white/10 backdrop-blur-xl">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2 flex-1 bg-black/20 border border-white/10 p-2 rounded-lg">
              <Search className="w-4 h-4 text-white/40" />
              <input
                aria-label="Buscar registros"
                className="w-full bg-transparent outline-none text-sm text-white/90 placeholder:text-white/40"
                placeholder="Buscar por humor, texto ou mensagem..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="Data inicial"
                className="p-2 bg-black/20 border border-white/10 rounded-lg text-sm text-white/80"
                value={dateFrom ?? ''}
                onChange={(e) => setDateFrom(e.target.value || null)}
              />
              <input
                type="date"
                aria-label="Data final"
                className="p-2 bg-black/20 border border-white/10 rounded-lg text-sm text-white/80"
                value={dateTo ?? ''}
                onChange={(e) => setDateTo(e.target.value || null)}
              />
              <button
                onClick={() => {
                  setDateFrom(null);
                  setDateTo(null);
                  setSearch('');
                }}
                className="px-3 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-sm text-white/80 transition-colors"
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="mt-4 text-sm text-white/90 placeholder:text-white/40">
            <h2 className="text-base font-semibold">
              O lugar onde sua memória não fuma...
            </h2>
            <p className="mt-2 text-sm text-white/80">
              Este é o seu Diário Completo — o lugar onde você acompanha sua
              jornada, seus humores e seus dias. Mesmo quando a cabeça fica
              cheia, aqui você encontra tudo registrado com clareza.
            </p>
          </div>
        </div>

        {/* Conteúdo: diário agrupado por dia */}
        <section>
          {groupedByDay.length === 0 ? (
            <div className="bg-black/30 p-6 rounded-2xl border border-white/10 backdrop-blur-xl text-center">
              <p className="text-white/80">
                Nenhum registro encontrado.
              </p>
              <p className="text-sm text-white/50 mt-2">
                Registre seu humor no painel principal para que ele apareça
                aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pagedDays.map((day) => (
                <div
                  key={day.date}
                  className="bg-black/30 p-4 rounded-2xl border border-white/10 backdrop-blur-xl"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-white/50">
                        {formatDate(day.date)}
                      </div>
                      <div className="text-base font-medium text-white">Registros do dia</div>
                    </div>
                    <div className="text-sm text-white/50">
                      {day.items.length} {day.items.length===1?'check-in':'check-ins'}
                    </div>
                  </div>

                  {/* destaque: primeira reação do dia */}
                  <div className="mt-4 p-4 rounded-xl border border-white/10 bg-gradient-to-r from-purple-500/10 via-fuchsia-500/10 to-pink-500/10 flex items-start gap-4">
                    <div className="text-2xl select-none">
                      {moodValueToEmoji(day.items[0].mood_value,day.items[0].mood)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm text-white/50">
                            {day.items[0].time ?? ''}
                          </div>
                          <div className="font-semibold text-white">
                            {day.items[0].mood ?? '—'}
                          </div>
                        </div>

                        {ActionButtons({entryId:day.items[0].id,entryNotes:day.items[0].notes,entryMood:day.items[0].mood})}
                      </div>

                      {day.items[0].notes && (
                        <p className="mt-3 text-sm text-white/90 placeholder:text-white/40 whitespace-pre-wrap">
                          {day.items[0].notes}
                        </p>
                      )}

                      {/* daily_message - caixa roxa */}
                      {day.items[0].daily_message && (
                        <div className="mt-3 p-2 rounded-lg border border-purple-400/20 bg-purple-500/10 text-sm text-purple-200">
                          {day.items[0].daily_message}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* reações adicionais */}
                  {day.items.length > 1 && (
                    <div className="mt-3">
                      <button
                        onClick={() =>
                          setExpandedDays((s) => ({
                            ...s,
                            [day.date]: !s[day.date],
                          }))
                        }
                        className="text-sm text-purple-200 hover:text-purple-100 underline"
                      >
                        {expandedDays[day.date]
                          ? 'Mostrar menos'
                          : `Mostrar mais (${day.items.length - 1})`}
                      </button>

                      {expandedDays[day.date] && (
                        <div className="mt-3 space-y-3">
                          {day.items.slice(1).map((it: any) => (
                            <div
                              key={it.id}
                              className="p-3 rounded-lg border border-white/10 bg-black/20 flex items-start gap-3"
                            >
                              <div className="text-xl select-none">
                                {moodValueToEmoji(it.mood_value,it.mood)}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <div className="text-sm text-white/50">
                                      {it.time ?? ''}
                                    </div>
                                    <div className="font-medium text-white">
                                      {it.mood ?? '—'}
                                    </div>
                                  </div>

                                  {ActionButtons({entryId:it.id,entryNotes:it.notes,entryMood:it.mood})}
                                </div>

                                {it.notes && (
                                  <p className="mt-2 text-sm text-white/90 placeholder:text-white/40 whitespace-pre-wrap">
                                    {it.notes}
                                  </p>
                                )}

                                {it.daily_message && (
                                  <div className="mt-2 p-2 rounded-lg border border-purple-400/20 bg-purple-500/10 text-sm text-purple-200">
                                    {it.daily_message}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* paginação + total de registros */}
              <div className="flex items-center justify-between text-xs text-white/50">
                <div>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-2 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white/80 transition-colors mr-2"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    className="px-2 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white/80 transition-colors"
                  >
                    Próxima
                  </button>
                </div>
                <div>
                  Página {page} • {totalPages}
                  <span className="mx-3">•</span>
                  <span className="text-xs text-white/40">
                    Total de registros: {entries.length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
