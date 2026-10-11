'use client';

import { useEffect, useState } from 'react';
import {
  CURRENCY_LOCALE_MAP,
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  LOCALE_CONFIG,
  SupportedCurrency,
  SupportedLocale,
} from '@/config/localization';

type LocaleCurrencyState = {
  locale: SupportedLocale;
  currency: SupportedCurrency;
  setLocale: (next: SupportedLocale) => void;
  setCurrency: (next: SupportedCurrency) => void;
};

const LOCALE_STORAGE_KEY = 'weedreset_locale';
const CURRENCY_STORAGE_KEY = 'weedreset_currency';

export function useLocaleCurrency(): LocaleCurrencyState {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);
  const [currency, setCurrencyState] =
    useState<SupportedCurrency>(DEFAULT_CURRENCY);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // tenta recuperar preferências salvas
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    const storedCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY);

    if (storedLocale && isSupportedLocale(storedLocale)) {
      setLocaleState(storedLocale);
    } else {
      // detecta pelo navegador
      const navLang = navigator.language as SupportedLocale;
      if (isSupportedLocale(navLang)) {
        setLocaleState(navLang);
      }
    }

    if (storedCurrency && isSupportedCurrency(storedCurrency)) {
      setCurrencyState(storedCurrency);
    } else {
      // deriva a partir do locale
      const initialLocale = storedLocale && isSupportedLocale(storedLocale)
        ? (storedLocale as SupportedLocale)
        : (navigator.language as SupportedLocale);

      if (isSupportedLocale(initialLocale)) {
        setCurrencyState(LOCALE_CONFIG[initialLocale].currency);
      }
    }
  }, []);

  function setLocale(next: SupportedLocale) {
    setLocaleState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    }
    // se mudar de idioma, podemos opcionalmente ajustar a moeda padrão dele
    const nextCurrency = LOCALE_CONFIG[next].currency;
    setCurrency(nextCurrency);
  }

  function setCurrency(next: SupportedCurrency) {
    setCurrencyState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, next);
    }
  }

  return { locale, currency, setLocale, setCurrency };
}

function isSupportedLocale(v: string): v is SupportedLocale {
  return v === 'pt-BR' || v === 'en-US' || v === 'es-ES';
}

function isSupportedCurrency(v: string): v is SupportedCurrency {
  return v === 'BRL' || v === 'USD' || v === 'EUR';
}

// Helper opcional para formatar valores
export function formatCurrency(
  amount: number,
  currency: SupportedCurrency
): string {
  const locale = CURRENCY_LOCALE_MAP[currency] || 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
