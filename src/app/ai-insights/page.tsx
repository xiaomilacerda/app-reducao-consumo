'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Brain,
  ShieldAlert,
  Flame,
  Wind,
  Target,
  Clock,
  Sparkles,
  Crown,
  Lock,
  Search,
  RefreshCcw,
  MessageCircle,
  Wand2,
  Activity,
  HeartPulse,
  ListChecks,
  Lightbulb,
  ClipboardList,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';

type RiskLevel = 'low' | 'medium' | 'high';

type MoodEntry = {
  id?: string;
  user_id?: string;
  date?: string; // YYYY-MM-DD
  mood_value?: number | null; // 0..100 (ou 0..10)
  note?: string | null; // ✅ schema atual
  notes?: string | null; // fallback legado
  daily_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type JournalRow = {
  id?: string;
  user_id?: string;
  journey_day?: number | null;
  answer_text?: string | null; // ✅ schema atual
  answered_text?: string | null; // fallback legado
  created_at?: string | null;
  updated_at?: string | null;
};

type SosLog = {
  id?: string;
  user_id?: string;
  tool_id?: number | null;
  tool_name?: string | null;
  duration?: number | null; // schema atual
  duration_seconds?: number | null; // fallback legado
  used_at?: string | null; // schema atual
  created_at?: string | null; // fallback legado
};

type ProfileMini = {
  id: string;
  is_premium?: boolean | null;
};

function formatDbError(err: any) {
  if (!err) return 'Erro desconhecido';
  const parts = [err?.message, err?.details, err?.hint, err?.code].filter(Boolean);
  return parts.length ? parts.join(' | ') : String(err);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function daysAgoKey(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toPctMood(m?: number | null) {
  if (m == null || Number.isNaN(m)) return null;
  if (m <= 100 && m >= 0) return clamp(Math.round(m), 0, 100);
  if (m <= 10 && m >= 0) return clamp(Math.round((m / 10) * 100), 0, 100);
  return clamp(Math.round(m), 0, 100);
}

function riskFromSignals(opts: {
  moodPct: number | null;
  moodTrend: number;
  journalRecentCount: number;
  journalNegativity: number;
  sosRecentCount: number;
  sosAvgDuration: number;
}) {
  const { moodPct, moodTrend, journalRecentCount, journalNegativity, sosRecentCount, sosAvgDuration } = opts;

  let score = 0;

  if (moodPct == null) score += 10;
  else if (moodPct < 25) score += 35;
  else if (moodPct < 40) score += 25;
  else if (moodPct < 55) score += 15;
  else score += 5;

  if (moodTrend < -15) score += 20;
  else if (moodTrend < -5) score += 12;
  else if (moodTrend > 10) score -= 5;

  if (sosRecentCount >= 6) score += 25;
  else if (sosRecentCount >= 3) score += 16;
  else if (sosRecentCount >= 1) score += 8;

  if (sosRecentCount > 0 && sosAvgDuration > 0 && sosAvgDuration < 40) score += 8;

  if (journalRecentCount >= 4) score += 10;
  else if (journalRecentCount >= 1) score += 5;

  if (journalNegativity >= 70) score += 22;
  else if (journalNegativity >= 45) score += 14;
  else if (journalNegativity >= 25) score += 8;

  score = clamp(Math.round(score), 0, 100);

  let level: RiskLevel = 'low';
  if (score >= 68) level = 'high';
  else if (score >= 38) level = 'medium';

  return { score, level };
}

function riskColor(level: RiskLevel) {
  if (level === 'high') return 'from-red-600 to-pink-600';
  if (level === 'medium') return 'from-amber-500 to-orange-500';
  return 'from-emerald-500 to-green-600';
}

function riskLabel(level: RiskLevel) {
  if (level === 'high') return 'Risco alto (pico de fissura provável)';
  if (level === 'medium') return 'Risco moderado (atenção hoje)';
  return 'Risco baixo (continue o ritmo)';
}

function pickActionNow(level: RiskLevel) {
  if (level === 'high') {
    return {
      title: 'Protocolo Agora (4 minutos)',
      steps: [
        '1 min: Respiração 4-7-8 (sem celular).',
        '1 min: Água + alongar ombro/pescoço (soltar tensão).',
        '1 min: Mudar de ambiente (levanta e vai para outro cômodo).',
        '1 min: Abrir SOS e iniciar uma técnica guiada.',
      ],
    };
  }
  if (level === 'medium') {
    return {
      title: 'Protocolo Agora (2 minutos)',
      steps: [
        '60s: Treino de Foco (um ponto fixo + respirar).',
        '60s: Listar 3 razões práticas do porquê continuar hoje.',
      ],
    };
  }
  return {
    title: 'Manter o ritmo (1 minuto)',
    steps: ['Revisar seu “porquê” em 1 frase.', 'Definir a próxima ação saudável (água / banho / caminhada curta).'],
  };
}

function keywordScore(text: string) {
  const t = (text || '').toLowerCase();
  const bad = [
    'ansiedade',
    'raiva',
    'irritado',
    'fissura',
    'vontade',
    'crise',
    'triste',
    'pânico',
    'desespero',
    'estresse',
    'insônia',
    'sozinho',
    'cansado',
    'fracasso',
    'recaída',
    'sonhei',
    'sonho',
  ];
  let hits = 0;
  for (const k of bad) if (t.includes(k)) hits += 1;
  return clamp(Math.round((hits / 6) * 100), 0, 100);
}

function safeNumber(n: any, d = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : d;
}

function journalText(r: JournalRow) {
  return (r.answer_text ?? r.answered_text ?? '') || '';
}

function moodNoteText(r: MoodEntry) {
  return (r.note ?? r.notes ?? '') || '';
}

// -------------------------
// COACH ENGINE (OFFLINE)
// -------------------------

type CoachMode = 'idle' | 'calm_now' | 'collect_trigger' | 'plan_15' | 'if_then' | 'reflect';

type CoachState = {
  mode: CoachMode;
  // slots
  urgeLevel?: number | null; // 0..10
  where?: string | null;
  trigger?: string | null; // o que aconteceu antes
  timeOfDay?: string | null;
  dream?: boolean;
  // anti-repeat
  recentAssistantHashes: string[];
  // continuity flags
  offeredPlan?: boolean;
  offeredIfThen?: boolean;
  lastQuestion?: string | null;
  lastUserSummary?: string | null;
  createdAt: number;
  updatedAt: number;
};

const COACH_LS_PREFIX = 'weedreset_ai_coach_v2';

function hashText(s: string) {
  // hash simples (suficiente pra anti-repetição local)
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return String(h);
}

function pickVar<T>(arr: T[], avoid: Set<number>) {
  if (arr.length === 0) throw new Error('pickVar empty');
  const candidates = arr.map((_, i) => i).filter((i) => !avoid.has(i));
  const idx = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : Math.floor(Math.random() * arr.length);
  return { value: arr[idx], idx };
}

function normalizeYesNo(text: string) {
  const t = (text || '').trim().toLowerCase();
  const yes = ['sim', 's', 'claro', 'pode', 'manda', 'quero', 'ok', 'fechado', 'bora', 'por favor', 'pode montar'];
  const no = ['não', 'nao', 'n', 'agora não', 'depois', 'dispenso'];
  if (yes.some((x) => t === x || t.includes(x))) return 'yes';
  if (no.some((x) => t === x || t.includes(x))) return 'no';
  return 'unknown';
}

function extractUrgeLevel(text: string): number | null {
  const t = (text || '').toLowerCase();
  // pega número 0..10 isolado
  const m = t.match(/(^|\D)(10|[0-9])(\D|$)/);
  if (!m) return null;
  const n = Number(m[2]);
  if (Number.isFinite(n) && n >= 0 && n <= 10) return n;
  return null;
}

function detectDream(text: string) {
  const t = (text || '').toLowerCase();
  return t.includes('sonhei') || t.includes('sonho');
}

function detectAnxiety(text: string) {
  const t = (text || '').toLowerCase();
  return t.includes('ansiedade') || t.includes('ansioso') || t.includes('pânico') || t.includes('panico') || t.includes('crise');
}

function detectPlanRequest(text: string) {
  const t = (text || '').toLowerCase();
  return (
    t.includes('plano') ||
    t.includes('monta') ||
    t.includes('pode montar') ||
    t.includes('me ajuda') ||
    t.includes('o que eu faço') ||
    t.includes('passo a passo')
  );
}

function detectIfThenRequest(text: string) {
  const t = (text || '').toLowerCase();
  return t.includes('se') && t.includes('então') || t.includes('se entao') || t.includes('gatilho');
}

function build15MinPlan(args: {
  urge: number | null;
  risk: RiskLevel;
  hasDream: boolean;
  triggerHint?: string | null;
}) {
  const urge = args.urge ?? null;

  const block1 = [
    '00:00–02:00 → Água devagar + respiração (4s entra, 6–8s solta).',
    '02:00–05:00 → Troca de ambiente (levanta, luz mais forte, lava o rosto).',
    '05:00–08:00 → Ação física curta (20 agachamentos OU caminhada dentro de casa).',
    '08:00–12:00 → Tarefa “mecânica” (arrumar uma coisa pequena / banho / louça por 4 min).',
    '12:00–15:00 → Abre o SOS e faz 1 técnica completa (sem pular).',
  ];

  const block2 = [
    'Fechar o “caminho fácil”: tirar gatilho do alcance (local, item, conversa, rotina).',
    'Comida simples (proteína + carbo bom) pra não confundir fissura com queda de energia.',
    'Definir um “não negociável” de hoje: “hoje eu não uso, ponto”.',
  ];

  const dreamLine = args.hasDream
    ? 'Sobre o sonho: é comum na abstinência. Sonho não é recaída — é o cérebro descarregando hábito.'
    : '';

  const riskLine =
    args.risk === 'high'
      ? 'Hoje o foco é sobreviver ao pico sem decisões longas. Só rotina curta.'
      : args.risk === 'medium'
      ? 'Hoje é dia de proteção extra: rotina + cortar gatilho.'
      : 'Você está bem. Use o dia pra consolidar proteções.';

  const urgeLine =
    urge != null
      ? `Você disse fissura ${urge}/10. A meta é cair 2 pontos nos próximos 15 minutos — não “zerar”.`
      : 'Se puder, me diga 0–10 da fissura pra eu ajustar a intensidade.';

  const triggerLine = args.triggerHint ? `Gatilho provável: ${args.triggerHint}. Vamos contornar isso sem briga.` : '';

  return [
    'Fechado. Aqui vai um plano de 15 minutos (pra atravessar a onda):',
    '',
    ...block1,
    '',
    riskLine,
    urgeLine,
    dreamLine,
    triggerLine,
    '',
    'Quando terminar, me responde só isso: a fissura caiu pra quanto (0–10)?',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildIfThen(trigger: string | null, where: string | null) {
  const t = (trigger || 'quando eu perceber que a vontade subiu').trim();
  const w = (where || 'no lugar onde eu costumo vacilar').trim();

  const options = [
    { if: `Se ${t} (${w})`, then: 'então eu bebo água + lavo o rosto + abro o SOS e faço 1 técnica inteira.' },
    { if: `Se ${t} (${w})`, then: 'então eu levanto e vou para outro cômodo por 3 minutos (sem celular).' },
    { if: `Se ${t} (${w})`, then: 'então eu faço 20 agachamentos + 10 respirações lentas.' },
    { if: `Se ${t} (${w})`, then: 'então eu escrevo 1 linha: “eu não preciso disso hoje” e continuo a tarefa.' },
  ];

  const pick = options[Math.floor(Math.random() * options.length)];
  return [
    'Fechado. Seu “Se… então…” (pra cortar negociação):',
    '',
    `SE: ${pick.if}`,
    `ENTÃO: ${pick.then}`,
    '',
    'Quer que eu crie 3 variações (noite / trabalho / ansiedade)?',
  ].join('\n');
}

function createDefaultCoachState(): CoachState {
  const now = Date.now();
  return {
    mode: 'idle',
    urgeLevel: null,
    where: null,
    trigger: null,
    timeOfDay: null,
    dream: false,
    recentAssistantHashes: [],
    offeredPlan: false,
    offeredIfThen: false,
    lastQuestion: null,
    lastUserSummary: null,
    createdAt: now,
    updatedAt: now,
  };
}

function loadCoachState(key: string): CoachState {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return createDefaultCoachState();
    const obj = JSON.parse(raw) as CoachState;
    return { ...createDefaultCoachState(), ...obj };
  } catch {
    return createDefaultCoachState();
  }
}

function saveCoachState(key: string, s: CoachState) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...s, updatedAt: Date.now() }));
  } catch {
    // ignore
  }
}

function nextCoachMessage(args: {
  userText: string;
  state: CoachState;
  derivedRisk: { level: RiskLevel; score: number };
}) {
  const userText = (args.userText || '').trim();
  const t = userText.toLowerCase();
  const yesNo = normalizeYesNo(userText);
  const urge = extractUrgeLevel(userText);
  const hasDream = detectDream(userText);
  const anxiety = detectAnxiety(userText);

  const s: CoachState = { ...args.state };

  if (urge != null) s.urgeLevel = urge;
  if (hasDream) s.dream = true;

  // heurísticas simples de slots
  if (t.includes('estou em') || t.includes('to em') || t.includes('tô em')) {
    s.where = userText;
  }
  if (t.includes('porque') || t.includes('aconteceu') || t.includes('voltei') || t.includes('briguei') || t.includes('sonhei')) {
    s.trigger = userText;
  }

  // se o usuário pediu plano / se-então explicitamente
  const planReq = detectPlanRequest(userText);
  const ifThenReq = detectIfThenRequest(userText);

  // ---- execução coerente de promessas ----
  // Se o coach ofereceu plano e o usuário respondeu "sim/pode", ENTREGAR o plano (não perguntar igual)
  if (s.offeredPlan && yesNo === 'yes') {
    s.offeredPlan = false;
    s.mode = 'plan_15';

    const msg = build15MinPlan({
      urge: s.urgeLevel ?? urge ?? null,
      risk: args.derivedRisk.level,
      hasDream: !!s.dream,
      triggerHint: s.trigger ?? null,
    });

    return { state: s, reply: msg };
  }

  // Se ofereceu if-then e o usuário disse sim
  if (s.offeredIfThen && yesNo === 'yes') {
    s.offeredIfThen = false;
    s.mode = 'if_then';
    const msg = buildIfThen(s.trigger ?? userText, s.where ?? null);
    return { state: s, reply: msg };
  }

  // Se usuário pediu “monta um plano”, responder com plano direto
  if (planReq && (yesNo === 'yes' || t.includes('montar') || t.includes('pode') || t.includes('faça'))) {
    s.mode = 'plan_15';
    const msg = build15MinPlan({
      urge: s.urgeLevel ?? urge ?? null,
      risk: args.derivedRisk.level,
      hasDream: !!(s.dream || hasDream),
      triggerHint: s.trigger ?? userText,
    });
    return { state: s, reply: msg };
  }

  // Se usuário pediu “se então”, responder criando um
  if (ifThenReq && (t.includes('se') || t.includes('então') || t.includes('gatilho'))) {
    s.mode = 'if_then';
    const msg = buildIfThen(s.trigger ?? userText, s.where ?? null);
    return { state: s, reply: msg };
  }

  // ---- respostas variáveis por intenção ----
  const introsCalm = [
    'Entendi. Vamos baixar esse pico agora (sem negociar com a cabeça).',
    'Ok. Primeiro a gente regula o corpo, depois pensa.',
    'Fechado. Vamos acalmar em 2 minutos e depois decidir o próximo passo.',
    'Tá. Respira comigo: hoje é só atravessar a onda.',
  ];

  const askOneDetail = [
    'Me diz 1 detalhe: onde você está e o que aconteceu 2 minutos antes de bater a vontade?',
    'Me dá uma pista: qual foi o gatilho exato (lugar/horário/emoção)?',
    'Qual foi o “começo” da vontade? (um pensamento, um lugar, uma sensação?)',
    'O que mudou no ambiente nos últimos 5 minutos?',
  ];

  const dreamReframe = [
    'Sobre o sonho: isso é bem comum na abstinência. Sonho não é recaída — é cérebro descarregando hábito.',
    'Sonhar com isso acontece muito quando você está firme. Não significa que você “quer” de verdade.',
    'Sonho assim é efeito colateral normal. O que importa é o que você faz acordado.',
  ];

  const microNow = [
    'Agora: água devagar + 10 respirações longas (solta mais lento do que entra).',
    'Agora: levanta, muda de cômodo e lava o rosto. Isso quebra o piloto automático.',
    'Agora: 20 agachamentos OU caminhada de 2 minutos (mesmo dentro de casa).',
    'Agora: pega uma tarefa mecânica por 3 minutos (arrumar algo pequeno).',
  ];

  const offerPlan = [
    'Quer que eu monte um plano fechado de 15 minutos pra hoje?',
    'Se você quiser, eu faço um passo-a-passo de 15 minutos (bem prático).',
    'Quer um plano rápido (15 min) pra derrubar a fissura 2 pontos?',
  ];

  const offerIfThen = [
    'Quer que eu monte um “Se… então…” personalizado com esse gatilho?',
    'Se você quiser, eu crio um “Se… então…” pra cortar negociação na hora.',
    'Quer um plano “Se… então…” pra esse momento específico?',
  ];

  // anti-repetição: evita repetir mesma “intro” e “pergunta”
  const avoid = new Set<number>();
  const avoid2 = new Set<number>();

  // determina intenção principal
  let intent: 'calm' | 'dream' | 'generic' = 'generic';
  if (anxiety) intent = 'calm';
  if (hasDream) intent = 'dream';

  // monta resposta por blocos, mas variando
  const { value: intro, idx: introIdx } = pickVar(introsCalm, avoid);
  avoid.add(introIdx);

  const { value: nowStep, idx: nowIdx } = pickVar(microNow, avoid2);
  avoid2.add(nowIdx);

  const { value: ask, idx: askIdx } = pickVar(askOneDetail, new Set());
  const { value: planOffer } = pickVar(offerPlan, new Set());
  const { value: ifOffer } = pickVar(offerIfThen, new Set());

  const dreamLine = intent === 'dream' ? dreamReframe[Math.floor(Math.random() * dreamReframe.length)] : '';

  // Coerência: se usuário respondeu "sim" sozinho, mas não tinha promessa aberta, pedir UMA info específica
  // e abrir “promessa” correta (plano ou se-então) em seguida.
  if (yesNo === 'yes' && !s.offeredPlan && !s.offeredIfThen && !planReq && !ifThenReq) {
    s.mode = 'collect_trigger';
    s.offeredPlan = true; // a próxima confirmação “sim” entrega o plano
    const msg = [intro, nowStep, '', ask, planOffer].filter(Boolean).join('\n');
    return { state: s, reply: msg };
  }

  // caso geral: resposta curta, 1 pergunta, e oferece 1 coisa (não duas)
  s.mode = anxiety ? 'calm_now' : 'collect_trigger';
  s.offeredPlan = true; // por padrão oferece plano (e depois executa se sim)
  s.offeredIfThen = false;

  // Se o texto menciona gatilho social/hábito, oferece “se então” em vez de plano
  if (t.includes('gatilho') || t.includes('banheiro') || t.includes('noite') || t.includes('sozinho') || t.includes('entediado')) {
    s.offeredPlan = false;
    s.offeredIfThen = true;
  }

  const msg = [
    intro,
    nowStep,
    dreamLine,
    '',
    ask,
    s.offeredPlan ? planOffer : ifOffer,
    '',
    'De 0 a 10: quão forte está a vontade agora?',
  ]
    .filter(Boolean)
    .join('\n');

  // anti-repetição final
  const h = hashText(msg);
  if (s.recentAssistantHashes.includes(h)) {
    // se repetiu, troca por um fallback diferente
    const fallback = [
      'Ok. Vamos fazer o mínimo que funciona agora:',
      '1) Água devagar (20s)',
      '2) Troca de ambiente (30s)',
      '3) SOS por 2 minutos',
      '',
      'Me diz: 0–10 da vontade e qual foi o gatilho?',
    ].join('\n');
    s.recentAssistantHashes = [...s.recentAssistantHashes.slice(-8), hashText(fallback)];
    return { state: s, reply: fallback };
  }

  s.recentAssistantHashes = [...s.recentAssistantHashes.slice(-8), h];
  return { state: s, reply: msg };
}

export default function AiInsightsPage() {
  const [mounted, setMounted] = useState(false);

  const [supabaseUser, setSupabaseUser] = useState<any | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  const [loading, setLoading] = useState(true);

  const [mood, setMood] = useState<MoodEntry[]>([]);
  const [journal, setJournal] = useState<JournalRow[]>([]);
  const [sos, setSos] = useState<SosLog[]>([]);

  const [searchQ, setSearchQ] = useState('');
  const [tab, setTab] = useState<'overview' | 'coach' | 'history'>('overview');

  const [coachInput, setCoachInput] = useState('');
  const [coachMsgs, setCoachMsgs] = useState<{ role: 'user' | 'assistant'; text: string; ts: number }[]>([]);
  const coachEndRef = useRef<HTMLDivElement | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  // coach memory (local)
  const coachStateKey = useMemo(() => {
    const uid = supabaseUser?.id || 'guest';
    return `${COACH_LS_PREFIX}:${uid}`;
  }, [supabaseUser?.id]);

  const [coachState, setCoachState] = useState<CoachState>(() => {
    if (typeof window === 'undefined') return createDefaultCoachState();
    return createDefaultCoachState();
  });

  useEffect(() => {
    setMounted(true);
    try {
      const local = storage?.getUserData?.();
      void local;
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAuth() {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user ?? null;
        if (cancelled) return;

        setSupabaseUser(user);

        if (user) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('id, is_premium')
            .eq('id', user.id)
            .maybeSingle();

          if (!cancelled) {
            if (error) console.error('Erro carregando profile em /ai-insights:', formatDbError(error), error);
            setIsPremium(!!(profile as ProfileMini | null)?.is_premium);
          }
        }
      } catch (err) {
        console.error('Erro auth /ai-insights:', err);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    }

    loadAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  // load coach state from localStorage AFTER we know key
  useEffect(() => {
    if (!mounted) return;
    const st = loadCoachState(coachStateKey);
    setCoachState(st);
  }, [mounted, coachStateKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      if (!supabaseUser?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const since90 = new Date();
      since90.setDate(since90.getDate() - 90);
      const iso90 = since90.toISOString();
      const key90 = daysAgoKey(90);

      async function loadMood() {
        try {
          const { data, error } = await supabase
            .from('mood_entries')
            .select('id, user_id, date, mood_value, note, daily_message, created_at')
            .eq('user_id', supabaseUser.id)
            .gte('created_at', iso90)
            .order('date', { ascending: false })
            .limit(180);

          if (error) throw error;
          return (data as MoodEntry[]) ?? [];
        } catch (error1: any) {
          console.error('Erro carregando mood_entries (created_at):', formatDbError(error1), error1);

          try {
            const { data, error } = await supabase
              .from('mood_entries')
              .select('id, user_id, date, mood_value, note, created_at')
              .eq('user_id', supabaseUser.id)
              .gte('created_at', iso90)
              .order('date', { ascending: false })
              .limit(180);

            if (error) throw error;
            return (data as MoodEntry[]) ?? [];
          } catch (error1b: any) {
            console.error('Erro mood_entries (sem daily_message):', formatDbError(error1b), error1b);

            try {
              const { data, error } = await supabase
                .from('mood_entries')
                .select('id, user_id, date, mood_value, notes, daily_message, created_at')
                .eq('user_id', supabaseUser.id)
                .gte('created_at', iso90)
                .order('date', { ascending: false })
                .limit(180);

              if (error) throw error;
              return (data as MoodEntry[]) ?? [];
            } catch (errorNotes: any) {
              console.error('Erro mood_entries (notes):', formatDbError(errorNotes), errorNotes);

              try {
                const { data, error } = await supabase
                  .from('mood_entries')
                  .select('id, user_id, date, mood_value, note, daily_message, updated_at')
                  .eq('user_id', supabaseUser.id)
                  .gte('updated_at', iso90)
                  .order('date', { ascending: false })
                  .limit(180);

                if (error) throw error;
                return (data as MoodEntry[]) ?? [];
              } catch (error2: any) {
                console.error('Erro mood_entries (updated_at):', formatDbError(error2), error2);

                try {
                  const { data, error } = await supabase
                    .from('mood_entries')
                    .select('id, user_id, date, mood_value, note, daily_message')
                    .eq('user_id', supabaseUser.id)
                    .gte('date', key90)
                    .order('date', { ascending: false })
                    .limit(180);

                  if (error) throw error;
                  return (data as MoodEntry[]) ?? [];
                } catch (error3: any) {
                  console.error('Erro mood_entries (date):', formatDbError(error3), error3);
                  return [];
                }
              }
            }
          }
        }
      }

      async function loadJournal() {
        try {
          const { data, error } = await supabase
            .from('mission_journal')
            .select('id, user_id, journey_day, answer_text, updated_at, created_at')
            .eq('user_id', supabaseUser.id)
            .order('journey_day', { ascending: false })
            .limit(365);

          if (error) throw error;
          return (data as JournalRow[]) ?? [];
        } catch (error1: any) {
          console.error('Erro mission_journal (answer_text):', formatDbError(error1), error1);

          try {
            const { data, error } = await supabase
              .from('mission_journal')
              .select('id, user_id, journey_day, answered_text, updated_at, created_at')
              .eq('user_id', supabaseUser.id)
              .order('journey_day', { ascending: false })
              .limit(365);

            if (error) throw error;
            return (data as JournalRow[]) ?? [];
          } catch (error2: any) {
            console.error('Erro mission_journal (answered_text):', formatDbError(error2), error2);

            try {
              const { data, error } = await supabase
                .from('mission_journal')
                .select('id, user_id, journey_day, updated_at, created_at')
                .eq('user_id', supabaseUser.id)
                .order('journey_day', { ascending: false })
                .limit(365);

              if (error) throw error;
              return (data as JournalRow[]) ?? [];
            } catch (error3: any) {
              console.error('Erro mission_journal (simples):', formatDbError(error3), error3);
              return [];
            }
          }
        }
      }

      async function loadSos() {
        try {
          const { data, error } = await supabase
            .from('sos_logs')
            .select('id, user_id, tool_id, duration, used_at')
            .eq('user_id', supabaseUser.id)
            .gte('used_at', iso90)
            .order('used_at', { ascending: false })
            .limit(250);

          if (error) throw error;
          return (data as SosLog[]) ?? [];
        } catch (error1: any) {
          console.error('Erro sos_logs (used_at):', formatDbError(error1), error1);

          try {
            const { data, error } = await supabase
              .from('sos_logs')
              .select('id, user_id, tool_id, duration_seconds, created_at')
              .eq('user_id', supabaseUser.id)
              .gte('created_at', iso90)
              .order('created_at', { ascending: false })
              .limit(250);

            if (error) throw error;
            return (data as SosLog[]) ?? [];
          } catch (error2: any) {
            console.error('Erro sos_logs (created_at):', formatDbError(error2), error2);
            return [];
          }
        }
      }

      const [m, j, s] = await Promise.all([loadMood(), loadJournal(), loadSos()]);
      if (cancelled) return;

      setMood(m);
      setJournal(j);
      setSos(s);

      setLoading(false);
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [supabaseUser?.id, reloadKey]);

  useEffect(() => {
    if (!coachEndRef.current) return;
    coachEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [coachMsgs.length, tab]);

  const derived = useMemo(() => {
    const lastMoodPct = toPctMood(mood?.[0]?.mood_value ?? null);

    const last10 = mood
      .slice(0, 10)
      .map((x) => toPctMood(x.mood_value ?? null))
      .filter((x) => x != null) as number[];
    const trend = last10.length >= 2 ? last10[0] - last10[last10.length - 1] : 0;

    const jRecent = journal.slice(0, 7);
    const jNeg = jRecent.reduce((acc, r) => acc + keywordScore(journalText(r)), 0) / Math.max(1, jRecent.length);

    const sRecent = sos.slice(0, 20);
    const durations = sRecent
      .map((x) => safeNumber(x.duration ?? x.duration_seconds, 0))
      .filter((v) => v > 0);
    const avgDur = durations.reduce((a, b) => a + b, 0) / Math.max(1, durations.length);

    const risk = riskFromSignals({
      moodPct: lastMoodPct,
      moodTrend: trend,
      journalRecentCount: jRecent.length,
      journalNegativity: Math.round(jNeg),
      sosRecentCount: sRecent.length,
      sosAvgDuration: Math.round(avgDur),
    });

    const nowProtocol = pickActionNow(risk.level);

    const insights: { icon: React.ReactNode; title: string; desc: string }[] = [];

    if (lastMoodPct != null && lastMoodPct < 40) {
      insights.push({
        icon: <HeartPulse className="w-4 h-4" />,
        title: 'Seu humor está baixo hoje',
        desc: 'Quando o humor cai, a fissura tenta parecer “atalho”. Ganhe no micro: água, banho, levantar, SOS.',
      });
    } else if (lastMoodPct != null && lastMoodPct >= 65) {
      insights.push({
        icon: <Sparkles className="w-4 h-4" />,
        title: 'Humor está bom — use isso a seu favor',
        desc: 'Dias bons servem pra instalar proteções (rotina + bloqueios + plano se-então).',
      });
    } else {
      insights.push({
        icon: <Activity className="w-4 h-4" />,
        title: 'Dia neutro pede ritual curto',
        desc: 'Neutro é quando a mente tenta “tanto faz”. Um ritual de 2 min evita decisão errada depois.',
      });
    }

    if (trend < -10) {
      insights.push({
        icon: <Flame className="w-4 h-4" />,
        title: 'Tendência de queda',
        desc: 'Isso é acúmulo. Priorize sono + comida simples + cortar gatilhos.',
      });
    } else if (trend > 10) {
      insights.push({
        icon: <Lightbulb className="w-4 h-4" />,
        title: 'Tendência positiva',
        desc: 'Reforce a identidade livre registrando vitórias pequenas.',
      });
    }

    if (sRecent.length >= 3) {
      insights.push({
        icon: <Wind className="w-4 h-4" />,
        title: 'SOS em alta',
        desc: 'Bom sinal: você está treinando atravessar pico. Tente 1 sessão um pouco mais longa (2–4 min).',
      });
    }

    if (Math.round(jNeg) >= 45) {
      insights.push({
        icon: <Brain className="w-4 h-4" />,
        title: 'Tensão no diário',
        desc: 'Hoje não precisa resolver tudo. 1 tarefa pequena + 1 autocuidado + 1 proteção.',
      });
    }

    const ifThenDefaults = [
      { if: 'Se eu entrar no banheiro e bater a vontade', then: 'eu lavo o rosto com água fria + abro o SOS (1 técnica).' },
      { if: 'Se eu me pegar “negociando” na cabeça', then: 'eu escrevo 1 linha: “eu não preciso disso hoje” e mudo de cômodo.' },
      { if: 'Se eu estiver entediado à noite', then: 'eu faço 10 min de algo mecânico (arrumar algo, banho, caminhar na casa).' },
      { if: 'Se eu estiver com ansiedade forte', then: 'eu faço respiração 4-7-8 por 2 ciclos e bebo água devagar.' },
    ];

    return {
      lastMoodPct,
      trend: Math.round(trend),
      journalNegativity: Math.round(jNeg),
      sosRecentCount: sRecent.length,
      sosAvgDuration: Math.round(avgDur),
      risk,
      nowProtocol,
      insights,
      ifThenDefaults,
    };
  }, [mood, journal, sos]);

  const filteredHistory = useMemo(() => {
    const q = (searchQ || '').trim().toLowerCase();
    if (!q) return journal;

    return journal.filter((r) => {
      const text = journalText(r).toLowerCase();
      const day = String(r.journey_day ?? '');
      return text.includes(q) || day === q;
    });
  }, [journal, searchQ]);

  function onSendCoach() {
    const text = (coachInput || '').trim();
    if (!text) return;

    const now = Date.now();
    const { state: nextState, reply } = nextCoachMessage({
      userText: text,
      state: coachState,
      derivedRisk: derived.risk,
    });

    const nextMsgs = [
      ...coachMsgs,
      { role: 'user' as const, text, ts: now },
      { role: 'assistant' as const, text: reply, ts: now + 1 },
    ];

    setCoachMsgs(nextMsgs);
    setCoachInput('');

    setCoachState(nextState);
    saveCoachState(coachStateKey, nextState);
  }

  function clearCoach() {
    setCoachMsgs([]);
    const fresh = createDefaultCoachState();
    setCoachState(fresh);
    try {
      window.localStorage.removeItem(coachStateKey);
    } catch {}
  }

  function reload() {
    setReloadKey((k) => k + 1);
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  const lockedPremium = !isPremium;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-950 to-gray-950 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-6 h-6 text-white/80" />
            </Link>

            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
              <Wand2 className="w-5 h-5" />
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold">IA Offline — Insights & Plano de Ação</h1>
              <p className="text-xs sm:text-sm text-white/70">Coach com memória local + respostas variáveis (sem repetir)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isPremium ? (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold text-xs">
                <Crown className="w-4 h-4" />
                Premium ativo
              </span>
            ) : (
              <Link
                href="/premium"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white/90 text-xs font-semibold transition-colors"
              >
                <Lock className="w-4 h-4" />
                Ver Premium
              </Link>
            )}

            <button onClick={reload} className="p-2 rounded-lg hover:bg-white/10 transition-colors" title="Recarregar" type="button">
              <RefreshCcw className="w-5 h-5 text-white/80" />
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 pb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('overview')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              tab === 'overview' ? 'bg-white text-black border-white' : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
            }`}
          >
            Visão geral
          </button>
          <button
            type="button"
            onClick={() => setTab('coach')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              tab === 'coach' ? 'bg-white text-black border-white' : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
            }`}
          >
            Coach
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              tab === 'history' ? 'bg-white text-black border-white' : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
            }`}
          >
            Histórico 365
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {!authChecked && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-300" />
            Checando sua conta…
          </div>
        )}

        {authChecked && !supabaseUser && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">Para liberar o painel inteligente e salvar multi-dispositivo, faça login.</div>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-sm"
            >
              Entrar / Criar conta
            </Link>
          </div>
        )}

        {tab === 'overview' && (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-6 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-white/70">
                      <ShieldAlert className="w-4 h-4 text-purple-300" />
                      Painel de risco (últimos 90 dias)
                    </div>
                    <h2 className="mt-1 text-xl sm:text-2xl font-bold">{riskLabel(derived.risk.level)}</h2>
                    <p className="mt-1 text-sm text-white/70">
                      Score: <span className="font-semibold text-white">{derived.risk.score}/100</span>
                      {' • '}
                      Humor atual: <span className="font-semibold text-white">{derived.lastMoodPct ?? '—'}%</span>
                      {' • '}
                      Tendência:{' '}
                      <span className="font-semibold text-white">{derived.trend >= 0 ? `+${derived.trend}` : derived.trend}</span>
                    </p>
                  </div>

                  <div className="w-24 h-24 rounded-2xl bg-black/30 border border-white/10 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl font-black">{derived.risk.score}</div>
                      <div className="text-[11px] text-white/60 uppercase tracking-wide">score</div>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${riskColor(derived.risk.level)}`} style={{ width: `${derived.risk.score}%` }} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-white/60">SOS (recente)</div>
                      <div className="text-lg font-bold">{derived.sosRecentCount}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-white/60">Duração média</div>
                      <div className="text-lg font-bold">{derived.sosAvgDuration ? `${derived.sosAvgDuration}s` : '—'}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-white/60">Negatividade (diário)</div>
                      <div className="text-lg font-bold">{derived.journalNegativity}%</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-white/60">Entradas de humor</div>
                      <div className="text-lg font-bold">{mood.length}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-purple-600/20 to-pink-600/10 p-6 shadow-xl">
                <div className="flex items-center gap-2 text-xs font-semibold text-white/70">
                  <Clock className="w-4 h-4 text-pink-200" />
                  Recomendação imediata
                </div>
                <h3 className="mt-1 text-lg font-bold">{derived.nowProtocol.title}</h3>

                <ul className="mt-4 space-y-2 text-sm text-white/85">
                  {derived.nowProtocol.steps.map((st, idx) => (
                    <li key={`step-${idx}`} className="flex items-start gap-2">
                      <ListChecks className="w-4 h-4 mt-0.5 text-purple-200" />
                      <span>{st}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex flex-col gap-2">
                  <Link
                    href="/sos"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors"
                  >
                    <Wind className="w-4 h-4" />
                    Abrir SOS agora
                  </Link>
                  <Link
                    href="/cant-stop"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-white font-semibold text-sm hover:bg-white/15 transition-colors"
                  >
                    <Target className="w-4 h-4" />
                    Ir para Não Consigo Parar
                  </Link>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-white/70">
                    <Brain className="w-4 h-4 text-purple-300" />
                    Insights acionáveis
                  </div>
                  <h3 className="mt-1 text-lg font-bold">O que fazer hoje</h3>
                  <p className="mt-1 text-sm text-white/70">Baseado no seu histórico (humor, diário e SOS).</p>
                </div>
                <Link
                  href="/mood"
                  className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white/90 text-xs font-semibold hover:bg-white/15 transition-colors"
                >
                  <Activity className="w-4 h-4" />
                  Abrir Humor
                </Link>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {derived.insights.map((x, i) => (
                  <div key={`ins-${i}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <span className="text-purple-200">{x.icon}</span>
                      {x.title}
                    </div>
                    <p className="mt-2 text-sm text-white/75">{x.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-white/70">
                    <ClipboardList className="w-4 h-4 text-purple-300" />
                    Plano “Se… então…”
                  </div>
                  <h3 className="mt-1 text-lg font-bold">Decisão vira rotina</h3>
                  <p className="mt-1 text-sm text-white/70">Frases prontas para cortar gatilhos.</p>
                </div>

                {lockedPremium ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-white/80 text-xs font-semibold">
                    <Lock className="w-4 h-4" />
                    Edição no Premium
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/20 text-emerald-200 text-xs font-semibold">
                    <Crown className="w-4 h-4" />
                    Editável (Premium)
                  </span>
                )}
              </div>

              <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {derived.ifThenDefaults.map((r, idx) => (
                  <div key={`ifthen-${idx}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs text-white/60 font-semibold">SE</div>
                    <div className="mt-1 text-sm font-semibold">{r.if}</div>

                    <div className="mt-3 text-xs text-white/60 font-semibold">ENTÃO</div>
                    <div className="mt-1 text-sm">{r.then}</div>

                    {lockedPremium && <div className="mt-3 text-[11px] text-white/55">No Premium você cria e salva seus próprios planos.</div>}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'coach' && (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-white/70">
                  <MessageCircle className="w-4 h-4 text-purple-300" />
                  Coach offline (anti-repetição + memória local)
                </div>
                <h2 className="mt-1 text-lg sm:text-xl font-bold">Conversa guiada para atravessar a fissura</h2>
                <p className="mt-1 text-sm text-white/70">Ele mantém contexto e entrega o plano quando você diz “sim”.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearCoach}
                  className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white/85 text-xs font-semibold hover:bg-white/15 transition-colors"
                  title="Limpar conversa e memória local"
                >
                  Limpar
                </button>

                {lockedPremium ? (
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white/80 text-xs font-semibold">
                    <Lock className="w-4 h-4" />
                    Histórico completo no Premium
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/20 text-emerald-200 text-xs font-semibold">
                    <Crown className="w-4 h-4" />
                    Premium ativo
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-black/20 p-4 h-[420px] overflow-auto">
                {coachMsgs.length === 0 ? (
                  <div className="text-sm text-white/70">
                    <p className="font-semibold text-white mb-2">Sugestões para começar:</p>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 mt-0.5 text-purple-300" />
                        <span>“A vontade subiu agora, me ajuda a atravessar.”</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 mt-0.5 text-purple-300" />
                        <span>“Sonhei que estava fumando e acordei ansioso.”</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 mt-0.5 text-purple-300" />
                        <span>“Monta um plano de 15 minutos pra eu me acalmar.”</span>
                      </li>
                    </ul>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {coachMsgs.map((m, idx) => (
                      <div
                        key={`msg-${idx}-${m.ts}`}
                        className={`rounded-2xl p-3 border ${
                          m.role === 'user'
                            ? 'bg-white/10 border-white/10'
                            : 'bg-gradient-to-br from-purple-600/25 to-pink-600/10 border-purple-400/20'
                        }`}
                      >
                        <div className="text-[11px] uppercase tracking-wide text-white/60 font-semibold">
                          {m.role === 'user' ? 'Você' : 'Coach'}
                        </div>
                        <pre className="mt-1 text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{m.text}</pre>
                      </div>
                    ))}
                    <div ref={coachEndRef} />
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-white/60 font-semibold">Atalhos rápidos</div>
                <div className="mt-3 space-y-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setCoachInput('A vontade subiu agora, me ajuda a atravessar.')}
                    className="w-full text-left px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
                  >
                    Pico agora
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoachInput('Sonhei que estava fumando e acordei ansioso.')}
                    className="w-full text-left px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
                  >
                    Sonho + ansiedade
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoachInput('Monta um plano de 15 minutos para eu me acalmar agora.')}
                    className="w-full text-left px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
                  >
                    Plano 15 min
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoachInput('Minha fissura está 7/10.')}
                    className="w-full text-left px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
                  >
                    Informar nível (0–10)
                  </button>
                </div>

                <div className="mt-4 text-xs text-white/60">
                  Dica: ele fica muito mais “inteligente” quando você diz <b>gatilho</b> + <b>nível 0–10</b>.
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-end gap-2">
              <textarea
                value={coachInput}
                onChange={(e) => setCoachInput(e.target.value)}
                rows={2}
                className="flex-1 rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                placeholder="Escreva aqui…"
              />
              <button
                type="button"
                onClick={onSendCoach}
                className="px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-sm hover:opacity-95 transition-opacity"
              >
                Enviar
              </button>
            </div>

            <div className="mt-3 text-[11px] text-white/35">
              Coach com memória local (anti-repetição). Se você quiser, a gente também pode salvar esse chat no Supabase pra ficar multi-dispositivo.
            </div>
          </section>
        )}

        {tab === 'history' && (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-white/70">
                  <Search className="w-4 h-4 text-purple-300" />
                  Histórico de respostas (Jornada 365)
                </div>
                <h2 className="mt-1 text-lg sm:text-xl font-bold">Buscar respostas por palavra ou dia</h2>
                <p className="mt-1 text-sm text-white/70">
                  Total carregado: <span className="font-semibold text-white">{journal.length}</span>
                </p>
              </div>

              {!isPremium && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/75">
                  <div className="font-semibold text-white">Premium</div>
                  <div className="mt-1">Acesso ao histórico completo + busca avançada.</div>
                  <Link
                    href="/premium"
                    className="mt-3 inline-flex items-center justify-center px-3 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-white/90 transition-colors"
                  >
                    Ver Premium
                  </Link>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-white/50 absolute left-3 top-3" />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Buscar (ex.: ansiedade, sono, foco) ou digite o número do dia..."
                  className="w-full rounded-2xl bg-black/30 border border-white/10 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>

              <Link
                href="/missions"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-2xl bg-white/10 border border-white/10 text-white font-semibold text-sm hover:bg-white/15 transition-colors"
              >
                Voltar para Missões
              </Link>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
              <div className="max-h-[520px] overflow-auto">
                {(isPremium ? filteredHistory : filteredHistory.slice(0, 25)).map((r, idx) => (
                  <div key={`jr-${idx}-${r.id ?? 'x'}`} className="border-b border-white/10 p-4 last:border-b-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold">Dia {r.journey_day ?? '—'}</div>
                      <div className="text-[11px] text-white/50">
                        {r.updated_at || r.created_at ? new Date((r.updated_at || r.created_at) as string).toLocaleString() : ''}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-white/85 whitespace-pre-wrap leading-relaxed">
                      {journalText(r) || <span className="text-white/50">Sem texto</span>}
                    </div>
                  </div>
                ))}

                {!isPremium && filteredHistory.length > 25 && (
                  <div className="p-5 text-sm text-white/70">
                    <div className="font-semibold text-white">Desbloqueie o histórico completo</div>
                    <div className="mt-1">No Premium você vê todas as respostas do ano, com busca completa.</div>
                    <Link
                      href="/premium"
                      className="mt-3 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-sm"
                    >
                      Virar Premium
                    </Link>
                  </div>
                )}

                {isPremium && filteredHistory.length === 0 && <div className="p-5 text-sm text-white/70">Nenhuma resposta encontrada.</div>}
              </div>
            </div>

            <div className="mt-3 text-xs text-white/50">Dica: buscar por “sono”, “ansiedade”, “foco” ou digitar um dia (ex.: 12).</div>
          </section>
        )}

        {loading && supabaseUser && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="rounded-2xl border border-white/10 bg-black/60 p-5 flex items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-500 border-t-transparent" />
              <div>
                <div className="font-semibold">Carregando dados…</div>
                <div className="text-xs text-white/60">(humor, diário e SOS)</div>
              </div>
            </div>
          </div>
        )}

        <div className="text-[11px] text-white/35">
          Leitura compatível com seu banco: mood_entries.note e mission_journal.answer_text (com fallback notes/answered_text).
        </div>
      </main>
    </div>
  );
}
