// Tipos completos do aplicativo de suporte à abstinência

// =====================
// USER DATA & RELAPSE
// =====================

export interface RelapseRecord {
  id: string;
  date: string;      // 'YYYY-MM-DD'
  time: string;      // 'HH:mm:ss'
  notes?: string;
  mood?: string;
  trigger?: string;
}

export type FrequencyPeriod = 'day' | 'week' | 'month';

export interface Friend {
  id: string;
  name: string;
  level: number;
  cleanDays: number;
}

export type ThemeMode = 'default' | 'focus';

export interface UserData {
  // Dados básicos de progresso
  startDate: string;
  lastRelapseDate: string | null;
  totalRelapses: number;
  currency: string;
  onboardingCompleted: boolean;
  isPremium: boolean;

  // Dados de consumo detalhados
  dailyCost: number;
  gramsPerJoint: number;
  thcPotency: number;
  pricePerGram: number;
  consumptionMethods: string[];
  frequencyAmount: number;
  frequencyPeriod: FrequencyPeriod;
  lastUseDateTime?: string | null;

  // Histórico
  relapseHistory: RelapseRecord[];

  // Gamificação / progresso
  xp: number;
  level: number;
  completedMissions: string[];
  unlockedRewards: string[];
  themeMode: ThemeMode;
  detoxCycleActive: boolean;
  detoxCycleStartDate: string | null;

  // Rede / social
  friends: Friend[];
}

// =====================
// ACHIEVEMENTS / MISSIONS / REWARDS
// =====================

export type AchievementCategory = 'time' | 'savings' | 'special';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  category: AchievementCategory;
  daysRequired?: number;
}

// Missões no contexto do app (podemos usar tanto para local quanto para dados do banco)
export interface Mission {
  id: number | string;
  title: string;
  description?: string | null;
  category?: string | null;
  rarity?: string | null;
  difficulty?: string | null;

  // Recompensas
  reward_xp?: number;
  reward_coins?: number;

  // Campos opcionais caso alguma parte do app use esse formato
  xpReward?: number;
  type?: 'daily' | 'weekly' | 'one-time';
  completed?: boolean;
  completedAt?: string | null;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  xpCost: number;
  unlocked: boolean;
}

// =====================
// COMMUNITY / RECIPES / METHODS
// =====================

export interface CommunityPost {
  id: string;
  content: string;
  timestamp: string;
  likes: number;
  isPremiumPost?: boolean;
}

export interface Recipe {
  id: string;
  title: string;
  category: string; // juice, smoothie, vitamin, tea, etc.
  ingredients: string[];
  instructions: string;
  benefits: string;
  isPremium: boolean;
}

export interface AntiRelapseMethod {
  id: string;
  title: string;
  description: string;
  steps: string[];
  duration: string;
  category: string; // breathing, grounding, distraction, mindfulness, etc.
  isPremium: boolean;
}

// =====================
// LIMITES DIÁRIOS / DICAS / NOTIFICAÇÕES
// =====================

export interface DailyLimit {
  id: string;
  date: string;       // 'YYYY-MM-DD'
  maxUses: number;
  currentUses: number;
  notifications: boolean;
  completed: boolean;
}

export interface AccessTip {
  id: string;
  title: string;
  description: string;
  category: string;
}

export interface NotificationSettings {
  achievements: boolean;
  tips: boolean;
  motivational: boolean;
  limitWarnings: boolean;
  dailyReminders: boolean;
  crisisSupport: boolean;
}

// =====================
// ANALYTICS / HEALTH
// =====================

export interface AnalyticsData {
  date: string;             // 'YYYY-MM-DD'
  moodAvg?: number | null;
  detoxUsed?: number | null;
  sosUsed?: number | null;
  missionsCompleted?: number | null;
  relapses?: number | null;
}

export interface HealthMetric {
  id: string;
  name: string;
  value: number;
  maxValue: number;
  icon: string;
  color: string; // ex: 'from-blue-500 to-cyan-500'
}

// =====================
// MOOD / DETOX / TRIGGERS
// =====================

export interface MoodEntry {
  date: string;   // 'YYYY-MM-DD'
  mood: string;
  notes?: string;
}

export interface DetoxCycle {
  active: boolean;
  startDate: string;
  endDate: string;
  recommendations: string[];
}

export interface Trigger {
  location: string;
  time: string;
  people: string[];
  objects: string[];
}
