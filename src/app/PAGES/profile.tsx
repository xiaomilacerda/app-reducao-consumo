'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Loader2, Check, X } from 'lucide-react';

/**
 * Profile Page
 * - Detecta timezone do navegador por padrão
 * - Permite ao usuário escolher outro timezone
 * - Salva (upsert) em profiles incluindo timezone
 *
 * Cole em: src/app/profile/page.tsx
 */

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Lista enxuta de timezones (pode expandir conforme necessário)
 * Para um app global, recomendo substituir por uma lista completa IANA.
 */
const TIMEZONES = [
  'America/Sao_Paulo',
  'America/Cuiaba',
  'America/Bahia',
  'America/Fortaleza',
  'America/Recife',
  'America/Manaus',
  'America/Boa_Vista',
  'America/Rio_Branco',
  'America/Argentina/Buenos_Aires',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'UTC',
];

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<any | null>(null);

  // profile fields
  const [displayName, setDisplayName] = useState<string>('');
  const [timezone, setTimezone] = useState<string>(() => {
    try {
      // detect default timezone (browser)
      if (typeof Intl !== 'undefined') {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      }
      return 'UTC';
    } catch {
      return 'UTC';
    }
  });

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getUser();
        const currentUser = data?.user ?? null;
        if (!mounted) return;
        setUser(currentUser);
        if (!currentUser) {
          setLoading(false);
          return;
        }

        // load profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('display_name, timezone')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          console.error('Erro carregando profile', error);
        } else if (profile) {
          setDisplayName(profile.display_name ?? '');
          setTimezone(profile.timezone ?? timezone);
        }
      } catch (err) {
        console.error('Erro ao carregar perfil', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [supabase]);

  async function handleSaveProfile(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!user) return setErrorMsg('Usuário não autenticado.');

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        id: user.id,
        display_name: displayName.trim() || null,
        timezone: timezone || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(payload, { returning: 'representation' });

      if (error) {
        console.error('Erro salvando profile', error);
        setErrorMsg('Falha ao salvar. Tente novamente.');
      } else {
        setSuccessMsg('Perfil salvo com sucesso!');
        // limpa msg depois de 2.5s
        setTimeout(() => setSuccessMsg(null), 2500);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro inesperado ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="animate-spin w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full" />
          <div className="text-sm text-gray-600">Carregando perfil...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-lg rounded-2xl p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Seu Perfil</h1>
          <p className="text-sm text-gray-500 mb-6">Atualize as preferências do seu perfil. O fuso horário será usado para definir as datas locais ao publicar entradas.</p>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome de exibição</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Como as pessoas te verão (opcional)"
                className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Fuso horário</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-purple-300"
              >
                {/* opção detector */}
                <option value={Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}>
                  Detectado: {Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}
                </option>
                <option disabled>──────────</option>

                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}

                <option value="UTC">UTC</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">Escolha seu fuso horário. Isso garante que seus registros apareçam no dia correto.</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold shadow hover:opacity-95 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>

              <button
                type="button"
                onClick={() => {
                  // restaura valores do profile (recarrega)
                  setLoading(true);
                  supabase.auth.getUser().then(({ data }) => {
                    const u = data?.user ?? null;
                    setUser(u);
                    supabase.from('profiles').select('display_name, timezone').eq('id', u?.id).maybeSingle()
                      .then(({ data: p }) => {
                        setDisplayName(p?.display_name ?? '');
                        setTimezone(p?.timezone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'));
                      })
                      .finally(() => setLoading(false));
                  });
                }}
                className="px-4 py-2 rounded-xl border text-sm"
              >
                Restaurar
              </button>

              {successMsg && (
                <div className="ml-auto flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" /> {successMsg}
                </div>
              )}

              {errorMsg && (
                <div className="ml-auto flex items-center gap-2 text-sm text-red-600">
                  <X className="w-4 h-4" /> {errorMsg}
                </div>
              )}
            </div>

            <div className="pt-4 text-xs text-gray-500">
              <strong>Nota:</strong> recomendamos definir seu timezone no perfil. Ainda assim, nas páginas de publicação/edição você poderá optar por definir uma data manualmente caso precise (registro retroativo ou ajuste).
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
