import { HealthMetric } from './types';

// Calcular dias limpos
export function calculateCleanDays(startDate: string, lastRelapseDate: string | null): number {
  const referenceDate = lastRelapseDate ? new Date(lastRelapseDate) : new Date(startDate);
  const now = new Date();
  const diffMs = now.getTime() - referenceDate.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

// Formatar tempo limpo
export function formatCleanTime(days: number): { value: string; unit: string; detail: string } {
  if (days < 1 / 24) {
    const minutes = Math.floor(days * 24 * 60);
    return {
      value: minutes.toString(),
      unit: minutes === 1 ? 'minuto' : 'minutos',
      detail: 'Cada minuto conta!',
    };
  } else if (days < 1) {
    const hours = Math.floor(days * 24);
    return {
      value: hours.toString(),
      unit: hours === 1 ? 'hora' : 'horas',
      detail: 'Continue firme!',
    };
  } else if (days < 7) {
    const wholeDays = Math.floor(days);
    return {
      value: wholeDays.toString(),
      unit: wholeDays === 1 ? 'dia' : 'dias',
      detail: 'Você está indo muito bem!',
    };
  } else if (days < 30) {
    const weeks = Math.floor(days / 7);
    return {
      value: weeks.toString(),
      unit: weeks === 1 ? 'semana' : 'semanas',
      detail: 'Progresso incrível!',
    };
  } else if (days < 365) {
    const months = Math.floor(days / 30);
    return {
      value: months.toString(),
      unit: months === 1 ? 'mês' : 'meses',
      detail: 'Você é uma inspiração!',
    };
  } else {
    const years = Math.floor(days / 365);
    return {
      value: years.toString(),
      unit: years === 1 ? 'ano' : 'anos',
      detail: 'Conquista extraordinária!',
    };
  }
}

// Calcular economia
export function calculateSavings(days: number, dailyCost: number): number {
  return days * dailyCost;
}

// Formatar moeda
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Calcular gramas evitadas
export function calculateGramsAvoided(days: number, gramsPerJoint: number, jointsPerDay: number): number {
  return days * gramsPerJoint * jointsPerDay;
}

// Calcular THC evitado (em mg)
export function calculateTHCAvoided(gramsAvoided: number, thcPotency: number): number {
  return gramsAvoided * 1000 * (thcPotency / 100);
}

// Calcular número de cigarros evitados (baseado em frequência)
export function calculateJointsAvoided(days: number, jointsPerDay: number): number {
  return Math.floor(days * jointsPerDay);
}

// Calcular métricas de saúde
export function calculateHealthMetrics(days: number): HealthMetric[] {
  const metrics: HealthMetric[] = [
    {
      id: 'lungs',
      name: 'Pulmões',
      value: Math.min(100, days * 2),
      maxValue: 100,
      icon: '🩹',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      id: 'energy',
      name: 'Energia',
      value: Math.min(100, days * 3),
      maxValue: 100,
      icon: '⚡',
      color: 'from-yellow-500 to-orange-500',
    },
    {
      id: 'focus',
      name: 'Foco',
      value: Math.min(100, days * 2.5),
      maxValue: 100,
      icon: '🎯',
      color: 'from-purple-500 to-pink-500',
    },
    {
      id: 'mood',
      name: 'Humor',
      value: Math.min(100, days * 1.5),
      maxValue: 100,
      icon: '😊',
      color: 'from-green-500 to-emerald-500',
    },
    {
      id: 'sleep',
      name: 'Sono',
      value: Math.min(100, days * 2),
      maxValue: 100,
      icon: '😴',
      color: 'from-indigo-500 to-blue-500',
    },
    {
      id: 'clarity',
      name: 'Clareza',
      value: Math.min(100, days * 2.8),
      maxValue: 100,
      icon: '🧠',
      color: 'from-pink-500 to-rose-500',
    },
  ];

  return metrics;
}

// Calcular frequência diária baseada no período
export function calculateDailyFrequency(amount: number, period: 'day' | 'week' | 'month'): number {
  switch (period) {
    case 'day':
      return amount;
    case 'week':
      return amount / 7;
    case 'month':
      return amount / 30;
    default:
      return amount;
  }
}

// Mensagens motivacionais
export const motivationalMessages = [
  'Você está fazendo um trabalho incrível! 💪',
  'Cada dia limpo é uma vitória! 🏆',
  'Continue assim, você está no caminho certo! 🌟',
  'Sua saúde agradece cada dia sem fumar! ❤️',
  'Você é mais forte do que imagina! 💎',
  'Recomeçar faz parte do processo. Continue! 🔄',
  'Você não está sozinho nessa jornada! 🤝',
  'Cada momento limpo é um investimento em você! 💰',
  'Sua determinação é inspiradora! ✨',
  'Você merece uma vida saudável e plena! 🌈',
];

// Mensagens de apoio para recaída
export const relapseMessages = [
  'Recaídas fazem parte do processo. O importante é recomeçar! 💪',
  'Você não falhou. Você está aprendendo. Continue tentando! 🌱',
  'Cada recomeço é uma nova oportunidade de sucesso! ⭐',
  'Não desista. Você já provou que é capaz! 🔥',
  'A jornada tem altos e baixos. O importante é seguir em frente! 🚀',
  'Você é mais forte do que qualquer recaída! 💎',
  'Aprenda com isso e volte ainda mais forte! 🦁',
  'Sua determinação em recomeçar já é uma vitória! 🏆',
];

// Obter mensagem aleatória
export function getRandomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}
