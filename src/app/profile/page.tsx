'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { prepareLocalAccount, readPrivateState, restoreJourney, snapshotJourney, updatePrivateState, type PrivateState } from '@/lib/private-state';
import { storage } from '@/lib/storage';
import {
  ArrowLeft,
  User,
  Leaf,
  Save,
  AlertCircle,
  CheckCircle2,
  Crown,
  LogOut,
  RotateCcw,
  Calendar,
  Coins,
  Sparkles,
  Brain,
  Clock,
  Settings,
  Globe2,
} from 'lucide-react';
import Link from 'next/link';

type UserData = ReturnType<typeof storage.getUserData> extends infer T ? T : any;

// Valores padrão importantes para o funcionamento do app
const DEFAULT_CORE_VALUES = {
  currency: 'BRL' as 'BRL' | 'USD' | 'EUR',
  frequencyAmount: 4,
  frequencyPeriod: 'day' as 'day' | 'week' | 'month',
  gramsPerJoint: 0.5,
  dailyCost: 20,
  pricePerGram: 10,
  thcPotency: 5,
  consumptionMethods: ['joint'] as string[],
};

const DEFAULT_PROFILE_VALUES = {
  mainGoal:
    'Reduzir o consumo, fortalecer minha mente e economizar dinheiro.',
  timezone: 'America/Sao_Paulo',
  preferredFocusArea: 'detox' as 'detox' | 'mood' | 'money' | 'health',
  notificationsEnabled: true,
  darkMode: false,
  preferredLanguage: 'pt' as 'pt' | 'en' | 'es',
};

function isCurrency(value: unknown): value is 'BRL' | 'USD' | 'EUR' {
  return value === 'BRL' || value === 'USD' || value === 'EUR';
}

function isFrequencyPeriod(value: unknown): value is 'day' | 'week' | 'month' {
  return value === 'day' || value === 'week' || value === 'month';
}

function isPreferredFocusArea(
  value: unknown
): value is 'detox' | 'mood' | 'money' | 'health' {
  return value === 'detox' || value === 'mood' || value === 'money' || value === 'health';
}

function isPreferredLanguage(value: unknown): value is 'pt' | 'en' | 'es' {
  return value === 'pt' || value === 'en' || value === 'es';
}

function safeNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatDateInputFromIso(iso?: string | null) {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');

  return {
    date: `${yyyy}-${mm}-${dd}`,
    time: `${hh}:${min}`,
  };
}

function buildIsoFromDateAndTime(date: string, time: string) {
  if (!date) return null;
  const d = new Date(`${date}T${time || '00:00'}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}


// Helper: dia do ano (1..365) para escolher frase do dia
function getDayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

type AvatarMeta = {
  code: string; // A1..A20
  name: string;
  description: string;
};

const AVATAR_CATALOG: AvatarMeta[] = [
  { code: 'A1', name: 'Padrão', description: 'Seu avatar base gratuito. Comece aqui.' },
  { code: 'A2', name: 'Ascensão', description: 'Você saiu do piloto automático e começou a subir um degrau.' },
  { code: 'A3', name: 'Escudo', description: 'Proteção emocional: você aprende a dizer “não” para o impulso.' },
  { code: 'A4', name: 'Mira', description: 'Objetivo claro: foco no que importa, um dia por vez.' },
  { code: 'A5', name: 'Bússola', description: 'Direção firme: você sabe para onde está indo.' },
  { code: 'A6', name: 'Tempo', description: 'Paciência e constância: a mudança acontece no ritmo certo.' },
  { code: 'A7', name: 'Escada', description: 'Evolução em etapas: cada pequeno passo conta.' },
  { code: 'A8', name: 'Fluxo', description: 'Rotina fluindo: menos esforço, mais consistência.' },
  { code: 'A9', name: 'Vento', description: 'Leveza e liberdade: você aprende a soltar e seguir.' },
  { code: 'A10', name: 'Infinito', description: 'Compromisso longo: o hábito virou parte de você.' },

  { code: 'A11', name: 'Elo', description: 'Conexão forte: você segura a corrente nos dias difíceis.' },
  { code: 'A12', name: 'Raio', description: 'Energia e ação: decisões rápidas a favor do seu futuro.' },
  { code: 'A13', name: 'Semente', description: 'O começo do melhor: você planta escolhas que viram vida.' },
  { code: 'A14', name: 'Lua', description: 'Equilíbrio: você atravessa fases sem perder o rumo.' },
  { code: 'A15', name: 'Flor', description: 'Crescimento visível: você floresce com disciplina e cuidado.' },
  { code: 'A16', name: 'Constelação', description: 'Visão ampla: você enxerga seu progresso como um mapa.' },
  { code: 'A17', name: 'Guarda', description: 'Raro e respeitado: você protege seu progresso com firmeza.' },
  { code: 'A18', name: 'Cristal', description: 'Pureza de propósito: constância lapidada no dia a dia.' },
  { code: 'A19', name: 'Coroa', description: 'Quase lendário: disciplina que inspira outros.' },
  { code: 'A20', name: 'Luz Suprema', description: 'O topo: para conquistar com longo prazo e paciência (meta de 1 ano).' },
];


function isAvatarCode(code: string | null | undefined): code is string {
  if (!code) return false;
  const c = String(code).trim().toUpperCase();
  if (!c.startsWith('A')) return false;
  const n = Number(c.slice(1));
  return Number.isFinite(n) && n >= 1 && n <= 20;
}

function avatarNumber(code: string) {
  const n = Number(code.slice(1));
  return Number.isFinite(n) ? n : 999;
}

function avatarSrc(code: string) {
  const c = isAvatarCode(code) ? code.toUpperCase() : 'A1';
  return `/avatars/${c}.png`;
}

function getAvatarMeta(code: string) {
  const c = isAvatarCode(code) ? code.toUpperCase() : 'A1';
  return AVATAR_CATALOG.find((a) => a.code === c) ?? AVATAR_CATALOG[0];
}

const PROFILE_LIGHT_VARS = {
  ['--foreground' as any]: 'oklch(0.145 0 0)',
  ['--background' as any]: 'oklch(1 0 0)',
} as const;


async function waitForCloud<T>(request: PromiseLike<T>, timeoutMs = 8500): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Tempo de espera da nuvem excedido.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [userData, setUserData] = useState<UserData | null>(null);
  const [displayName, setDisplayName] = useState('');

  const [thcPotency, setThcPotency] = useState<number>(
    DEFAULT_CORE_VALUES.thcPotency
  );
  const [mainGoal, setMainGoal] = useState<string>(DEFAULT_PROFILE_VALUES.mainGoal);


  // Avatar (somente símbolos – sem foto)
  const [equippedAvatar, setEquippedAvatar] = useState<string>('A1');
  const [ownedAvatars, setOwnedAvatars] = useState<Set<string>>(
    new Set(['A1'])
  );
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [daysClean, setDaysClean] = useState<number | null>(null);
  const [moneySaved, setMoneySaved] = useState<number | null>(null);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [dailyPhrase, setDailyPhrase] = useState<string>('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Gamificação (se existir no userData)
  const [xp, setXp] = useState<number | null>(null);
  const [level, setLevel] = useState<number | null>(null);

  // Campos que antes estavam no Onboarding
  const [currency, setCurrency] = useState<'BRL' | 'USD' | 'EUR'>(
    DEFAULT_CORE_VALUES.currency
  );
  const [frequencyAmount, setFrequencyAmount] = useState<number>(
    DEFAULT_CORE_VALUES.frequencyAmount
  );
  const [frequencyPeriod, setFrequencyPeriod] = useState<
    'day' | 'week' | 'month'
  >(DEFAULT_CORE_VALUES.frequencyPeriod);
  const [gramsPerJoint, setGramsPerJoint] = useState<number>(
    DEFAULT_CORE_VALUES.gramsPerJoint
  );
  const [dailyCost, setDailyCost] = useState<number>(
    DEFAULT_CORE_VALUES.dailyCost
  );
  const [pricePerGram, setPricePerGram] = useState<number>(
    DEFAULT_CORE_VALUES.pricePerGram
  );
  const [consumptionMethods, setConsumptionMethods] = useState<string[]>(
    DEFAULT_CORE_VALUES.consumptionMethods
  );

  const [lastUseDate, setLastUseDate] = useState<string>(''); // yyyy-mm-dd
  const [lastUseTime, setLastUseTime] = useState<string>(''); // HH:mm

  // Jornada 365 (mantemos a lógica só para não quebrar nada, mas não usamos na UI)
  const [journeyCurrentDay, setJourneyCurrentDay] = useState<number | null>(
    null
  );
  const [journeyStartedAt, setJourneyStartedAt] = useState<string | null>(null);
  const [journeyCompletedAt, setJourneyCompletedAt] =
    useState<string | null>(null);
  const [journeyEntriesCount, setJourneyEntriesCount] = useState<number | null>(
    null
  );

  // NOVOS CAMPOS (da página nova):
  const [timezone, setTimezone] = useState<string>(DEFAULT_PROFILE_VALUES.timezone);
  const [preferredFocusArea, setPreferredFocusArea] = useState<
    'detox' | 'mood' | 'money' | 'health'
  >(DEFAULT_PROFILE_VALUES.preferredFocusArea);
  const [notificationsEnabled, setNotificationsEnabled] =
    useState<boolean>(DEFAULT_PROFILE_VALUES.notificationsEnabled);
  const [darkMode, setDarkMode] = useState<boolean>(DEFAULT_PROFILE_VALUES.darkMode);

  // Idioma preferido (salvo apenas localmente por enquanto)
  const [preferredLanguage, setPreferredLanguage] = useState<
    'pt' | 'en' | 'es'
  >(DEFAULT_PROFILE_VALUES.preferredLanguage);

  // Frases motivacionais
  const phrases = [
    'Um dia de cada vez já é vitória.',
    'Você não é o seu hábito, você é sua escolha.',
    'Hoje você já fez mais do que ontem.',
    'Você merece uma vida mais leve.',
    'Cada passo conta, não pare.',
    'Seu futuro agradece as escolhas de hoje.',
    'Mesmo devagar, ainda é pra frente.',
  ];

  // Escolhe a frase do dia
  useEffect(() => {
    const day = getDayOfYear(new Date());
    const index = day % phrases.length;
    setDailyPhrase(phrases[index]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carrega dados do usuário + storage + profile Supabase + Jornada 365
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);

        // Garantir sessão Supabase
        const {
          data: { session },
          error: sessionError,
        } = (await waitForCloud(supabase.auth.getSession(), 8500)) as any;

        if (sessionError) {
          console.error(
            'Erro getSession profile:',
            sessionError?.message,
            sessionError
          );
        }

        const user = session?.user;
        if (!user) {
          router.push('/login');
          return;
        }

        setUserId(user.id);
        setUserEmail(user.email ?? null);
        prepareLocalAccount(user.id);

        // Nome padrão amigável quando o usuário entra em outro navegador
        // e ainda não existe localStorage naquele dispositivo.
        if (user.email) {
          const emailName = user.email.split('@')[0]?.trim();
          if (emailName) setDisplayName(emailName);
        }


        // Dados locais do app
        let data = storage.getUserData() as UserData | null;

        // Se não existir nada no storage, cria um pacote mínimo com defaults
   if (!data) {
  const nowIso = new Date().toISOString();

  // Usuário completamente novo: já definimos a data do último uso
  // como o momento da criação da conta, para não ficar em branco.
  data = {
    startDate: nowIso,
    lastRelapseDate: null,
    daysClean: 0,
    moneySaved: 0,
    lastUseDateTime: nowIso,
    ...DEFAULT_CORE_VALUES,
  } as UserData;

  storage.initUserData(data);
}


        // Estado privado do Supabase tem prioridade sobre este dispositivo.
        // Se não houver rede, não descartamos os dados locais já existentes.
        let cloudState: PrivateState | null = null;
        try {
          cloudState = await waitForCloud(readPrivateState(user.id));
          data = restoreJourney(cloudState, data);
          if (cloudState?.displayName) setDisplayName(cloudState.displayName);
          if (cloudState?.preferredFocusArea && isPreferredFocusArea(cloudState.preferredFocusArea)) {
            setPreferredFocusArea(cloudState.preferredFocusArea);
          }
          if (typeof cloudState?.notificationsEnabled === 'boolean') {
            setNotificationsEnabled(cloudState.notificationsEnabled);
          }
          if (typeof cloudState?.darkMode === 'boolean') setDarkMode(cloudState.darkMode);
          if (isPreferredLanguage(cloudState?.preferredLanguage)) {
            setPreferredLanguage(cloudState.preferredLanguage);
          }
          if (typeof cloudState?.timezone === 'string') setTimezone(cloudState.timezone);
        } catch (cloudError) {
          console.error('Falha ao carregar dados privados:', cloudError);
          setErrorMessage('Não foi possível sincronizar seus dados. Confira a conexão antes de salvar.');
        }

        setUserData(data);

        // Gamificação se existir (mantém compatibilidade com versões antigas)
        if (typeof data?.xp === 'number' && !Number.isNaN(data.xp)) {
          setXp(data.xp);
        }

        if (
          typeof (data as any)?.level === 'number' &&
          !Number.isNaN((data as any).level)
        ) {
          setLevel((data as any).level);
        }

        // THC – se já existir no storage, usa; senão padrão 5%
        if (data && typeof data.thcPotency === 'number') {
          setThcPotency(
            Number.isFinite(data.thcPotency)
              ? data.thcPotency
              : DEFAULT_CORE_VALUES.thcPotency
          );
        } else {
          setThcPotency(DEFAULT_CORE_VALUES.thcPotency);
        }

        // Meta principal (storage)
        if (data && typeof data.goal === 'string' && data.goal.trim()) {
          setMainGoal(data.goal);
        } else {
          setMainGoal(DEFAULT_PROFILE_VALUES.mainGoal);
        }

        // Campos do antigo Onboarding (com defaults seguros)
        setCurrency(
          (data?.currency as 'BRL' | 'USD' | 'EUR') ??
            DEFAULT_CORE_VALUES.currency
        );

        setFrequencyAmount(
          typeof data?.frequencyAmount === 'number' &&
            !Number.isNaN(data.frequencyAmount)
            ? data.frequencyAmount
            : DEFAULT_CORE_VALUES.frequencyAmount
        );

        setFrequencyPeriod(
          (data?.frequencyPeriod as 'day' | 'week' | 'month') ??
            DEFAULT_CORE_VALUES.frequencyPeriod
        );

        setGramsPerJoint(
          typeof data?.gramsPerJoint === 'number' &&
            !Number.isNaN(data.gramsPerJoint)
            ? data.gramsPerJoint
            : DEFAULT_CORE_VALUES.gramsPerJoint
        );

        setDailyCost(
          typeof data?.dailyCost === 'number' && !Number.isNaN(data.dailyCost)
            ? data.dailyCost
            : DEFAULT_CORE_VALUES.dailyCost
        );

        setPricePerGram(
          typeof data?.pricePerGram === 'number' &&
            !Number.isNaN(data.pricePerGram)
            ? data.pricePerGram
            : DEFAULT_CORE_VALUES.pricePerGram
        );

        setConsumptionMethods(
          Array.isArray(data?.consumptionMethods) &&
            (data!.consumptionMethods as string[]).length > 0
            ? (data!.consumptionMethods as string[])
            : DEFAULT_CORE_VALUES.consumptionMethods
        );

        // Último uso – se existir, quebra em data e hora
let lastIso: string | null = null;

if (typeof data?.lastUseDateTime === 'string') {
  lastIso = data.lastUseDateTime;
} else if (typeof data?.lastUseTimestamp === 'number') {
  lastIso = new Date(data.lastUseTimestamp).toISOString();
}

if (lastIso) {
  const d = new Date(lastIso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');

  setLastUseDate(`${yyyy}-${mm}-${dd}`);
  setLastUseTime(`${hh}:${min}`);
} else {
  // Fallback: se não existir informação de último uso,
  // usamos a data de hoje para não deixar o campo vazio.
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  setLastUseDate(`${yyyy}-${mm}-${dd}`);
  // Horário fica em branco, já que a pessoa pode não lembrar
  setLastUseTime('12:00');
}


        // Estatísticas básicas para conquistas
        let days = 0;
        let money = 0;

        const cleanSince = data?.lastRelapseDate || data?.lastUseDateTime || data?.startDate;
        if (cleanSince && Number.isFinite(new Date(cleanSince).getTime())) {
          days = Math.max(0, Math.floor((Date.now() - new Date(cleanSince).getTime()) / 86400000));
        }

        const dailyCostLocal =
          typeof data?.dailyCost === 'number'
            ? data.dailyCost
            : DEFAULT_CORE_VALUES.dailyCost;

        money = Math.round(Math.max(0, days * Math.max(0, dailyCostLocal)));

        setDaysClean(days || null);
        setMoneySaved(money || null);

        const ach: string[] = [];
        if (days >= 1) ach.push('Primeiro dia sem fumar 🎉');
        if (days >= 3) ach.push('3 dias sem fumar 👏');
        if (days >= 7) ach.push('7 dias sem fumar 🔥');
        if (days >= 30) ach.push('30 dias – modo lenda 🏆');
        if (money >= 100) ach.push('R$ 100 economizados 💰');
        if (money >= 500) ach.push('R$ 500 economizados 💸');
        setAchievements(ach);

        // Fallback: nome salvo no localStorage, caso não exista/funcione o profile
        if (typeof window !== 'undefined') {
          const storedName = localStorage.getItem('weedreset_display_name');
          if (storedName && storedName.trim()) {
            setDisplayName(storedName.trim());
          }
        }

        // ======= DETECÇÃO DE PREMIUM (profiles + storage + metadata) =======
        let premiumDetected = false;

        try {
          const { data: profile, error: profileError } = await waitForCloud(
            supabase.from('profiles')
              .select('display_name, full_name, is_premium, thc_potency, main_goal, timezone, preferred_language, currency, grams_per_joint, daily_cost, last_use, equipped_avatar, equipped_icon, xp')
              .eq('id', user.id)
              .maybeSingle()
          ) as any;

          if (profileError) {
            console.warn(
              'Erro carregando profile do Supabase:',
              profileError?.message,
              profileError
            );
          } else if (profile) {
            if (profile.display_name) {
              setDisplayName(profile.display_name);
              if (typeof window !== 'undefined') {
                localStorage.setItem(
                  'weedreset_display_name',
                  profile.display_name
                );
              }
            }

            if (typeof profile.thc_potency === 'number') {
              setThcPotency(profile.thc_potency);
            }

            if (
              typeof profile.main_goal === 'string' &&
              profile.main_goal.trim()
            ) {
              setMainGoal(profile.main_goal);
            }

            if (
              typeof profile.timezone === 'string' &&
              profile.timezone.trim()
            ) {
              setTimezone(profile.timezone);
            }

            if (typeof profile.preferred_focus_area === 'string') {
              const allowed = ['detox', 'mood', 'money', 'health'] as const;
              const value = profile.preferred_focus_area as any;
              setPreferredFocusArea(
                allowed.includes(value) ? value : ('detox' as 'detox')
              );
            }

            if (typeof profile.notifications_enabled === 'boolean') {
              setNotificationsEnabled(profile.notifications_enabled);
            }

            if (typeof profile.dark_mode === 'boolean') {
              setDarkMode(profile.dark_mode);
            }

            if (isPreferredLanguage((profile as any).preferred_language)) {
              setPreferredLanguage((profile as any).preferred_language);
            }

            if (isCurrency((profile as any).currency)) {
              setCurrency((profile as any).currency);
            }

            if (isFrequencyPeriod((profile as any).frequency_period)) {
              setFrequencyPeriod((profile as any).frequency_period);
            }

            if ((profile as any).frequency_amount != null) {
              setFrequencyAmount(
                safeNumber(
                  (profile as any).frequency_amount,
                  DEFAULT_CORE_VALUES.frequencyAmount
                )
              );
            }

            if ((profile as any).grams_per_joint != null) {
              setGramsPerJoint(
                safeNumber(
                  (profile as any).grams_per_joint,
                  DEFAULT_CORE_VALUES.gramsPerJoint
                )
              );
            }

            if ((profile as any).daily_cost != null) {
              setDailyCost(
                safeNumber((profile as any).daily_cost, DEFAULT_CORE_VALUES.dailyCost)
              );
            }

            if ((profile as any).price_per_gram != null) {
              setPricePerGram(
                safeNumber(
                  (profile as any).price_per_gram,
                  DEFAULT_CORE_VALUES.pricePerGram
                )
              );
            }

            if (
              Array.isArray((profile as any).consumption_methods) &&
              (profile as any).consumption_methods.length > 0
            ) {
              setConsumptionMethods((profile as any).consumption_methods);
            }

            if (!cloudState?.userData?.lastUseDateTime && typeof profile.last_use === 'string') {
              if (data) {
                data = { ...data, startDate: profile.last_use, lastUseDateTime: profile.last_use } as UserData;
                storage.saveUserData(data);
                setUserData(data);
              }
              const formatted = formatDateInputFromIso(profile.last_use);
              if (formatted.date) {
                setLastUseDate(formatted.date);
                setLastUseTime(formatted.time);
              }
            }

            if (typeof profile.is_premium === 'boolean') {
              premiumDetected = profile.is_premium;
            }
          }

          // Nunca confiar em user_metadata editável para liberar Premium.
          if (!premiumDetected && user) {
            const anyUser: any = user;
            const appMeta = anyUser.app_metadata || {};

            if (
              appMeta.is_premium === true ||
              appMeta.plan === 'premium' ||
              appMeta.role === 'premium'
            ) {
              premiumDetected = true;
            }
          }
        } catch (e: any) {
          console.warn(
            'Falha geral ao buscar profile no Supabase',
            e?.message ?? e
          );
        }

        setIsPremium(premiumDetected);

        // Nome, progresso, datas e preferências essenciais já foram tratados.
        // Inventário e estatísticas adicionais não devem deixar o Perfil
        // indefinidamente na tela de carregamento se PostgREST estiver lento.
        setLoading(false);

        // Avatar: equipado + inventário (somente símbolos)
        try {
          // Garante que sempre exista um avatar equipado
          const { data: p } = await supabase
            .from('profiles')
            .select('equipped_icon')
            .eq('id', user.id)
            .maybeSingle();

          const rawEquipped = String((p as any)?.equipped_icon || cloudState?.equippedAvatar || '').trim();
          const initial = isAvatarCode(rawEquipped) ? rawEquipped.toUpperCase() : 'A1';

          setEquippedAvatar(initial);

          // Garante que o profile tenha o A1 se estiver vazio
          if (!rawEquipped) {
            await supabase
              .from('profiles')
              .upsert({ id: user.id, equipped_icon: 'A1' });
          }

          // Garante que o usuário possua o item do avatar padrão (A1)
          try {
            await supabase.from('user_store_items').insert({
              user_id: user.id,
              item_id: 'avatar_A1',
            });
          } catch {
            // ignora: provavelmente já existe
          }

          // Carrega inventário de avatares
          const { data: inv } = await supabase
            .from('user_store_items')
            .select('item_id')
            .eq('user_id', user.id)
            .like('item_id', 'avatar_%');

          const set = new Set<string>(['A1']);
          (inv ?? []).forEach((row: any) => {
            const id = String(row?.item_id ?? '');
            if (!id.startsWith('avatar_')) return;
            const code = id.replace('avatar_', '').trim().toUpperCase();
            if (isAvatarCode(code)) set.add(code);
          });

          setOwnedAvatars(set);

          // Se o equipado não está no inventário, volta pro padrão (A1)
          if (!set.has(initial)) {
            setEquippedAvatar('A1');
            await supabase
              .from('profiles')
              .upsert({ id: user.id, equipped_icon: 'A1' });
          }
        } catch (e: any) {
          console.warn('Falha ao carregar inventário de avatares', e?.message ?? e);
          setEquippedAvatar('A1');
          setOwnedAvatars(new Set(['A1']));
        }


        // Resumo da Jornada 365 (mantido só na lógica, não exibido aqui)
        try {
          const { data: journey, error: journeyError } = await supabase
            .from('user_journey_progress')
            .select('journey_day, status, completed_at')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!journeyError && journey) {
            const anyJourney: any = journey;
            const currentDay = (anyJourney.journey_day as number | null) ?? null;

            setJourneyCurrentDay(currentDay);
            setJourneyStartedAt(null);
            setJourneyCompletedAt(anyJourney.completed_at ?? null);
          }
        } catch (e: any) {
          console.warn(
            'Erro ao carregar resumo da Jornada (lógica interna):',
            e?.message ?? e
          );
        }

        // Contagem de entradas no diário de missão (mission_journal) – apenas lógica, não exibida
        try {
          const { count, error: journalError } = await supabase
            .from('mission_journal')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id);

          if (!journalError && typeof count === 'number') {
            setJourneyEntriesCount(count);
          }
        } catch (e: any) {
          console.warn(
            'Erro ao contar mission_journal:',
            e?.message ?? e
          );
        }
      } catch (err: any) {
        console.error(err?.message ?? err);
        setErrorMessage('Não foi possível carregar seus dados.');
      } finally {
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMethod = (value: string) => {
    setConsumptionMethods((prev) =>
      prev.includes(value)
        ? prev.filter((m) => m !== value)
        : [...prev, value]
    );
  };

  // salvar configurações gerais
  const handleSave = async () => {
    if (!userData || !userId) {
      setErrorMessage('Faça login para sincronizar seus dados.');
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!Number.isFinite(thcPotency) || thcPotency < 5 || thcPotency > 40) {
      setErrorMessage('Informe uma porcentagem de THC entre 5% e 40%.');
      return;
    }
    if (!lastUseDate) {
      setErrorMessage('Informe a data da última vez que você fumou.');
      return;
    }

    const lastUseDateTime = buildIsoFromDateAndTime(lastUseDate, lastUseTime || '12:00');
    if (!lastUseDateTime) {
      setErrorMessage('A data ou o horário informado é inválido.');
      return;
    }

    const previousLastUse = userData.lastUseDateTime;
    const updated: UserData = {
      ...userData,
      thcPotency,
      goal: mainGoal,
      onboardingCompleted: true,
      currency,
      frequencyAmount,
      frequencyPeriod,
      gramsPerJoint,
      dailyCost,
      pricePerGram,
      consumptionMethods,
      lastUseDateTime,
      // O contador de tempo limpo deve seguir a data e hora informadas.
      startDate: lastUseDateTime,
      lastRelapseDate: previousLastUse !== lastUseDateTime ? null : userData.lastRelapseDate,
    } as UserData;

    try {
      setSaving(true);

      // Primeiro confirma o registro privado. Dados ainda não salvos ficam no formulário.
      await updatePrivateState({
        userData: snapshotJourney(updated),
        displayName: displayName.trim(),
        equippedAvatar,
        preferredFocusArea,
        notificationsEnabled,
        darkMode,
        preferredLanguage,
        timezone,
      });

      // Campos de compatibilidade usados por outras telas do aplicativo.
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        display_name: displayName.trim() || null,
        thc_potency: thcPotency,
        main_goal: mainGoal.trim() || DEFAULT_PROFILE_VALUES.mainGoal,
        timezone,
        preferred_language: preferredLanguage,
        currency,
        grams_per_joint: gramsPerJoint,
        daily_cost: dailyCost,
        last_use: lastUseDateTime,
      });

      if (profileError) throw profileError;

      storage.saveUserData(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem('weedreset_display_name', displayName.trim());
      }
      setUserData(updated);
      setLastUseTime(lastUseTime || '12:00');
      setSuccessMessage('Dados salvos na nuvem! Você pode acessar em outro dispositivo.');
    } catch (err) {
      console.error('Erro ao salvar perfil na nuvem:', err);
      setErrorMessage('Não foi possível confirmar o salvamento no Supabase. Suas alterações continuam nesta tela; tente novamente.');
    } finally {
      setSaving(false);
    }
  };

    const handleEquipAvatar = async (code: string) => {
    if (!userId) return;
    const target = isAvatarCode(code) ? code.toUpperCase() : 'A1';

    // Só permite equipar o que o usuário possui
    if (!ownedAvatars?.has(target)) {
      setErrorMessage('Você ainda não possui esse avatar.');
      return;
    }

    try {
      setAvatarBusy(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const { error } = await supabase
        .from('profiles')
        .upsert({ id: userId, equipped_icon: target });

      if (error) {
        console.warn('Erro ao equipar avatar:', error?.message, error);
        setErrorMessage('Não foi possível equipar esse avatar agora.');
        return;
      }
      await updatePrivateState({ equippedAvatar: target });

      setEquippedAvatar(target);
      setAvatarPickerOpen(false);
      setSuccessMessage('Avatar equipado com sucesso!');
    } catch (e: any) {
      console.warn('Falha ao equipar avatar', e?.message ?? e);
      setErrorMessage('Não foi possível equipar esse avatar agora.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      setSaving(true);

      await supabase.auth.signOut();
      router.push('/login');
    } catch (err: any) {
      console.error(err?.message ?? err);
      setErrorMessage('Não foi possível sair da conta.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetApp = () => {
    if (typeof window === 'undefined') return;

    const ok = window.confirm(
      'Tem certeza que deseja resetar os dados locais do app neste dispositivo? Vamos voltar para os valores padrão recomendados, mas sua conta Supabase permanece intacta.'
    );

    if (!ok) return;

    try {
      const nowIso = new Date().toISOString();

      const resetData: UserData = {
        startDate: nowIso,
        lastRelapseDate: null,
        daysClean: 0,
        moneySaved: 0,
        ...DEFAULT_CORE_VALUES,
      } as UserData;

      storage.initUserData(resetData);

      // NÃO limpamos avatar/nome, só os dados de consumo
      setUserData(resetData);
      setThcPotency(DEFAULT_CORE_VALUES.thcPotency);
      setCurrency(DEFAULT_CORE_VALUES.currency);
      setFrequencyAmount(DEFAULT_CORE_VALUES.frequencyAmount);
      setFrequencyPeriod(DEFAULT_CORE_VALUES.frequencyPeriod);
      setGramsPerJoint(DEFAULT_CORE_VALUES.gramsPerJoint);
      setDailyCost(DEFAULT_CORE_VALUES.dailyCost);
      setPricePerGram(DEFAULT_CORE_VALUES.pricePerGram);
      setConsumptionMethods(DEFAULT_CORE_VALUES.consumptionMethods);
      setLastUseDate('');
      setLastUseTime('');
      setDaysClean(0);
      setMoneySaved(0);
      setAchievements([]);

      setSuccessMessage('Dados do app resetados para os valores padrão.');
    } catch (err: any) {
      console.error(err?.message ?? err);
      setErrorMessage('Não foi possível resetar os dados locais.');
    }
  };

  // RESETAR JORNADA 365 – apenas Premium (mantido só na lógica)
  const handleResetJourney365 = async () => {
    if (!userId) return;

    const ok = window.confirm(
      'Tem certeza que deseja resetar completamente a sua Jornada 365? Isso apaga o diário da Jornada e zera o seu progresso, voltando para o Dia 1.'
    );
    if (!ok) return;

    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      setSaving(true);

      // Apaga entradas do diário relacionadas à Jornada 365
      const { error: journalError } = await supabase
        .from('mission_journal')
        .delete()
        .eq('user_id', userId)
        .eq('is_journey', true);

      if (journalError) {
        console.error(
          'Erro ao limpar mission_journal (Jornada 365):',
          journalError.message
        );
        throw new Error('Não foi possível limpar o diário da Jornada 365.');
      }

      // Remove (ou zera) progresso da Jornada 365
      const { error: progressError } = await supabase
        .from('user_journey_progress')
        .delete()
        .eq('user_id', userId);

      if (progressError) {
        console.error(
          'Erro ao resetar user_journey_progress:',
          progressError.message
        );
        throw new Error('Não foi possível resetar o progresso da Jornada 365.');
      }

      setJourneyCurrentDay(null);
      setJourneyStartedAt(null);
      setJourneyCompletedAt(null);
      setJourneyEntriesCount(0);

      setSuccessMessage(
        'Jornada 365 resetada com sucesso. Você pode recomeçar do Dia 1.'
      );
    } catch (err: any) {
      console.error(err?.message ?? err);
      setErrorMessage(
        err?.message ||
          'Não foi possível resetar a Jornada 365. Tente novamente.'
      );
    } finally {
      setSaving(false);
    }
  };

  const currentName =
    displayName ||
    (userId ? `WeedReset User #${userId.slice(0, 4)}` : 'WeedReset User');


  const ownedAvatarList = useMemo(() => {
    const list = Array.from(ownedAvatars ?? new Set<string>(['A1']))
      .map((c) => String(c).trim().toUpperCase())
      .filter((c) => isAvatarCode(c));

    const unique = Array.from(new Set(list));
    unique.sort((a, b) => avatarNumber(a) - avatarNumber(b));
    return unique;
  }, [ownedAvatars]);


  // ====== DERIVADOS / RESUMOS ADICIONAIS ======
  const {
    monthlySessions,
    monthlyGrams,
    estimatedMonthlyCostByCalc,
    estimatedMonthlyCostByDaily,
  } = useMemo(() => {
    let sessions = 0;

    if (frequencyAmount > 0) {
      if (frequencyPeriod === 'day') sessions = frequencyAmount * 30;
      else if (frequencyPeriod === 'week') sessions = frequencyAmount * 4;
      else sessions = frequencyAmount;
    }

    const grams = sessions * (gramsPerJoint > 0 ? gramsPerJoint : 0);
    const costCalc = grams * (pricePerGram > 0 ? pricePerGram : 0);
    const costDaily = (dailyCost > 0 ? dailyCost : 0) * 30;

    return {
      monthlySessions: Math.round(sessions),
      monthlyGrams: Math.round(grams * 10) / 10,
      estimatedMonthlyCostByCalc: Math.round(costCalc),
      estimatedMonthlyCostByDaily: Math.round(costDaily),
    };
  }, [frequencyAmount, frequencyPeriod, gramsPerJoint, pricePerGram, dailyCost]);

  const xpForLevel = 500; // mesmo conceito usado na tela antiga de missões
  const safeXp = xp && xp > 0 ? xp : 0;
  const currentLevel = level && level > 0 ? level : Math.floor(safeXp / xpForLevel) + 1;
  const xpInCurrentLevel = safeXp % xpForLevel;
  const xpToNextLevel = xpForLevel - xpInCurrentLevel;
  const xpProgressPercent = (xpInCurrentLevel / xpForLevel) * 100;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-black to-gray-900">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-gray-900">
      <header className="bg-black/40 backdrop-blur-sm shadow-sm sticky top-0 z-30 border-b border-purple-500/20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          <div className="flex items-center gap-3 w-full">
            {/* Título do perfil */}
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Seu perfil</h1>
                <p className="text-xs text-purple-100/80">
                  Ajuste nome, consumo, dinheiro e configurações principais em
                  um único lugar.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Mensagens */}
        {(errorMessage || successMessage) && (
          <div className="space-y-2">
            {errorMessage && (
              <div className="flex items-center gap-2 text-xs bg-red-900/40 border border-red-500/60 text-red-50 px-3 py-2 rounded-xl">
                <AlertCircle className="w-4 h-4" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="flex items-center gap-2 text-xs bg-emerald-900/40 border border-emerald-500/60 text-emerald-50 px-3 py-2 rounded-xl">
                <CheckCircle2 className="w-4 h-4" />
                <span>{successMessage}</span>
              </div>
            )}
          </div>
        )}

                {avatarPickerOpen && (
          <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setAvatarPickerOpen(false)}
            />

            <div className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Inventário de avatares
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    Escolha um avatar que você já possui. (A1 é gratuito.)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setAvatarPickerOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white"
                >
                  Fechar
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[60vh] overflow-auto pr-1">
                {ownedAvatarList.map((code) => {
                  const meta = getAvatarMeta(code);
                  const active = code === equippedAvatar;

                  return (
                    <button
                      key={code}
                      type="button"
                      disabled={avatarBusy}
                      onClick={() => handleEquipAvatar(code)}
                      className={[
                        'rounded-2xl border p-2 text-left transition',
                        active
                          ? 'border-purple-400/70 bg-purple-500/20'
                          : 'border-white/10 bg-black/20 hover:bg-black/30',
                        avatarBusy ? 'opacity-70 cursor-not-allowed' : '',
                      ].join(' ')}
                    >
                      <div className="aspect-square rounded-xl overflow-hidden bg-black/30 border border-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={avatarSrc(code)}
                          alt={meta.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            const el = e.currentTarget as HTMLImageElement;
                            el.style.display = 'none';
                          }}
                        />
                        <div className="h-full w-full flex items-center justify-center text-white/80 font-extrabold">
                          {code}
                        </div>
                      </div>

                      <div className="mt-2">
                        <p className="text-xs font-extrabold text-white">
                          {meta.name}
                        </p>
                        <p className="text-[11px] text-white/60 leading-snug mt-0.5">
                          {meta.description}
                        </p>

                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[11px] text-white/70 font-semibold">
                            {code}
                          </span>

                          {active ? (
                            <span className="text-[11px] font-bold text-purple-200">
                              Equipado
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-white/60">
                              Toque para equipar
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 text-xs text-white/60">
                Dica: você pode comprar mais avatares na{' '}
                <Link href="/rewards" className="text-purple-200 underline">
                  loja de recompensas
                </Link>
                .
              </div>
            </div>
          </div>
        )}

{/* 2) Card principal: avatar + nome + indicadores rápidos */}
        <section style={PROFILE_LIGHT_VARS} className="bg-white/95 rounded-3xl shadow-2xl p-5 space-y-5 border border-purple-500/10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
                            <div className="relative">
                <button
                  type="button"
                  onClick={() => setAvatarPickerOpen(true)}
                  className="relative cursor-pointer group"
                  aria-label="Trocar avatar"
                >
                  <div className="relative h-16 w-16 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-105">
                    <User className="w-7 h-7 text-white/90" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="absolute inset-0 h-full w-full object-cover"
                      src={avatarSrc(equippedAvatar)}
                      alt={`Avatar ${getAvatarMeta(equippedAvatar).name}`}
                      onError={(e) => {
                        const el = e.currentTarget as HTMLImageElement;
                        el.style.display = 'none';
                      }}
                    />
                  </div>

                  <div className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-full shadow-md">
                    <Sparkles className="w-3 h-3 text-purple-600" />
                  </div>
                </button>
              </div>

              <div>
                <p className="text-xs text-gray-500">Nome dentro do app:</p>
                <p className="text-base font-semibold text-gray-900">
                  {currentName}
                </p>

                {userEmail && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    Conta:{' '}
                    <span className="font-medium break-all">{userEmail}</span>
                  </p>
                )}
              
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-gray-500">Avatar:</span>

                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-purple-50 border border-purple-100 text-[11px] text-purple-700 font-semibold">
                    {getAvatarMeta(equippedAvatar).name}
                  </span>

                  <button
                    type="button"
                    onClick={() => setAvatarPickerOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Trocar
                  </button>

                  <Link
                    href="/rewards"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Loja
                  </Link>

                  <span className="text-[11px] text-gray-500">
                    • Você tem {ownedAvatarList.length} avatar(s)
                  </span>
                </div>
              </div>
            </div>

            {/* 1) Janelinha roxa – Mensagem do dia */}
            <section className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl shadow-2xl p-4 border border-purple-300/40">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-2xl bg-white/15 flex items-center justify-center text-white shadow-md">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-purple-100 uppercase tracking-[0.12em] mb-1">
                    MENSAGEM DO DIA
                  </p>
                  <p className="text-sm text-white leading-relaxed">
                    {dailyPhrase}
                  </p>
                </div>
              </div>
            </section>
          </div>

          {achievements.length > 0 && (
            <div className="pt-2 border-t border-gray-100 mt-2">
              <p className="text-[11px] font-semibold text-gray-600 mb-1">
                Conquistas recentes:
              </p>
              <div className="flex flex-wrap gap-2">
                {achievements.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center px-3 py-1 rounded-full bg-purple-50 border border-purple-100 text-[11px] text-purple-700"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 5) Gamificação & atalhos */}
        <section style={PROFILE_LIGHT_VARS} className="bg-white/95 rounded-3xl shadow-2xl p-5 space-y-6 border border-purple-500/10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Gamificação */}
            <div className="rounded-2xl bg-gradient-to-r from-purple-500 to-pink-600 px-4 py-4 text-white space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-90">
                Gamificação & progresso
              </p>
              <p className="text-2xl font-bold">Nível {currentLevel}</p>
              <p className="text-sm opacity-90">
                XP total aproximado: <strong>{safeXp}</strong>
              </p>

              <div className="space-y-1.5 mt-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span>Progresso para o próximo nível</span>
                  <span>{xpToNextLevel} XP restantes</span>
                </div>
                <div className="w-full bg-white/30 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, xpProgressPercent)}%`,
                    }}
                  />
                </div>
              </div>

              {!xp && (
                <p className="text-[11px] opacity-80 mt-2">
                  Assim que você começar a completar missões, o XP acumulado
                  aparece aqui.
                </p>
              )}
            </div>

            {/* Atalhos rápidos */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-800">
                Atalhos rápidos da sua jornada
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Link
                  href="/missions"
                  className="rounded-2xl border border-purple-200 bg-purple-50 px-3 py-3 hover:border-purple-400 hover:bg-purple-100 transition"
                >
                  <p className="font-semibold text-purple-800 mb-1">
                    Missões & XP
                  </p>
                  <p className="text-[11px] text-purple-700">
                    Complete desafios diários e semanais para ganhar XP.
                  </p>
                </Link>

                <Link
                  href="/rewards"
                  className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 hover:border-amber-400 hover:bg-amber-100 transition"
                >
                  <p className="font-semibold text-amber-800 mb-1">
                    Loja & recompensas
                  </p>
                  <p className="text-[11px] text-amber-700">
                    Troque seu progresso por itens especiais do app.
                  </p>
                </Link>

                <Link
                  href="/jornada"
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 hover:border-emerald-400 hover:bg-emerald-100 transition"
                >
                  <p className="font-semibold text-emerald-800 mb-1">
                    Jornada 365
                  </p>
                  <p className="text-[11px] text-emerald-700">
                    Acompanhe seu dia da jornada e escreva no diário.
                  </p>
                </Link>

                <Link
                  href="/sos"
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 hover:border-rose-400 hover:bg-rose-100 transition"
                >
                  <p className="font-semibold text-rose-800 mb-1">SOS</p>
                  <p className="text-[11px] text-rose-700">
                    Use nas horas mais difíceis para não ceder à vontade.
                  </p>
                </Link>

                <Link
                  href="/body-evolution"
                  className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 hover:border-blue-400 hover:bg-blue-100 transition"
                >
                  <p className="font-semibold text-blue-800 mb-1">
                    Evolução do corpo
                  </p>
                  <p className="text-[11px] text-blue-700">
                    Acompanhe os benefícios físicos da redução no consumo.
                  </p>
                </Link>

                <Link
                  href="/cant-stop"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 hover:border-slate-400 hover:bg-slate-100 transition"
                >
                  <p className="font-semibold text-slate-800 mb-1">
                    Não consigo parar
                  </p>
                  <p className="text-[11px] text-slate-700">
                    Use quando estiver muito difícil para lembrar seus recursos.
                  </p>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 3) CONFIGURAÇÕES – tudo que altera o app em uma caixa só */}
        <section style={PROFILE_LIGHT_VARS} className="bg-white/95 rounded-3xl shadow-2xl p-5 space-y-6 border border-purple-500/10">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-2">
            <div className="h-7 w-7 rounded-xl bg-purple-100 flex items-center justify-center">
              <Settings className="w-4 h-4 text-purple-700" />
            </div>
            <span>Configurações</span>
          </div>

          {/* Nome + THC + Meta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Nome exibido */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Nome ou apelido exibido
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex: Mário, Mari, João..."
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-[11px] text-gray-500">
                Esse nome aparece em conquistas e no painel, mas não é usado na
                comunidade anônima.
              </p>
            </div>

            {/* THC */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Leaf className="w-4 h-4 text-green-500" />
                % de THC que você está acostumado
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={40}
                  step={1}
                  value={thcPotency}
                  onChange={(e) => setThcPotency(Number(e.target.value))}
                  className="w-24 px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-600">%</span>
              </div>
              <p className="text-[11px] text-gray-500">
                Se você souber a potência aproximada do que costuma usar, ajuste
                para deixar os cálculos mais fiéis à sua realidade.
              </p>
            </div>
          </div>

          {/* Meta principal */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Meta principal com a WeedReset
            </label>
            <textarea
              value={mainGoal}
              onChange={(e) => setMainGoal(e.target.value)}
              rows={2}
              placeholder="Ex: Parar completamente, reduzir para 1x por semana, limpar a mente, economizar dinheiro..."
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
            <p className="text-[11px] text-gray-500">
              Essa meta ajuda você a se lembrar do motivo pelo qual começou e
              guia algumas recomendações dentro do app.
            </p>
          </div>

          {/* Fuso, foco, idioma, tema, notificações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Idioma preferido */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-purple-600" />
                Idioma principal do app
              </label>
              <select
                value={preferredLanguage}
                onChange={(e) =>
                  setPreferredLanguage(e.target.value as 'pt' | 'en' | 'es')
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="pt">Português (Brasil)</option>
                <option value="en">Inglês</option>
                <option value="es">Espanhol</option>
              </select>
              <p className="text-[11px] text-gray-500">
                A tradução completa do app para inglês e espanhol será aplicada
                em uma <strong>versão futura</strong>. Por enquanto, salvamos
                aqui apenas a sua preferência.
              </p>
            </div>

            {/* Fuso horário */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
                Fuso horário
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="America/Sao_Paulo">
                  América/São Paulo (Brasil)
                </option>
                <option value="America/Bogota">América/Bogotá</option>
                <option value="America/New_York">América/Nova York</option>
                <option value="Europe/Lisbon">Europa/Lisboa</option>
                <option value="Europe/London">Europa/Londres</option>
                <option value="UTC">UTC (Tempo Universal)</option>
              </select>
              <p className="text-[11px] text-gray-500">
                Usado para calcular corretamente horários de metas, detox e
                notificações.
              </p>
            </div>

            {/* Área principal de foco */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-600" />
                Área principal de foco
              </label>
              <select
                value={preferredFocusArea}
                onChange={(e) =>
                  setPreferredFocusArea(
                    e.target.value as 'detox' | 'mood' | 'money' | 'health'
                  )
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="detox">Detox & tempo limpo</option>
                <option value="mood">Humor & estabilidade emocional</option>
                <option value="money">Economia de dinheiro</option>
                <option value="health">Saúde física & mental</option>
              </select>
              <p className="text-[11px] text-gray-500">
                Isso ajuda o aplicativo a priorizar quais métricas mostrar
                primeiro para você.
              </p>
            </div>

            {/* Preferências visuais (tema) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Settings className="w-4 h-4 text-purple-600" />
                Preferências visuais
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDarkMode(false)}
                  className={`flex-1 px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1 ${
                    !darkMode
                      ? 'bg-purple-600 text-white border-purple-700'
                      : 'bg-white border-gray-300 text-gray-700'
                  }`}
                >
                  ☀️ Claro
                </button>
                <button
                  type="button"
                  onClick={() => setDarkMode(true)}
                  className={`flex-1 px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1 ${
                    darkMode
                      ? 'bg-purple-600 text-white border-purple-700'
                      : 'bg-white border-gray-300 text-gray-700'
                  }`}
                >
                  🌙 Escuro
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                O app pode usar essa informação para adaptar o visual em versões
                futuras.
              </p>
            </div>
          </div>

          {/* Notificações */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <input
                id="notifications-toggle"
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <label
                htmlFor="notifications-toggle"
                className="text-xs text-gray-700"
              >
                Receber lembretes suaves, mensagens motivacionais e alertas de
                metas.
              </label>
            </div>
          </div>

          {/* Subtítulo dados de consumo */}
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 pt-4 border-t border-gray-100">
            <Coins className="w-4 h-4 text-purple-600" />
            <span>Dados de consumo e dinheiro</span>
          </div>

          {/* Campos de consumo e dinheiro */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            {/* Frequência */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Com que frequência você fuma?
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={frequencyAmount}
                  onChange={(e) => setFrequencyAmount(Number(e.target.value))}
                  className="w-20 px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <select
                  value={frequencyPeriod}
                  onChange={(e) =>
                    setFrequencyPeriod(
                      e.target.value as 'day' | 'week' | 'month'
                    )
                  }
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="day">vezes por dia</option>
                  <option value="week">vezes por semana</option>
                  <option value="month">vezes por mês</option>
                </select>
              </div>
            </div>

            {/* Gramas por sessão */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Gramas por sessão / baseado
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={gramsPerJoint}
                onChange={(e) => setGramsPerJoint(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-[11px] text-gray-500">
                Se não tiver certeza, um valor comum é em torno de 0,5g por
                baseado.
              </p>
            </div>

            {/* Preço por grama */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Quanto paga por grama?
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={currency}
                  onChange={(e) =>
                    setCurrency(e.target.value as 'BRL' | 'USD' | 'EUR')
                  }
                  className="px-2 py-2 rounded-xl border border-gray-300 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="BRL">R$</option>
                  <option value="USD">$</option>
                  <option value="EUR">€</option>
                </select>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={pricePerGram}
                  onChange={(e) => setPricePerGram(Number(e.target.value))}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <p className="text-[11px] text-gray-500">
                Esse valor é chave para o app calcular o quanto você poderia
                estar economizando.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Gasto diário estimado */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Gasto médio diário com maconha
              </label>
              <div className="flex items-center gap-2">
                <span className="px-2 py-2 rounded-xl border border-gray-300 bg-white text-xs text-gray-900">
                  {currency === 'BRL'
                    ? 'R$'
                    : currency === 'USD'
                    ? '$'
                    : '€'}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={dailyCost}
                  onChange={(e) => setDailyCost(Number(e.target.value))}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <p className="text-[11px] text-gray-500">
                Se não souber o valor exato, pode colocar uma média aproximada —
                o app usa isso para as projeções de economia.
              </p>
            </div>

            {/* Último uso */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                Última vez que você fumou
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={lastUseDate}
                  onChange={(e) => setLastUseDate(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  type="time"
                  value={lastUseTime}
                  onChange={(e) => setLastUseTime(e.target.value)}
                  className="w-28 px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <p className="text-[11px] text-gray-500">
                Caso não saiba a hora exata, o aplicativo utiliza 12h como horário aproximado.
                Você pode alterar esse valor antes de salvar.
              </p>
            </div>
          </div>

          {/* Métodos de consumo */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Como você costuma consumir?
            </label>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { value: 'joint', label: 'Baseado (fumar)' },
                { value: 'vape', label: 'Vape / pen' },
                { value: 'bong', label: 'Bong / pipe / bowl' },
                { value: 'edible', label: 'Comestível (brownie, etc.)' },
                { value: 'other', label: 'Outros' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleMethod(opt.value)}
                  className={`px-3 py-1.5 rounded-full border text-xs ${
                    consumptionMethods.includes(opt.value)
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500">
              Isso ajuda a ajustar projeções de saúde e futuras recomendações
              dentro do app.
            </p>
          </div>

          {/* Botão Salvar alterações no final da caixa */}
          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !userData}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold shadow-md hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </section>

        {/* 4) Resumo financeiro estimado */}
        <section style={PROFILE_LIGHT_VARS} className="bg-white/95 rounded-3xl shadow-2xl p-5 space-y-3 border border-purple-500/10">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">
            Projeção de consumo (estimativa mensal)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 px-3 py-3">
              <p className="text-[11px] text-slate-700/80">
                Sessões por mês (estimado)
              </p>
              <p className="text-lg font-bold text-slate-900">
                {Number.isFinite(monthlySessions) ? monthlySessions : 0}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Com base na frequência que você marcou acima.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 px-3 py-3">
              <p className="text-[11px] text-slate-700/80">
                Gramas por mês (aprox.)
              </p>
              <p className="text-lg font-bold text-slate-900">
                {Number.isFinite(monthlyGrams) ? monthlyGrams : 0} g
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Estimado a partir das gramas por sessão.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 px-3 py-3">
              <p className="text-[11px] text-slate-700/80">
                Gasto mensal (estimado)
              </p>
              <p className="text-lg font-bold text-slate-900">
                {currency === 'BRL'
                  ? 'R$'
                  : currency === 'USD'
                  ? '$'
                  : '€'}{' '}
                {estimatedMonthlyCostByCalc ||
                  estimatedMonthlyCostByDaily ||
                  0}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Calculado pelas gramas e preço por grama. Se estiver muito
                diferente da realidade, ajuste os valores nas configurações.
              </p>
            </div>
          </div>
        </section>

        {/* 6) Status da conta + ações */}
        <section style={PROFILE_LIGHT_VARS} className="bg-white/95 rounded-3xl shadow-2xl p-5 space-y-5 border border-purple-500/10">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-white shadow-md">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status da assinatura
                </p>
                {isPremium ? (
                  <p className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Premium ativo neste app
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-purple-600">
                    Plano gratuito em uso
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1 max-w-xl">
                  {isPremium
                    ? 'Você tem acesso liberado à IA de prevenção, análises avançadas e histórico completo do que escreve nas áreas especiais do app.'
                    : 'Assinando o Premium você libera a IA de prevenção, análises avançadas e o histórico completo de tudo que registrar nas áreas especiais do app, além de outros recursos extras.'}
                </p>
              </div>
            </div>

            <Link
              href="/premium"
              className="inline-flex items-center justify-center px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md hover:opacity-90 transition"
            >
              {isPremium ? 'Gerenciar plano Premium' : 'Ver plano Premium'}
            </Link>
          </div>

          <div className="pt-3 border-t border-gray-100 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="space-y-1 text-[11px] text-gray-500">
              <p>
                • O reset do app limpa apenas os dados deste dispositivo
                (progresso e projeções) e volta para valores padrão
                recomendados.
              </p>
              <p>• Sair da conta encerra sua sessão neste dispositivo.</p>
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={handleResetApp}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-red-300/70 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition"
              >
                <RotateCcw className="w-4 h-4" />
                Resetar dados do app
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-300 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 transition"
              >
                <LogOut className="w-4 h-4" />
                Sair da conta
              </button>
            </div>
          </div>
        </section>

        {/* 7) Info complementar */}
        <section className="text-[11px] text-purple-100/90 space-y-1 pb-8">
          <p>
            • Seu nome/apelido e o seu avatar são usados apenas dentro do app, e não são exibidos na comunidade (que é totalmente anônima).
          </p>
          <p>
            • THC, dados de consumo, dinheiro e registros internos são usados
            apenas para cálculos dentro da WeedReset, nunca compartilhados com
            terceiros.
          </p>
        </section>
      </main>
    </div>
  );
}
