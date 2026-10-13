'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, CalendarDays, Check, CheckCircle2, Coins, Download, HeartHandshake,
  Loader2, RefreshCw, Save, ShieldCheck, Sparkles, Target, TrendingUp, Wallet,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ProfileActionNotice from '@/components/profile/ProfileActionNotice';

type GoalKind = 'checkins' | 'spending' | 'sessions';
type Currency = 'BRL' | 'USD' | 'EUR';
type GrowthSettings = {
  goal_kind: GoalKind;
  goal_target: number;
  goal_deadline: string | null;
  baseline_weekly_spend: number | null;
  money_currency: Currency;
  triggers: string[];
  coping_actions: string[];
  support_label: string | null;
};
type WeeklyReview = {
  week_start: string;
  sessions: number | null;
  spent: number | null;
  mood: string | null;
  money_currency: Currency;
};
type Checkin = { checkin_date: string; mood: string };

const initialSettings: GrowthSettings = {
  goal_kind: 'checkins', goal_target: 3, goal_deadline: null,
  baseline_weekly_spend: null, money_currency: 'BRL',
  triggers: [], coping_actions: [], support_label: null,
};

function localDate(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const get = (part: string) => parts.find(p => p.type === part)?.value ?? '00';
    return get('year') + '-' + get('month') + '-' + get('day');
  } catch { return date.toISOString().slice(0, 10); }
}
function addDays(iso: string, days: number) {
  const date = new Date(iso + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function mondayOf(iso: string) {
  const weekDay = new Date(iso + 'T12:00:00Z').getUTCDay();
  return addDays(iso, -((weekDay + 6) % 7));
}
function money(value: number, currency: Currency) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}
function fieldNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}
function inputStyle() {
  return 'w-full min-w-0 rounded-xl border border-white/15 bg-[#151427] px-3.5 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20';
}
function tile(label: string, value: string, note: string) {
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[.045] p-3 sm:p-4">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 truncate text-2xl font-bold tabular-nums text-white" title={value}>{value}</p>
    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{note}</p>
  </div>;
}

export default function ProfileGrowthHub({
  userId, timezone, currency,
}: { userId: string | null; timezone: string; currency: Currency }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState<'goal' | 'review' | 'support' | 'export' | null>(null);
  const [settings, setSettings] = useState<GrowthSettings>({ ...initialSettings });
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [missionsMonth, setMissionsMonth] = useState<number | null>(null);
  const [xp, setXp] = useState<number | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [reviewSpend, setReviewSpend] = useState('');
  const [reviewSessions, setReviewSessions] = useState('');
  const [reviewMood, setReviewMood] = useState('');
  const [baselineInput, setBaselineInput] = useState('');
  const [goalDirty, setGoalDirty] = useState(false);
  const [supportDirty, setSupportDirty] = useState(false);
  const [reviewDirty, setReviewDirty] = useState(false);
  const dismissNotice = useCallback(() => { setError(''); setNotice(''); }, []);
  const [triggers, setTriggers] = useState<string[]>(['', '', '']);
  const [actions, setActions] = useState<string[]>(['', '', '']);
  const [contact, setContact] = useState('');

  const today = localDate(new Date(), timezone);
  const weekStart = mondayOf(today);
  const todayMinus29 = addDays(today, -29);
  const currentReview = reviews.find(r => r.week_start === weekStart);
  const weeklyCheckins = checkins.filter(c => c.checkin_date >= weekStart && c.checkin_date <= today);
  const lastSeven = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const moods = checkins.reduce<Record<string, number>>((acc, row) => {
    acc[row.mood] = (acc[row.mood] ?? 0) + 1;
    return acc;
  }, {});
  const moodCount = checkins.length;
  const moodTop = moodCount
    ? (moods.bem ?? 0) >= Math.max(moods.normal ?? 0, moods.dificil ?? 0) ? '🙂 Bem'
      : (moods.normal ?? 0) >= (moods.dificil ?? 0) ? '😐 Regular' : '💜 Difícil'
    : '—';
  const currencyMismatch = settings.money_currency !== currency ||
    Boolean(currentReview && currentReview.money_currency !== settings.money_currency);
  const validComparison = settings.baseline_weekly_spend !== null &&
    currentReview?.spent !== null && currentReview?.spent !== undefined && !currencyMismatch;
  const difference = validComparison
    ? Number(settings.baseline_weekly_spend) - Number(currentReview?.spent)
    : null;
  const goalResult = useMemo(() => {
    if (settings.goal_kind === 'checkins') {
      return { completed: weeklyCheckins.length >= Number(settings.goal_target), current: weeklyCheckins.length,
        title: String(weeklyCheckins.length) + ' de ' + String(settings.goal_target) + ' check-ins nesta semana',
        percent: Math.min(100, 100 * weeklyCheckins.length / Math.max(1, settings.goal_target)) };
    }
    if (settings.goal_kind === 'sessions') {
      const current = currentReview?.sessions;
      return { completed: current !== null && current !== undefined && current <= settings.goal_target,
        current: current ?? null,
        title: current == null ? 'Registre suas sessões para acompanhar a meta'
          : String(current) + ' sessões nesta semana · meta de até ' + String(settings.goal_target),
        percent: current == null ? 0 : current <= settings.goal_target ? 100 : Math.max(0, 100 * settings.goal_target / Math.max(1, current)) };
    }
    return { completed: difference !== null && difference >= Number(settings.goal_target),
      current: difference,
      title: difference === null ? 'Preencha a referência e o gasto desta semana'
        : money(difference, settings.money_currency) + ' de diferença · meta ' + money(settings.goal_target, settings.money_currency),
      percent: difference === null ? 0 : Math.min(100, Math.max(0, 100 * difference / Math.max(1, settings.goal_target))) };
  }, [settings, weeklyCheckins.length, currentReview?.sessions, difference]);

  async function refresh() {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      // A sessão precisa pertencer ao usuário atual antes de buscar dados privados.
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || auth?.user?.id !== userId) throw new Error('Sua sessão precisa ser renovada.');
      const [growth, weekly, daily, profile, wallet, missions] = await Promise.all([
        supabase.from('profile_growth_settings').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('profile_weekly_reviews').select('week_start,sessions,spent,mood,money_currency')
          .eq('user_id', userId).order('week_start', { ascending: false }).limit(15),
        supabase.from('engagement_daily_checkins').select('checkin_date,mood')
          .eq('user_id', userId).gte('checkin_date', todayMinus29).lte('checkin_date', today),
        supabase.from('profiles').select('xp').eq('id', userId).maybeSingle(),
        supabase.from('user_wallet').select('coins').eq('user_id', userId).maybeSingle(),
        supabase.from('user_missions').select('mission_id,completed_at',{ count:'exact',head:true })
          .eq('user_id',userId).eq('completed',true)
          .gte('completed_at',todayMinus29 + 'T00:00:00Z'),
      ]);
      if (growth.error || weekly.error || daily.error)
        throw new Error('Não foi possível buscar metas, registros semanais ou check-ins.');
      const fromDb = growth.data as unknown as GrowthSettings | null;
      if (fromDb) {
        const next = { ...initialSettings, ...fromDb };
        setSettings(next);
        // Referências monetárias não são convertidas automaticamente entre moedas.
        setBaselineInput(next.money_currency !== currency || next.baseline_weekly_spend == null
          ? '' : String(next.baseline_weekly_spend));
        setTriggers([...next.triggers.slice(0,3), '', '', ''].slice(0,3));
        setActions([...next.coping_actions.slice(0,3), '', '', ''].slice(0,3));
        setContact(next.support_label ?? '');
      } else {
        setSettings({ ...initialSettings, money_currency: currency });
        setBaselineInput('');
        setTriggers(['','','']);
        setActions(['','','']);
        setContact('');
      }
      setGoalDirty(false);
      setSupportDirty(false);
      setReviewDirty(false);
      const weeklyData = (weekly.data ?? []) as WeeklyReview[];
      setReviews(weeklyData);
      const current = weeklyData.find(r => r.week_start === weekStart);
      setReviewSpend(!current || current.money_currency !== currency || current.spent == null
        ? '' : String(current.spent));
      setReviewSessions(current?.sessions == null ? '' : String(current.sessions));
      setReviewMood(current?.mood ?? '');
      setCheckins((daily.data ?? []) as Checkin[]);
      setXp(profile.error || !profile.data ? null : Number(profile.data.xp ?? 0));
      setCoins(wallet.error || !wallet.data ? null : Number(wallet.data.coins ?? 0));
      setMissionsMonth(missions.error ? null : missions.count ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao consultar sua evolução. Tente novamente.');
    } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); /* recarrega ao entrar/trocar conta e na semana atual */ },
    [userId, weekStart]);
  useEffect(() => {
    const beforeLeave = (event: BeforeUnloadEvent) => {
      if (!(goalDirty || supportDirty || reviewDirty)) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeLeave);
    return () => window.removeEventListener('beforeunload', beforeLeave);
  }, [goalDirty, supportDirty, reviewDirty]);

  async function saveGoal() {
    if (!userId || saving) return;
    const target = Number(settings.goal_target);
    const max = settings.goal_kind === 'checkins' ? 7 :
      settings.goal_kind === 'sessions' ? 100 : 100000;
    const baseline = fieldNumber(baselineInput);
    if (!Number.isFinite(target) || target < 1 || target > max ||
       (settings.goal_kind !== 'spending' && target !== Math.round(target)) ||
       (baselineInput.trim() !== '' && (baseline == null || baseline < 0 || baseline > 100000))) {
      setError('Revise os valores: a meta e a referência precisam ser válidas.'); return;
    }
    setSaving('goal'); setError(''); setNotice('');
    try {
      const next = { ...settings, goal_target: target, baseline_weekly_spend: baseline, money_currency: currency };
      const { data: result, error: e } = await supabase.rpc('update_profile_growth_goal', {
        p_goal_kind: next.goal_kind,
        p_goal_target: next.goal_target,
        p_goal_deadline: next.goal_deadline,
        p_baseline_weekly_spend: next.baseline_weekly_spend,
        p_money_currency: currency,
      });
      if (!e && result?.ok !== true) throw new Error('Meta não confirmada.');
      if (e) throw e;
      setSettings(next); setGoalDirty(false); setNotice('Meta salva na sua conta com sucesso.');
    } catch { setError('Não foi possível salvar sua meta. Nada foi descartado.'); }
    finally { setSaving(null); }
  }

  async function saveReview() {
    if (!userId || saving) return;
    const spent = fieldNumber(reviewSpend), sessions = fieldNumber(reviewSessions);
    if ((reviewSpend.trim() !== '' && (spent == null || spent < 0 || spent > 100000)) ||
        (reviewSessions.trim() !== '' && (sessions == null || sessions < 0 || sessions > 500 || sessions !== Math.floor(sessions))) ||
        (reviewSpend.trim() === '' && reviewSessions.trim() === '' && !reviewMood)) {
      setError('Informe ao menos um valor de acompanhamento válido.'); return;
    }
    setSaving('review'); setError(''); setNotice('');
    try {
      const { error: e } = await supabase.from('profile_weekly_reviews').upsert({
        user_id: userId, week_start: weekStart, spent,
        sessions, mood: reviewMood || null, money_currency: currency,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,week_start' });
      if (e) throw e;
      setReviews(prev => [{ week_start: weekStart, spent, sessions, mood: reviewMood || null,
        money_currency: currency }, ...prev.filter(r => r.week_start !== weekStart)]);
      setReviewDirty(false);
      setNotice('Registro semanal salvo com segurança.');
    } catch { setError('O registro semanal não foi salvo. Tente novamente.'); }
    finally { setSaving(null); }
  }

  async function saveSupport() {
    if (!userId || saving) return;
    const t = triggers.map(x => x.trim()).filter(Boolean);
    const a = actions.map(x => x.trim()).filter(Boolean);
    if (t.some(x=>x.length>100) || a.some(x=>x.length>150) || contact.length>80) {
      setError('Reduza os textos: gatilhos até 100 caracteres, ações até 150 e pessoa até 80.'); return;
    }
    setSaving('support'); setError(''); setNotice('');
    try {
      const { data: result, error: e } = await supabase.rpc('update_profile_growth_support', {
        p_triggers: t, p_coping_actions: a, p_support_label: contact.trim() || null,
      });
      if (!e && result?.ok !== true) throw new Error('Plano não confirmado.');
      if (e) throw e;
      setSettings(prev => ({ ...prev, triggers: t, coping_actions: a, support_label: contact.trim() || null }));
      setSupportDirty(false); setNotice('Plano de apoio salvo. Ele também aparecerá na área SOS.');
    } catch { setError('Não foi possível salvar seu plano de apoio.'); }
    finally { setSaving(null); }
  }

  async function exportData() {
    if (!userId || saving) return;
    setSaving('export'); setError('');
    try {
      const auth = await supabase.auth.getUser();
      if (auth.error || auth.data.user?.id !== userId) throw new Error('Sessão inválida.');
      const queries = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId),
        supabase.from('user_private_state').select('data').eq('user_id', userId),
        supabase.from('profile_growth_settings').select('*').eq('user_id', userId),
        supabase.from('profile_weekly_reviews').select('*').eq('user_id', userId).limit(1000),
        supabase.from('engagement_daily_checkins').select('*').eq('user_id', userId).limit(1000),
        supabase.from('user_missions').select('*').eq('user_id', userId).limit(1000),
        supabase.from('user_wallet').select('coins').eq('user_id', userId),
      ]);
      if (queries.some(q=>q.error)) throw new Error('Falha ao buscar os dados.');
      const exportedData = {
        exportedAt: new Date().toISOString(),
        description: 'Cópia dos dados da conta WeedReset. Guardar em local privado.',
        profile: queries[0].data, journey: queries[1].data,
        goalsAndSupport: queries[2].data, weeklyReviews: queries[3].data,
        ritualCheckins: queries[4].data, missionRecords: queries[5].data,
        wallet: queries[6].data,
        note: 'Exportação dos conjuntos principais. Consultas com máximo de 1000 itens por conjunto.',
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(exportedData,null,2)],{type:'application/json'}));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'weedreset-meus-dados-' + today + '.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      setNotice('Exportação gerada. Guarde o arquivo com cuidado: contém informações pessoais.');
    } catch { setError('Não foi possível gerar o arquivo. Confira a conexão e tente novamente.'); }
    finally { setSaving(null); }
  }
  // O download é preparado apenas na ação explícita do usuário.

  if (!userId) return null;
  return (
    <section className="min-w-0 space-y-4 text-white" aria-label="Minha evolução e metas pessoais">
      <ProfileActionNotice success={notice} error={error} onDismiss={dismissNotice}/>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-violet-200">Sua jornada, do seu jeito</p>
          <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">Meu painel de evolução</h2>
          <p className="mt-1 text-sm text-slate-300">Progresso confirmado, metas realistas e apoio quando você precisar.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading || saving !== null}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-50">
          <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')}/> Atualizar
        </button>
      </div>
      {(goalDirty || supportDirty || reviewDirty) && (
        <p role="status" className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs text-amber-100">
          Existem alterações ainda não salvas em {[
            goalDirty ? 'metas' : null,
            supportDirty ? 'plano de apoio' : null,
            reviewDirty ? 'registro semanal' : null,
          ].filter(Boolean).join(', ')}.
        </p>
      )}
      {loading ? <div role="status" className="rounded-2xl border border-white/10 bg-[#17172a] p-6 text-sm text-slate-300">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin"/> Carregando dados confirmados da nuvem...
      </div> : <>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
          {tile('Check-ins · 7 dias', String(checkins.filter(c=>c.checkin_date>=addDays(today,-6)).length), 'Rituais registrados')}
          {tile('Missões · 30 dias', missionsMonth === null ? '—' : String(missionsMonth), 'Concluídas na conta')}
          {tile('XP confirmado', xp === null ? '—' : String(xp), 'Saldo oficial do banco')}
          {tile('Moedas', coins === null ? '—' : String(coins), 'Saldo da carteira')}
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#17172a] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="font-bold">Os últimos sete dias</h3>
              <p className="mt-1 text-xs text-slate-400">O dia sem registro fica em branco; não representa fracasso.</p></div>
            <Link href="/missions" className="inline-flex items-center gap-1 text-xs font-semibold text-violet-200 underline underline-offset-4">
              Fazer check-in <ArrowRight className="h-4 w-4"/></Link>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {lastSeven.map(d=><div key={d} className="min-w-0 text-center">
              <div className={'flex h-12 items-center justify-center rounded-xl border ' +
                (checkins.some(c=>c.checkin_date===d) ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300'
                  : 'border-white/10 bg-white/[.035] text-slate-500')}>
                {checkins.some(c=>c.checkin_date===d) ? <Check className="h-5 w-5"/> : <span aria-label="Sem registro">·</span>}
              </div><span className="mt-1 block text-[10px] text-slate-400">{d.slice(8)}</span>
            </div>)}
          </div>
          <p className="mt-3 text-xs text-slate-400">Humor mais registrado nos últimos 30 dias: <strong className="text-slate-200">{moodTop}</strong>
            {moodCount > 0 ? ' (' + moodCount + ' check-ins)' : ' · comece pelo ritual de hoje'}.</p>
        </div>
      </>}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <article className="min-w-0 rounded-3xl border border-violet-400/25 bg-gradient-to-br from-[#252048] to-[#151429] p-4 shadow-xl sm:p-5">
          <div className="flex items-center gap-2"><Target className="h-5 w-5 text-violet-200"/>
            <h3 className="text-lg font-bold">Minha próxima meta</h3></div>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">Pequenos objetivos ajustáveis. Uma mudança de plano não apaga suas conquistas.</p>
          {!loading && <div className="mt-4 rounded-xl border border-violet-300/15 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-200">{goalResult.title}</p>
              {goalResult.completed && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300"/>}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-emerald-400"
                style={{width: String(goalResult.percent) + '%'}}/>
            </div>
          </div>}
          <div className="mt-4 grid gap-3">
            <label className="text-xs font-medium text-slate-200">Qual é seu foco?
              <select value={settings.goal_kind} onChange={e=>{
                const kind=e.target.value as GoalKind;
                setSettings(p=>({...p,goal_kind:kind,goal_target:kind==='checkins'?3:kind==='sessions'?5:50}));
                setGoalDirty(true);
              }} className={'mt-1 ' + inputStyle()}>
                <option value="checkins">Registrar check-ins na semana</option>
                <option value="sessions">Limitar sessões por semana</option>
                <option value="spending">Reduzir gastos na semana</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-200">
              {settings.goal_kind==='checkins'?'Quantidade de check-ins (1–7)':
                settings.goal_kind==='sessions'?'Máximo de sessões por semana':'Diferença desejada de gastos'}
              <input type="number" inputMode="decimal" min="1"
                max={settings.goal_kind==='checkins'?7:settings.goal_kind==='sessions'?100:100000}
                step={settings.goal_kind==='spending'?'0.01':'1'}
                value={settings.goal_target}
                onChange={e=>{setSettings(p=>({...p,goal_target:Number(e.target.value)}));setGoalDirty(true);}}
                className={'mt-1 ' + inputStyle()}/>
            </label>
            <label className="text-xs font-medium text-slate-200">Prazo desejado (opcional)
              <input type="date" value={settings.goal_deadline ?? ''}
                onChange={e=>{setSettings(p=>({...p,goal_deadline:e.target.value||null}));setGoalDirty(true);}}
                className={'mt-1 ' + inputStyle()}/>
            </label>
          </div>
          <button type="button" onClick={()=>void saveGoal()} disabled={saving!==null || !goalDirty || loading}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-bold text-[#17102d] transition hover:bg-violet-300 disabled:opacity-50">
            <Save className="h-4 w-4"/> {saving==='goal'?'Salvando...':'Salvar minha meta'}
          </button>
        </article>

        <article className="min-w-0 rounded-3xl border border-amber-400/20 bg-[#201b28] p-4 shadow-xl sm:p-5">
          <div className="flex items-center gap-2"><Wallet className="h-5 w-5 text-amber-200"/>
            <h3 className="text-lg font-bold">Minha economia</h3></div>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">Compare seu gasto registrado com uma referência semanal informada por você. Nunca mostramos uma economia fictícia.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {tile('Diferença nesta semana',
              difference === null ? '—' : money(difference,settings.money_currency),
              difference === null ? 'Aguardando valores' : difference >= 0 ? 'Abaixo da referência' : 'Acima da referência')}
            {tile('Projeção mensal',
              difference === null ? '—' : money(difference * 4.33,settings.money_currency),
              'Se esta diferença semanal se repetir')}
          </div>
          {currencyMismatch && <p className="mt-3 text-xs text-amber-200">Os valores foram registrados em moedas diferentes. Salve a referência e o registro na mesma moeda para comparar.</p>}
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-slate-200">
              Referência de gasto semanal ({currency}) · valor anterior
              <input value={baselineInput} type="number" min="0" max="100000" step="0.01"
                onChange={e=>{setBaselineInput(e.target.value);setGoalDirty(true);}}
                placeholder="Ex.: 140" className={'mt-1 ' + inputStyle()}/>
            </label>
            <button type="button" onClick={()=>void saveGoal()} disabled={saving!==null || !goalDirty || loading}
              className="min-h-10 w-full rounded-xl border border-amber-300/40 px-3 text-xs font-bold text-amber-100 disabled:opacity-50">
              Salvar referência de comparação
            </button>
            <div className="border-t border-white/10 pt-3">
              <p className="text-sm font-semibold text-white">Meu registro desta semana</p>
              <p className="mt-1 text-xs text-slate-400">Informe o que aconteceu; campo em branco significa não registrado, não zero.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-200">Gastei ({currency})
                  <input value={reviewSpend} type="number" min="0" step="0.01" inputMode="decimal"
                    onChange={e=>{setReviewSpend(e.target.value);setReviewDirty(true);}} placeholder="Sem registro"
                    className={'mt-1 ' + inputStyle()}/>
                </label>
                <label className="text-xs text-slate-200">Sessões
                  <input value={reviewSessions} type="number" min="0" step="1" inputMode="numeric"
                    onChange={e=>{setReviewSessions(e.target.value);setReviewDirty(true);}} placeholder="Sem registro"
                    className={'mt-1 ' + inputStyle()}/>
                </label>
              </div>
              <label className="mt-3 block text-xs text-slate-200">Como me senti (opcional)
                <select value={reviewMood} onChange={e=>{setReviewMood(e.target.value);setReviewDirty(true);}} className={'mt-1 ' + inputStyle()}>
                  <option value="">Prefiro não registrar</option>
                  <option value="bem">Bem</option><option value="normal">Um dia comum</option>
                  <option value="dificil">Foi difícil</option>
                </select>
              </label>
              <button type="button" onClick={()=>void saveReview()} disabled={saving!==null || loading}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-bold text-[#24180c] hover:bg-amber-200 disabled:opacity-50">
                <Save className="h-4 w-4"/> {saving==='review'?'Salvando...':'Salvar registro semanal'}
              </button>
            </div>
          </div>
        </article>
      </div>

      <article className="min-w-0 rounded-3xl border border-emerald-400/20 bg-[#132423] p-4 shadow-lg sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="flex items-center gap-2"><HeartHandshake className="h-5 w-5 text-emerald-300"/>
            <h3 className="text-lg font-bold">Meu plano de apoio</h3></div>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">Escreva o que costuma desencadear a vontade e o que ajuda. Só você pode ver e editar.</p></div>
          <Link href="/sos" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-400/10 px-3 text-xs font-bold text-emerald-200">
            Abrir SOS <ArrowRight className="h-4 w-4"/></Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><p className="text-xs font-semibold text-emerald-200">Meus gatilhos</p>
            {triggers.map((v,i)=><label className="block" key={'trigger'+i}>
              <span className="sr-only">{'Gatilho ' + (i+1)}</span>
              <input className={inputStyle()} maxLength={100} value={v}
                placeholder={['Ex.: estresse ao fim do dia','Ex.: situações sociais','Ex.: dificuldade para dormir'][i]}
                onChange={e=>{setTriggers(a=>a.map((x,j)=>j===i?e.target.value:x));setSupportDirty(true);}}/>
            </label>)}
          </div>
          <div className="space-y-2"><p className="text-xs font-semibold text-emerald-200">O que posso fazer nesses momentos</p>
            {actions.map((v,i)=><label className="block" key={'action'+i}>
              <span className="sr-only">{'Ação ' + (i+1)}</span>
              <input className={inputStyle()} maxLength={150} value={v}
                placeholder={['Ex.: respirar por 2 minutos','Ex.: mudar de ambiente','Ex.: conversar com alguém'][i]}
                onChange={e=>{setActions(a=>a.map((x,j)=>j===i?e.target.value:x));setSupportDirty(true);}}/>
            </label>)}
          </div>
        </div>
        <label className="mt-3 block text-xs font-semibold text-emerald-100">Pessoa de confiança (nome ou apelido, opcional)
          <input className={'mt-1 ' + inputStyle()} maxLength={80} value={contact}
            placeholder="Quem posso procurar quando precisar?"
            onChange={e=>{setContact(e.target.value);setSupportDirty(true);}}/>
        </label>
        <p className="mt-2 text-xs text-slate-400">Não é necessário informar telefone. Este plano não substitui atendimento profissional em situações de emergência.</p>
        <button type="button" onClick={()=>void saveSupport()} disabled={saving!==null || !supportDirty || loading}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 text-sm font-bold text-[#073427] hover:bg-emerald-200 disabled:opacity-50">
          <Save className="h-4 w-4"/> {saving==='support'?'Salvando...':'Salvar meu plano de apoio'}
        </button>
      </article>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#17172a] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-300"/>
          <div><h3 className="text-sm font-bold">Meus dados, meu controle</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">Exporte uma cópia dos dados principais da sua conta. O arquivo contém informações privadas: não compartilhe sem necessidade.</p></div>
        </div>
        <button type="button" onClick={()=>void exportData()} disabled={saving!==null}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/15 disabled:opacity-50">
          <Download className="h-4 w-4"/> {saving==='export'?'Preparando...':'Exportar meus dados'}
        </button>
      </div>
      <nav aria-label="Atalhos para sua jornada" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          {href:'/missions',title:'Missões',subtitle:'XP e check-ins'},
          {href:'/jornada',title:'Jornada 365',subtitle:'Reflexões e progresso'},
          {href:'/rewards',title:'Loja',subtitle:'Suas recompensas'},
          {href:'/sos',title:'SOS',subtitle:'Apoio imediato'},
          {href:'/body-evolution',title:'Evolução do corpo',subtitle:'Acompanhamento pessoal'},
          {href:'/cant-stop',title:'Não consigo parar',subtitle:'Recursos de apoio'},
        ].map(item=><Link key={item.href} href={item.href}
          className="group min-w-0 rounded-xl border border-white/10 bg-white/5 p-3 hover:border-violet-300/50 hover:bg-white/10">
          <p className="text-sm font-semibold text-white">{item.title} <ArrowRight className="inline h-3.5 w-3.5 text-violet-300"/></p>
          <p className="mt-1 text-xs text-slate-400">{item.subtitle}</p>
        </Link>)}
      </nav>
    </section>
  );
}
