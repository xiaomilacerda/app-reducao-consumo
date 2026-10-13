'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { prepareLocalAccount, readPrivateState, updatePrivateState } from '@/lib/private-state';
import {
  ArrowLeft,
  Settings as SettingsIcon,
  Smartphone,
  Crown,
  Languages,
  Globe2,
  SunMedium,
  Moon,
  Brain,
  Sparkles,
  Clock,
  Bell,
  Shield,
  Info,
  Save,
  LogOut,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

type ProfileRow = {
  display_name: string | null;
  is_premium: boolean | null;
  timezone: string | null;
  preferred_focus_area: string | null;
  motivational_level: number | null;
  notifications_enabled: boolean | null;
  dark_mode: boolean | null;
  preferred_language: string | null;
};

type UserSettingsRow = {
  notifications_enabled: boolean | null;
  notifications_time: string | null;
};

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const DEFAULT_LANGUAGE: 'pt' | 'en' | 'es' = 'pt';
const DEFAULT_NOTIFICATIONS_TIME = '20:00';

export default function SettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [accountCreatedAt, setAccountCreatedAt] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState<string>('');
  const [isPremium, setIsPremium] = useState<boolean>(false);

  // Preferências de app
  const [preferredLanguage, setPreferredLanguage] =
    useState<'pt' | 'en' | 'es'>(DEFAULT_LANGUAGE);
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [preferredFocusArea, setPreferredFocusArea] = useState<
    'detox' | 'mood' | 'money' | 'health'
  >('detox');
  const [motivationalLevel, setMotivationalLevel] = useState<number>(3);
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Notificações
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [notificationsTime, setNotificationsTime] =
    useState<string>(DEFAULT_NOTIFICATIONS_TIME);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Erro getSession (settings):', sessionError.message);
        }

        const user = session?.user;
        if (!user) {
          router.push('/login');
          return;
        }

        setUserId(user.id);
        setUserEmail(user.email ?? null);
        prepareLocalAccount(user.id);
        setAccountCreatedAt(
          user.created_at ? new Date(user.created_at).toLocaleString() : null
        );

        // PROFILE
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select(
            'display_name, is_premium, timezone, preferred_language'
          )
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.warn('Erro carregando profile em Settings:', profileError.message);
        }

        const p = (profile ?? null) as ProfileRow | null;

        if (p) {
          if (p.display_name) setDisplayName(p.display_name);
          if (typeof p.is_premium === 'boolean') setIsPremium(p.is_premium);

          if (p.timezone && p.timezone.trim()) {
            setTimezone(p.timezone);
          } else {
            setTimezone(DEFAULT_TIMEZONE);
          }

          if (p.preferred_focus_area) {
            const allowed = ['detox', 'mood', 'money', 'health'] as const;
            const value = p.preferred_focus_area as any;
            setPreferredFocusArea(
              allowed.includes(value) ? value : ('detox' as 'detox')
            );
          }

          if (typeof p.motivational_level === 'number') {
            setMotivationalLevel(p.motivational_level || 3);
          }

          if (typeof p.notifications_enabled === 'boolean') {
            setNotificationsEnabled(p.notifications_enabled);
          }

          if (typeof p.dark_mode === 'boolean') {
            setDarkMode(p.dark_mode);
          }

          if (
            typeof p.preferred_language === 'string' &&
            ['pt', 'en', 'es'].includes(p.preferred_language)
          ) {
            setPreferredLanguage(p.preferred_language as 'pt' | 'en' | 'es');
          } else {
            setPreferredLanguage(DEFAULT_LANGUAGE);
          }
        }

        // USER_SETTINGS
        const { data: userSettings, error: settingsError } = await supabase
          .from('user_settings')
          .select('notifications_enabled, notifications_time')
          .eq('user_id', user.id)
          .maybeSingle();

        if (settingsError) {
          console.warn(
            'Erro carregando user_settings em Settings:',
            settingsError.message
          );
        }

        const s = (userSettings ?? null) as UserSettingsRow | null;

        if (s) {
          if (typeof s.notifications_enabled === 'boolean') {
            setNotificationsEnabled(s.notifications_enabled);
          }

          if (typeof s.notifications_time === 'string' && s.notifications_time.trim()) {
            setNotificationsTime(s.notifications_time);
          }
        }

        // Preferências privadas que não cabem nas colunas atuais de profiles.
        const privateState = await readPrivateState(user.id);
        if (privateState) {
          if (privateState.displayName) setDisplayName(privateState.displayName);
          if (typeof privateState.preferredFocusArea === 'string' &&
              ['detox', 'mood', 'money', 'health'].includes(privateState.preferredFocusArea)) {
            setPreferredFocusArea(privateState.preferredFocusArea as 'detox' | 'mood' | 'money' | 'health');
          }
          if (typeof privateState.motivationalLevel === 'number') setMotivationalLevel(privateState.motivationalLevel);
          if (typeof privateState.darkMode === 'boolean') setDarkMode(privateState.darkMode);
          if (typeof privateState.notificationsEnabled === 'boolean') setNotificationsEnabled(privateState.notificationsEnabled);
          if (privateState.notificationsTime) setNotificationsTime(privateState.notificationsTime);
          if (privateState.preferredLanguage && ['pt', 'en', 'es'].includes(privateState.preferredLanguage)) {
            setPreferredLanguage(privateState.preferredLanguage as 'pt' | 'en' | 'es');
          }
          if (typeof privateState.timezone === 'string') setTimezone(privateState.timezone);
        }
      } catch (err: any) {
        console.error(err?.message ?? err);
        setErrorMessage('Não foi possível carregar as configurações.');
      } finally {
        setLoading(false);
      }
    };

    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!userId) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      setSaving(true);

      // Salvar em profiles
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        display_name: displayName.trim() || null,
        timezone,
        preferred_language: preferredLanguage,
      });

      if (profileError) {
        console.error('Erro ao salvar profile (settings):', profileError.message);
        throw new Error('Erro ao salvar dados principais.');
      }

      // Salvar em user_settings
      const { error: settingsError } = await supabase.from('user_settings').upsert({
        user_id: userId,
        notifications_enabled: notificationsEnabled,
        notifications_time: notificationsTime,
      });

      if (settingsError) {
        console.error('Erro ao salvar user_settings (settings):', settingsError.message);
        throw new Error('Erro ao salvar configurações de notificações.');
      }

      await updatePrivateState({
        displayName: displayName.trim(),
        timezone,
        preferredFocusArea,
        motivationalLevel,
        darkMode,
        notificationsEnabled,
        notificationsTime,
        preferredLanguage,
      });

      setSuccessMessage('Configurações salvas na nuvem e disponíveis em outros dispositivos!');
    } catch (err: any) {
      console.error(err?.message ?? err);
      setErrorMessage(
        err?.message || 'Não foi possível salvar as configurações. Tente novamente.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      setSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      await supabase.auth.signOut();
      router.push('/login');
    } catch (err: any) {
      console.error(err?.message ?? err);
      setErrorMessage('Não foi possível sair da conta.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-black to-gray-900">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  const currentName =
    displayName || (userId ? `WeedReset User #${userId.slice(0, 4)}` : 'WeedReset User');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-gray-900">
      {/* HEADER */}
      <header className="bg-black/40 backdrop-blur-sm shadow-sm sticky top-0 z-30 border-b border-purple-500/20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push('/profile')}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          <div className="flex items-center gap-3 justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md">
                <SettingsIcon className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Configurações do app</h1>
                <p className="text-xs text-purple-100/80">
                  Ajuste idioma, região, visual, notificações e detalhes da sua conta.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* CONTEÚDO */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Mensagens */}
        {(errorMessage || successMessage) && (
          <div className="space-y-2">
            {errorMessage && (
              <div className="flex items-center gap-2 text-xs bg-red-900/40 border border-red-500/60 text-red-50 px-3 py-2 rounded-xl">
                <AlertCircle className="w-4 h-4" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="flex items-center gap-2 text-xs bg-emerald-900/40 border border-emerald-500/60 text-emerald-50 px-3 py-2 rounded-xl">
                <CheckCircle2 className="w-4 h-4" />
                <span>{successMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* CONTA & STATUS */}
        <section className="bg-white/95 rounded-3xl shadow-2xl p-5 space-y-4 border border-purple-500/10">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  Conta
                </p>
                <p className="text-sm font-semibold text-gray-900">{currentName}</p>
                {userEmail && (
                  <p className="text-xs text-gray-500 break-all">{userEmail}</p>
                )}
                {accountCreatedAt && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    Conta criada em {accountCreatedAt}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-white shadow-md">
                  <Crown className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    Plano
                  </p>
                  {isPremium ? (
                    <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1 justify-end">
                      <CheckCircle2 className="w-3 h-3" />
                      Premium ativo
                    </p>
                  ) : (
                    <p className="text-xs font-semibold text-purple-600">
                      Plano gratuito em uso
                    </p>
                  )}
                </div>
              </div>

              <Link
                href="/premium"
                className="inline-flex items-center justify-center px-4 py-1.5 rounded-full text-[11px] font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md hover:opacity-90 transition"
              >
                {isPremium ? 'Gerenciar Premium' : 'Ver plano Premium'}
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-300 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 transition"
            >
              <LogOut className="w-4 h-4" />
              Sair da conta
            </button>
          </div>
        </section>

        {/* IDIOMA & REGIÃO */}
        <section className="bg-white/95 rounded-3xl shadow-2xl p-5 space-y-5 border border-purple-500/10">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-1">
            <div className="h-7 w-7 rounded-xl bg-purple-100 flex items-center justify-center">
              <Languages className="w-4 h-4 text-purple-700" />
            </div>
            <span>Idioma & região</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Idioma preferido */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-purple-600" />
                Idioma principal do app
              </label>
              <select
                value={preferredLanguage}
                onChange={(e) =>
                  setPreferredLanguage(e.target.value as 'pt' | 'en' | 'es')
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="pt">Português (Brasil)</option>
                <option value="en">Inglês</option>
                <option value="es">Espanhol</option>
              </select>
              <p className="text-[11px] text-gray-500">
                A tradução completa do app para inglês e espanhol será aplicada em uma{' '}
                <strong>versão futura</strong>. Por enquanto, salvamos aqui apenas a sua
                preferência.
              </p>
            </div>

            {/* Fuso horário */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
                Fuso horário
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="America/Sao_Paulo">América/São Paulo (Brasil)</option>
                <option value="America/Bogota">América/Bogotá</option>
                <option value="America/New_York">América/Nova York</option>
                <option value="Europe/Lisbon">Europa/Lisboa</option>
                <option value="Europe/London">Europa/Londres</option>
                <option value="UTC">UTC (Tempo Universal)</option>
              </select>
              <p className="text-[11px] text-gray-500">
                Usado para agendar corretamente notificações, metas diárias e cálculos de
                jornada.
              </p>
            </div>
          </div>
        </section>

        {/* EXPERIÊNCIA & VISUAL */}
        <section className="bg-white/95 rounded-3xl shadow-2xl p-5 space-y-5 border border-purple-500/10">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-1">
            <div className="h-7 w-7 rounded-xl bg-purple-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-700" />
            </div>
            <span>Experiência & visual</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Área de foco */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-600" />
                Área principal de foco
              </label>
              <select
                value={preferredFocusArea}
                onChange={(e) =>
                  setPreferredFocusArea(
                    e.target.value as 'detox' | 'mood' | 'money' | 'health'
                  )
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="detox">Detox & tempo limpo</option>
                <option value="mood">Humor & estabilidade emocional</option>
                <option value="money">Economia de dinheiro</option>
                <option value="health">Saúde física & mental</option>
              </select>
              <p className="text-[11px] text-gray-500">
                Ajuda o app a decidir quais métricas e mensagens priorizar para você em
                futuras telas.
              </p>
            </div>

            {/* Nível de motivação */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Nível de motivação atual
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={motivationalLevel}
                  onChange={(e) => setMotivationalLevel(Number(e.target.value) || 3)}
                  className="flex-1"
                />
                <span className="text-xs text-gray-700 font-semibold w-12 text-right">
                  {motivationalLevel}/5
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Usado para ajustar o tom de algumas notificações e mensagens motivacionais.
              </p>
            </div>
          </div>

          {/* Tema visual */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-purple-600" />
              Tema do app
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDarkMode(false)}
                className={`flex-1 px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1 ${
                  !darkMode
                    ? 'bg-purple-600 text-white border-purple-700'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                <SunMedium className="w-4 h-4" />
                Tema claro
              </button>
              <button
                type="button"
                onClick={() => setDarkMode(true)}
                className={`flex-1 px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1 ${
                  darkMode
                    ? 'bg-purple-600 text-white border-purple-700'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                <Moon className="w-4 h-4" />
                Tema escuro
              </button>
            </div>
            <p className="text-[11px] text-gray-500">
              O tema fica salvo na sua conta e pode ser aplicado automaticamente em versões
              futuras do app.
            </p>
          </div>
        </section>

        {/* NOTIFICAÇÕES */}
        <section className="bg-white/95 rounded-3xl shadow-2xl p-5 space-y-5 border border-purple-500/10">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-1">
            <div className="h-7 w-7 rounded-xl bg-purple-100 flex items-center justify-center">
              <Bell className="w-4 h-4 text-purple-700" />
            </div>
            <span>Notificações & lembretes</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                id="notifications-toggle"
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="notifications-toggle" className="text-sm text-gray-800">
                Quero receber lembretes suaves, motivação e avisos importantes do app.
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Horário preferido para notificações diárias
                </label>
                <input
                  type="time"
                  value={notificationsTime}
                  onChange={(e) => setNotificationsTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-[11px] text-gray-500">
                  Usado como referência para lembretes diários (resumo do dia, progresso da
                  jornada, etc).
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-600" />
                  Tipos de notificações
                </label>
                <p className="text-[11px] text-gray-500">
                  Nesta primeira versão, as notificações são gerais (motivação, metas e
                  jornada). Em versões futuras você poderá escolher em detalhes quais tipos
                  deseja receber.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* BOTÃO SALVAR */}
        <section className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold shadow-md hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </section>

        {/* SOBRE & PRIVACIDADE */}
        <section className="bg-white/10 rounded-3xl border border-white/10 p-4 space-y-2 text-[11px] text-purple-100/90 mb-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-50">
            <Info className="w-3 h-3" />
            <span>Sobre o WeedReset & privacidade</span>
          </div>
          <p>
            • Essas configurações ficam salvas na sua conta (<code>profiles</code> e{' '}
            <code>user_settings</code>) e podem ser usadas em outros dispositivos.
          </p>
          <p>
            • Idioma, fuso horário, foco, tema e notificações servem apenas para
            personalizar a sua experiência — não compartilhamos esses dados com terceiros.
          </p>
          <p>
            • Tradução completa para inglês e espanhol será ligada apenas quando o app
            estiver totalmente fechado em português.
          </p>
        </section>
      </main>
    </div>
  );
}
