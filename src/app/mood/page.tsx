'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, BarChart3, CalendarDays, CheckCircle2, HeartHandshake,
  Loader2, RefreshCw, Save, ShieldCheck, SmilePlus, Sparkles,
} from 'lucide-react';
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/lib/supabase';
import ProfileActionNotice from '@/components/profile/ProfileActionNotice';

type Period = 'day' | 'week' | 'month' | 'year';
type Group = 'positive' | 'calm' | 'neutral' | 'anxious' | 'difficult' | 'other';
type MoodOption = { key: string; label: string; emoji: string; legacyValue: number; group: Group };
type MoodEntry = {
  id: string;
  user_id: string;
  mood: string;
  mood_value: number;
  date: string;
  time: string;
  created_at: string | null;
  notes: string | null;
  note: string | null;
  trigger_note: string | null;
  helpful_action: string | null;
  daily_message: string | null;
};
type GroupInfo = { key: Group; label: string; color: string; short: string };

const OPTIONS: MoodOption[] = [
  { key:'excelente',label:'Excelente',emoji:'🤩',legacyValue:100,group:'positive' },
  { key:'maravilhoso',label:'Maravilhoso',emoji:'😍',legacyValue:95,group:'positive' },
  { key:'otimo',label:'Ótimo',emoji:'😄',legacyValue:90,group:'positive' },
  { key:'feliz',label:'Feliz',emoji:'🙂',legacyValue:80,group:'positive' },
  { key:'animado',label:'Animado',emoji:'😃',legacyValue:75,group:'positive' },
  { key:'bem',label:'Bem',emoji:'😊',legacyValue:65,group:'positive' },
  { key:'normal',label:'Normal',emoji:'😐',legacyValue:55,group:'neutral' },
  { key:'calmo',label:'Calmo',emoji:'😌',legacyValue:50,group:'calm' },
  { key:'preocupado',label:'Preocupado',emoji:'😕',legacyValue:40,group:'anxious' },
  { key:'ansioso',label:'Ansioso',emoji:'😥',legacyValue:30,group:'anxious' },
  { key:'muito_ansioso',label:'Muito ansioso',emoji:'😰',legacyValue:20,group:'anxious' },
  { key:'irritado',label:'Irritado',emoji:'😤',legacyValue:15,group:'difficult' },
  { key:'triste',label:'Triste',emoji:'😢',legacyValue:8,group:'difficult' },
  { key:'muito_mal',label:'Muito mal / raiva',emoji:'😡',legacyValue:3,group:'difficult' },
];
const GROUPS: GroupInfo[] = [
  { key:'positive',label:'Momentos positivos',color:'#4FBD95',short:'Positivo' },
  { key:'calm',label:'Momentos de calma',color:'#65B8CF',short:'Calma' },
  { key:'neutral',label:'Momentos neutros',color:'#9A97CF',short:'Neutro' },
  { key:'anxious',label:'Preocupação ou ansiedade',color:'#E5AF60',short:'Ansiedade' },
  { key:'difficult',label:'Momentos difíceis',color:'#D9819B',short:'Difícil' },
  { key:'other',label:'Outros registros',color:'#8390A6',short:'Outros' },
];
const FRONT_KEYS = ['feliz','bem','normal','ansioso','triste'];
const FEEDBACK: Record<Group,string> = {
  positive:'É bom perceber momentos leves. Vale guardar o que ajudou você hoje.',
  calm:'Momentos de tranquilidade também merecem ser reconhecidos.',
  neutral:'Um dia comum é parte da jornada. Você não precisa se sentir bem o tempo todo.',
  anxious:'Obrigado por registrar. Se desejar, experimente uma pausa curta na área SOS.',
  difficult:'Obrigado por compartilhar este momento. Você merece cuidado e pode procurar apoio quando precisar.',
  other:'Registrar como você está já ajuda a perceber sua própria trajetória.',
};
const PERIOD_LABELS: Record<Period,string> = { day:'Hoje', week:'7 dias', month:'30 dias', year:'12 meses' };

function isoLocal(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US',{
      timeZone,year:'numeric',month:'2-digit',day:'2-digit'
    }).formatToParts(date);
    const part = (key:string) => parts.find(p=>p.type===key)?.value ?? '00';
    return part('year')+'-'+part('month')+'-'+part('day');
  } catch { return date.toLocaleDateString('sv-SE'); }
}
function nowLocalTime(timeZone:string) {
  try {
    return new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
  } catch { return new Date().toTimeString().slice(0,5); }
}
function addDays(date:string, amount:number) {
  const dt=new Date(date+'T12:00:00Z');
  dt.setUTCDate(dt.getUTCDate()+amount);
  return dt.toISOString().slice(0,10);
}
function normalize(s:string) {
  return (s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
}
function optionFor(mood:string):MoodOption|null {
  const key=normalize(mood);
  return OPTIONS.find(m=>normalize(m.key)===key || normalize(m.label)===key)??null;
}
function groupOf(entry:MoodEntry):Group {
  // Derive from the saved emotion, NOT from the arbitrary legacy numeric value.
  return optionFor(entry.mood)?.group??'other';
}
function optionEmoji(entry:MoodEntry) { return optionFor(entry.mood)?.emoji??'💜'; }
function dateTimeLabel(e:MoodEntry) {
  const d=e.date?.split('-')??[];
  return d.length===3 ? d[2]+'/'+d[1]+' · '+String(e.time??'').slice(0,5) : e.date;
}
function rangeStart(today:string,period:Period){
  if(period==='day')return today;
  if(period==='week')return addDays(today,-6);
  if(period==='month')return addDays(today,-29);
  const dt=new Date(today+'T12:00:00Z');
  dt.setUTCMonth(dt.getUTCMonth()-11);
  return dt.toISOString().slice(0,7)+'-01';
}
function percentageSplit(counts:number[]) {
  const total=counts.reduce((a,b)=>a+b,0);
  if(!total)return counts.map(()=>0);
  const fractional=counts.map(c=>100*c/total);
  const whole=fractional.map(Math.floor);
  let remain=100-whole.reduce((a,b)=>a+b,0);
  const positions=fractional.map((v,i)=>({i,frac:v-Math.floor(v)})).sort((a,b)=>b.frac-a.frac);
  for(let i=0;i<remain;i++)whole[positions[i].i]++;
  return whole;
}
function buildChart(rows:MoodEntry[],period:Period,today:string){
  const labels:string[]=[];
  if(period==='day') {
    // Every check-in remains distinct: the same day can contain many emotions.
    return [...rows].sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time))
      .map((e,i)=>({label:e.time?.slice(0,5)??String(i+1),[groupOf(e)]:1}));
  }
  if(period==='year'){
    const first=rangeStart(today,'year').slice(0,7);
    const month=new Date(first+'-15T12:00:00Z');
    for(let i=0;i<12;i++){labels.push(month.toISOString().slice(0,7));month.setUTCMonth(month.getUTCMonth()+1);}
  }else{
    const days=period==='week'?7:30;
    for(let i=days-1;i>=0;i--)labels.push(addDays(today,-i));
  }
  return labels.map(date=>{
    const events=rows.filter(r=>period==='year'?r.date.slice(0,7)===date:r.date===date);
    const item:Record<string,string|number>={label:period==='year'?date.slice(5)+'/'+date.slice(2,4):date.slice(8)};
    GROUPS.forEach(g=>item[g.key]=events.filter(e=>groupOf(e)===g.key).length);
    return item;
  });
}

export default function MoodTrackerPage(){
  const [userId,setUserId]=useState<string|null>(null);
  const [timeZone,setTimeZone]=useState('America/Sao_Paulo');
  const [loading,setLoading]=useState(true);
  const [fetchError,setFetchError]=useState('');
  const [entries,setEntries]=useState<MoodEntry[]>([]);
  const [period,setPeriod]=useState<Period>('week');
  const [selected,setSelected]=useState<MoodOption|null>(null);
  const [expanded,setExpanded]=useState(false);
  const [notes,setNotes]=useState('');
  const [trigger,setTrigger]=useState('');
  const [helpful,setHelpful]=useState('');
  const [saving,setSaving]=useState(false);
  const [success,setSuccess]=useState('');
  const [saveError,setSaveError]=useState('');
  const [lastFeedback,setLastFeedback]=useState<Group|null>(null);
  const [canLoadMore,setCanLoadMore]=useState(false);
  const inFlight=useRef(false);
  const clearNotice=useCallback(()=>{setSuccess('');setSaveError('');},[]);

  const today=isoLocal(new Date(),timeZone);
  const start=rangeStart(today,period);

  const load=useCallback(async()=>{
    setLoading(true);setFetchError('');setCanLoadMore(false);
    try {
      const auth=await supabase.auth.getUser();
      if(auth.error || !auth.data.user){setUserId(null);setEntries([]);return;}
      const uid=auth.data.user.id;
      setUserId(uid);
      const p=await supabase.from('profiles').select('timezone').eq('id',uid).maybeSingle();
      if(!p.error&&typeof p.data?.timezone==='string'&&p.data.timezone) setTimeZone(p.data.timezone);
      const result:MoodEntry[]=[];
      const size=500,maxRows=5000;
      while(result.length<maxRows){
        const from=result.length;
        const page=await supabase.from('mood_entries')
          .select('id,user_id,mood,mood_value,date,time,created_at,notes,note,trigger_note,helpful_action,daily_message')
          .eq('user_id',uid).order('date',{ascending:false}).order('time',{ascending:false})
          .order('created_at',{ascending:false}).range(from,from+size-1);
        if(page.error)throw page.error;
        result.push(...(page.data??[]) as MoodEntry[]);
        if(!page.data || page.data.length<size)break;
      }
      setEntries(result);
      setCanLoadMore(result.length===maxRows);
    }catch(err){
      console.error('[Mood] Falha sincronizando histórico',err);
      setEntries([]);setFetchError('Não conseguimos consultar seu diário no momento. Seu histórico não foi apagado. Confira a conexão e tente novamente.');
    }finally {setLoading(false);}
  },[]);

  useEffect(()=>{void load();},[load]);

  const visible=useMemo(()=>entries.filter(e=>e.date>=start&&e.date<=today),[entries,start,today]);
  const counts=GROUPS.map(group=>visible.filter(e=>groupOf(e)===group.key).length);
  const percent=percentageSplit(counts);
  const distribution=GROUPS.map((g,i)=>({...g,count:counts[i],percent:percent[i]})).filter(g=>g.count>0);
  const distinctDays=new Set(visible.map(e=>e.date)).size;
  const dominant=distribution.slice().sort((a,b)=>b.count-a.count)[0];
  const chart=useMemo(()=>buildChart(visible,period,today),[visible,period,today]);
  const recent=useMemo(()=>[...visible].sort((a,b)=>
    (b.date+'T'+b.time).localeCompare(a.date+'T'+a.time)).slice(0,6),[visible]);
  const noteCount=notes.trim().length;
  const hasDifficult=visible.some(e=>['anxious','difficult'].includes(groupOf(e)));
  const timelineTitle=period==='day'?'Registros de hoje':'Registros recentes do período';

  async function save(){
    if(inFlight.current||saving)return;
    if(!selected){setSaveError('Escolha como você está se sentindo antes de salvar.');return;}
    if(notes.trim().length>600 || trigger.trim().length>160 || helpful.trim().length>160){
      setSaveError('Revise os limites: reflexão de até 600 caracteres e campos complementares de até 160.');return;
    }
    inFlight.current=true;setSaving(true);setSaveError('');setSuccess('');
    try{
      const auth=await supabase.auth.getUser();
      if(auth.error||!auth.data.user||auth.data.user.id!==userId){
        throw new Error('Sua sessão não foi confirmada. Entre novamente para salvar.');
      }
      const entry={
        user_id:auth.data.user.id,mood:selected.label,mood_value:selected.legacyValue,
        date:isoLocal(new Date(),timeZone),time:nowLocalTime(timeZone),
        notes:notes.trim()||null,trigger_note:trigger.trim()||null,
        helpful_action:helpful.trim()||null,
        daily_message:FEEDBACK[selected.group],
      };
      // INSERT, never UPDATE: preserve every mood recorded this day, even across devices.
      const res=await supabase.from('mood_entries').insert(entry)
        .select('id,user_id,mood,mood_value,date,time,created_at,notes,note,trigger_note,helpful_action,daily_message')
        .single();
      if(res.error||!res.data)throw new Error('O Supabase não confirmou o novo registro. Tente novamente.');
      setEntries(prev=>[res.data as MoodEntry,...prev]);
      setSuccess('Seu humor foi salvo na nuvem, sem apagar os registros anteriores.');
      setLastFeedback(selected.group);
      setSelected(null);setNotes('');setTrigger('');setHelpful('');
    }catch(e){setSaveError(e instanceof Error?e.message:'Não foi possível salvar. Tente novamente.');}
    finally {setSaving(false);inFlight.current=false;}
  }

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-[#100f1f] pb-24 text-white">
      <ProfileActionNotice success={success} error={saveError} onDismiss={clearNotice}/>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#100f1f]/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-3 sm:px-6">
          <Link href="/" aria-label="Voltar ao início" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 hover:bg-white/10"><ArrowLeft className="h-5 w-5"/></Link>
          <SmilePlus className="h-7 w-7 text-violet-300"/>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold sm:text-xl">Diário de Emoções</h1>
            <p className="text-[11px] text-slate-400">Seu momento, sua jornada.</p>
          </div>
          <Link href="/mood/history" className="shrink-0 rounded-xl border border-violet-400/25 bg-violet-400/10 px-3 py-2.5 text-xs font-semibold text-violet-200 hover:bg-violet-400/20">Histórico <ArrowRight className="inline h-3.5 w-3.5"/></Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl min-w-0 space-y-5 px-3 py-5 sm:space-y-6 sm:px-6">
        <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-[#2e224b] via-[#211a39] to-[#152033] p-4 shadow-xl sm:p-6" aria-label="Registrar como me sinto">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-violet-200"><Sparkles className="h-4 w-4"/> Um momento para você</p>
          <h2 className="mt-2 text-xl font-extrabold sm:text-2xl">Como você está se sentindo agora?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">Você pode registrar quantas vezes precisar. Cada momento fica salvo separadamente, sem julgamentos ou notas de desempenho.</p>
          {!userId && !loading ? <div className="mt-4 rounded-2xl border border-white/15 bg-black/20 p-4">
            <p className="text-sm text-slate-200">Entre para guardar seu diário e acessá-lo em outros dispositivos.</p>
            <Link href="/login?next=%2Fmood" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-300 px-4 text-sm font-bold text-[#181128]">Entrar / Criar conta <ArrowRight className="h-4 w-4"/></Link>
          </div> : null}
          <div className="mt-5 grid grid-cols-5 gap-1.5 sm:gap-3" role="group" aria-label="Sentimentos mais comuns">
            {OPTIONS.filter(m=>FRONT_KEYS.includes(m.key)).map(m=>(
              <button key={m.key} type="button" aria-pressed={selected?.key===m.key}
                onClick={()=>{setSelected(m);setLastFeedback(null);}}
                className={'flex min-h-[86px] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border px-1 py-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 sm:min-h-24 '+
                  (selected?.key===m.key?'border-violet-200 bg-violet-400/25 shadow-lg shadow-violet-900/30':'border-white/10 bg-white/[.055] hover:bg-white/10')}>
                <span className="text-2xl sm:text-3xl" aria-hidden="true">{m.emoji}</span>
                <span className="text-[10px] font-semibold leading-tight sm:text-xs">{m.label}</span>
              </button>
            ))}
          </div>
          <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(e=>!e)}
            className="mt-3 flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-semibold text-violet-100 hover:bg-white/10">
            {expanded?'Mostrar menos':'Ver todas as 14 emoções'} <ArrowRight className={'h-3.5 w-3.5 transition-transform '+(expanded?'rotate-90':'')}/>
          </button>
          {expanded&&<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Outros sentimentos">
            {OPTIONS.filter(m=>!FRONT_KEYS.includes(m.key)).map(m=>(
              <button key={m.key} type="button" onClick={()=>{setSelected(m);setLastFeedback(null);}}
                aria-pressed={selected?.key===m.key}
                className={'flex min-h-12 items-center gap-2 rounded-xl border p-3 text-left text-xs font-semibold transition '+
                  (selected?.key===m.key?'border-violet-300 bg-violet-400/25':'border-white/10 bg-white/5 hover:bg-white/10')}>
                <span className="text-lg" aria-hidden="true">{m.emoji}</span>{m.label}
              </button>
            ))}
          </div>}
          {selected&&<p role="status" className="mt-3 text-sm font-medium text-violet-100">Você escolheu: {selected.emoji} {selected.label}.</p>}
          <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-200">O que influenciou esse momento? (opcional)
              <input value={trigger} maxLength={160} onChange={e=>setTrigger(e.target.value)} placeholder="Ex.: trabalho, descanso, conversa"
                className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-300"/>
            </label>
            <label className="text-xs font-medium text-slate-200">O que te ajudou? (opcional)
              <input value={helpful} maxLength={160} onChange={e=>setHelpful(e.target.value)} placeholder="Ex.: caminhada, respirar, pedir apoio"
                className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-300"/>
            </label>
          </div>
          <label className="mt-4 block text-xs font-medium text-slate-200">Quer registrar uma reflexão? (opcional)
            <textarea rows={3} maxLength={600} value={notes} onChange={e=>setNotes(e.target.value)}
              placeholder="Escreva no seu ritmo. Esta informação fica privada na sua conta."
              className="mt-2 w-full min-w-0 resize-y rounded-xl border border-white/15 bg-black/20 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-300"/>
          </label>
          <div className="mt-1 text-right text-[11px] text-slate-400">{noteCount}/600</div>
          <button type="button" onClick={()=>void save()} disabled={saving||loading||!userId||!selected||Boolean(fetchError)}
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-300 to-fuchsia-300 px-5 py-3 text-sm font-extrabold text-[#21112d] shadow-md transition hover:brightness-110 disabled:opacity-45 sm:w-auto">
            {saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}
            {saving?'Salvando na nuvem...':'Registrar meu momento'}
          </button>
          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-400"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300"/> Seus registros são privados. Nenhum sentimento é considerado fracasso.</p>
          {lastFeedback&&<div className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-300/10 p-3 text-sm text-emerald-100">
            {FEEDBACK[lastFeedback]}
            {(lastFeedback==='anxious'||lastFeedback==='difficult')&&<Link href="/sos" className="mt-2 inline-flex min-h-10 items-center gap-1.5 font-semibold text-emerald-200 underline underline-offset-4">Experimente uma pausa no SOS <ArrowRight className="h-4 w-4"/></Link>}
          </div>}
        </section>

        <section aria-label="Análises reais de humor" className="space-y-4 rounded-3xl border border-white/10 bg-[#1b1b2d] p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-[11px] font-semibold uppercase tracking-widest text-violet-300">Sua história em registros</p>
              <h2 className="mt-1 text-lg font-bold sm:text-xl">Como seus momentos se distribuem</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">Percentuais representam a quantidade de registros — não uma nota de humor nem risco clínico.</p></div>
            <button type="button" onClick={()=>void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"><RefreshCw className={'h-4 w-4 '+(loading?'animate-spin':'')}/> Atualizar</button>
          </div>
          <div role="group" aria-label="Período da análise" className="flex flex-wrap gap-2">
            {(['day','week','month','year'] as const).map(p=><button type="button" key={p} onClick={()=>setPeriod(p)} aria-pressed={period===p}
              className={'min-h-10 rounded-xl border px-3 py-2 text-xs font-semibold '+(period===p?'border-violet-300/50 bg-violet-400/20 text-violet-100':'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10')}>{PERIOD_LABELS[p]}</button>)}
          </div>
          {fetchError&&<p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-200">{fetchError}</p>}
          {loading?<p role="status" className="flex items-center gap-2 rounded-xl border border-white/10 p-4 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin"/> Consultando registros salvos...</p>:<>
            <div className="grid grid-cols-3 gap-2">
              <div className="min-w-0 rounded-2xl bg-white/5 p-3"><p className="text-[11px] text-slate-400">Registros</p><p className="mt-1 text-2xl font-bold tabular-nums">{fetchError?'—':visible.length}</p></div>
              <div className="min-w-0 rounded-2xl bg-white/5 p-3"><p className="text-[11px] text-slate-400">Dias registrados</p><p className="mt-1 text-2xl font-bold tabular-nums">{fetchError?'—':distinctDays}</p></div>
              <div className="min-w-0 rounded-2xl bg-white/5 p-3"><p className="text-[11px] text-slate-400">Mais frequente</p><p className="mt-1 break-words text-sm font-bold leading-snug">{fetchError?'Indisponível':dominant?.short??'Sem registros'}</p></div>
            </div>
            {!fetchError&&visible.length>0?<div>
              <div className="mt-1 flex h-5 w-full overflow-hidden rounded-full bg-white/10" role="img" aria-label={'Distribuição dos '+visible.length+' registros do período: '+distribution.map(d=>d.short+' '+d.percent+' por cento').join(', ')}>
                {distribution.map(d=><div key={d.key} style={{width:100*d.count/visible.length+'%',backgroundColor:d.color}} title={d.label+': '+d.count+' registros'} />)}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {distribution.map(g=><div key={g.key} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.035] px-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2 text-xs text-slate-200"><span className="h-3 w-3 shrink-0 rounded-full" style={{backgroundColor:g.color}}/>{g.label}</span>
                  <span className="shrink-0 text-xs font-bold tabular-nums">{g.count} · {g.percent}%</span>
                </div>)}
              </div>
              <p className="mt-3 text-[11px] text-slate-400">As partes somam 100% dos {visible.length} registros no período. Um mesmo dia pode ter vários sentimentos.</p>
            </div>:!fetchError?<p className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 text-center text-sm text-slate-300">Sem registros neste período. Você pode começar registrando como está se sentindo agora.</p>:null}
            {!fetchError&&visible.length>0&&<div className="border-t border-white/10 pt-4">
              <h3 className="flex items-center gap-2 text-base font-semibold"><BarChart3 className="h-5 w-5 text-violet-300"/> Registros ao longo do tempo</h3>
              <p className="mt-1 text-xs text-slate-400">Quantidade de cada sentimento, não uma pontuação emocional.</p>
              <div className="mt-4 h-56 w-full" role="img" aria-label="Gráfico de quantidade de registros por dia, horário ou mês">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{top:5,right:5,left:-28,bottom:0}}>
                    <CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false}/>
                    <XAxis dataKey="label" stroke="#A7ABC2" tick={{fontSize:10}} minTickGap={16} interval={period==='month'?4:'preserveStartEnd'}/>
                    <YAxis stroke="#A7ABC2" tick={{fontSize:10}} allowDecimals={false}/>
                    <Tooltip cursor={{fill:'rgba(255,255,255,.06)'}} contentStyle={{background:'#22253a',color:'#f4f3ff',border:'1px solid #5e587a',borderRadius:12}}/>
                    {GROUPS.map(g=><Bar key={g.key} name={g.short} stackId="moods" dataKey={g.key} fill={g.color} maxBarSize={44}/>)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>}
            {canLoadMore&&<p className="text-xs text-amber-200">Existe um histórico muito grande. Parte dos registros antigos não entrou nesta análise. Acesse o histórico completo para consultar.</p>}
            {hasDifficult&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <div className="flex items-start gap-2"><HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300"/>
                <p className="text-xs leading-relaxed text-emerald-100">Você registrou momentos difíceis neste período. Se quiser, o SOS tem pausas e estratégias de apoio.</p></div>
              <Link href="/sos" className="inline-flex min-h-10 items-center gap-1.5 text-xs font-bold text-emerald-200 underline">Abrir SOS <ArrowRight className="h-4 w-4"/></Link>
            </div>}
          </>}
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#1b1b2d] p-4 sm:p-6" aria-label="Linha do tempo das emoções">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div><h2 className="text-lg font-bold">{timelineTitle}</h2><p className="mt-1 text-xs text-slate-400">Cada registro é preservado com data, horário e sua reflexão.</p></div>
            <Link href="/mood/history" className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-violet-200 underline underline-offset-4">Ver histórico completo <ArrowRight className="h-4 w-4"/></Link>
          </div>
          {!loading&&!fetchError&&recent.length===0?<p className="mt-4 text-sm text-slate-400">Nenhum registro neste período.</p>:null}
          <div className="mt-4 space-y-2">
            {recent.map(e=><article key={e.id} className="flex min-w-0 gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-400/10 text-2xl" aria-hidden="true">{optionEmoji(e)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">{e.mood}</p>
                  <span className="text-[11px] text-slate-400">{dateTimeLabel(e)}</span>
                </div>
                {(e.notes||e.note)&&<p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-300">{e.notes||e.note}</p>}
                {e.trigger_note&&<p className="mt-2 text-xs text-slate-400"><strong className="text-slate-300">Influenciou:</strong> {e.trigger_note}</p>}
                {e.helpful_action&&<p className="mt-1 text-xs text-slate-400"><strong className="text-slate-300">Ajudou:</strong> {e.helpful_action}</p>}
              </div>
            </article>)}
          </div>
          <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-slate-400"><CalendarDays className="h-4 w-4 shrink-0"/> O diário ajuda a observar padrões pessoais; não mede risco clínico nem substitui avaliação profissional.</p>
        </section>
      </main>
    </div>
  );
}
