'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

/**
 * Onboarding page (nova) — pergunta timezone logo no começo
 * Cole em: src/app/onboarding/page.tsx
 *
 * Ao finalizar o onboarding, salva tudo em profiles (upsert).
 */

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const DEFAULTS = {
  grams_per_joint: 0.5,
  thc_potency: 15,
  currency: 'BRL',
};

export default function OnboardingPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Step UI
  const [step, setStep] = useState<number>(1);

  // basic user info / profile defaults
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  });

  // onboarding fields
  const [goal, setGoal] = useState<'stop' | 'reduce' | 'control'>('reduce');
  const [frequencyTag, setFrequencyTag] = useState<string>('diario');
  const [dailyCost, setDailyCost] = useState<number | null>(null);
  const [lastUseDate, setLastUseDate] = useState<string | null>(null); // YYYY-MM-DD
  const [lastUseTime, setLastUseTime] = useState<string | null>(null); // HH:MM
  const [wantsReminders, setWantsReminders] = useState(true);

  const [thcPotency, setThcPotency] = useState<number | null>(DEFAULTS.thc_potency);
  const [gramsPerJoint, setGramsPerJoint] = useState<number | null>(DEFAULTS.grams_per_joint);
  const [currency, setCurrency] = useState<string>(DEFAULTS.currency);

  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getUser();
        const u = data.user ?? null;
        if (!mounted) return;
        setUser(u);
        if (!u) {
          setLoading(false);
          return;
        }

        // load profile if exists (pre-fill)
        const { data: p } = await supabase.from('profiles').select('*').eq('id', u.id).maybeSingle();
        if (!mounted) return;
        if (p) {
          setDisplayName(p.display_name ?? '');
          setTimezone(p.timezone ?? timezone);
          setThcPotency(p.thc_potency ?? DEFAULTS.thc_potency);
          setGramsPerJoint(p.grams_per_joint ?? DEFAULTS.grams_per_joint);
          setCurrency(p.currency ?? DEFAULTS.currency);
        }
      } catch (err) {
        console.error('Erro carregando onboarding:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [supabase]);

  async function handleFinish() {
    if (!user) return alert('Usuário não autenticado.');
    setSaving(true);
    try {
      // compose lastUse as timestamptz if provided
      let lastUse: string | null = null;
      if (lastUseDate) {
        const t = lastUseTime ?? '00:00';
        // create ISO-like string (no timezone conversion here; server will interpret)
        lastUse = `${lastUseDate}T${t}:00`;
      }

      const payload: any = {
        id: user.id,
        display_name: displayName || null,
        timezone: timezone || null,
        main_goal: goal,
        frequency_tag: frequencyTag,
        daily_cost: dailyCost ?? null,
        last_use: lastUse,
        wants_reminders: wantsReminders,
        thc_potency: thcPotency ?? null,
        grams_per_joint: gramsPerJoint ?? null,
        currency: currency || 'BRL',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').upsert(payload, { returning: 'representation' });
      if (error) throw error;

      // after onboarding: redirect to home or mood
      router.push('/');
    } catch (err) {
      console.error('Erro salvando onboarding:', err);
      alert('Falha ao salvar dados. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-start py-12">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl p-6 shadow-xl w-full">
        <h1 className="text-2xl font-bold mb-3">Bem-vindo — algumas perguntas rápidas</h1>

        {/* Step 1: timezone + name */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Primeiro, confirme seu fuso horário — isso garante que suas datas apareçam corretamente.</p>

            <div>
              <label className="block text-sm font-medium text-gray-700">Fuso horário</label>
              <input value={timezone} onChange={(e)=>setTimezone(e.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl border" />
              <p className="text-xs text-gray-500 mt-1">Detectado: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Nome de exibição</label>
              <input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} placeholder="Como quer ser chamado" className="mt-2 w-full px-4 py-3 rounded-xl border" />
            </div>

            <div className="flex justify-between">
              <button onClick={()=>setStep(2)} className="px-4 py-2 bg-purple-600 text-white rounded-xl">Próximo</button>
            </div>
          </div>
        )}

        {/* Step 2: goal & usage */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Qual seu objetivo com o app?</p>
            <div className="flex gap-2">
              <button className={`px-3 py-2 rounded-xl ${goal==='stop'?'bg-purple-600 text-white':'bg-gray-100'}`} onClick={()=>setGoal('stop')}>Parar</button>
              <button className={`px-3 py-2 rounded-xl ${goal==='reduce'?'bg-purple-600 text-white':'bg-gray-100'}`} onClick={()=>setGoal('reduce')}>Reduzir</button>
              <button className={`px-3 py-2 rounded-xl ${goal==='control'?'bg-purple-600 text-white':'bg-gray-100'}`} onClick={()=>setGoal('control')}>Controlar</button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Com que frequência?</label>
              <select value={frequencyTag} onChange={(e)=>setFrequencyTag(e.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl border">
                <option value="diario">Diário</option>
                <option value="ocasional">Ocasional</option>
                <option value="semanal">Semanal</option>
              </select>
            </div>

            <div className="flex justify-between">
              <button onClick={()=>setStep(1)} className="px-4 py-2 rounded-xl border">Voltar</button>
              <button onClick={()=>setStep(3)} className="px-4 py-2 bg-purple-600 text-white rounded-xl">Próximo</button>
            </div>
          </div>
        )}

        {/* Step 3: costs and last use */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Quanto costuma gastar por dia (aprox.)?</label>
              <input type="number" value={dailyCost ?? ''} onChange={e=>setDailyCost(e.target.value ? Number(e.target.value) : null)} className="mt-2 w-full px-4 py-3 rounded-xl border" placeholder="Ex.: 20" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Última vez que usou</label>
              <div className="flex gap-2 mt-2">
                <input type="date" value={lastUseDate ?? ''} onChange={e=>setLastUseDate(e.target.value || null)} className="px-3 py-2 rounded-xl border" />
                <input type="time" value={lastUseTime ?? ''} onChange={e=>setLastUseTime(e.target.value || null)} className="px-3 py-2 rounded-xl border" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" checked={wantsReminders} onChange={e=>setWantsReminders(e.target.checked)} />
              <div className="text-sm text-gray-600">Quero receber lembretes e dicas</div>
            </div>

            <div className="flex justify-between">
              <button onClick={()=>setStep(2)} className="px-4 py-2 rounded-xl border">Voltar</button>
              <button onClick={()=>setStep(4)} className="px-4 py-2 bg-purple-600 text-white rounded-xl">Próximo</button>
            </div>
          </div>
        )}

        {/* Step 4: technical (thc / grams) */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Potência média de THC (%)</label>
              <input type="number" value={thcPotency ?? ''} onChange={e=>setThcPotency(e.target.value ? Number(e.target.value) : null)} className="mt-2 w-full px-4 py-3 rounded-xl border" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Gramas por baseado (ex.: 0.5)</label>
              <input type="number" step="0.1" value={gramsPerJoint ?? ''} onChange={e=>setGramsPerJoint(e.target.value ? Number(e.target.value) : null)} className="mt-2 w-full px-4 py-3 rounded-xl border" />
            </div>

            <div className="flex justify-between">
              <button onClick={()=>setStep(3)} className="px-4 py-2 rounded-xl border">Voltar</button>
              <button onClick={()=>setStep(5)} className="px-4 py-2 bg-purple-600 text-white rounded-xl">Próximo</button>
            </div>
          </div>
        )}

        {/* Step 5: review + save */}
        {step === 5 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Revise suas respostas</h3>

            <div className="text-sm text-gray-700 space-y-1">
              <div><strong>Fuso:</strong> {timezone}</div>
              <div><strong>Nome:</strong> {displayName || '(não definido)'}</div>
              <div><strong>Objetivo:</strong> {goal}</div>
              <div><strong>Frequência:</strong> {frequencyTag}</div>
              <div><strong>Gasto diário:</strong> {dailyCost ?? '—'}</div>
              <div><strong>Último uso:</strong> {lastUseDate ? `${lastUseDate} ${lastUseTime ?? ''}` : '—'}</div>
              <div><strong>THC:</strong> {thcPotency ?? '—'}</div>
              <div><strong>Gramas por baseado:</strong> {gramsPerJoint ?? '—'}</div>
            </div>

            <div className="flex justify-between">
              <button onClick={()=>setStep(4)} className="px-4 py-2 rounded-xl border">Voltar</button>
              <button onClick={handleFinish} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-xl">{saving ? 'Salvando...' : 'Concluir e salvar'}</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
