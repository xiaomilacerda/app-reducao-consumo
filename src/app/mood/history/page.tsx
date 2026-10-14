'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Edit3, Loader2, Search, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ProfileActionNotice from '@/components/profile/ProfileActionNotice';

type MoodEntry = {
  id:string;user_id:string;mood:string;mood_value:number;date:string;time:string;
  notes:string|null;note:string|null;trigger_note:string|null;helpful_action:string|null;
  daily_message:string|null;created_at:string|null;
};
const MOODS = [
  ['Excelente','🤩',100],['Maravilhoso','😍',95],['Ótimo','😄',90],
  ['Feliz','🙂',80],['Animado','😃',75],['Bem','😊',65],
  ['Normal','😐',55],['Calmo','😌',50],['Preocupado','😕',40],
  ['Ansioso','😥',30],['Muito ansioso','😰',20],['Irritado','😤',15],
  ['Triste','😢',8],['Muito mal / raiva','😡',3],
] as const;
function normalize(value:string){
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
}
function moodInfo(value:string){
  return MOODS.find(x=>normalize(x[0])===normalize(value))??null;
}
function formatDate(iso:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return iso;
  const [year,month,day]=iso.split('-');
  return day+'/'+month+'/'+year;
}
const PAGE_SIZE=7;

export default function MoodHistoryPage(){
  const [userId,setUserId]=useState<string|null>(null);
  const [entries,setEntries]=useState<MoodEntry[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [search,setSearch]=useState('');
  const [dateFrom,setDateFrom]=useState('');
  const [dateTo,setDateTo]=useState('');
  const [page,setPage]=useState(1);
  const [expandedDays,setExpandedDays]=useState<Record<string,boolean>>({});
  const [editId,setEditId]=useState<string|null>(null);
  const [editMood,setEditMood]=useState('');
  const [editNotes,setEditNotes]=useState('');
  const [editTrigger,setEditTrigger]=useState('');
  const [editHelp,setEditHelp]=useState('');
  const [confirmDelete,setConfirmDelete]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const [truncated,setTruncated]=useState(false);
  const savingRef=useRef(false);
  const dismiss=useCallback(()=>{setNotice('');setError('');},[]);

  const load=useCallback(async()=>{
    setLoading(true);setLoadError('');setTruncated(false);
    try{
      const auth=await supabase.auth.getUser();
      if(auth.error||!auth.data.user){setUserId(null);setEntries([]);return;}
      const uid=auth.data.user.id;
      setUserId(uid);
      const rows:MoodEntry[]=[];
      const size=500,cap=5000;
      while(rows.length<cap){
        const {data,error:e}=await supabase.from('mood_entries')
          .select('id,user_id,mood,mood_value,date,time,notes,note,trigger_note,helpful_action,daily_message,created_at')
          .eq('user_id',uid)
          .order('date',{ascending:false}).order('time',{ascending:false})
          .order('created_at',{ascending:false}).range(rows.length,rows.length+size-1);
        if(e)throw e;
        rows.push(...(data??[]) as MoodEntry[]);
        if(!data||data.length<size)break;
      }
      setTruncated(rows.length===cap);setEntries(rows);
    }catch(e){
      console.error('[Mood History] Falha na leitura',e);
      setEntries([]);
      setLoadError('Não foi possível sincronizar seu histórico. Os dados continuam na nuvem; confira a conexão e tente novamente.');
    }finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load()},[load]);

  const filtered=useMemo(()=>{
    const text=search.trim().toLocaleLowerCase('pt-BR');
    return entries.filter(e=>
      (!text||[e.mood,e.notes,e.note,e.trigger_note,e.helpful_action]
        .some(v=>(v??'').toLocaleLowerCase('pt-BR').includes(text))) &&
      (!dateFrom||e.date>=dateFrom) && (!dateTo||e.date<=dateTo));
  },[entries,search,dateFrom,dateTo]);
  const groups=useMemo(()=>{
    const result:{date:string;items:MoodEntry[]}[]=[];
    for(const e of filtered){
      let group=result.find(g=>g.date===e.date);
      if(!group){group={date:e.date,items:[]};result.push(group);}
      group.items.push(e);
    }
    return result.sort((a,b)=>b.date.localeCompare(a.date));
  },[filtered]);
  const totalPages=Math.max(1,Math.ceil(groups.length/PAGE_SIZE));
  const paged=groups.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  useEffect(()=>setPage(1),[search,dateFrom,dateTo]);

  function startEdit(e:MoodEntry){
    setEditId(e.id);setEditMood(e.mood);setEditNotes(e.notes??e.note??'');
    setEditTrigger(e.trigger_note??'');setEditHelp(e.helpful_action??'');
    setConfirmDelete(null);
  }
  function cancelEdit(){setEditId(null);setEditNotes('');setEditTrigger('');setEditHelp('');}
  async function saveEdit(entry:MoodEntry){
    if(busy||savingRef.current||!userId)return;
    if(editNotes.trim().length>600||editTrigger.trim().length>160||editHelp.trim().length>160){
      setError('Limite excedido: 600 caracteres na reflexão e 160 em cada campo adicional.');return;
    }
    const choice=moodInfo(editMood);
    if(!choice){setError('Selecione uma emoção válida.');return;}
    savingRef.current=true;setBusy(true);setError('');
    try {
      const auth=await supabase.auth.getUser();
      if(auth.error||auth.data.user?.id!==userId)throw new Error('Sessão não confirmada.');
      const update={
        mood:choice[0],mood_value:choice[2],notes:editNotes.trim()||null,
        trigger_note:editTrigger.trim()||null,helpful_action:editHelp.trim()||null,
        updated_at:new Date().toISOString(),
      };
      const {data,error:e}=await supabase.from('mood_entries').update(update)
        .eq('user_id',userId).eq('id',entry.id)
        .select('id,user_id,mood,mood_value,date,time,notes,note,trigger_note,helpful_action,daily_message,created_at').single();
      if(e||!data)throw new Error('O banco não confirmou a atualização.');
      setEntries(prev=>prev.map(r=>r.id===entry.id?data as MoodEntry:r));
      cancelEdit();setNotice('Registro corrigido e sincronizado com sua conta.');
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível corrigir o registro.');}
    finally {savingRef.current=false;setBusy(false);}
  }
  async function deleteEntry(entry:MoodEntry){
    if(busy||savingRef.current||!userId||confirmDelete!==entry.id)return;
    savingRef.current=true;setBusy(true);setError('');
    try{
      const auth=await supabase.auth.getUser();
      if(auth.error||auth.data.user?.id!==userId)throw new Error('Sessão não confirmada.');
      const {data,error:e}=await supabase.from('mood_entries').delete()
        .eq('user_id',userId).eq('id',entry.id).select('id').single();
      if(e||!data)throw new Error('O banco não confirmou a exclusão.');
      setEntries(prev=>prev.filter(x=>x.id!==entry.id));
      setConfirmDelete(null);cancelEdit();setNotice('Apenas o registro escolhido foi excluído da sua conta.');
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível excluir o registro.');}
    finally {savingRef.current=false;setBusy(false);}
  }

  function card(entry:MoodEntry){
    const editing=editId===entry.id;
    const confirming=confirmDelete===entry.id;
    const emoji=moodInfo(entry.mood)?.[1]??'💜';
    return <article key={entry.id} className="min-w-0 rounded-2xl border border-white/10 bg-white/[.045] p-3 sm:p-4">
      <div className="flex min-w-0 flex-wrap items-start gap-3">
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-400/10 text-2xl">{emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><p className="text-sm font-bold">{entry.mood}</p>
              <p className="mt-1 text-xs text-slate-400">{String(entry.time??'').slice(0,5)}</p></div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button type="button" aria-label="Corrigir registro" onClick={()=>editing?cancelEdit():startEdit(entry)}
                disabled={busy} className="flex min-h-10 items-center gap-1 rounded-lg border border-violet-300/20 px-2.5 text-xs font-semibold text-violet-200 hover:bg-violet-400/10 disabled:opacity-50">
                {editing?<X className="h-4 w-4"/>:<Edit3 className="h-4 w-4"/>}{editing?'Fechar':'Corrigir'}</button>
              <button type="button" aria-label="Excluir este registro" onClick={()=>{setConfirmDelete(confirming?null:entry.id);cancelEdit();}}
                disabled={busy} className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-400/20 text-rose-200 hover:bg-rose-400/10 disabled:opacity-50">
                <Trash2 className="h-4 w-4"/></button>
            </div>
          </div>
          {!editing&&<>
            {(entry.notes||entry.note)&&<p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">{entry.notes||entry.note}</p>}
            {entry.trigger_note&&<p className="mt-2 break-words text-xs text-slate-300"><strong>Influenciou:</strong> {entry.trigger_note}</p>}
            {entry.helpful_action&&<p className="mt-1 break-words text-xs text-slate-300"><strong>Ajudou:</strong> {entry.helpful_action}</p>}
            {entry.daily_message&&<p className="mt-3 rounded-xl border border-violet-400/15 bg-violet-400/10 p-3 text-xs leading-relaxed text-violet-100">{entry.daily_message}</p>}
          </>}
        </div>
      </div>
      {editing&&<div className="mt-3 space-y-3 rounded-xl border border-violet-400/15 bg-black/20 p-3">
        <label className="block text-xs text-slate-200">Emoção
          <select value={editMood} onChange={e=>setEditMood(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[#242139] p-2 text-sm text-white">
            {MOODS.map(m=><option key={m[0]} value={m[0]}>{m[1]} {m[0]}</option>)}
          </select>
        </label>
        <label className="block text-xs text-slate-200">O que influenciou?
          <input maxLength={160} value={editTrigger} onChange={e=>setEditTrigger(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-white/15 bg-[#242139] p-2 text-sm text-white"/>
        </label>
        <label className="block text-xs text-slate-200">O que te ajudou?
          <input maxLength={160} value={editHelp} onChange={e=>setEditHelp(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-white/15 bg-[#242139] p-2 text-sm text-white"/>
        </label>
        <label className="block text-xs text-slate-200">Reflexão
          <textarea rows={3} maxLength={600} value={editNotes} onChange={e=>setEditNotes(e.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-[#242139] p-2 text-sm text-white"/>
        </label>
        <button type="button" onClick={()=>void saveEdit(entry)} disabled={busy}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-violet-300 px-4 text-xs font-bold text-[#211434] disabled:opacity-50">
          {busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Check className="h-4 w-4"/>} Salvar correção
        </button>
      </div>}
      {confirming&&<div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3">
        <p className="text-xs text-rose-100">Excluir somente este momento? Os outros registros, inclusive os do mesmo dia, continuarão salvos.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={()=>void deleteEntry(entry)} disabled={busy} className="min-h-10 rounded-lg bg-rose-400 px-3 text-xs font-bold text-[#321624] disabled:opacity-50">Confirmar exclusão</button>
          <button type="button" onClick={()=>setConfirmDelete(null)} className="min-h-10 rounded-lg border border-white/20 px-3 text-xs">Cancelar</button>
        </div>
      </div>}
    </article>;
  }

  return <div className="min-h-screen w-full overflow-x-clip bg-[#100f1f] pb-24 text-white">
    <ProfileActionNotice error={error} success={notice} onDismiss={dismiss}/>
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#100f1f]/95 backdrop-blur-lg">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-3 sm:px-6">
        <Link href="/mood" aria-label="Voltar ao Diário" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 hover:bg-white/10"><ArrowLeft className="h-5 w-5"/></Link>
        <div className="min-w-0 flex-1"><h1 className="text-lg font-bold">Meu Histórico de Emoções</h1>
          <p className="text-[11px] text-slate-400">Cada momento permanece registrado separadamente.</p></div>
        <Link href="/mood" className="hidden min-h-10 items-center gap-2 text-xs font-semibold text-violet-200 sm:inline-flex">Novo registro <ArrowRight className="h-4 w-4"/></Link>
      </div>
    </header>
    <main className="mx-auto max-w-5xl space-y-4 px-3 py-5 sm:px-6">
      <section className="rounded-3xl border border-white/10 bg-[#1b1b2d] p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-base font-bold"><Search className="h-5 w-5 text-violet-300"/> Encontrar meus registros</h2>
        <p className="mt-1 text-xs text-slate-400">Busque por emoção, reflexão, gatilho ou algo que te ajudou.</p>
        <input type="search" aria-label="Buscar registros" value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Ex.: ansiedade, caminhada, família"
          className="mt-3 min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-300"/>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="min-w-0 text-xs text-slate-300">De
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-white/15 bg-[#242139] px-2 text-xs text-white"/>
          </label>
          <label className="min-w-0 text-xs text-slate-300">Até
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-white/15 bg-[#242139] px-2 text-xs text-white"/>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-400">{!loading&&!loadError?filtered.length+' registros em '+groups.length+' dias':'Histórico privado da sua conta'}</p>
          <button type="button" onClick={()=>{setSearch('');setDateFrom('');setDateTo('');setPage(1);}} className="min-h-10 rounded-lg border border-white/15 px-3 text-xs font-semibold text-slate-200">Limpar filtros</button>
        </div>
      </section>
      {!loading&&!userId?<div className="rounded-2xl border border-white/10 bg-[#1b1b2d] p-5 text-sm text-slate-300">
        Entre para consultar e editar seus registros. <Link href="/login?next=%2Fmood%2Fhistory" className="ml-1 font-semibold text-violet-200 underline">Entrar</Link></div>:null}
      {loadError&&<div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-4">
        <p className="text-sm text-rose-100">{loadError}</p>
        <button type="button" onClick={()=>void load()} className="mt-3 min-h-10 rounded-lg border border-white/20 px-3 text-xs font-semibold">Tentar novamente</button>
      </div>}
      {loading?<p role="status" className="flex items-center gap-2 rounded-xl border border-white/10 p-4 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin"/> Buscando seu histórico na nuvem...</p>:null}
      {!loading&&!loadError&&userId&&groups.length===0?<div className="rounded-2xl border border-white/10 bg-[#1b1b2d] p-5 text-center">
        <p className="text-sm text-slate-300">Nenhum registro encontrado com esses filtros.</p>
        <Link href="/mood" className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-xs font-bold text-violet-200 underline">Registrar meu humor <ArrowRight className="h-4 w-4"/></Link>
      </div>:null}
      <div className="space-y-3">
        {paged.map(day=>{
          const expanded=expandedDays[day.date]===true;
          const items=expanded?day.items:day.items.slice(0,1);
          return <section key={day.date} className="min-w-0 rounded-2xl border border-white/10 bg-[#1b1b2d] p-3 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-violet-300"/>{formatDate(day.date)}</h2>
              <span className="text-xs text-slate-400">{day.items.length} {day.items.length===1?'momento':'momentos'}</span>
            </div>
            <div className="space-y-2">{items.map(card)}</div>
            {day.items.length>1&&<button type="button" aria-expanded={expanded}
              onClick={()=>setExpandedDays(prev=>({...prev,[day.date]:!prev[day.date]}))}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-400/10 px-3 text-xs font-semibold text-violet-200">
              {expanded?'Recolher momentos':'Ver os outros '+(day.items.length-1)+' momentos'}
              <ChevronDown className={'h-4 w-4 transition-transform '+(expanded?'rotate-180':'')}/>
            </button>}
          </section>;
        })}
      </div>
      {groups.length>PAGE_SIZE&&<div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="min-h-10 rounded-xl border border-white/20 px-4 text-xs font-semibold disabled:opacity-40">Anterior</button>
        <span className="text-xs text-slate-300">Página {page} de {totalPages}</span>
        <button type="button" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="min-h-10 rounded-xl border border-white/20 px-4 text-xs font-semibold disabled:opacity-40">Próxima</button>
      </div>}
      {truncated&&<p className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100">Seu histórico é muito extenso. Esta página carrega até 5.000 registros por vez. Nenhum dado foi apagado.</p>}
      <p className="rounded-2xl border border-white/10 bg-white/[.035] p-4 text-xs leading-relaxed text-slate-400">
        Seus sentimentos pertencem a você. Corrigir e excluir registros próprios é gratuito; essas ações não removem as outras emoções registradas no mesmo dia.
      </p>
    </main>
  </div>;
}
