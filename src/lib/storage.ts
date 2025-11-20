import { 
  UserData, 
  Achievement, 
  RelapseRecord, 
  CommunityPost, 
  Recipe, 
  AntiRelapseMethod,
  DailyLimit,
  AccessTip,
  AnalyticsData,
  NotificationSettings
} from './types';

const STORAGE_KEYS = {
  USER_DATA: 'recovery_user_data',
  ACHIEVEMENTS: 'recovery_achievements',
  COMMUNITY_POSTS: 'recovery_community_posts',
  RECIPES: 'recovery_recipes',
  METHODS: 'recovery_methods',
  DAILY_LIMITS: 'recovery_daily_limits',
  ACCESS_TIPS: 'recovery_access_tips',
  ANALYTICS: 'recovery_analytics',
  NOTIFICATIONS: 'recovery_notifications',
};

// Valores padrão para UserData
const DEFAULT_USER_DATA: Partial<UserData> = {
  consumptionMethods: [],
  thcPotency: 0,
  gramsPerJoint: 0,
  costPerGram: 0,
  pricePerGram: 0,
  dailyCost: 0,
  frequencyAmount: 0,
  frequencyPeriod: 'day',
  lastRelapseDate: null,
  totalRelapses: 0,
  relapseHistory: [],
  currency: 'BRL',
  onboardingCompleted: false,
  isPremium: false,
};

// Conquistas expandidas
const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  // Conquistas de tempo
  { id: '1h', title: 'Primeira Hora', description: 'Você completou sua primeira hora limpo!', icon: '🌱', unlocked: false, daysRequired: 0.042, category: 'time' },
  { id: '6h', title: 'Seis Horas', description: 'Seis horas de força!', icon: '🌿', unlocked: false, daysRequired: 0.25, category: 'time' },
  { id: '12h', title: 'Meio Dia', description: 'Meio dia completo!', icon: '☀️', unlocked: false, daysRequired: 0.5, category: 'time' },
  { id: '24h', title: 'Primeiro Dia', description: 'Um dia inteiro de determinação!', icon: '⭐', unlocked: false, daysRequired: 1, category: 'time' },
  { id: '3d', title: 'Três Dias', description: 'Três dias de progresso!', icon: '🔥', unlocked: false, daysRequired: 3, category: 'time' },
  { id: '1w', title: 'Uma Semana', description: 'Uma semana completa!', icon: '💪', unlocked: false, daysRequired: 7, category: 'time' },
  { id: '2w', title: 'Duas Semanas', description: 'Duas semanas de transformação!', icon: '🏆', unlocked: false, daysRequired: 14, category: 'time' },
  { id: '1m', title: 'Um Mês', description: 'Um mês inteiro!', icon: '👑', unlocked: false, daysRequired: 30, category: 'time' },
  { id: '3m', title: 'Três Meses', description: 'Três meses de vitórias!', icon: '💎', unlocked: false, daysRequired: 90, category: 'time' },
  { id: '6m', title: 'Seis Meses', description: 'Meio ano de conquistas!', icon: '🌟', unlocked: false, daysRequired: 180, category: 'time' },
  { id: '1y', title: 'Um Ano', description: 'UM ANO LIMPO!', icon: '🎖️', unlocked: false, daysRequired: 365, category: 'time' },
  
  // Conquistas de economia
  { id: 'save100', title: 'Economizou R$100', description: 'Primeira centena economizada!', icon: '💰', unlocked: false, daysRequired: 0, category: 'savings' },
  { id: 'save500', title: 'Economizou R$500', description: 'Meio milheiro guardado!', icon: '💵', unlocked: false, daysRequired: 0, category: 'savings' },
  { id: 'save1000', title: 'Economizou R$1.000', description: 'Mil reais economizados!', icon: '🤑', unlocked: false, daysRequired: 0, category: 'savings' },
  
  // Conquistas especiais
  { id: 'first_relapse', title: 'Recomeço', description: 'Você teve uma recaída, mas está recomeçando. Isso é coragem!', icon: '🔄', unlocked: false, daysRequired: 0, category: 'special' },
  { id: 'community', title: 'Membro da Comunidade', description: 'Você fez sua primeira postagem!', icon: '🤝', unlocked: false, daysRequired: 0, category: 'special' },
];

// Receitas alternativas
const DEFAULT_RECIPES: Recipe[] = [
  {
    id: 'juice1',
    title: 'Suco Calmante de Maracujá',
    category: 'juice',
    ingredients: ['1 maracujá', '200ml de água', '1 colher de mel', 'Gelo'],
    instructions: 'Bata todos os ingredientes no liquidificador e coe. Beba gelado.',
    benefits: 'O maracujá tem propriedades calmantes naturais que ajudam a reduzir a ansiedade.',
    isPremium: false,
  },
  {
    id: 'juice2',
    title: 'Suco Energizante de Laranja com Gengibre',
    category: 'juice',
    ingredients: ['2 laranjas', '1 pedaço pequeno de gengibre', '1 cenoura', 'Água'],
    instructions: 'Descasque as laranjas e a cenoura. Bata tudo com o gengibre e água.',
    benefits: 'Aumenta a energia naturalmente e fortalece o sistema imunológico.',
    isPremium: false,
  },
  {
    id: 'smoothie1',
    title: 'Smoothie Anti-Fissura de Banana',
    category: 'smoothie',
    ingredients: ['2 bananas congeladas', '1 copo de leite', '1 colher de aveia', 'Canela'],
    instructions: 'Bata todos os ingredientes até ficar cremoso.',
    benefits: 'A banana contém triptofano que ajuda na produção de serotonina, melhorando o humor.',
    isPremium: true,
  },
  {
    id: 'vitamin1',
    title: 'Vitamina Relaxante de Abacate',
    category: 'vitamin',
    ingredients: ['1 abacate', '1 copo de leite', '1 colher de mel', 'Gelo'],
    instructions: 'Bata tudo no liquidificador até ficar homogêneo.',
    benefits: 'Rico em gorduras boas que ajudam na função cerebral e reduzem a ansiedade.',
    isPremium: true,
  },
  {
    id: 'tea1',
    title: 'Chá Calmante de Camomila',
    category: 'tea',
    ingredients: ['2 colheres de camomila seca', '1 xícara de água quente', 'Mel a gosto'],
    instructions: 'Deixe a camomila em infusão por 5 minutos. Adoce com mel.',
    benefits: 'A camomila é conhecida por suas propriedades relaxantes e indutoras do sono.',
    isPremium: false,
  },
];

// Métodos anti-recaída
const DEFAULT_METHODS: AntiRelapseMethod[] = [
  {
    id: 'breathing1',
    title: 'Respiração 4-7-8',
    description: 'Técnica de respiração para acalmar a mente rapidamente',
    steps: [
      'Inspire pelo nariz contando até 4',
      'Segure a respiração contando até 7',
      'Expire pela boca contando até 8',
      'Repita 4 vezes',
    ],
    duration: '2 minutos',
    category: 'breathing',
    isPremium: false,
  },
  {
    id: 'breathing2',
    title: 'Respiração Quadrada',
    description: 'Técnica usada por militares para controlar o estresse',
    steps: [
      'Inspire contando até 4',
      'Segure contando até 4',
      'Expire contando até 4',
      'Segure vazio contando até 4',
      'Repita 5 vezes',
    ],
    duration: '3 minutos',
    category: 'breathing',
    isPremium: true,
  },
  {
    id: 'grounding1',
    title: 'Técnica 5-4-3-2-1',
    description: 'Grounding para trazer você de volta ao presente',
    steps: [
      'Identifique 5 coisas que você pode VER',
      'Identifique 4 coisas que você pode TOCAR',
      'Identifique 3 coisas que você pode OUVIR',
      'Identifique 2 coisas que você pode CHEIRAR',
      'Identifique 1 coisa que você pode SABOREAR',
    ],
    duration: '5 minutos',
    category: 'grounding',
    isPremium: false,
  },
  {
    id: 'distraction1',
    title: 'Lista de Distrações Rápidas',
    description: 'Atividades para fazer quando a fissura aparecer',
    steps: [
      'Beba um copo de água gelada',
      'Faça 10 polichinelos',
      'Ligue para um amigo',
      'Assista a um vídeo engraçado',
      'Tome um banho frio',
      'Escove os dentes',
      'Organize uma gaveta',
      'Desenhe ou rabisque',
    ],
    duration: '5-10 minutos',
    category: 'distraction',
    isPremium: false,
  },
  {
    id: 'mindfulness1',
    title: 'Atrasar o Consumo',
    description: 'Técnica de micro-metas para adiar a recaída',
    steps: [
      'Quando sentir vontade, espere 5 minutos',
      'Se ainda sentir, espere mais 5 minutos',
      'Continue adiando em intervalos de 5 minutos',
      'Muitas vezes a vontade passa antes de você perceber',
    ],
    duration: 'Variável',
    category: 'mindfulness',
    isPremium: true,
  },
];

// Dicas de dificultar acesso
const DEFAULT_ACCESS_TIPS: AccessTip[] = [
  { id: 'tip1', title: 'Guarde longe', description: 'Guarde o dichavador e acessórios em um lugar de difícil acesso.', category: 'storage' },
  { id: 'tip2', title: 'Fora da vista', description: 'Tire a maconha do seu campo de visão. O que os olhos não veem, o coração não sente.', category: 'environment' },
  { id: 'tip3', title: 'Mude de ambiente', description: 'Quando sentir vontade, mude de ambiente por 3 minutos.', category: 'environment' },
  { id: 'tip4', title: 'Evite gatilhos', description: 'Identifique e evite situações que costumam te fazer querer fumar.', category: 'routine' },
  { id: 'tip5', title: 'Conte para alguém', description: 'Compartilhe sua meta com um amigo de confiança.', category: 'social' },
  { id: 'tip6', title: 'Troque o ritual', description: 'Substitua o ritual de fumar por outro hábito saudável.', category: 'routine' },
];

export const storage = {
  // ===== USER DATA =====
  saveUserData: (data: UserData): void => {
    if (typeof window !== 'undefined') {
      // Garantir que consumptionMethods seja sempre um array
      const safeData = {
        ...data,
        consumptionMethods: Array.isArray(data.consumptionMethods) ? data.consumptionMethods : [],
        thcPotency: data.thcPotency || 0,
        gramsPerJoint: data.gramsPerJoint || 0,
        dailyCost: data.dailyCost || 0,
        pricePerGram: data.pricePerGram || 0,
        frequencyAmount: data.frequencyAmount || 0,
        relapseHistory: Array.isArray(data.relapseHistory) ? data.relapseHistory : [],
      };
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(safeData));
    }
  },

  getUserData: (): UserData | null => {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(STORAGE_KEYS.USER_DATA);
      if (data) {
        const parsed = JSON.parse(data);
        // Garantir valores padrão ao recuperar
        return {
          ...DEFAULT_USER_DATA,
          ...parsed,
          consumptionMethods: Array.isArray(parsed.consumptionMethods) ? parsed.consumptionMethods : [],
          relapseHistory: Array.isArray(parsed.relapseHistory) ? parsed.relapseHistory : [],
          thcPotency: parsed.thcPotency || 0,
          gramsPerJoint: parsed.gramsPerJoint || 0,
          dailyCost: parsed.dailyCost || 0,
          pricePerGram: parsed.pricePerGram || 0,
          frequencyAmount: parsed.frequencyAmount || 0,
        } as UserData;
      }
    }
    return null;
  },

  initUserData: (data: Partial<UserData>): UserData => {
    const userData: UserData = {
      ...DEFAULT_USER_DATA,
      startDate: new Date().toISOString(),
      lastRelapseDate: null,
      totalRelapses: 0,
      currency: 'BRL',
      onboardingCompleted: true,
      isPremium: false,
      relapseHistory: [],
      consumptionMethods: [],
      thcPotency: 0,
      gramsPerJoint: 0,
      dailyCost: 0,
      pricePerGram: 0,
      frequencyAmount: 0,
      frequencyPeriod: 'day',
      // Novos recursos avançados
      xp: 0,
      level: 1,
      completedMissions: [],
      unlockedRewards: [],
      themeMode: 'default',
      detoxCycleActive: false,
      detoxCycleStartDate: null,
      friends: [],
      ...data,
      // Garantir que arrays sejam sempre arrays
      consumptionMethods: Array.isArray(data.consumptionMethods) ? data.consumptionMethods : [],
      relapseHistory: Array.isArray(data.relapseHistory) ? data.relapseHistory : [],
      completedMissions: Array.isArray(data.completedMissions) ? data.completedMissions : [],
      unlockedRewards: Array.isArray(data.unlockedRewards) ? data.unlockedRewards : [],
      friends: Array.isArray(data.friends) ? data.friends : [],
    } as UserData;
    
    storage.saveUserData(userData);
    storage.initAchievements();
    storage.initRecipes();
    storage.initMethods();
    storage.initAccessTips();
    storage.initNotifications();
    return userData;
  },

  registerRelapse: (notes?: string, mood?: string, trigger?: string): UserData => {
    const userData = storage.getUserData();
    if (userData) {
      const now = new Date();
      const relapseRecord: RelapseRecord = {
        id: `relapse_${Date.now()}`,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        notes,
        mood,
        trigger,
      };

      userData.lastRelapseDate = now.toISOString();
      userData.totalRelapses += 1;
      userData.relapseHistory = Array.isArray(userData.relapseHistory) ? userData.relapseHistory : [];
      userData.relapseHistory.push(relapseRecord);
      
      storage.saveUserData(userData);
      storage.resetAchievements();
    }
    return userData!;
  },

  // ===== ACHIEVEMENTS =====
  initAchievements: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(DEFAULT_ACHIEVEMENTS));
    }
  },

  getAchievements: (): Achievement[] => {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
      return data ? JSON.parse(data) : DEFAULT_ACHIEVEMENTS;
    }
    return DEFAULT_ACHIEVEMENTS;
  },

  updateAchievements: (achievements: Achievement[]): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(achievements));
    }
  },

  resetAchievements: (): void => {
    storage.initAchievements();
  },

  // ===== COMMUNITY =====
  getCommunityPosts: (): CommunityPost[] => {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(STORAGE_KEYS.COMMUNITY_POSTS);
      return data ? JSON.parse(data) : [];
    }
    return [];
  },

  addCommunityPost: (content: string, isPremium: boolean): void => {
    if (typeof window !== 'undefined') {
      const posts = storage.getCommunityPosts();
      const newPost: CommunityPost = {
        id: `post_${Date.now()}`,
        content,
        timestamp: new Date().toISOString(),
        likes: 0,
        isPremiumPost: isPremium,
      };
      posts.unshift(newPost);
      localStorage.setItem(STORAGE_KEYS.COMMUNITY_POSTS, JSON.stringify(posts));
    }
  },

  // ===== RECIPES =====
  initRecipes: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.RECIPES, JSON.stringify(DEFAULT_RECIPES));
    }
  },

  getRecipes: (): Recipe[] => {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(STORAGE_KEYS.RECIPES);
      return data ? JSON.parse(data) : DEFAULT_RECIPES;
    }
    return DEFAULT_RECIPES;
  },

  // ===== METHODS =====
  initMethods: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.METHODS, JSON.stringify(DEFAULT_METHODS));
    }
  },

  getMethods: (): AntiRelapseMethod[] => {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(STORAGE_KEYS.METHODS);
      return data ? JSON.parse(data) : DEFAULT_METHODS;
    }
    return DEFAULT_METHODS;
  },

  // ===== DAILY LIMITS =====
  getDailyLimit: (): DailyLimit | null => {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(STORAGE_KEYS.DAILY_LIMITS);
      if (data) {
        const limit: DailyLimit = JSON.parse(data);
        const today = new Date().toISOString().split('T')[0];
        if (limit.date === today) {
          return limit;
        }
      }
    }
    return null;
  },

  setDailyLimit: (maxUses: number): DailyLimit => {
    const limit: DailyLimit = {
      id: `limit_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      maxUses,
      currentUses: 0,
      notifications: true,
      completed: false,
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.DAILY_LIMITS, JSON.stringify(limit));
    }
    return limit;
  },

  incrementDailyLimit: (): DailyLimit | null => {
    const limit = storage.getDailyLimit();
    if (limit) {
      limit.currentUses += 1;
      if (limit.currentUses >= limit.maxUses) {
        limit.completed = true;
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.DAILY_LIMITS, JSON.stringify(limit));
      }
    }
    return limit;
  },

  // ===== ACCESS TIPS =====
  initAccessTips: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TIPS, JSON.stringify(DEFAULT_ACCESS_TIPS));
    }
  },

  getAccessTips: (): AccessTip[] => {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(STORAGE_KEYS.ACCESS_TIPS);
      return data ? JSON.parse(data) : DEFAULT_ACCESS_TIPS;
    }
    return DEFAULT_ACCESS_TIPS;
  },

  // ===== NOTIFICATIONS =====
  initNotifications: (): void => {
    const defaultSettings: NotificationSettings = {
      achievements: true,
      tips: true,
      motivational: true,
      limitWarnings: true,
      dailyReminders: true,
      crisisSupport: true,
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(defaultSettings));
    }
  },

  getNotificationSettings: (): NotificationSettings => {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      return data ? JSON.parse(data) : {
        achievements: true,
        tips: true,
        motivational: true,
        limitWarnings: true,
        dailyReminders: true,
        crisisSupport: true,
      };
    }
    return {
      achievements: true,
      tips: true,
      motivational: true,
      limitWarnings: true,
      dailyReminders: true,
      crisisSupport: true,
    };
  },

  updateNotificationSettings: (settings: NotificationSettings): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(settings));
    }
  },

  // ===== CLEAR ALL =====
  clearAll: (): void => {
    if (typeof window !== 'undefined') {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    }
  },
};
