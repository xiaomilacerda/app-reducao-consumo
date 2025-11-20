// Tipos completos do aplicativo de suporte à abstinência

export interface UserData {
  // Dados básicos
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
  frequencyPeriod: 'day' | 'week' | 'month';
  lastUseDateTime: string;

  // Histórico
  relapseHistory: RelapseRecord[];

  // Novos recursos avançados
  xp: number;
  level: number;
  completedMissions: string[];
  unlockedRewards: string[];
  themeMode: 'default' | 'focus';
  detoxCycleActive: boolean;
  detoxCycleStartDate: string | null;
  friends: Friend[];
}

export interface RelapseRecord {
  id: string;
  date: string;
  time: string;
  notes?: string;
  mood?: string;
  trigger?: string;
  location?: string;
  withWhom?: string;
  equipment?: string;
}

export interface HealthMetric {
  id: string;
  name: string;
  value: number;
  maxValue: number;
  icon: string;
  color: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  daysRequired: number;
  category: 'time' | 'savings' | 'health' | 'special';
}

export interface CommunityPost {
  id: string;
  content: string;
  timestamp: string;
  likes: number;
  isPremiumPost: boolean;
}

export interface Recipe {
  id: string;
  title: string;
  category: 'juice' | 'smoothie' | 'vitamin' | 'tea';
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
  category: 'breathing' | 'grounding' | 'distraction' | 'mindfulness';
  isPremium: boolean;
}

export interface DailyLimit {
  id: string;
  date: string;
  maxUses: number;
  currentUses: number;
  notifications: boolean;
  completed: boolean;
}

export interface AccessTip {
  id: string;
  title: string;
  description: string;
  category: 'environment' | 'storage' | 'routine' | 'social';
}

export interface AnalyticsData {
  dailyStats: DailyStat[];
  weeklyComparison: WeeklyStat[];
  monthlyTrends: MonthlyTrend[];
  commonTriggers: TriggerStat[];
  peakHours: HourStat[];
}

export interface DailyStat {
  date: string;
  relapses: number;
  savings: number;
  healthScore: number;
}

export interface WeeklyStat {
  week: string;
  totalRelapses: number;
  avgHealthScore: number;
  totalSavings: number;
}

export interface MonthlyTrend {
  month: string;
  relapseCount: number;
  savingsTotal: number;
  improvementRate: number;
}

export interface TriggerStat {
  trigger: string;
  count: number;
  percentage: number;
}

export interface HourStat {
  hour: number;
  count: number;
}

export interface NotificationSettings {
  achievements: boolean;
  tips: boolean;
  motivational: boolean;
  limitWarnings: boolean;
  dailyReminders: boolean;
  crisisSupport: boolean;
}

// ===== NOVOS TIPOS PARA RECURSOS AVANÇADOS =====

export interface MoodEntry {
  id: string;
  date: string;
  time: string;
  mood: 'calm' | 'anxious' | 'very-anxious' | 'irritated' | 'normal' | 'good' | 'great';
  notes?: string;
}

export interface AIInsight {
  id: string;
  type: 'mood' | 'relapse-risk' | 'pattern' | 'achievement';
  title: string;
  description: string;
  timestamp: string;
  priority: 'low' | 'medium' | 'high';
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly';
  xpReward: number;
  completed: boolean;
  completedAt?: string;
  category: 'delay' | 'substitute' | 'engage' | 'track';
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  type: 'badge' | 'card' | 'avatar-frame' | 'theme' | 'icon';
  xpCost: number;
  unlocked: boolean;
  imageUrl?: string;
}

export interface BodyEvolution {
  hours: number;
  title: string;
  description: string;
  icon: string;
  completed: boolean;
}

export interface DetoxMetric {
  day: number;
  thcLevel: number;
  hydrationGoal: number;
  sleepGoal: number;
  exerciseMinutes: number;
}

export interface Friend {
  id: string;
  name: string;
  avatar: string;
  cleanDays: number;
  xp: number;
  level: number;
}

export interface TriggerAnalysis {
  locations: { name: string; count: number }[];
  times: { hour: number; count: number }[];
  people: { name: string; count: number }[];
  equipment: { name: string; count: number }[];
}
