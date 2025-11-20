// Tipos completos do aplicativo de suporte à abstinência

export interface UserData {
  // Dados básicos
  startDate: string;
  lastRelapseDate: string | null;
  totalRelapses: number;
  currency: string;
  onboardingCompleted: boolean;

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
  date: string;
  reason?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  category: 'time' | 'savings' | 'missions';
  daysRequired?: number;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  type: 'daily' | 'weekly';
  completed: boolean;
  completedAt?: string;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  xpCost: number;
  unlocked: boolean;
}

export interface Friend {
  id: string;
  name: string;
  level: number;
  cleanDays: number;
}

export interface CommunityPost {
  id: string;
  content: string;
  timestamp: string;
  likes: number;
}

export interface Recipe {
  id: string;
  title: string;
  ingredients: string[];
  instructions: string;
  category: string;
}

export interface AntiRelapseMethod {
  id: string;
  title: string;
  description: string;
  category: string;
}

export interface MoodEntry {
  date: string;
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