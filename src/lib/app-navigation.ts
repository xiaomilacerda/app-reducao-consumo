import type { LucideIcon } from "lucide-react";
import {
  Activity, BarChart3, BookOpen, Brain, CalendarDays, Crown, Droplets,
  FileText, FlaskConical, Gift, HeartPulse, History, Home, LayoutGrid,
  MessageCircle, Settings, Share2, Shield, SmilePlus, Sparkles, Target, Trash2,
  UserRound, Users
} from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  keywords?: string;
};

export type AppNavGroup = {
  id: string;
  title: string;
  description: string;
  items: AppNavItem[];
};

export const MAIN_TABS: AppNavItem[] = [
  { href: "/", label: "Início", description: "Meu painel", icon: Home },
  { href: "/mood", label: "Humor", description: "Registrar como me sinto", icon: SmilePlus },
  { href: "/missions", label: "Missões", description: "Atividades do dia", icon: Target },
  { href: "/community", label: "Mural", description: "Comunidade", icon: Users },
  { href: "/explorar", label: "Explorar", description: "Todas as funções", icon: LayoutGrid },
];

/** Rotas realmente existentes. Não apresentar rotas administrativas ao público. */
export const APP_NAV_GROUPS: AppNavGroup[] = [
  {
    id: "jornada",
    title: "Minha jornada",
    description: "Acompanhe seu progresso e suas conquistas.",
    items: [
      { href: "/jornada", label: "Jornada 365", description: "Continue o seu percurso diário", icon: CalendarDays, keywords: "calendario jornada dias" },
      { href: "/analytics", label: "Dados e estatísticas", description: "Entenda a sua evolução", icon: BarChart3, keywords: "analises gráficos indicadores economia" },
      { href: "/mood", label: "Diário de emoções", description: "Registre como você se sente", icon: SmilePlus, keywords: "humor diario check-in" },
      { href: "/missions", label: "Missões", description: "Pequenas ações de cada dia", icon: Target, keywords: "tarefas desafios xp" },
      { href: "/rewards", label: "Recompensas e loja", description: "Seus itens, moedas e avatar", icon: Gift, keywords: "moedas xp loja itens avatar" },
      { href: "/mood/history", label: "Histórico de emoções", description: "Reveja seus registros de humor", icon: History, keywords: "humor registros passado" },
      { href: "/jornada/history", label: "Histórico da jornada", description: "Revise suas reflexões anteriores", icon: BookOpen, keywords: "reflexões registro histórico" },
      { href: "/experimento", label: "Experimento guiado", description: "Explore os passos do desafio", icon: FlaskConical, keywords: "experimento desafio calendario" },
    ],
  },
  {
    id: "cuidado",
    title: "Cuidado e apoio",
    description: "Encontre recursos para momentos difíceis.",
    items: [
      { href: "/sos", label: "Ajuda SOS", description: "Apoio para momentos de vontade", icon: HeartPulse, keywords: "preciso de ajuda urgencia fissura ansiedade" },
      { href: "/cant-stop", label: "Não consigo parar", description: "Estratégias e acolhimento", icon: MessageCircle, keywords: "apoio recaida parar consumir" },
      { href: "/ai-insights", label: "IA de prevenção", description: "Informações e reflexões de apoio", icon: Brain, keywords: "inteligencia artificial prevencao" },
      { href: "/body-evolution", label: "Evolução corporal", description: "Indicadores e acompanhamento", icon: Activity, keywords: "corpo saude progresso" },
      { href: "/detox", label: "Plano de cuidados", description: "Rotina de autocuidado", icon: Droplets, keywords: "detox sono água habitos" },
      { href: "/sos/history", label: "Histórico de apoio", description: "Reveja os recursos utilizados", icon: History, keywords: "sos histórico ajuda" },
    ],
  },
  {
    id: "conexoes",
    title: "Comunidade e compartilhamento",
    description: "Encontre outras pessoas e compartilhe suas vitórias.",
    items: [
      { href: "/community", label: "Comunidade", description: "Publicações e conversas anônimas", icon: Users, keywords: "mural comentários respostas" },
      { href: "/share", label: "Compartilhar progresso", description: "Mostre suas conquistas", icon: Share2, keywords: "compartilhar imagem progresso" },
      { href: "/story", label: "Cartão da sua jornada", description: "Crie um cartão com sua história", icon: Sparkles, keywords: "story cartão historia compartilhar" },
    ],
  },
  {
    id: "conta",
    title: "Conta e preferências",
    description: "Personalize seu espaço e suas preferências.",
    items: [
      { href: "/profile", label: "Meu perfil", description: "Seus dados e informações", icon: UserRound, keywords: "conta cadastro perfil" },
      { href: "/settings", label: "Configurações", description: "Notificações e preferências", icon: Settings, keywords: "configurações ajustes tema notificações" },
      { href: "/premium", label: "Plano Premium", description: "Conheça os recursos do plano", icon: Crown, keywords: "premium assinatura" },
      { href: "/excluir-conta", label: "Excluir conta", description: "Remova sua conta e registros pessoais", icon: Trash2, keywords: "privacidade remoção excluir apagar dados lgpd" },
      { href: "/privacy", label: "Privacidade", description: "Como os dados são tratados", icon: Shield, keywords: "termos dados segurança" },
      { href: "/terms", label: "Termos de uso", description: "Condições de utilização", icon: FileText, keywords: "juridico contrato termos" },
    ],
  },
];

/**
 * A aba Explorar representa as rotas que não fazem parte das quatro
 * abas de acesso direto. Assim sempre existe contexto visual na barra.
 */
export function activeMainTab(pathname: string): string {
  if (pathname === "/") return "/";
  if (pathname === "/mood" || pathname.startsWith("/mood/")) return "/mood";
  if (pathname === "/missions" || pathname.startsWith("/missions/")) return "/missions";
  if (pathname === "/community" || pathname.startsWith("/community/")) return "/community";
  return "/explorar";
}

export function isRouteActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
}

export function normalizeNavigationSearch(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function getNavMatch(item: AppNavItem, query: string): boolean {
  const term = normalizeNavigationSearch(query);
  if (!term) return true;
  return normalizeNavigationSearch([item.label, item.description, item.keywords || ""].join(" ")).includes(term);
}
