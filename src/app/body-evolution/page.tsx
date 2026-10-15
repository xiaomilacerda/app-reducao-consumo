'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { storage } from '@/lib/storage';
import { UserData, BodyEvolution } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

import {
  Heart,
  ArrowLeft,
  CheckCircle,
  Clock,
  Info,
  ChevronDown,
  ChevronUp,
  Lock,
  Sparkles,
  Crown,
  Gift,
  Pencil,
  Save,
  X,
  Brain,
  Moon,
  Wind,
  Activity,
  ArrowRight,
} from 'lucide-react';

import { calculateCleanDays } from '@/lib/utils-recovery';

// ------------------ Helpers ------------------
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatHours(value: number): string {
  if (!Number.isFinite(value)) return '0,00';
  const safe = Math.max(0, value);
  return safe.toFixed(2).replace('.', ',');
}

function formatPercent(value: number): string {
  const p = Math.round(clamp(value, 0, 1) * 100);
  return `${p}%`;
}

function formatDateTimeBR(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

// ------------------ Types ------------------
type StageDetails = {
  title: string;
  bullets: string[];
  tip?: string;
};

type Stage = BodyEvolution & {
  details?: StageDetails;
};

type NoteRow = {
  stage_hours: number;
  note_text: string;
  created_at: string;
};

// ------------------ Time helpers (hours) ------------------
const H = {
  hours: (n: number) => n,
  days: (n: number) => n * 24,
  months30: (n: number) => n * 30 * 24,
  year: 365 * 24,
};

// ------------------ Reward config ------------------
const COMPLETION_REWARD = {
  name: 'Luz Suprema',
  item_id: 'avatar_A20',
  img: '/avatars/A20.png',
};

// ------------------ Local notes key (fallback offline) ------------------
const LOCAL_NOTES_KEY = 'we_reset_body_evolution_notes_v2';

// Salva no localStorage como: { [stage_hours]: { note_text, created_at } }
function loadLocalNotes(): Record<string, { note_text: string; created_at: string }> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_NOTES_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return {};
    return obj;
  } catch {
    return {};
  }
}

function saveLocalNotes(obj: Record<string, { note_text: string; created_at: string }>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

// ------------------ Timeline ------------------
const BODY_EVOLUTION: Stage[] = [
  {
    hours: H.hours(6),
    title: '6 Horas',
    description:
      'Você começa a perceber mais claramente seus gatilhos e momentos em que costumava fumar. É um primeiro contato com a nova rotina.',
    icon: '⏱️',
    completed: false,
    details: {
      title: 'O que costuma acontecer por volta de 6 horas',
      bullets: [
        'Você começa a notar mais o “automático” (os momentos em que você fumaria sem pensar).',
        'A mente pode ficar inquieta em ondas: isso é comum nos primeiros marcos.',
        'Seu cérebro começa a “pedir” o hábito — e você começa a reconhecer o pedido.',
      ],
      tip: 'Hoje a meta é simples: identifique 1 gatilho e substitua por 1 ação rápida (água, banho, respiração, 10 flexões, caminhada curta).',
    },
  },
  {
    hours: H.hours(12),
    title: '12 Horas',
    description:
      'Muitas pessoas relatam leve mudança de disposição e atenção ao próprio corpo. A vontade pode oscilar bastante aqui.',
    icon: '🌙',
    completed: false,
    details: {
      title: 'O que costuma melhorar por volta de 12 horas',
      bullets: [
        'Você começa a “sentir” melhor os picos de vontade (eles sobem e descem).',
        'Algumas pessoas relatam sono diferente: mais leve ou mais agitado.',
        'Você começa a construir a primeira microconfiança: “eu consigo segurar”.',
      ],
      tip: 'Quando bater a fissura: faça 60 segundos de foco (olhar fixo + respiração lenta). Só isso já “quebra o pico”.',
    },
  },
  {
    hours: H.hours(24),
    title: '24 Horas',
    description:
      'Seu corpo está se ajustando à ausência do hábito. Ansiedade ou irritação podem aparecer, mas são fases comuns do processo.',
    icon: '🌱',
    completed: false,
    details: {
      title: '1 dia: a virada do “ontem eu fumei”',
      bullets: [
        'Você começa a passar por situações do dia a dia sem “usar o velho botão”.',
        'Oscilações de humor podem aparecer — isso não significa fracasso, só ajuste.',
        'Você começa a treinar o “não preciso agora”.',
      ],
      tip: 'Evite decisões grandes hoje. Foque em manter o básico: comer, água, banho, sair um pouco, dormir.',
    },
  },
  {
    hours: H.hours(48),
    title: '48 Horas',
    description:
      'Seu sono e apetite podem ficar diferentes do habitual. É um momento de observar o que muda e testar novas rotinas saudáveis.',
    icon: '🌿',
    completed: false,
    details: {
      title: '2 dias: o cérebro começa a aceitar novas rotas',
      bullets: [
        'O corpo vai entendendo que o hábito não vai acontecer “só porque a mente pediu”.',
        'Gatilhos antigos podem aparecer mais fortes — mas também ficam mais previsíveis.',
        'Você começa a criar um padrão: vontade → ferramenta → alívio.',
      ],
      tip: 'Hoje é um ótimo dia pra criar um ritual curto pós-refeição (ex.: escovar dentes + água gelada + 2 minutos de respiração).',
    },
  },
  {
    hours: H.hours(72),
    title: '72 Horas',
    description:
      'Esse período costuma ser um pico de desconforto em relatos de muita gente. Passar daqui costuma trazer sensação de vitória.',
    icon: '💪',
    completed: false,
    details: {
      title: '3 dias: “pico” que vira marco',
      bullets: [
        'Muita gente sente esse marco como um “teste”: você passa e se sente mais forte.',
        'O automático começa a perder força quando você resiste repetidamente.',
        'Você começa a perceber que a vontade não manda: ela passa.',
      ],
      tip: 'Se bater forte: use SOS + mude o ambiente por 5 minutos (banho, rua, outro cômodo). Ambiente muda emoção rápido.',
    },
  },
  {
    hours: H.days(5),
    title: '5 Dias',
    description:
      'Você já atravessou os primeiros dias, que costumam ser os mais intensos. O corpo começa a se acostumar com a nova rotina.',
    icon: '🛡️',
    completed: false,
    details: {
      title: '5 dias: você já não é “o mesmo” do começo',
      bullets: [
        'Você acumulou vitórias pequenas suficientes pra formar base.',
        'Os picos ainda existem, mas você já tem ferramentas para atravessar.',
        'Seu cérebro começa a aprender que “não usar” é uma opção real.',
      ],
      tip: 'Faça uma lista de 3 gatilhos e 3 respostas (uma pra cada). Deixe isso fácil de acessar (print/nota).',
    },
  },
  {
    hours: H.days(7),
    title: '1 Semana',
    description:
      'O humor de muita gente começa a ficar um pouco mais estável. Você já tem uma semana de experiência lidando com gatilhos.',
    icon: '⭐',
    completed: false,
    details: {
      title: '1 semana: estabilidade começando a aparecer',
      bullets: [
        'Você começa a enxergar a semana com “menos névoa” e mais controle.',
        'Alguns gatilhos perdem intensidade por repetição (você provou que dá).',
        'Você começa a construir identidade: “sou alguém que segura”.',
      ],
      tip: 'Recompense a semana: algo simples e saudável (comida boa, filme, sair, compra pequena). O cérebro aprende com recompensa.',
    },
  },
  {
    hours: H.days(10),
    title: '10 Dias',
    description:
      'Alguns hábitos antigos começam a perder força no automático. Você começa a se ver em situações em que antes fumaria e agora não fuma.',
    icon: '🎯',
    completed: false,
    details: {
      title: '10 dias: o automático enfraquece',
      bullets: [
        'Você percebe “ah, eu passaria por isso fumando… e passei sem”.',
        'A fissura pode vir mais espaçada, e você começa a prever quando virá.',
        'Rotinas novas começam a ganhar lugar (mesmo que pequenas).',
      ],
      tip: 'Escolha 1 hábito novo pequeno pra consolidar (ex.: 10 min de caminhada depois do almoço). Pequeno, mas consistente.',
    },
  },
  {
    hours: H.days(14),
    title: '2 Semanas',
    description:
      'Memória e concentração podem ficar mais organizadas. A rotina tende a parecer um pouco mais leve do que nos primeiros dias.',
    icon: '🔥',
    completed: false,
    details: {
      title: '2 semanas: sua mente começa a “respirar” melhor',
      bullets: [
        'A rotina sem uso começa a parecer mais normal do que “exceção”.',
        'Você aprende padrões: o que dispara fissura e o que alivia.',
        'A autoconfiança cresce por repetição — não por força de vontade.',
      ],
      tip: 'Crie um plano para “dias ruins”: 3 ações de emergência + 1 pessoa pra chamar + 1 lugar seguro.',
    },
  },
  {
    hours: H.days(21),
    title: '3 Semanas',
    description:
      'Muitas pessoas relatam que, a partir daqui, alguns gatilhos começam a diminuir de intensidade. A sensação de “conseguir” fica mais presente.',
    icon: '🚶‍♂️',
    completed: false,
    details: {
      title: '3 semanas: consistência vira vantagem',
      bullets: [
        'Você já tem “histórico” suficiente pra confiar no processo.',
        'Gatilhos antigos começam a ser enfrentados com menos medo.',
        'Você começa a se perceber mais estável em decisões e rotina.',
      ],
      tip: 'Escolha 1 gatilho “difícil” e enfrente com estratégia (SÓ 1). Ex.: música + caminhada + SOS.',
    },
  },
  {
    hours: H.months30(1),
    title: '1 Mês',
    description:
      'Respiração, disposição e sono tendem a estar diferentes do início. Não é perfeito todos os dias, mas a média costuma ser melhor.',
    icon: '👑',
    completed: false,
    details: {
      title: '1 mês: você está criando uma nova versão',
      bullets: [
        'O “eu do mês passado” já não manda mais no seu dia a dia.',
        'Você já passou por ciclos (fissura, tédio, estresse) e sobreviveu.',
        'Você começa a recuperar tempo e energia antes perdidos no hábito.',
      ],
      tip: 'Faça um “antes e depois” simples: 3 coisas que melhoraram + 1 desafio que ainda pega. Isso vira combustível.',
    },
  },
  {
    hours: H.days(45),
    title: '45 Dias',
    description:
      'Você já passou por vários ciclos de vontade e se testou em diversas situações. A confiança na sua capacidade de escolha tende a crescer.',
    icon: '🏆',
    completed: false,
    details: {
      title: '45 dias: você atravessou várias ondas',
      bullets: [
        'Você cria resistência emocional: a fissura não te derruba tão fácil.',
        'Você começa a “se reconhecer” menos no padrão antigo.',
        'A disciplina começa a pesar mais do que a força de vontade.',
      ],
      tip: 'Faça uma regra clara: “se bater, eu uso SOS primeiro”. Zero negociação com a fissura.',
    },
  },
  {
    hours: H.months30(2),
    title: '2 Meses',
    description: 'Seu dia a dia começa a ter uma identidade nova, com hábitos diferentes dos de antes.',
    icon: '🌄',
    completed: false,
    details: {
      title: '2 meses: identidade nova se forma',
      bullets: [
        'Você começa a viver mais “presente” em tarefas simples.',
        'Você se acostuma a resolver tédio/estresse com outras coisas.',
        'O hábito antigo começa a parecer menos necessário.',
      ],
      tip: 'Reforce sua rotina: sono, alimentação, movimento. Essas 3 coisas deixam fissura mais fraca.',
    },
  },
  {
    hours: H.months30(3),
    title: '3 Meses',
    description: 'Ajustes físicos e emocionais continuam acontecendo. Atividades simples podem parecer mais leves.',
    icon: '💎',
    completed: false,
    details: {
      title: '3 meses: mais clareza e estabilidade',
      bullets: ['Você ganha “espaço mental”.', 'Você se sente mais confiável pra você mesmo.', 'Você protege melhor sua rotina e seus limites.'],
      tip: 'Defina 1 meta concreta (trabalho, projeto, saúde). A energia que volta precisa de destino.',
    },
  },
  {
    hours: H.months30(4),
    title: '4 Meses',
    description: 'A leitura dos próprios limites fica mais clara. Você percebe sinais cedo e ajusta melhor seu ambiente.',
    icon: '🧭',
    completed: false,
    details: {
      title: '4 meses: autoconsciência mais forte',
      bullets: ['Você percebe sinais cedo (antes de virar recaída).', 'Você aprende o que te protege e o que te expõe.', 'Seu “sim” e “não” ficam mais firmes.'],
      tip: 'Se tiver um ambiente que te puxa pra trás: tempo limitado + saída planejada.',
    },
  },
  {
    hours: H.months30(5),
    title: '5 Meses',
    description: 'A consistência começa a pesar mais do que a força de vontade momentânea. Você construiu disciplina.',
    icon: '📈',
    completed: false,
    details: {
      title: '5 meses: consistência vira estilo de vida',
      bullets: ['Você confia mais na sua disciplina como ferramenta real.', 'Você tem histórico de vitórias.', 'A fissura aparece menos “mandona”.'],
      tip: 'Faça um check-in semanal de 5 minutos: gatilhos, vitórias, desafios.',
    },
  },
  {
    hours: H.months30(6),
    title: '6 Meses',
    description: 'Seu corpo e sua mente já caminharam bastante nessa mudança. Metade do ano é um marco grande.',
    icon: '🌟',
    completed: false,
    details: {
      title: '6 meses: metade do ano é um marco pesado',
      bullets: ['Rotina bem diferente do início.', 'Mais constância em metas.', 'Mais sensação de “dono do seu dia”.'],
      tip: 'Crie um marco de celebração saudável. Reforça identidade e compromisso.',
    },
  },
  {
    hours: H.months30(7),
    title: '7 Meses',
    description: 'Você já viveu situações difíceis sem voltar ao padrão antigo. Isso fortalece sua identidade.',
    icon: '🧩',
    completed: false,
    details: {
      title: '7 meses: você provou em fases diferentes',
      bullets: ['Você atravessou épocas boas e ruins sem depender do hábito.', 'Você aprende a “ser você” sem muleta.', 'Recaída deixa de parecer inevitável.'],
      tip: 'Reforce proteção nos gatilhos perigosos (rotas de saída, limites, pessoas).',
    },
  },
  {
    hours: H.months30(8),
    title: '8 Meses',
    description: 'A nova versão de você já está bem consolidada. Gatilhos antigos tendem a ser mais fáceis de lidar.',
    icon: '🧱',
    completed: false,
    details: {
      title: '8 meses: base sólida',
      bullets: ['O hábito antigo fica mais distante.', 'Resultados aparecem em outras áreas.', 'Estabilidade em decisões.'],
      tip: 'Cuidado com excesso de confiança. Tenha 1 ferramenta SOS favorita sempre à mão.',
    },
  },
  {
    hours: H.months30(9),
    title: '9 Meses',
    description: 'Você não está mais “tentando”. Você está vivendo assim. A normalidade muda.',
    icon: '🏗️',
    completed: false,
    details: {
      title: '9 meses: vira normalidade',
      bullets: ['A vida sem fumar vira padrão.', 'Você lida melhor com tédio/ansiedade.', 'Mais confiança em você.'],
      tip: 'Se vier forte, trate como evento raro: SOS + ambiente + ação física curta.',
    },
  },
  {
    hours: H.months30(10),
    title: '10 Meses',
    description: 'Você construiu uma história de decisões diferentes. Isso se espalha para foco, projetos e relações.',
    icon: '📚',
    completed: false,
    details: {
      title: '10 meses: sua história já mudou',
      bullets: ['Provas de longo prazo.', 'Mais responsabilidade por você.', 'Mais foco em metas.'],
      tip: 'Planeje o 1 ano: o que você quer dizer quando chegar lá? Isso vira motivação absurda.',
    },
  },
  {
    hours: H.months30(11),
    title: '11 Meses',
    description: 'Quase um ano: sua identidade já mudou bastante. Período ótimo para consolidar hábitos e metas.',
    icon: '🧠',
    completed: false,
    details: {
      title: '11 meses: consolidação final',
      bullets: ['Você sabe o que funciona pra você.', 'Não negocia com o hábito.', 'Mais autonomia.'],
      tip: 'Escolha 1 hábito “adulto” pra selar a fase (sono, treino, estudo, rotina matinal).',
    },
  },
  {
    hours: H.year,
    title: '1 Ano',
    description: 'Um ano representa uma mudança profunda de hábito e identidade. É um marco muito importante.',
    icon: '🎖️',
    completed: false,
    details: {
      title: '1 ano: marco de identidade',
      bullets: ['Você construiu um novo padrão de vida.', 'Controle vira prática, não sorte.', 'Você vira referência pra você mesmo.'],
      tip: 'Transforme isso em missão: proteja sua rotina com carinho e mantenha o que te trouxe até aqui.',
    },
  },
];

// ------------------ Component ------------------
export default function BodyEvolutionPage() {
  const { toast } = useToast();

  const [mounted, setMounted] = useState(false);

  const [userData, setUserData] = useState<UserData | null>(null);
  const [evolution, setEvolution] = useState<Stage[]>(BODY_EVOLUTION);
  const [cleanHours, setCleanHours] = useState(0);

  const [expandedHours, setExpandedHours] = useState<number | null>(null);
  const [showAllStages, setShowAllStages] = useState(false);
  const [activeSystem, setActiveSystem] = useState<'mente' | 'sono' | 'respiracao' | 'energia'>('mente');

  // Auth + premium
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  // Notes
  const [notes, setNotes] = useState<Record<number, { note_text: string; created_at: string }>>({});
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [savingStage, setSavingStage] = useState<number | null>(null);
  const draftRefs = useRef<Record<number, string>>({});

  // Edit mode (Premium)
  const [editingStage, setEditingStage] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  // Reward claim
  const [rewardOwned, setRewardOwned] = useState(false);
  const [claiming, setClaiming] = useState(false);

  // -------- mount: load local userData + compute progress --------
  useEffect(() => {
    setMounted(true);

    const data = storage.getUserData();

    const safeData: UserData = data
      ? ({
          ...data,
          startDate: data.startDate || new Date().toISOString(),
          lastRelapseDate: data.lastRelapseDate ?? null,
          dailyCost: typeof data.dailyCost === 'number' && !Number.isNaN(data.dailyCost) ? data.dailyCost : 20,
          gramsPerJoint:
            typeof data.gramsPerJoint === 'number' && !Number.isNaN(data.gramsPerJoint) ? data.gramsPerJoint : 0.5,
          pricePerGram:
            typeof (data as any).pricePerGram === 'number' && !Number.isNaN((data as any).pricePerGram)
              ? (data as any).pricePerGram
              : 10,
          frequencyAmount:
            typeof data.frequencyAmount === 'number' && !Number.isNaN(data.frequencyAmount) ? data.frequencyAmount : 4,
          frequencyPeriod: data.frequencyPeriod || 'day',
          thcPotency: typeof data.thcPotency === 'number' && !Number.isNaN(data.thcPotency) ? data.thcPotency : 5,
          themeMode: data.themeMode || 'default',
        } as UserData)
      : ({
          startDate: new Date().toISOString(),
          lastRelapseDate: null,
          dailyCost: 20,
          gramsPerJoint: 0.5,
          pricePerGram: 10,
          frequencyAmount: 4,
          frequencyPeriod: 'day',
          thcPotency: 5,
          themeMode: 'default',
        } as any);

    if (!data) storage.saveUserData(safeData);

    setUserData(safeData);

    const days = calculateCleanDays(safeData.startDate, safeData.lastRelapseDate);
    const safeDays = Number.isFinite(days) ? days : 0;
    const hours = safeDays * 24;
    setCleanHours(hours);

    const updated = BODY_EVOLUTION.map((stage) => ({
      ...stage,
      completed: hours >= stage.hours,
    }));
    setEvolution(updated);

    const lastCompleted = [...updated].reverse().find((s) => s.completed);
    setExpandedHours(lastCompleted?.hours ?? null);
  }, []);

  // -------- load auth + premium status --------
  useEffect(() => {
    let cancelled = false;

    async function loadAuth() {
      try {
        const { data } = await supabase.auth.getUser();
        const u = data?.user ?? null;
        if (cancelled) return;

        setUserId(u?.id ?? null);

        if (u?.id) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('is_premium')
            .eq('id', u.id)
            .maybeSingle();

          if (!cancelled) {
            if (error) console.error('Erro carregando profiles.is_premium em /body-evolution:', error);
            setIsPremium(!!profile?.is_premium);
          }
        }
      } catch (e) {
        console.error('Erro auth /body-evolution:', e);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    }

    loadAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  // -------- load notes (Supabase if logged, else local) --------
  useEffect(() => {
    let cancelled = false;

    async function loadNotes() {
      setLoadingNotes(true);

      const local = loadLocalNotes();
      const localMap: Record<number, { note_text: string; created_at: string }> = {};
      Object.keys(local).forEach((k) => {
        const n = Number(k);
        if (Number.isFinite(n) && local[k]?.note_text) {
          localMap[n] = { note_text: local[k].note_text, created_at: local[k].created_at };
        }
      });

      if (!userId) {
        if (!cancelled) setNotes(localMap);
        setLoadingNotes(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('body_evolution_notes')
          .select('stage_hours, note_text, created_at')
          .eq('user_id', userId)
          .order('stage_hours', { ascending: true });

        if (error) {
          console.warn('Notas não disponíveis agora (usando local):', error);
          if (!cancelled) setNotes(localMap);
        } else {
          const dbMap: Record<number, { note_text: string; created_at: string }> = {};
          (data as NoteRow[] | null)?.forEach((r) => {
            dbMap[Number(r.stage_hours)] = { note_text: r.note_text, created_at: r.created_at };
          });

          const merged: Record<number, { note_text: string; created_at: string }> = { ...localMap, ...dbMap };
          if (!cancelled) setNotes(merged);
        }
      } catch (e) {
        console.error('Erro carregando notas (fallback local):', e);
        if (!cancelled) setNotes(localMap);
      } finally {
        if (!cancelled) setLoadingNotes(false);
      }
    }

    loadNotes();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // -------- reward owned check --------
  useEffect(() => {
    let cancelled = false;

    async function loadRewardOwned() {
      if (!userId) {
        setRewardOwned(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('user_store_items')
          .select('item_id')
          .eq('user_id', userId)
          .eq('item_id', COMPLETION_REWARD.item_id)
          .limit(1);

        if (!cancelled) {
          if (error) {
            console.warn('Erro checando recompensa:', error);
            setRewardOwned(false);
          } else {
            setRewardOwned(Array.isArray(data) && data.length > 0);
          }
        }
      } catch (e) {
        console.warn('Erro checando recompensa (catch):', e);
        if (!cancelled) setRewardOwned(false);
      }
    }

    loadRewardOwned();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // -------- derived values --------
  const safeCleanDays = useMemo(() => Math.floor(cleanHours / 24), [cleanHours]);

  const completedStages = useMemo(() => evolution.filter((s) => s.completed).length, [evolution]);

  const lastCompletedStage = useMemo(() => {
    return [...evolution].reverse().find((s) => s.completed) ?? null;
  }, [evolution]);

  const nextStage = useMemo(() => evolution.find((s) => !s.completed) ?? null, [evolution]);

  const nextProgress = useMemo(() => {
    const start = lastCompletedStage?.hours ?? 0;
    const end = nextStage?.hours ?? H.year;
    const denom = Math.max(1, end - start);
    const raw = (cleanHours - start) / denom;
    return clamp(raw, 0, 1);
  }, [cleanHours, lastCompletedStage, nextStage]);

  const remainingDaysNextStage = useMemo(() => {
    if (!nextStage) return 0;
    if (cleanHours >= nextStage.hours) return 0;
    return Math.max(0, Math.ceil((nextStage.hours - cleanHours) / 24));
  }, [cleanHours, nextStage]);

  const isFocusMode = (userData as any)?.themeMode === 'focus';

  const hasCompletedFullYear = cleanHours >= H.year;

  // -------- actions --------
  async function insertNoteToSupabase(stage: Stage, trimmed: string) {
    if (!userId) return { ok: false as const, reason: 'no_user' as const };

    try {
      const { error } = await supabase.from('body_evolution_notes').insert({
        user_id: userId,
        stage_hours: stage.hours,
        stage_title: stage.title,
        note_text: trimmed,
      });
      if (error) return { ok: false as const, reason: 'error' as const, error };
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, reason: 'exception' as const, error: e };
    }
  }

  async function updateNoteInSupabase(stage: Stage, trimmed: string) {
    if (!userId) return { ok: false as const, reason: 'no_user' as const };

    try {
      const { data, error } = await supabase
        .from('body_evolution_notes')
        .update({ note_text: trimmed, stage_title: stage.title })
        .eq('user_id', userId)
        .eq('stage_hours', stage.hours)
        .select('id')
        .limit(1);

      if (error) return { ok: false as const, reason: 'error' as const, error };

      // Se não atualizou nada (não existia no DB), tenta inserir
      if (!data || data.length === 0) {
        const ins = await insertNoteToSupabase(stage, trimmed);
        if (!ins.ok) return { ok: false as const, reason: 'insert_fallback_failed' as const, error: (ins as any).error };
      }

      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, reason: 'exception' as const, error: e };
    }
  }

  async function saveNewNote(stage: Stage, text: string) {
    const trimmed = (text ?? '').trim();
    if (trimmed.length < 3) {
      toast({ title: 'Escreva um pouco mais', description: 'Digite pelo menos algumas palavras.' });
      return;
    }

    const created_at = new Date().toISOString();
    setSavingStage(stage.hours);

    // salva local
    const local = loadLocalNotes();
    local[String(stage.hours)] = { note_text: trimmed, created_at };
    saveLocalNotes(local);

    setNotes((prev) => ({
      ...prev,
      [stage.hours]: { note_text: trimmed, created_at },
    }));

    // tenta salvar no Supabase (se logado)
    if (userId) {
      const res = await insertNoteToSupabase(stage, trimmed);
      if (!res.ok) {
        console.warn('Falha ao salvar nota no Supabase (mantendo local):', (res as any).error);
        toast({
          title: 'Registro salvo',
          description: 'Ficou salvo com segurança. Se estiver logado, será sincronizado quando disponível.',
        });
      } else {
        toast({ title: 'Registro salvo!', description: 'Você pode manter como está — editar é Premium.' });
      }
    } else {
      toast({ title: 'Registro salvo!', description: 'Você pode manter como está — editar é Premium.' });
    }

    setSavingStage(null);
  }

  function startEdit(stageHours: number) {
    if (!isPremium) {
      toast({ title: 'Recurso Premium', description: 'Editar registros é um bônus Premium.' });
      return;
    }
    const existing = notes[stageHours]?.note_text ?? '';
    setEditingStage(stageHours);
    setEditText(existing);
  }

  function cancelEdit() {
    setEditingStage(null);
    setEditText('');
  }

  async function saveEdit(stage: Stage) {
    if (!isPremium) {
      toast({ title: 'Recurso Premium', description: 'Editar registros é um bônus Premium.' });
      return;
    }

    const trimmed = (editText ?? '').trim();
    if (trimmed.length < 3) {
      toast({ title: 'Escreva um pouco mais', description: 'Digite pelo menos algumas palavras.' });
      return;
    }

    const existingCreated = notes[stage.hours]?.created_at ?? new Date().toISOString();
    setSavingStage(stage.hours);

    // atualiza local
    const local = loadLocalNotes();
    local[String(stage.hours)] = { note_text: trimmed, created_at: existingCreated };
    saveLocalNotes(local);

    setNotes((prev) => ({
      ...prev,
      [stage.hours]: { note_text: trimmed, created_at: existingCreated },
    }));

    // tenta atualizar no Supabase (se logado)
    if (userId) {
      const res = await updateNoteInSupabase(stage, trimmed);
      if (!res.ok) {
        console.warn('Falha ao atualizar nota no Supabase (mantendo local):', (res as any).error);
        toast({
          title: 'Alteração salva',
          description: 'Ficou salva com segurança. Se estiver logado, será sincronizada quando disponível.',
        });
      } else {
        toast({ title: 'Alteração salva!', description: 'Pronto ✅' });
      }
    } else {
      toast({ title: 'Alteração salva!', description: 'Pronto ✅' });
    }

    setSavingStage(null);
    cancelEdit();
  }

  async function claimCompletionReward() {
    if (!hasCompletedFullYear) return;

    if (!userId) {
      toast({ title: 'Faça login para coletar', description: 'Você precisa estar logado para adicionar no inventário.' });
      return;
    }

    if (rewardOwned) {
      toast({ title: 'Você já coletou!', description: 'Essa recompensa já está no seu inventário.' });
      return;
    }

    try {
      setClaiming(true);
      const ins = await supabase.from('user_store_items').insert({
        user_id: userId,
        item_id: COMPLETION_REWARD.item_id,
        equipped: false,
      });

      if (ins.error && ins.error.code !== '23505') {
        throw ins.error;
      }

      setRewardOwned(true);
      toast({ title: 'Recompensa coletada! 🎉', description: `Você desbloqueou ${COMPLETION_REWARD.name}.` });
    } catch (e) {
      console.error('Erro coletando recompensa:', e);
      toast({ title: 'Não foi possível coletar', description: 'Tente novamente.' });
    } finally {
      setClaiming(false);
    }
  }

  // ---------- UI ----------
  if (!mounted || !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${
        isFocusMode
          ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900'
          : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900'
      }`}
    >
      {/* Header */}
      <header className="bg-black/40 backdrop-blur-xl shadow-lg sticky top-0 z-40 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <ArrowLeft className="w-6 h-6 text-white/80" />
              </Link>
              <Heart className="w-8 h-8 text-red-500" />
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
                  Evolução do Seu Corpo
                </h1>
                <span className="text-xs text-white/70">Acompanhe seu ritmo e desbloqueie detalhes por etapa.</span>
              </div>
            </div>

            {authChecked && isPremium && (
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-white text-xs sm:text-sm font-semibold">
                <Crown className="w-4 h-4" />
                <span className="hidden sm:inline">Premium</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Progresso Geral */}
        <section className="rounded-2xl bg-gradient-to-r from-emerald-400/80 to-green-500/70 p-[1px] shadow-2xl">
          <div className="rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-200" />
                  Seu Progresso
                </h2>
                <p className="text-xs text-white/70 mt-1">Um marco de cada vez.</p>
              </div>

              <div className="text-[11px] text-white/60 text-right">
                <div>{formatHours(cleanHours)}h</div>
                <div>
                  {safeCleanDays} dia{safeCleanDays === 1 ? '' : 's'} limpo
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/10 border border-white/10 p-4">
                <p className="text-xs text-white/70 mb-1">Tempo limpo</p>
                <p className="text-2xl font-bold text-white">{safeCleanDays} dias</p>
                <p className="text-xs text-white/60 mt-1">{formatHours(cleanHours)} horas</p>
              </div>

              <div className="rounded-xl bg-white/10 border border-white/10 p-4">
                <p className="text-xs text-white/70 mb-1">Etapas completadas</p>
                <p className="text-2xl font-bold text-white">
                  {completedStages}/{evolution.length}
                </p>
                <p className="text-xs text-white/60 mt-1">{Math.round((completedStages / evolution.length) * 100)}% completo</p>
              </div>

              <div className="rounded-xl bg-white/10 border border-white/10 p-4">
                <p className="text-xs text-white/70 mb-1">Próxima etapa</p>
                <p className="text-base font-semibold text-white">{nextStage ? nextStage.title : 'Todas completas 🎉'}</p>
                <p className="text-xs text-white/60 mt-1">
                  {nextStage ? `Faltam ~${remainingDaysNextStage} dia${remainingDaysNextStage === 1 ? '' : 's'}` : 'Você fechou a timeline.'}
                </p>

                {nextStage && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-white/70 mb-1">
                      <span>
                        Progresso até <strong>{nextStage.title}</strong>
                      </span>
                      <span>{formatPercent(nextProgress)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/30 overflow-hidden border border-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-green-400"
                        style={{ width: `${Math.round(nextProgress * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-emerald-300/25 bg-gradient-to-br from-[#102b2b] via-[#171c31] to-[#271837] p-5 text-white shadow-xl sm:p-7">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-emerald-200"><Sparkles className="h-4 w-4"/> Sua jornada de descobertas</div>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Entenda o que pode mudar no seu organismo</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">Cada marco libera novos conhecimentos. Seu corpo tem seu próprio ritmo: os prazos indicam etapas do aplicativo, não garantias de recuperação.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              {id:'mente',name:'Cérebro e atenção',Icon:Brain},
              {id:'sono',name:'Sono e sonhos',Icon:Moon},
              {id:'respiracao',name:'Respiração',Icon:Wind},
              {id:'energia',name:'Energia e humor',Icon:Activity},
            ] as const).map(item=><button key={item.id} type="button" onClick={()=>setActiveSystem(item.id)} aria-pressed={activeSystem===item.id} className={'flex min-h-28 flex-col items-start justify-between rounded-2xl border p-3 text-left transition '+(activeSystem===item.id?'border-emerald-300/70 bg-emerald-300/15':'border-white/10 bg-white/5 hover:bg-white/10')}><item.Icon className="h-6 w-6 text-emerald-200"/><span className="text-sm font-semibold">{item.name}</span></button>)}
          </div>
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
            {activeSystem==='mente'&&<><h3 className="font-semibold text-emerald-200">Cérebro e atenção</h3><p className="mt-1 text-sm text-white/80">A atenção e a memória podem mudar após reduzir ou interromper o consumo. A evolução varia conforme frequência, duração do uso e outros fatores.</p><p className="mt-2 text-xs text-white/60">Observe: está mais fácil acompanhar uma conversa ou concluir uma tarefa?</p></>}
            {activeSystem==='sono'&&<><h3 className="font-semibold text-emerald-200">Sono e sonhos</h3><p className="mt-1 text-sm text-white/80">Dificuldade para dormir e sonhos intensos podem ocorrer durante a abstinência, especialmente no início. Melhoras não acontecem em uma data fixa.</p><p className="mt-2 text-xs text-white/60">Observe: duração, despertares e sensação ao acordar.</p></>}
            {activeSystem==='respiracao'&&<><h3 className="font-semibold text-emerald-200">Respiração</h3><p className="mt-1 text-sm text-white/80">Para quem fuma, reduzir a exposição à fumaça pode beneficiar as vias respiratórias. Sintomas como tosse e catarro merecem acompanhamento se persistirem.</p><p className="mt-2 text-xs text-white/60">Observe: tosse, irritação e conforto ao respirar.</p></>}
            {activeSystem==='energia'&&<><h3 className="font-semibold text-emerald-200">Energia e humor</h3><p className="mt-1 text-sm text-white/80">Irritabilidade, ansiedade e mudanças de apetite podem aparecer na adaptação. Um dia difícil não apaga o progresso.</p><p className="mt-2 text-xs text-white/60">Observe: disposição, apetite e estratégias que ajudam.</p></>}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/mood" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2 text-sm font-bold text-[#102a27]">Registrar como me sinto <ArrowRight className="h-4 w-4"/></Link>
            <Link href="/sos" className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white">Preciso de apoio</Link>
          </div>
        </section>

        {/* Timeline */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">Biblioteca de descobertas</h3>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200 mb-6">
            Explore os marcos já alcançados e registre sua experiência. Os prazos são simbólicos e não representam um diagnóstico do seu organismo.
          </p>

          {loadingNotes && (
            <div className="mb-4 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/30 border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-3">
              Carregando seus registros...
            </div>
          )}

          <div className="space-y-3">
            {evolution.map((stage, index) => {
              if (!showAllStages && !stage.completed && nextStage?.hours !== stage.hours) return null;
              const remainingDays =
                cleanHours < stage.hours ? Math.max(0, Math.ceil((stage.hours - cleanHours) / 24)) : 0;

              const canOpen = !!stage.completed;
              const isOpen = expandedHours === stage.hours;

              const isNextCard = nextStage?.hours === stage.hours;
              const prevStage = evolution[index - 1];
              const prevHours = prevStage?.hours ?? (lastCompletedStage?.hours ?? 0);
              const segment = Math.max(1, stage.hours - prevHours);
              const insideProgress = clamp((cleanHours - prevHours) / segment, 0, 1);

              const noteExists = !!notes[stage.hours]?.note_text;
              const noteCreatedAt = notes[stage.hours]?.created_at;

              const isEditingThis = editingStage === stage.hours;

              return (
                <div key={stage.title} className="relative min-w-0" id={`stage-${stage.hours}`}>
                  {index < evolution.length - 1 && (
                    <div
                      className={`absolute left-6 top-16 w-0.5 h-full ${
                        stage.completed ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                  )}

                  <div
                    className={`p-3 sm:p-5 rounded-xl transition-all border-2 ${
                      stage.completed
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-600'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-2 sm:gap-4">
                      <div
                        className={`w-9 h-9 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                          stage.completed
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {stage.completed ? <CheckCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-3">
                            <h4 className="text-base sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                              {stage.icon} {stage.title}
                            </h4>

                            {stage.completed ? (
                              <span className="px-3 py-1 bg-green-500 text-white rounded-full text-xs font-semibold">
                                Desbloqueado
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                Bloqueado
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={!canOpen}
                            onClick={() => {
                              if (!canOpen) return;
                              setExpandedHours((prev) => (prev === stage.hours ? null : stage.hours));
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-2 transition-colors ${
                              canOpen
                                ? 'bg-black/10 dark:bg-white/10 text-gray-800 dark:text-gray-100 hover:bg-black/20 dark:hover:bg-white/20'
                                : 'bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                            }`}
                            title={canOpen ? (isOpen ? 'Ocultar detalhes' : 'Ver detalhes') : 'Desbloqueie esta etapa'}
                          >
                            {canOpen ? (
                              <>
                                {isOpen ? 'Ocultar detalhes' : 'Ver detalhes'}
                                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </>
                            ) : (
                              <>
                                Desbloqueia em ~{remainingDays} dia{remainingDays === 1 ? '' : 's'}
                                <ChevronDown className="w-4 h-4 opacity-60" />
                              </>
                            )}
                          </button>
                        </div>

                        <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">{stage.description}</p>

                        {isNextCard && !stage.completed && (
                          <div className="mt-4 rounded-xl border border-gray-200/60 dark:border-gray-700/60 bg-white/60 dark:bg-black/20 p-3">
                            <div className="flex items-center justify-between text-xs text-gray-700 dark:text-gray-200 mb-2">
                              <span>Você está a caminho de desbloquear</span>
                              <span className="font-bold">{formatPercent(insideProgress)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600"
                                style={{ width: `${Math.round(insideProgress * 100)}%` }}
                              />
                            </div>
                            <div className="mt-2 text-[11px] text-gray-600 dark:text-gray-300">
                              Falta ~{remainingDays} dia{remainingDays === 1 ? '' : 's'} para desbloquear {stage.title}.
                            </div>
                          </div>
                        )}

                        {canOpen && isOpen && stage.details && (
                          <div className="mt-4 rounded-xl border border-green-300/60 dark:border-green-700/60 bg-white/60 dark:bg-black/20 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="w-4 h-4 text-green-600 dark:text-green-300" />
                              <h5 className="font-bold text-gray-800 dark:text-gray-100">{stage.details.title}</h5>
                            </div>

                            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-200">
                              {stage.details.bullets.map((b, i) => (
                                <li key={`${stage.title}-b-${i}`}>{b}</li>
                              ))}
                            </ul>

                            {stage.details.tip && (
                              <div className="mt-3 rounded-lg border border-green-200/60 dark:border-green-800/60 bg-green-50/70 dark:bg-green-900/20 p-3">
                                <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Dica prática</p>
                                <p className="text-sm text-green-700/90 dark:text-green-200/90">{stage.details.tip}</p>
                              </div>
                            )}

                            {/* Registro do usuário */}
                            <div className="mt-4 rounded-xl border border-gray-200/60 dark:border-gray-700/60 bg-gray-50/70 dark:bg-gray-900/30 p-4">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Seu registro desta etapa</p>
                                {noteExists && noteCreatedAt && (
                                  <span className="text-[11px] text-gray-600 dark:text-gray-400">{formatDateTimeBR(noteCreatedAt)}</span>
                                )}
                              </div>

                              {!noteExists ? (
                                <>
                                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                    Escreva o que você sentiu ao passar por esse período.
                                  </p>

                                  <textarea
                                    className="mt-2 w-full min-h-[90px] rounded-xl border border-gray-200/70 dark:border-gray-700/70 bg-white/80 dark:bg-black/20 p-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-purple-500/30"
                                    placeholder="Ex.: Hoje percebi que a fissura vem em ondas... O que funcionou foi..."
                                    maxLength={900}
                                    onChange={(e) => {
                                      draftRefs.current[stage.hours] = e.target.value;
                                    }}
                                    defaultValue={draftRefs.current[stage.hours] ?? ''}
                                  />

                                  <div className="mt-3 flex items-center justify-end">
                                    <button
                                      type="button"
                                      disabled={savingStage === stage.hours}
                                      onClick={() => saveNewNote(stage, draftRefs.current[stage.hours] ?? '')}
                                      className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold hover:opacity-95 disabled:opacity-60"
                                    >
                                      {savingStage === stage.hours ? 'Salvando...' : 'Salvar registro'}
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  {!isEditingThis ? (
                                    <>
                                      <div className="mt-2 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                        {notes[stage.hours]?.note_text}
                                      </div>

                                      <div className="mt-3 flex items-center justify-end gap-2">
                                        {isPremium ? (
                                          <button
                                            type="button"
                                            onClick={() => startEdit(stage.hours)}
                                            className="px-3 py-2 rounded-full bg-black/5 dark:bg-white/10 text-gray-800 dark:text-gray-100 text-xs font-bold hover:bg-black/10 dark:hover:bg-white/20 inline-flex items-center gap-2"
                                          >
                                            <Pencil className="w-4 h-4" />
                                            Editar
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => startEdit(stage.hours)}
                                            className="px-3 py-2 rounded-full bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-xs font-bold inline-flex items-center gap-2 border border-gray-200/70 dark:border-gray-700/70"
                                            title="Editar é Premium"
                                          >
                                            <Lock className="w-4 h-4" />
                                            Editar (Premium)
                                          </button>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <textarea
                                        className="mt-2 w-full min-h-[110px] rounded-xl border border-gray-200/70 dark:border-gray-700/70 bg-white/80 dark:bg-black/20 p-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-purple-500/30"
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        maxLength={900}
                                      />

                                      <div className="mt-3 flex items-center justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={cancelEdit}
                                          className="px-3 py-2 rounded-full bg-black/5 dark:bg-white/10 text-gray-800 dark:text-gray-100 text-xs font-bold hover:bg-black/10 dark:hover:bg-white/20 inline-flex items-center gap-2"
                                        >
                                          <X className="w-4 h-4" />
                                          Cancelar
                                        </button>

                                        <button
                                          type="button"
                                          disabled={savingStage === stage.hours}
                                          onClick={() => saveEdit(stage)}
                                          className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold hover:opacity-95 disabled:opacity-60 inline-flex items-center gap-2"
                                        >
                                          <Save className="w-4 h-4" />
                                          {savingStage === stage.hours ? 'Salvando...' : 'Salvar alterações'}
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {!stage.completed && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">
                            Faltam aproximadamente {remainingDays} dia{remainingDays === 1 ? '' : 's'} para desbloquear esta etapa.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button type="button" onClick={()=>setShowAllStages(v=>!v)} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-purple-300/30 bg-purple-500/10 px-4 text-sm font-semibold text-purple-800 dark:text-purple-100">{showAllStages?'Mostrar apenas conquistas e próximo marco':'Explorar todos os marcos futuros'} <ChevronDown className={'h-4 w-4 transition '+(showAllStages?'rotate-180':'')}/></button>
          <div className="mt-6 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>Os marcos representam tempo de jornada, não a confirmação de mudanças fisiológicas. Os sintomas e o ritmo de adaptação variam. Informações educativas não substituem orientação profissional.</p>
          </div>
        </section>

        {/* Recompensa 1 ano */}
        <section className="bg-gradient-to-br from-violet-50 via-white to-amber-50 dark:from-[#211a37] dark:via-[#1a1b2d] dark:to-[#292016] rounded-3xl p-4 sm:p-7 shadow-xl border border-violet-200/80 dark:border-violet-400/25">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex flex-wrap items-center gap-2">
                <Gift className="w-5 h-5 text-purple-600 dark:text-purple-300" />
                Sua conquista de 1 ano
              </h3>
              <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200 mt-2">
                Ao completar um ano e todas as etapas, uma lembrança especial da sua jornada estará esperando por você.
              </p>
            </div>

            <Link
              href="/rewards"
              className="self-start shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-black/5 dark:bg-white/10 text-gray-800 dark:text-gray-100 text-xs font-semibold hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
              title="Ir para Recompensas"
            >
              Ver na loja
              <ChevronDown className="w-4 h-4 opacity-60 rotate-[-90deg]" />
            </Link>
          </div>

          <div className="mt-5 rounded-2xl border border-violet-200 dark:border-violet-400/20 bg-white/75 dark:bg-white/5 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex shrink-0 items-center gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-purple-300/30 bg-black/10">
                  <Image src={COMPLETION_REWARD.img} alt={COMPLETION_REWARD.name} fill className="object-contain p-1" />
                </div>
                <div className="min-w-0 sm:hidden">
                  <p className="break-words text-base font-bold leading-snug text-gray-900 dark:text-white">{COMPLETION_REWARD.name}</p>
                  <span className="mt-1 inline-flex rounded-full bg-purple-500/15 px-2.5 py-1 text-xs font-semibold text-purple-800 dark:text-purple-200">{rewardOwned ? 'Coletado' : hasCompletedFullYear ? 'Disponível para coletar' : 'Ainda bloqueado'}</span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="hidden break-words text-base font-bold text-gray-900 dark:text-white sm:block">{COMPLETION_REWARD.name}</p>
                <p className="text-sm leading-6 text-gray-800 dark:text-gray-100">Uma conquista simbólica para celebrar um ano de jornada. Depois de coletar, você poderá equipá-la em Recompensas.</p>
                {!hasCompletedFullYear && <p className="mt-2 text-xs font-medium text-purple-800 dark:text-purple-200">Disponível ao completar um ano e todas as etapas.</p>}
              </div>
              {hasCompletedFullYear && !rewardOwned && <button type="button" onClick={claimCompletionReward} disabled={claiming} className="min-h-11 w-full rounded-xl bg-purple-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-60 sm:w-auto">{claiming ? 'Coletando...' : 'Coletar recompensa'}</button>}
            </div>
            {hasCompletedFullYear && !userId && <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm text-gray-800 dark:text-amber-100">Faça login para salvar a recompensa no inventário.</p>}
          </div>
        </section>


        <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-8 shadow-2xl text-white text-center">
          <h3 className="text-2xl font-bold mb-4">Você está evoluindo! 🎉</h3>
          <p className="text-lg opacity-90">Um passo por vez — e com registro real do que você viveu em cada etapa.</p>
        </div>
      </main>
    </div>
  );
}
