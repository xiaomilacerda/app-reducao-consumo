'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CalendarDays, CheckCircle2, ChevronDown, HeartHandshake,
  History, Loader2, PlusCircle, RefreshCcw, ShieldCheck, Sparkles, TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ProfileActionNotice from '@/components/profile/ProfileActionNotice';

type GroupKey = 'positive' | 'balanced' | 'anxious' | 'difficult' | 'other';
type Period = 'day' | 'week' | 'month' | 'year';
type Mood = { key: string; label: string; emoji: string; value: number; group: GroupKey; messageCategory: string };
type Entry = {
  id: string; user_id: string; mood: string; mood_value: number;
  notes: string | null; date: string; time: string | null;
  created_at: string; daily_message: string | null; context_tags?: string[] | null;
};

const MOODS: Mood[] = [
  {key:'excelente',label:'Excelente',emoji:'🤩',value:100,group:'positive',messageCategory:'motivation'},
  {key:'maravilhoso',label:'Maravilhoso',emoji:'😍',value:95,group:'positive',messageCategory:'encouragement'},
  {key:'otimo',label:'Ótimo',emoji:'😄',value:90,group:'positive',messageCategory:'motivation'},
  {key:'feliz',label:'Feliz',emoji:'🙂',value:80,group:'positive',messageCategory:'encouragement'},
  {key:'animado',label:'Animado',emoji:'😃',value:75,group:'positive',messageCategory:'encouragement'},
  {key:'bem',label:'Bem',emoji:'😊',value:65,group:'positive',messageCategory:'reflection'},
  {key:'normal',label:'Normal',emoji:'😐',value:55,group:'balanced',messageCategory:'reflection'},
  {key:'calmo',label:'Calmo',emoji:'😌',value:50,group:'balanced',messageCategory:'calma'},
  {key:'preocupado',label:'Preocupado',emoji:'😕',value:40,group:'anxious',messageCategory:'reflection'},
  {key:'ansioso',label:'Ansioso',emoji:'😥',value:30,group:'anxious',messageCategory:'calma'},
  {key:'muito_ansioso',label:'Muito ansioso',emoji:'😰',value:20,group:'anxious',messageCategory:'support'},
  {key:'irritado',label:'Irritado',emoji:'😤',value:15,group:'difficult',messageCategory:'reflection'},
  {key:'triste',label:'Triste',emoji:'😢',value:8,group:'difficult',messageCategory:'support'},
  {key:'muito_mal',label:'Muito mal / raiva',emoji:'😡',value:3,group:'difficult',messageCategory:'support'},
];
const GROUPS: {key:GroupKey;label:string;color:string}[] = [
  {key:'positive',label:'Momentos positivos',color:'#44C5A7'},
  {key:'balanced',label:'Neutros e tranquilos',color:'#8BB8E8'},
  {key:'anxious',label:'Preocupação e ansiedade',color:'#F4BE64'},
  {key:'difficult',label:'Momentos difíceis',color:'#E484AC'},
  {key:'other',label:'Outros registros',color:'#A1A1AA'},
];
const TAGS = ['Sono','Estresse','Trabalho','Relacionamentos','Vontade de consumir','Movimento','Alimentação','Outro'];
const PERIODS: {key:Period;label:string;days:number}[] = [
  {key:'day',label:'Hoje',days:1},{key:'week',label:'7 dias',days:7},
  {key:'month',label:'30 dias',days:30},{key:'year',label:'365 dias',days:365},
];

function keyInTimezone(date: Date, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
    const part=(type:string)=>parts.find(x=>x.type===type)?.value??'00';
    return [part('year'),part('month'),part('day')].join('-');
  } catch {return date.toISOString().slice(0,10);}
}
function clockInTimezone(date: Date, tz: string):string {
  try {return new Intl.DateTimeFormat('pt-BR',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false}).format(date);}
  catch {return date.toTimeString().slice(0,5);}
}
function shiftDate(day:string,offset:number):string {
  const d = new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);
  return d.toISOString().slice(0,10);
}
function niceDay(d:string) {return /^\d{4}-\d{2}-\d{2}$/.test(d)?d.slice(8,10)+'/'+d.slice(5,7):d;}
function moodByEntry(entry:Entry):Mood | undefined {
  const name=(entry.mood||'').trim().toLocaleLowerCase('pt-BR');
  return MOODS.find(m=>m.label.toLocaleLowerCase('pt-BR')===name || m.key===name)
    ?? MOODS.find(m=>m.value===Number(entry.mood_value));
}
function groupOf(entry:Entry):GroupKey {return moodByEntry(entry)?.group??'other';}
function countGroups(list:Entry[]):Record<GroupKey,number> {
  const result:Record<GroupKey,number>={positive:0,balanced:0,anxious:0,difficult:0,other:0};
  list.forEach(item=>result[groupOf(item)]++);
  return result;
}
/** Distribui o arredondamento para que a soma dos rótulos seja SEMPRE 100%. */
function parts100(counts:number[]):number[] {
  const total=counts.reduce((a,b)=>a+b,0);
  if(!total)return counts.map(()=>0);
  const exact=counts.map(n=>n*100/total);
  const values=exact.map(n=>Math.floor(n));
  let remain=100-values.reduce((a,b)=>a+b,0);
  const indices=exact.map((n,i)=>({i,fraction:n-values[i]}))
    .sort((a,b)=>b.fraction-a.fraction||a.i-b.i);
  for(const item of indices){if(remain<=0)break;values[item.i]++;remain--;}
  return values;
}
function fallbackMessage(mood:Mood) {
  if(mood.group==='anxious'||mood.group==='difficult')
    return 'Obrigado por reconhecer como está se sentindo. Você pode fazer uma pausa e procurar apoio, sem precisar resolver tudo agora.';
  if(mood.group==='balanced')
    return 'Dar nome ao que sente é uma forma de perceber a sua jornada. Você não precisa ter um dia perfeito.';
  return 'Que bom que você registrou esse momento. Guarde o que fez bem para lembrar nos próximos dias.';
}

export default function MoodTrackerPage() {
  const [userId,setUserId]=useState<string|null>(null);
  const [timezone,setTimezone]=useState('America/Sao_Paulo');
  const [entries,setEntries]=useState<Entry[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [selectedMood,setSelectedMood]=useState<Mood|null>(null);
  const [moreMoods,setMoreMoods]=useState(false);
  const [notes,setNotes]=useState('');
  const [tags,setTags]=useState<string[]>([]);
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [notice,setNotice]=useState('');
  const dismiss=useCallback(()=>{setNotice('');setSaveError('');},[]);
  const [lastSaved,setLastSaved]=useState<{mood:Mood;message:string}|null>(null);
  const [period,setPeriod]=useState<Period>('week');
  const [showHistory,setShowHistory]=useState(false);

  const today=keyInTimezone(new Date(),timezone);
  const days=PERIODS.find(x=>x.key===period)?.days??7;
  const since=shiftDate(today,-(days-1));
  const filtered=useMemo(()=>entries.filter(x=>x.date>=since&&x.date<=today),[entries,since,today]);
  const groups=useMemo(()=>countGroups(filtered),[filtered]);
  const groupPercent=useMemo(()=>parts100(GROUPS.map(g=>groups[g.key])),[groups]);
  const uniqueDays=useMemo(()=>new Set(filtered.map(e=>e.date)).size,[filtered]);
  const moodCounts=useMemo(()=>{
    const count=new Map<string,{label:string;emoji:string;count:number}>();
    for(const entry of filtered){
      const m=moodByEntry(entry),label=m?.label??entry.mood??'Outro';
      const current=count.get(label)??{label,emoji:m?.emoji??'📝',count:0};
      current.count++;
      count.set(label,current);
    }
    return [...count.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));
  },[filtered]);
  const latest=useMemo(()=>[...filtered].sort((a,b)=>b.created_at.localeCompare(a.created_at))[0], [filtered]);

  const chart=useMemo(()=>{
    const bucket=new Map<string,Entry[]>();
    for(const row of filtered){
      const bucketKey=period==='year'?row.date.slice(0,7):
        period==='day'?String(row.time??'').slice(0,2)||'00':row.date;
      if(!bucket.has(bucketKey))bucket.set(bucketKey,[]);
      bucket.get(bucketKey)?.push(row);
    }
    return [...bucket.entries()].sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([key,items])=>({
        key, label:period==='year'?key.slice(5,7)+'/'+key.slice(2,4)
          :period==='day'?key+'h':niceDay(key),
        counts:countGroups(items),total:items.length,
      }));
  },[filtered,period]);

  const load=useCallback(async()=>{
    setLoading(true);setLoadError('');
    try {
      const auth=await supabase.auth.getUser();
      if(auth.error)throw auth.error;
      const user=auth.data.user;
      setUserId(user?.id??null);
      if(!user){setEntries([]);return;}
      const profile=await supabase.from('profiles').select('timezone').eq('id',user.id).maybeSingle();
      const tz=profile.data?.timezone??'America/Sao_Paulo';
      setTimezone(tz);
      const todayInTz=keyInTimezone(new Date(),tz);
      // Consultas paginadas: nenhum registro é ignorado silenciosamente ao atingir
      // o limite padrão de 1000 linhas do Supabase.
      const output:Entry[]=[];
      let more=true;
      for(let start=0;more;start+=500){
        if(start>=5000){throw new Error('O histórico é maior que o limite de consulta. Contate o suporte para uma exportação completa.');}
        const query=await supabase.from('mood_entries')
          .select('id,user_id,mood,mood_value,notes,date,time,created_at,daily_message,context_tags')
          .eq('user_id',user.id).gte('date',shiftDate(todayInTz,-364))
          .lte('date',todayInTz).order('date',{ascending:false})
          .order('time',{ascending:false}).range(start,start+499);
        if(query.error)throw query.error;
        const batch=(query.data??[]) as Entry[];
        output.push(...batch);
        more=batch.length===500;
      }
      setEntries(output);
    }catch(e){
      console.warn('Diário emocional: erro de sincronização',e);
      setLoadError('Não conseguimos sincronizar os registros. Nenhum dado foi apagado; tente novamente.');
    }finally{setLoading(false);}
  },[]);

  useEffect(()=>{void load();},[load]);

  async function saveMood(){
    if(saving||!selectedMood)return;
    setSaveError('');setNotice('');
    if(notes.length>500){setSaveError('A reflexão deve ter até 500 caracteres.');return;}
    setSaving(true);
    try{
      const auth=await supabase.auth.getUser();
      if(auth.error||!auth.data.user||auth.data.user.id!==userId)
        throw new Error('A sessão expirou. Entre novamente antes de registrar.');
      const now=new Date(),date=keyInTimezone(now,timezone),time=clockInTimezone(now,timezone);
      let dailyMessage=fallbackMessage(selectedMood);
      try{
        const res=await supabase.rpc('get_random_mood_message_for_user',{
          p_user:auth.data.user.id,category_input:selectedMood.messageCategory,avoid_days:7,
        });
        if(!res.error&&Array.isArray(res.data)&&typeof res.data[0]?.message==='string'&&res.data[0].message.trim())
          dailyMessage=res.data[0].message.trim();
      }catch {/* A mensagem complementar nunca impede o registro. */}
      const payload={
        user_id:auth.data.user.id,date,time,mood:selectedMood.label,
        mood_value:selectedMood.value,notes:notes.trim()||null,
        context_tags:tags,daily_message:dailyMessage,
      };
      const {data,error}=await supabase.from('mood_entries').insert(payload)
        .select('id,user_id,mood,mood_value,notes,date,time,created_at,daily_message,context_tags').single();
      if(error||!data)throw error??new Error('Salvamento não confirmado');
      const saved=data as Entry;
      setEntries(prev=>[saved,...prev]);
      setLastSaved({mood:selectedMood,message:dailyMessage});
      setSelectedMood(null);setNotes('');setTags([]);
      setNotice('Seu sentimento foi salvo no WeedReset e estará disponível em outros dispositivos.');
    }catch(e){
      console.warn('Falha ao salvar humor',e);
      setSaveError('Não foi possível confirmar o registro na nuvem. Sua seleção continua aqui para tentar novamente.');
    }finally{setSaving(false);}
  }

  const showMoods=moreMoods?MOODS:MOODS.slice(0,8);
  return (
    <div className="min-h-screen w-full overflow-x-clip bg-transparent pb-28 text-white">
      <ProfileActionNotice success={notice} error={saveError} onDismiss={dismiss}/>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#171426]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-3 sm:px-6">
          <Link href="/" aria-label="Voltar ao início" className="rounded-lg p-2 text-slate-200 hover:bg-white/10"><ArrowLeft className="h-5 w-5"/></Link>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-400/15 text-2xl">💜</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold sm:text-xl">Diário de Emoções</h1>
            <p className="text-[11px] text-slate-400">Seu espaço para perceber e cuidar</p>
          </div>
          <Link href="/mood/history" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-semibold text-violet-200 hover:bg-white/10"><History className="h-4 w-4"/> Histórico</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl min-w-0 space-y-5 px-3 py-5 sm:px-6 sm:py-7">
        {!loading&&!userId&&<section className="rounded-2xl border border-violet-300/20 bg-[#23213a] p-5 text-sm text-slate-200">
          Entre para registrar seus sentimentos e recuperá-los em qualquer dispositivo.
          <Link href="/login?next=%2Fmood" className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-violet-400 px-4 font-bold text-[#1c1533]">Entrar / Criar conta</Link>
        </section>}
        {loadError&&<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
          {loadError}<button type="button" onClick={()=>void load()} className="min-h-10 rounded-lg border border-rose-200/30 px-3 font-semibold">Tentar novamente</button>
        </div>}
        <section className="relative min-w-0 overflow-hidden rounded-3xl border border-violet-400/25 bg-gradient-to-br from-[#31234d] via-[#252044] to-[#17192f] p-4 shadow-xl sm:p-6">
          <span className="text-[11px] font-semibold uppercase tracking-[.17em] text-violet-200">Um check-in, no seu ritmo</span>
          <h2 className="mt-2 text-xl font-extrabold sm:text-2xl">Como você está se sentindo agora?</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">Um dia pode ter muitos sentimentos. Registre quantas vezes quiser, sem precisar escolher um único humor para o dia inteiro.</p>
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
            {showMoods.map(m=>(
              <button key={m.key} type="button" aria-pressed={selectedMood?.key===m.key}
                disabled={!userId||loading||saving||!!loadError}
                onClick={()=>{setSelectedMood(m);setLastSaved(null);}}
                className={'flex min-h-[78px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-45 '+
                  (selectedMood?.key===m.key?'border-violet-200 bg-violet-400/30 ring-2 ring-violet-300/25':'border-white/10 bg-white/[.065] hover:border-violet-300/40 hover:bg-white/10')}>
                <span className="text-2xl" aria-hidden="true">{m.emoji}</span>
                <span className="break-words text-[10px] font-semibold leading-tight sm:text-[11px]">{m.label}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={()=>setMoreMoods(v=>!v)}
            className="mt-3 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-violet-200 hover:text-white">
            {moreMoods?'Mostrar opções principais':'Ver outros sentimentos'} <ChevronDown className={'h-4 w-4 transition '+(moreMoods?'rotate-180':'')}/>
          </button>
          {selectedMood&&<p className="mt-2 text-sm font-medium text-emerald-200">Você selecionou {selectedMood.emoji} {selectedMood.label}.</p>}
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold text-slate-200">Algo influenciou esse sentimento? <span className="font-normal text-slate-400">(opcional, até 3)</span></p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TAGS.map(tag=>(
                <button type="button" key={tag} aria-pressed={tags.includes(tag)}
                  disabled={!userId||loading||saving||!!loadError||(!tags.includes(tag)&&tags.length>=3)}
                  onClick={()=>setTags(v=>v.includes(tag)?v.filter(x=>x!==tag):[...v,tag])}
                  className={'min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-40 '+
                    (tags.includes(tag)?'border-emerald-300/60 bg-emerald-400/15 text-emerald-100':'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10')}>{tag}</button>
              ))}
            </div>
            <label className="mt-4 block text-xs font-semibold text-slate-200" htmlFor="mood-note">Quer escrever uma reflexão? <span className="font-normal text-slate-400">(opcional)</span></label>
            <textarea id="mood-note" value={notes} maxLength={500} rows={3}
              disabled={!userId||loading||saving||!!loadError}
              onChange={e=>setNotes(e.target.value)}
              placeholder="O que aconteceu? O que poderia ajudar neste momento?"
              className="mt-2 min-h-24 w-full resize-y rounded-xl border border-white/15 bg-black/25 p-3 text-sm leading-relaxed text-white outline-none placeholder:text-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-300/20 disabled:opacity-50"/>
            <div className="mt-1 text-right text-[11px] text-slate-400">{notes.length}/500</div>
            <button type="button" disabled={!selectedMood||saving||loading||!userId||!!loadError}
              onClick={()=>void saveMood()}
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-400 to-fuchsia-400 px-4 text-sm font-extrabold text-[#20112f] shadow-lg transition hover:brightness-110 disabled:opacity-45">
              {saving?<Loader2 className="h-4 w-4 animate-spin"/>:<PlusCircle className="h-4 w-4"/>}
              {saving?'Salvando na nuvem...':'Registrar este momento'}
            </button>
            <p className="mt-3 text-center text-[11px] text-slate-400">Novo registro, sem substituir o anterior. A conta é necessária para sincronizar.</p>
          </div>
        </section>

        {lastSaved&&<section aria-label="Mensagem após registro" className="rounded-2xl border border-emerald-300/20 bg-[#17322f] p-4 sm:p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-200"><CheckCircle2 className="h-5 w-5"/> Obrigado por registrar {lastSaved.mood.emoji}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">{lastSaved.message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(lastSaved.mood.group==='anxious'||lastSaved.mood.group==='difficult')&&
              <Link href="/sos" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-300 px-4 text-xs font-bold text-[#133027]"><HeartHandshake className="h-4 w-4"/> Fazer uma pausa SOS</Link>}
            <Link href="/mood/history" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-4 text-xs font-semibold text-white">Ver meus registros</Link>
          </div>
        </section>}

        <section aria-label="Análise do humor no período" className="space-y-4 rounded-3xl border border-white/10 bg-[#191a30] p-4 shadow-lg sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-violet-300">Sua evolução</span>
              <h2 className="mt-1 text-lg font-bold sm:text-xl">Como foram seus registros?</h2>
              <p className="mt-1 text-xs text-slate-400">Proporções reais, sem atribuir notas psicológicas aos sentimentos.</p>
            </div>
            <button type="button" onClick={()=>void load()} disabled={loading}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs text-slate-200 disabled:opacity-50"><RefreshCcw className={'h-4 w-4 '+(loading?'animate-spin':'')}/> Sincronizar</button>
          </div>
          <div role="group" aria-label="Período de análise" className="grid grid-cols-4 gap-1.5 rounded-2xl bg-black/20 p-1.5">
            {PERIODS.map(p=><button key={p.key} type="button" aria-pressed={period===p.key}
              onClick={()=>setPeriod(p.key)}
              className={'min-h-10 rounded-xl px-1 text-xs font-semibold transition '+(period===p.key?'bg-violet-500 text-white shadow':'text-slate-300 hover:bg-white/10')}>
              {p.label}</button>)}
          </div>
          {loading?<p role="status" className="rounded-xl border border-white/10 p-4 text-sm text-slate-300"><Loader2 className="mr-2 inline h-4 w-4 animate-spin"/> Carregando seus registros...</p>
          :loadError?<p className="rounded-xl border border-white/10 p-4 text-sm text-slate-300">Os indicadores ficam indisponíveis até a sincronização. Seus dados não foram apagados.</p>
          :<>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] text-slate-400">Registros</p><p className="mt-1 text-xl font-bold tabular-nums">{filtered.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] text-slate-400">Dias acompanhados</p><p className="mt-1 text-xl font-bold tabular-nums">{uniqueDays}<span className="text-xs font-normal text-slate-400">/{days}</span></p>
              </div>
              <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] text-slate-400">Mais registrado</p>
                <p className="mt-1 break-words text-xs font-bold sm:text-sm">{moodCounts[0]?moodCounts[0].emoji+' '+moodCounts[0].label:'—'}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 p-3.5 sm:p-5">
              <h3 className="text-sm font-bold">Distribuição dos sentimentos</h3>
              <p className="mt-1 text-xs text-slate-400">Todos os check-ins do período compõem a mesma barra.</p>
              {filtered.length ? <>
                <div role="img" aria-label={'Distribuição de '+filtered.length+' registros no período'}
                  className="mt-4 flex h-5 w-full overflow-hidden rounded-full bg-white/10">
                  {GROUPS.map((g,i)=>groups[g.key]>0?
                    <div key={g.key} title={g.label+': '+groups[g.key]+' registros ('+groupPercent[i]+'%)'}
                      style={{width:groupPercent[i]+'%',backgroundColor:g.color}}/>:null)}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {GROUPS.filter(g=>groups[g.key]>0).map(g=>{
                    const idx=GROUPS.findIndex(p=>p.key===g.key);
                    return <div key={g.key} className="flex items-center gap-2 text-xs">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{backgroundColor:g.color}}/>
                      <span className="min-w-0 flex-1 text-slate-300">{g.label}</span>
                      <span className="font-semibold tabular-nums">{groups[g.key]} · {groupPercent[idx]}%</span>
                    </div>;
                  })}
                </div>
                <p className="mt-3 text-[11px] text-slate-400">A soma é sempre 100% dos registros escolhidos. Isso não é uma avaliação clínica.</p>
              </>:<p className="mt-4 rounded-xl bg-white/5 p-4 text-sm text-slate-300">Nenhum sentimento registrado neste período. Se quiser, comece com um check-in acima.</p>}
            </div>

            {chart.length>0&&<div className="min-w-0 rounded-2xl border border-white/10 bg-black/15 p-3.5 sm:p-5">
              <h3 className="text-sm font-bold">Linha do tempo dos registros</h3>
              <p className="mt-1 text-xs text-slate-400">Cada coluna representa a quantidade de sentimentos que você registrou, agrupada por {period==='day'?'hora':period==='year'?'mês':'dia'}.</p>
              <div className="mt-4 overflow-x-auto pb-2">
                <div className="flex h-40 min-w-full items-end gap-2" style={{width:Math.max(0,chart.length*43)+'px'}}>
                  {chart.map(item=><div key={item.key} className="flex h-full min-w-[35px] flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[10px] font-semibold text-slate-300">{item.total}</span>
                    <div className="flex w-full max-w-9 flex-col-reverse overflow-hidden rounded-t-lg border border-white/10 bg-white/5"
                      style={{height:Math.max(12,Math.round(item.total/Math.max(...chart.map(x=>x.total))*100))+'px'}}>
                      {GROUPS.map(g=>item.counts[g.key]>0?
                        <div key={g.key} title={g.label+': '+item.counts[g.key]}
                          style={{height:(100*item.counts[g.key]/item.total)+'%',backgroundColor:g.color}}/>:null)}
                    </div>
                    <span className="whitespace-nowrap text-[10px] text-slate-400">{item.label}</span>
                  </div>)}
                </div>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Dias sem registro não são considerados sentimentos negativos.</p>
            </div>}

            {filtered.length>0&&<div className="rounded-2xl border border-violet-300/15 bg-violet-300/[.065] p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-violet-200"><Sparkles className="h-4 w-4"/> Um olhar sobre este período</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">
                {moodCounts[0]?
                  'Você registrou '+filtered.length+' '+(filtered.length===1?'momento':'momentos')+' em '+uniqueDays+' '+(uniqueDays===1?'dia':'dias')+'. O sentimento mais frequente foi '+moodCounts[0].label.toLowerCase()+'.':
                  'Seus registros estão disponíveis para acompanhar no seu ritmo.'}
                {' '}Esses dados mostram o que você contou ao diário; não definem quem você é.
              </p>
              {filtered.some(e=>groupOf(e)==='difficult'||groupOf(e)==='anxious')&&
                <Link href="/sos" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-400/10 px-3 text-xs font-semibold text-violet-200">
                  <HeartHandshake className="h-4 w-4"/> Conhecer o SOS
                </Link>}
            </div>}
          </>}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#191a30] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-bold">Seus momentos mais recentes</h2>
              <p className="mt-1 text-xs text-slate-400">Cada check-in aparece separadamente, mesmo no mesmo dia.</p></div>
            <button type="button" onClick={()=>setShowHistory(v=>!v)} aria-expanded={showHistory}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs font-semibold text-violet-200">
              {showHistory?'Recolher':'Ver registros'} <ChevronDown className={'h-4 w-4 transition '+(showHistory?'rotate-180':'')}/>
            </button>
          </div>
          {showHistory&&<div className="mt-4 space-y-2">
            {[...entries].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,7).map(entry=>{
              const m=moodByEntry(entry);
              return <article key={entry.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <span className="text-2xl">{m?.emoji??'📝'}</span>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{entry.mood}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{niceDay(entry.date)} · {entry.time??'Horário não informado'}</p>
                  {entry.notes&&<p className="mt-2 break-words whitespace-pre-wrap text-sm text-slate-300">{entry.notes}</p>}
                  {!!entry.context_tags?.length&&<p className="mt-1 text-xs text-violet-200">Contexto: {entry.context_tags.join(', ')}</p>}
                </div>
              </article>;
            })}
            {!entries.length&&<p className="text-sm text-slate-300">Ainda não há registros salvos.</p>}
            <Link href="/mood/history" className="block min-h-10 pt-3 text-center text-sm font-semibold text-violet-200 underline underline-offset-4">Abrir histórico completo</Link>
          </div>}
        </section>
        <p className="flex items-start gap-2 px-2 text-xs leading-relaxed text-slate-400"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/> As informações do diário são privadas e associadas à sua conta. Você pode consultar ou excluir seus registros no histórico. Preferências de lembretes ficam no Perfil.</p>
      </main>
    </div>
  );
}
