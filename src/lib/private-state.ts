'use client';

import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import type { UserData } from '@/lib/types';

/** Dados privados com RLS (um registro por usuário). Nunca guardar tokens ou senhas. */
export type PrivateState = {
  userData?: Partial<UserData> & { goal?: string; lastMood?: string };
  displayName?: string;
  equippedAvatar?: string;
  preferredFocusArea?: string;
  notificationsEnabled?: boolean;
  notificationsTime?: string;
  motivationalLevel?: number;
  darkMode?: boolean;
  preferredLanguage?: string;
  timezone?: string;
  [key: string]: unknown;
};

const OWNER_KEY = 'weedreset_local_account_owner';

// Apenas dados de jornada não sensíveis a autorização. Premium, carteira e
// permissões sempre vêm das tabelas autoritativas do Supabase.
const SYNC_FIELDS = [
  'startDate', 'lastRelapseDate', 'totalRelapses', 'currency',
  'onboardingCompleted', 'dailyCost', 'gramsPerJoint', 'thcPotency',
  'pricePerGram', 'consumptionMethods', 'frequencyAmount',
  'frequencyPeriod', 'lastUseDateTime', 'relapseHistory',
  'goal', 'lastMood', 'detoxCycleActive', 'detoxCycleStartDate',
] as const;

export function snapshotJourney(data: Partial<UserData> & { goal?: string; lastMood?: string }) {
  const snapshot: Record<string, unknown> = {};
  for (const key of SYNC_FIELDS) {
    const value = (data as Record<string, unknown>)[key];
    if (value !== undefined) snapshot[key] = value;
  }
  return snapshot;
}

/** Evita compartilhar localStorage da última conta com outra conta no mesmo navegador. */
export function prepareLocalAccount(userId: string) {
  if (typeof window === 'undefined') return;
  const previousOwner = localStorage.getItem(OWNER_KEY);
  if (previousOwner && previousOwner !== userId) {
    localStorage.removeItem('recovery_user_data');
    localStorage.removeItem('weedreset_display_name');
  }
  localStorage.setItem(OWNER_KEY, userId);
}

export async function readPrivateState(userId: string): Promise<PrivateState | null> {
  const { data, error } = await supabase
    .from('user_private_state')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.data || typeof data.data !== 'object') return null;
  return data.data as PrivateState;
}

/** Atualização atômica do JSONB; o ID vem do JWT autenticado e é validado pelo RLS. */
export async function updatePrivateState(patch: PrivateState): Promise<PrivateState> {
  const { data, error } = await supabase.rpc('merge_user_private_state', {
    p_patch: patch,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error('O servidor não confirmou o salvamento.');
  return data as PrivateState;
}

export function restoreJourney(cloud: PrivateState | null, fallback: UserData | null): UserData | null {
  if (!cloud?.userData) return fallback;
  const merged = { ...(fallback ?? {}), ...cloud.userData } as UserData;
  // Nenhum campo de assinatura ou moedas deve vir de JSONB editável.
  if (fallback) {
    merged.isPremium = fallback.isPremium;
    merged.xp = fallback.xp;
    merged.level = fallback.level;
  }
  storage.saveUserData(merged);
  return merged;
}
