// src/config/pricing.ts

import { SupportedCurrency } from './localization';

export type PlanId = 'monthly' | 'annual' | 'lifetime';

export type PricePerCurrency = Record<SupportedCurrency, number>;

export type PricingPlan = {
  id: PlanId;
  label: string;
  subtitle: string;
  prices: PricePerCurrency;
  billingPeriod: 'month' | 'year' | 'lifetime';
  highlight?: 'main' | 'secondary';
  notes?: string;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'monthly',
    label: 'Premium Mensal',
    subtitle: 'Para testar o Premium por pouco tempo.',
    billingPeriod: 'month',
    prices: {
      BRL: 29.9,
      USD: 7.9,
      EUR: 7.9,
    },
  },
  {
    id: 'annual',
    label: 'Premium Anual',
    subtitle: 'Melhor custo-benefício para 12 meses.',
    billingPeriod: 'year',
    highlight: 'main',
    prices: {
      BRL: 99.9,
      USD: 24.9,
      EUR: 24.9,
    },
  },
  {
    id: 'lifetime',
    label: 'Premium Vitalício',
    subtitle: 'Paga uma vez e usa para sempre.',
    billingPeriod: 'lifetime',
    highlight: 'secondary',
    prices: {
      BRL: 149.9, // preço promocional de lançamento
      USD: 39.9,
      EUR: 39.9,
    },
    notes: 'Valor promocional. Previsão futura: R$ 199,90.',
  },
];
