'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, CheckCircle2, ChevronRight, Heart, Pause, Play, RotateCcw, ShieldCheck, Sparkles, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Feeling = 'urge' | 'anxiety' | 'irritation' | 'sleep';
type Phase = 'choose' | 'exercise' | 'done';
type Moment = { title: string; hint: string; steps: [string, string, string]; icon: string };

const moments: Record<Feeling, Moment> = {
  urge: {
    title: 'Estou com muita vontade',
    hint: 'Uma pausa para não agir no automático.',
    icon: '💜',
    steps: [
      'Coloque os pés no chão. Você não precisa tomar nenhuma decisão agora.',
      'Observe onde a vontade aparece no corpo. Deixe vir e ir, sem brigar com ela.',
      'Escolha a próxima ação simples: água, mudar de lugar ou falar com alguém.',
    ],
  },
  anxiety: {
    title: 'Estou ansioso',
    hint: 'Volte a atenção para o que está ao seu redor.',
    icon: '🌿',
    steps: [
      'Apoie os pés no chão e solte a tensão dos ombros. Respire confortavelmente.',
      'Encontre três objetos que consegue ver. Depois, perceba dois sons.',
      'Sinta o contato do corpo com a cadeira ou com o chão. Vá no seu ritmo.',
    ],
  },
  irritation: {
    title: 'Estou irritado',
    hint: 'Crie espaço antes de reagir.',
    icon: '☁️',
    steps: [
      'Afaste-se um pouco do que está provocando tensão, se for possível.',
      'Solte a mandíbula e os ombros. Perceba suas mãos e relaxe os dedos.',
      'Escolha uma ação que não machuque você nem ninguém: caminhar, beber água ou descansar.',
    ],
  },
  sleep: {
    title: 'Não consigo dormir',
    hint: 'Reduza os estímulos e encontre uma posição confortável.',
    icon: '🌙',
    steps: [
      'Diminua a luz, se puder, e escolha uma posição confortável.',
      'Note três pontos de contato do corpo com a cama ou a cadeira.',
      'Deixe a respiração seguir naturalmente. Não é preciso forçar o sono.',
    ],
  },
};
const choices: Feeling[] = ['urge','anxiety','irritation','sleep'];
const WINDOW_SECONDS = 60;

export default function SosQuickHelp({ userId }: { userId: string | null }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('choose');
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [before, setBefore] = useState<number | null>(null);
  const [after, setAfter] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(WINDOW_SECONDS);
  const [paused, setPaused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [recentSave, setRecentSave] = useState<string | null>(null);
  const remainingRef = useRef(WINDOW_SECONDS);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) { setRecentSave(null); return; }
    let live = true;
    void (async () => {
      try {
        const auth = await supabase.auth.getUser();
        if (auth.error || auth.data.user?.id !== userId) return;
        const { data, error } = await supabase.from('sos_quick_sessions')
          .select('created_at').eq('user_id', userId)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (live && !error && data?.created_at) setRecentSave(data.created_at);
      } catch { /* Ajuda imediata nunca depende da consulta. */ }
    })();
    return () => { live = false; };
  }, [userId]);

  const close = useCallback(() => {
    if (saving) return;
    setOpen(false);
    setPhase('choose');
    setFeeling(null);
    setBefore(null);
    setAfter(null);
    setRemaining(WINDOW_SECONDS);
    remainingRef.current = WINDOW_SECONDS;
    setPaused(false);
    setSaved(false);
    setSaveError('');
  }, [saving]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') close(); };
    window.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', key);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open || phase !== 'exercise' || paused) return;
    const starting = remainingRef.current;
    const start = Date.now();
    const interval = window.setInterval(() => {
      const seconds = Math.min(starting, Math.floor((Date.now() - start) / 1000));
      const next = Math.max(0, starting - seconds);
      setRemaining(next);
      if (next === 0) setPhase('done');
    }, 250);
    return () => {
      window.clearInterval(interval);
      const elapsed = Math.max(0, Math.floor((Date.now() - start) / 1000));
      remainingRef.current = Math.max(0, starting - elapsed);
    };
  }, [open, phase, paused]);

  function begin() {
    if (!feeling) return;
    remainingRef.current = WINDOW_SECONDS;
    setRemaining(WINDOW_SECONDS);
    setPhase('exercise');
    setPaused(false);
    setSaved(false);
    setSaveError('');
  }

  async function saveRecord() {
    if (!feeling || !userId || saving || saved) return;
    setSaving(true); setSaveError('');
    try {
      const auth = await supabase.auth.getUser();
      if (auth.error || auth.data.user?.id !== userId) throw new Error('Sessão não confirmada');
      const duration = Math.min(WINDOW_SECONDS, Math.max(0, WINDOW_SECONDS - remaining));
      const { data, error } = await supabase.from('sos_quick_sessions').insert({
        user_id: userId,
        feeling, intensity_before: before, intensity_after: after,
        duration_seconds: duration,
      }).select('id,created_at').single();
      if (error || !data) throw error || new Error('Não confirmado');
      setSaved(true);
      setRecentSave(data.created_at);
    } catch { setSaveError('Não conseguimos confirmar o registro na nuvem. Você pode tentar novamente.'); }
    finally { setSaving(false); }
  }

  const elapsed = WINDOW_SECONDS - remaining;
  const stepIndex = elapsed < 20 ? 0 : elapsed < 40 ? 1 : 2;
  const current = feeling ? moments[feeling] : null;

  return (
    <section aria-label="Ajuda SOS imediata" className="relative overflow-hidden rounded-3xl border border-fuchsia-300/20 bg-gradient-to-br from-[#362049] via-[#24183a] to-[#151e33] px-5 py-6 text-white shadow-2xl sm:px-7 sm:py-7">
      <div className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="relative">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-fuchsia-200">
          <Sparkles className="h-4 w-4"/> Um momento de cuidado
        </p>
        <h2 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">Você não precisa enfrentar isso sozinho.</h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-300">
          Escolha como está se sentindo. Em poucos segundos, comece uma pausa guiada — sem login, sem pressão e sem precisar procurar entre as técnicas.
        </p>
        <button type="button" onClick={() => {setOpen(true);setPhase('choose');}}
          className="mt-5 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-fuchsia-400 to-violet-400 px-5 py-3 text-base font-extrabold text-[#1c1031] shadow-lg shadow-fuchsia-900/30 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-300/50 sm:w-auto sm:min-w-72">
          <Heart className="h-5 w-5" /> Preciso de ajuda agora <ArrowRight className="h-5 w-5"/>
        </button>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-300"/> Ajuda imediata gratuita</span>
          <span>• 1 minuto • Funciona sem internet</span>
        </div>
        {recentSave && <p className="mt-3 text-xs text-emerald-200">Seu último registro de pausa guiada está salvo na conta.</p>}
      </div>
      {open && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#090b19]/95 p-3 backdrop-blur-lg sm:p-5" role="presentation">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="quick-sos-title" tabIndex={-1}
            className="flex max-h-[94dvh] w-full max-w-lg min-w-0 flex-col overflow-y-auto rounded-3xl border border-white/15 bg-[#191d30] p-5 text-white shadow-2xl outline-none sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">SOS guiado · sempre gratuito</p>
                <h2 id="quick-sos-title" className="mt-1 text-xl font-bold leading-snug sm:text-2xl">
                  {phase === 'choose' ? 'Como você está agora?' : phase === 'exercise' ? 'Um minuto para você' : 'Você fez uma pausa'}
                </h2>
              </div>
              <button type="button" aria-label="Fechar SOS guiado" onClick={close}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 text-slate-200 hover:bg-white/10"><X className="h-5 w-5"/></button>
            </div>

            {phase === 'choose' && <>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">Selecione uma opção. Não existe resposta errada.</p>
              <div className="mt-4 grid gap-2">
                {choices.map(key => (
                  <button type="button" key={key} onClick={() => setFeeling(key)}
                    aria-pressed={feeling === key}
                    className={'flex min-h-14 items-center gap-3 rounded-xl border p-3 text-left transition ' +
                      (feeling === key ? 'border-emerald-300/70 bg-emerald-400/15' : 'border-white/15 bg-white/[.045] hover:bg-white/10')}>
                    <span className="text-xl" aria-hidden="true">{moments[key].icon}</span>
                    <span className="min-w-0 flex-1 text-sm font-semibold">{moments[key].title}</span>
                    {feeling === key && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300"/>}
                  </button>
                ))}
              </div>
              <label className="mt-5 block text-xs font-medium text-slate-300">
                Intensidade do desconforto agora (opcional): {before === null ? 'não informar' : before + '/10'}
                <input type="range" min="0" max="10" step="1" value={before ?? 5}
                  onChange={e => setBefore(Number(e.target.value))}
                  className="mt-3 w-full accent-emerald-300" />
              </label>
              <button type="button" onClick={begin} disabled={!feeling}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 font-bold text-[#073329] disabled:opacity-40">
                Começar minha pausa <ChevronRight className="h-5 w-5"/>
              </button>
            </>}

            {phase === 'exercise' && current && <>
              <p className="mt-3 text-sm text-slate-300">{current.hint}</p>
              <div className="mt-5 text-center">
                <p className="text-5xl font-bold tabular-nums tracking-tight text-white" aria-live="off">00:{String(remaining).padStart(2,'0')}</p>
                <p className="mt-1 text-xs text-slate-400">Restante da pausa · você pode encerrar quando quiser</p>
              </div>
              <div role="progressbar" aria-label="Progresso da pausa" aria-valuemin={0} aria-valuemax={60} aria-valuenow={elapsed}
                className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-fuchsia-400 transition-[width] duration-300" style={{width: (elapsed / WINDOW_SECONDS * 100)+'%'}}/>
              </div>
              <div className="mt-6 min-h-44 rounded-2xl border border-emerald-300/20 bg-emerald-300/[.065] p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Passo {stepIndex + 1} de 3</p>
                <p key={stepIndex} className="mt-3 text-lg font-medium leading-relaxed text-white">{current.steps[stepIndex]}</p>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setPaused(v=>!v)}
                  className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 text-sm font-semibold hover:bg-white/10">
                  {paused ? <Play className="h-4 w-4"/> : <Pause className="h-4 w-4"/>}
                  {paused ? 'Continuar' : 'Pausar'}
                </button>
                <button type="button" onClick={() => setPhase('done')}
                  className="min-h-12 flex-1 rounded-xl border border-emerald-300/35 bg-emerald-300/10 px-3 text-sm font-semibold text-emerald-200">
                  Encerrar agora
                </button>
              </div>
              <p className="mt-4 text-center text-xs text-slate-400">Você pode interromper a qualquer momento, sem perder nada.</p>
            </>}

            {phase === 'done' && <>
              <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-5">
                <CheckCircle2 className="h-8 w-8 text-emerald-300"/>
                <p className="mt-3 text-lg font-semibold">Obrigado por dedicar esse momento a você.</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">Não precisa ter passado completamente para valer. Se ainda estiver difícil, você pode repetir, tentar outra técnica ou procurar alguém de confiança.</p>
              </div>
              <label className="mt-5 text-xs font-medium text-slate-300">
                Como está a intensidade agora? (opcional) {after === null ? 'não informar' : after + '/10'}
                <input type="range" min="0" max="10" step="1" value={after ?? 5}
                  onChange={e => setAfter(Number(e.target.value))} className="mt-3 w-full accent-emerald-300"/>
              </label>
              {!!userId && !saved && <button type="button" onClick={() => void saveRecord()} disabled={saving}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 font-bold text-[#093328] disabled:opacity-60">
                <ShieldCheck className="h-5 w-5"/> {saving ? 'Salvando...' : 'Guardar meu registro na nuvem'}
              </button>}
              {!userId && <p className="mt-4 text-center text-xs text-slate-300">
                Quer manter seus registros entre dispositivos? <Link className="font-semibold text-violet-200 underline" href="/login?next=%2Fsos">Entre na sua conta</Link>.
              </p>}
              {saved && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-400/15 p-3 text-sm text-emerald-200"><Check className="h-5 w-5"/> Registro confirmado na nuvem.</p>}
              {saveError && <p role="alert" className="mt-3 rounded-xl border border-rose-300/25 bg-rose-400/10 p-3 text-sm text-rose-200">{saveError}</p>}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => {setPhase('choose'); setFeeling(null);setAfter(null);setBefore(null);setSaved(false);}}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 px-3 text-sm font-semibold"><RotateCcw className="h-4 w-4"/> Outra pausa</button>
                <button type="button" onClick={close}
                  className="min-h-12 rounded-xl bg-white/10 px-3 text-sm font-semibold">Voltar ao SOS</button>
              </div>
            </>}
            <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500">Este exercício oferece apoio, mas não substitui atendimento profissional ou serviços de emergência.</p>
          </div>
        </div>
      )}
    </section>
  );
}
