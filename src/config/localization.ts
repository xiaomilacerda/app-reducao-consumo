// src/config/localization.ts

export type SupportedLocale = 'pt-BR' | 'en-US' | 'es-ES';
export type SupportedCurrency = 'BRL' | 'USD' | 'EUR';

export const DEFAULT_LOCALE: SupportedLocale = 'pt-BR';
export const DEFAULT_CURRENCY: SupportedCurrency = 'BRL';

export const LOCALE_CONFIG: Record<
  SupportedLocale,
  {
    label: string;
    langName: string;
    currency: SupportedCurrency;
  }
> = {
  'pt-BR': {
    label: 'Português (Brasil)',
    langName: 'Português',
    currency: 'BRL',
  },
  'en-US': {
    label: 'English (US)',
    langName: 'English',
    currency: 'USD',
  },
  'es-ES': {
    label: 'Español',
    langName: 'Español',
    currency: 'EUR', // ponto de partida (pode mudar depois)
  },
};

// Mapeia qual locale usar para formatar cada moeda
export const CURRENCY_LOCALE_MAP: Record<SupportedCurrency, string> = {
  BRL: 'pt-BR',
  USD: 'en-US',
  EUR: 'de-DE', // ou pt-PT / es-ES, tanto faz, é só pra formatação
};
