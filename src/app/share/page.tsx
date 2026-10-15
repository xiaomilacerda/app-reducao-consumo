'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy, Download, Eye, EyeOff, Heart, Image as ImageIcon, Link2, LockKeyhole, Share2, Sparkles, Trophy } from 'lucide-react';
import { storage } from '@/lib/storage';
import { UserData } from '@/lib/types';
import { calculateCleanDays, calculateSavings, formatCurrency } from '@/lib/utils-recovery';

type Theme = 'noite' | 'aurora' | 'ouro' | 'natureza';
type Format = 'story' | 'feed';
const THEMES: Record<Theme, { name: string; bg: string; bg2: string; accent: string; text: string }> = {
  noite: { name: 'Noite', bg: '#0A1426', bg2: '#1C254A', accent: '#A5B4FC', text: '#FFFFFF' },
  aurora: { name: 'Aurora', bg: '#24133C', bg2: '#6B2D66', accent: '#F9A8D4', text: '#FFFFFF' },
  ouro: { name: 'Dourado', bg: '#21180E', bg2: '#5A3D1D', accent: '#FDE68A', text: '#FFFFFF' },
  natureza: { name: 'Natureza', bg: '#08261F', bg2: '#155A46', accent: '#86EFAC', text: '#FFFFFF' },
};
const MILESTONES = [1, 3, 7, 14, 30, 60, 90, 180, 365];
const phrases = ['Cada passo conta. E este é meu.', 'Não é sobre perfeição. É sobre continuar.', 'Hoje eu escolhi cuidar de mim.', 'Uma nova fase, no meu ritmo.'];
const inviteUrl = 'https://app-reducao-consumo.vercel.app/?utm_source=shared_card&utm_medium=organic&utm_campaign=weedreset_jornada';

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.trim().split(/\s+/); const lines: string[] = []; let line = '';
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (ctx.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { const limited = lines.slice(0, maxLines); limited[maxLines - 1] += '…'; return limited; }
  return lines;
}
function makeArtwork(opts: { theme: Theme; format: Format; days: number; message: string; savings: number; achievements: number; showSavings: boolean; showAchievements: boolean; discreet: boolean; milestone: number | null }): HTMLCanvasElement {
  const w = 1080, h = opts.format === 'story' ? 1920 : 1080;
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas indisponível');
  const t = THEMES[opts.theme];
  const gradient = ctx.createLinearGradient(0, 0, w, h); gradient.addColorStop(0, t.bg); gradient.addColorStop(1, t.bg2);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.globalAlpha = .12; ctx.strokeStyle = t.accent; ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(950, 160, 170 + i * 85, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  const top = opts.format === 'story' ? 145 : 95;
  ctx.fillStyle = t.accent; ctx.font = '700 38px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('✦ WEEDRESET', 86, top);
  ctx.fillStyle = '#D5DAE5'; ctx.font = '500 27px sans-serif'; ctx.textAlign = 'right'; ctx.fillText('MINHA JORNADA', 994, top);
  const centerY = opts.format === 'story' ? 720 : 450;
  ctx.textAlign = 'center'; ctx.fillStyle = '#F1F5F9'; ctx.font = '500 36px sans-serif'; ctx.fillText(opts.milestone ? 'MARCO CONQUISTADO' : 'UM DIA DE CADA VEZ', 540, centerY - 235);
  ctx.fillStyle = t.text; ctx.font = '800 280px sans-serif';
  const dayLabel = String(Math.max(0, Math.floor(opts.days)));
  const dayWidth = ctx.measureText(dayLabel).width;
  if (dayWidth > 850) ctx.font = `800 ${Math.max(95, Math.floor(280 * 850 / dayWidth))}px sans-serif`;
  ctx.fillText(dayLabel, 540, centerY + 20, 850);
  ctx.fillStyle = t.accent; ctx.font = '800 84px sans-serif'; ctx.fillText(opts.days === 1 ? 'DIA' : 'DIAS', 540, centerY + 118);
  ctx.strokeStyle = t.accent; ctx.globalAlpha = .65; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(310, centerY + 175); ctx.lineTo(770, centerY + 175); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = '#FFFFFF'; ctx.font = '600 47px sans-serif';
  const lines = wrapText(ctx, opts.message, 880, 4);
  lines.forEach((line, i) => ctx.fillText(line, 540, centerY + 275 + i * 65));
  const statsY = opts.format === 'story' ? 1380 : 830;
  const stats = [];
  if (!opts.discreet && opts.showSavings) stats.push(formatCurrency(opts.savings) + ' economizados');
  if (!opts.discreet && opts.showAchievements) stats.push(opts.achievements + ' conquistas');
  if (stats.length) {
    ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = .09; roundedRect(ctx, 85, statsY - 72, 910, 124, 28); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#E2E8F0'; ctx.font = '600 29px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(stats.join('   •   '), 540, statsY + 2, 880);
  }
  const bottom = h - 100;
  ctx.fillStyle = '#E2E8F0'; ctx.font = '500 29px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Sua jornada também pode começar hoje.', 540, bottom - 48);
  ctx.fillStyle = t.accent; ctx.font = '700 31px sans-serif'; ctx.fillText('app-reducao-consumo.vercel.app', 540, bottom);
  return canvas;
}
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ShareProgressPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [achievements, setAchievements] = useState(0);
  const [theme, setTheme] = useState<Theme>('noite');
  const [format, setFormat] = useState<Format>('story');
  const [message, setMessage] = useState(phrases[0]);
  const [discreet, setDiscreet] = useState(true);
  const [showSavings, setShowSavings] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<number | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [shareCount, setShareCount] = useState(0);
  useEffect(() => {
    const data = storage.getUserData();
    if (!data?.onboardingCompleted) { router.replace('/onboarding'); return; }
    setUserData(data);
    setAchievements(storage.getAchievements().filter(a => a.unlocked).length);
    try { setShareCount(Number(localStorage.getItem('weedreset_share_actions_v1') || '0')); } catch {}
  }, [router]);
  const rawDays = userData ? calculateCleanDays(userData.startDate, userData.lastRelapseDate) : 0;
  const days = Number.isFinite(rawDays) ? Math.max(0, Math.floor(rawDays)) : 0;
  const savings = userData ? calculateSavings(days, userData.dailyCost || 0) : 0;
  const reached = MILESTONES.filter(d => d <= days);
  const chosenDays = selectedMilestone ?? days;
  const artworkOpts = useMemo(() => ({ theme, format, days: chosenDays, message, savings: calculateSavings(chosenDays, userData?.dailyCost || 0), achievements, showSavings, showAchievements, discreet, milestone: selectedMilestone }), [theme, format, chosenDays, message, userData, achievements, showSavings, showAchievements, discreet, selectedMilestone]);
  useEffect(() => {
    if (!userData) return;
    const id = window.setTimeout(() => { try { setPreview(makeArtwork(artworkOpts).toDataURL('image/png')); } catch { setFeedback('Não foi possível criar a prévia neste dispositivo.'); } }, 100);
    return () => window.clearTimeout(id);
  }, [artworkOpts, userData]);
  function recordAction() { try { const next = shareCount + 1; localStorage.setItem('weedreset_share_actions_v1', String(next)); setShareCount(next); } catch {} }
  async function createBlob() {
    const canvas = makeArtwork(artworkOpts);
    return new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Falha ao gerar imagem')), 'image/png'));
  }
  async function download() {
    setBusy(true); setFeedback('');
    try { saveBlob(await createBlob(), 'weedreset-minha-conquista-' + chosenDays + 'dias.png'); recordAction(); setFeedback('Imagem salva! Agora você pode publicar onde quiser.'); }
    catch { setFeedback('Não foi possível baixar a imagem. Tente novamente.'); }
    finally { setBusy(false); }
  }
  async function share() {
    setBusy(true); setFeedback('');
    try {
      const blob = await createBlob(); const file = new File([blob], 'weedreset-conquista.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Minha conquista • WeedReset', text: 'Minha jornada, no meu ritmo. Conheça o WeedReset: ' + inviteUrl });
        recordAction(); setFeedback('Compartilhamento aberto com a imagem.');
      } else {
        saveBlob(blob, 'weedreset-minha-conquista.png'); recordAction(); setFeedback('Imagem salva. Seu navegador não permite enviar arquivos diretamente; publique a imagem na rede desejada.');
      }
    } catch (e) { if ((e as Error).name !== 'AbortError') setFeedback('Não foi possível compartilhar. Tente baixar a imagem.'); }
    finally { setBusy(false); }
  }
  async function copyInvite() {
    try { await navigator.clipboard.writeText(inviteUrl); setFeedback('Link público de convite copiado.'); }
    catch { setFeedback('Não foi possível copiar automaticamente o link.'); }
  }
  if (!userData) return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Preparando suas conquistas…</main>;
  return (
    <div className="min-h-screen bg-[#090F1E] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#090F1E]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <Link href="/" aria-label="Voltar" className="rounded-xl p-2 hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></Link>
          <Sparkles className="h-6 w-6 text-violet-300" />
          <div><h1 className="text-lg font-bold sm:text-xl">Estúdio de Conquistas</h1><p className="text-xs text-slate-400">Sua história merece ser celebrada.</p></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-10">
        <div className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-[#202044] to-[#11192B] p-5 sm:p-8">
          <span className="text-xs font-bold uppercase tracking-[.2em] text-violet-300">Sua jornada • sua escolha</span>
          <h2 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Uma conquista sua. Uma história que inspira.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Crie uma arte pronta para os Stories ou Feed. Compartilhe só o que fizer sentido para você — sem pressão e sem expor informações pessoais.</p>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4 sm:p-5">
              <h3 className="flex items-center gap-2 font-bold"><Trophy className="h-5 w-5 text-amber-300" /> O que vamos celebrar?</h3>
              <p className="mt-2 text-sm text-slate-300">Seu progresso atual: <strong className="text-white">{days} {days === 1 ? 'dia' : 'dias'}</strong></p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => setSelectedMilestone(null)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${selectedMilestone === null ? 'border-violet-300 bg-violet-400/20 text-white' : 'border-white/15 text-slate-300'}`}>Progresso atual</button>
                {reached.map(d => <button key={d} onClick={() => setSelectedMilestone(d)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${selectedMilestone === d ? 'border-violet-300 bg-violet-400/20 text-white' : 'border-white/15 text-slate-300'}`}>{d} {d === 1 ? 'dia' : 'dias'}</button>)}
              </div>
              <p className="mt-3 text-xs text-slate-400">Os marcos disponíveis correspondem apenas ao progresso já alcançado.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4 sm:p-5">
              <h3 className="font-bold">Escolha o estilo</h3>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {(Object.keys(THEMES) as Theme[]).map(k => <button key={k} onClick={() => setTheme(k)} aria-pressed={theme === k} className={`rounded-xl border p-2 text-center ${theme === k ? 'border-violet-300 ring-2 ring-violet-400/20' : 'border-white/10'}`}><span className="mx-auto mb-2 block h-9 w-full rounded-lg" style={{ background: `linear-gradient(135deg,${THEMES[k].bg},${THEMES[k].bg2})` }} /><span className="text-[11px] font-semibold">{THEMES[k].name}</span></button>)}
              </div>
              <h3 className="mt-5 font-bold">Formato</h3>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(['story', 'feed'] as Format[]).map(v => <button key={v} onClick={() => setFormat(v)} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold ${format === v ? 'border-violet-300 bg-violet-400/15' : 'border-white/15'}`}><ImageIcon className="h-4 w-4" />{v === 'story' ? 'Story · 9:16' : 'Feed · 1:1'}</button>)}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4 sm:p-5">
              <label htmlFor="share-message" className="font-bold">Sua mensagem</label>
              <div className="mt-3 flex flex-wrap gap-2">{phrases.map((p, i) => <button key={p} onClick={() => setMessage(p)} className="rounded-full border border-white/15 px-3 py-2 text-xs text-slate-200 hover:bg-white/10">Frase {i + 1}</button>)}</div>
              <textarea id="share-message" maxLength={115} rows={3} value={message} onChange={e => setMessage(e.target.value)} className="mt-3 w-full resize-none rounded-xl border border-white/20 bg-black/20 p-3 text-sm text-white outline-none focus:border-violet-300" />
              <p className="mt-1 text-right text-xs text-slate-400">{message.length}/115</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4 sm:p-5">
              <h3 className="flex items-center gap-2 font-bold"><LockKeyhole className="h-5 w-5 text-emerald-300" /> Privacidade primeiro</h3>
              <p className="mt-2 text-sm text-slate-300">O cartão não exibe nome, detalhes de saúde ou substâncias. Você decide se quer mostrar números adicionais.</p>
              <label className="mt-4 flex min-h-11 items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm">{discreet ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} Modo discreto</span><input type="checkbox" checked={discreet} onChange={e => setDiscreet(e.target.checked)} className="h-5 w-5 accent-violet-500" /></label>
              {!discreet && <div className="space-y-3 border-t border-white/10 pt-3">{([[showSavings, setShowSavings, 'Mostrar economia'], [showAchievements, setShowAchievements, 'Mostrar conquistas']] as const).map(([value, setter, label]) => <label key={label} className="flex min-h-10 items-center justify-between gap-3 text-sm"><span>{label}</span><input type="checkbox" checked={value} onChange={e => setter(e.target.checked)} className="h-5 w-5 accent-violet-500" /></label>)}</div>}
            </div>
          </section>
          <section className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between"><h3 className="font-bold">Prévia da publicação</h3><span className="text-xs text-slate-400">{format === 'story' ? '1080 × 1920' : '1080 × 1080'}</span></div>
              <div className="mx-auto max-w-[260px] overflow-hidden rounded-2xl border border-white/15 shadow-2xl sm:max-w-[330px]">{preview ? <img src={preview} alt="Prévia da sua conquista personalizada" className="block h-auto w-full" /> : <div className="aspect-[9/16] animate-pulse bg-slate-800" />}</div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button onClick={download} disabled={busy} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-violet-300/50 bg-violet-400/15 px-2 text-sm font-bold disabled:opacity-50"><Download className="h-4 w-4" />Baixar PNG</button>
                <button onClick={share} disabled={busy} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-500 px-2 text-sm font-bold text-white disabled:opacity-50"><Share2 className="h-4 w-4" />Compartilhar</button>
              </div>
              {feedback && <p role="status" className="mt-3 rounded-xl bg-white/10 p-3 text-sm text-slate-100">{feedback}</p>}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
              <h3 className="flex items-center gap-2 font-bold"><Link2 className="h-5 w-5 text-emerald-300" /> Convide alguém a começar</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">Um convite público para conhecer o WeedReset. O link não dá acesso aos seus dados nem à sua página privada.</p>
              <button onClick={copyInvite} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 text-sm font-semibold"><Copy className="h-4 w-4" />Copiar link de convite</button>
              <p className="mt-3 text-xs text-slate-400">{shareCount} ações de compartilhar ou baixar registradas neste dispositivo. Não representam visualizações nem novos cadastros.</p>
            </div>
          </section>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4 text-sm leading-6 text-slate-300"><Heart className="mt-1 h-5 w-5 shrink-0 text-emerald-300" /><p>Compartilhar é sempre opcional. Sua jornada tem valor mesmo quando ninguém mais a vê. Os cartões representam seus registros no aplicativo, não um diagnóstico ou uma promessa de recuperação.</p></div>
      </main>
    </div>
  );
}
