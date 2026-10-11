'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  SmilePlus,
  Bell,
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

/*
  Página Mood com correção DEFINITIVA de fuso horário:
  - Agora usa profiles.timezone
  - Se timezone não estiver salvo, usa o timezone do navegador
  - Também oferece opção de data manual ao salvar (retroativa)
  - Isso garante que nunca mais haverá data errada (ex: registrando dia 28 e salvando como 27)
*/

/* ---------- UTILITÁRIO CENTRAL ---------- */
function dateForTimezoneToday(timeZone: string) {
  try {
    const formatter = new Intl.DateTimeFormat('sv', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date()); // retorna YYYY-MM-DD
  } catch {
    // fallback muito improvável
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
      .toISOString()
      .slice(0, 10);
  }
}

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/* ---------- CONFIG ---------- */
const MOODS = [
  { key: 'excelente', emoji: '🤩', label: 'Excelente', value: 100 },
  { key: 'maravilhoso', emoji: '😍', label: 'Maravilhoso', value: 95 },
  { key: 'otimo', emoji: '😄', label: 'Ótimo', value: 90 },
  { key: 'feliz', emoji: '🙂', label: 'Feliz', value: 80 },
  { key: 'animado', emoji: '😃', label: 'Animado', value: 75 },
  { key: 'bem', emoji: '😊', label: 'Bem', value: 65 },
  { key: 'normal', emoji: '😐', label: 'Normal', value: 55 },
  { key: 'calmo', emoji: '😌', label: 'Calmo', value: 50 },
  { key: 'preocupado', emoji: '😕', label: 'Preocupado', value: 40 },
  { key: 'ansioso', emoji: '😥', label: 'Ansioso', value: 30 },
  { key: 'muito_ansioso', emoji: '😰', label: 'Muito Ansioso', value: 20 },
  { key: 'irritado', emoji: '😤', label: 'Irritado', value: 15 },
  { key: 'triste', emoji: '😢', label: 'Triste', value: 8 },
  { key: 'muito_mal', emoji: '😡', label: 'Muito Mal / Raiva', value: 3 },
];

/* ---------- HELPERS ---------- */

function moodValueToEmoji(value: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '😐';
  let closest = MOODS[0];
  let bestDiff = Math.abs(value - closest.value);
  for (let i = 1; i < MOODS.length; i++) {
    const diff = Math.abs(value - MOODS[i].value);
    if (diff < bestDiff) {
      bestDiff = diff;
      closest = MOODS[i];
    }
  }
  return closest.emoji;
}

function formatDateShort(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

/* ------------------------------------------- */
/* -------------- PÁGINA PRINCIPAL ------------ */
/* ------------------------------------------- */

export default function MoodTrackerPage() {
  const supabase = useMemo(() => createClient(), []);

  /* USER + PROFILE */
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);

  /* DATA MOOD */
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedMood, setSelectedMood] = useState<any | null>(null);
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);

  /* TIMEZONE + DATA MANUAL */
  const [manualDateEnabled, setManualDateEnabled] = useState(false);
  const [manualDate, setManualDate] = useState<string | null>(null);

  /* UI (gráfico etc.) */
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedRange, setSelectedRange] = useState<'week' | 'month' | 'year' | 'day'>('month');
  const [thermo, setThermo] = useState(0);
  const [insights, setInsights] = useState({
    message: 'Registre seu humor para gerar insights',
    risk: 0,
    trend: 0,
  });

  /* ------------------------------------------ */
  /* ----------- 1) CARREGAR USER/PROFILE ----- */
  /* ------------------------------------------ */

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      try {
        const { data: auth } = await supabase.auth.getUser();
        const currentUser = auth.user ?? null;
        if (!mounted) return;
        setUser(currentUser);

        if (!currentUser) {
          setLoading(false);
          return;
        }

        // load profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (!mounted) return;
        setProfile(profileData);

        // load mood entries
        const { data: moods } = await supabase
          .from('mood_entries')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: true });

        if (!mounted) return;
        setEntries(moods ?? []);
      } catch (err) {
        console.error('Erro ao carregar mood page:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [supabase]);

  /* ---------------------------------------- */
  /* ------------- 2) GRÁFICO ETC ------------ */
  /* ---------------------------------------- */

  useEffect(() => {
    if (!entries || entries.length === 0) {
      setChartData([]);
      setThermo(0);
      setInsights({
        message: 'Registre seu humor para gerar insights',
        risk: 0,
        trend: 0,
      });
      return;
    }

    const now = new Date();
    let startDate = new Date();
    if (selectedRange === 'week') startDate.setDate(now.getDate() - 7);
    else if (selectedRange === 'month') startDate.setMonth(now.getMonth() - 1);
    else if (selectedRange === 'year') startDate.setFullYear(now.getFullYear() - 1);
    else startDate = new Date('1970-01-01');

    const filtered = entries.filter(e => new Date(e.date) >= startDate);

    const days: Record<string, { total: number; count: number }> = {};

    filtered.forEach((e: any) => {
      const key = (new Date(e.date)).toISOString().slice(0, 10);
      if (!days[key]) days[key] = { total: 0, count: 0 };
      days[key].total += e.mood_value || 0;
      days[key].count += 1;
    });

    const data = Object.keys(days).sort().map(day => ({
      label: `${day.slice(8, 10)}/${day.slice(5, 7)}`,
      value: Math.round(days[day].total / days[day].count),
    }));

    setChartData(data);

    const avg =
      filtered.reduce((sum, it) => sum + (it.mood_value || 0), 0) /
      filtered.length;

    const avgRounded = Math.round(avg);

    setThermo(avgRounded);

    const risk = avgRounded < 30 ? 80 : avgRounded < 50 ? 40 : 10;
    const trendMsg =
      avgRounded > 70
        ? 'Você está indo muito bem! Continue assim!'
        : avgRounded > 40
        ? 'Oscilações são normais. Continue registrando!'
        : 'Precisa se cuidar — procure apoio se necessário.';

    setInsights({ message: trendMsg, risk, trend: avgRounded });

  }, [entries, selectedRange]);

  /* ---------------------------------------- */
  /* ------------- 3) HANDLE SAVE ------------ */
  /* ---------------------------------------- */

  async function handleSave() {
    if (!user || !selectedMood) return;

    setSaving(true);

    try {
      // 1) timezone do usuário → prioridade
      const userTimezone =
        profile?.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        'UTC';

      // 2) data correta usando timezone
      const dateToSave =
        manualDateEnabled && manualDate
          ? manualDate
          : dateForTimezoneToday(userTimezone);

      // 3) verificar se já existe registro do dia
      const { data: existing } = await supabase
        .from('mood_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateToSave)
        .maybeSingle();

      const now = new Date();
      const timeStr = now.toTimeString().slice(0, 5);

      // 4) daily message
      let dailyMessage = null;
      try {
        const { data: msgData } = await supabase.rpc(
          'get_random_mood_message',
          { category_input: selectedMood.key }
        );
        if (msgData?.length) dailyMessage = msgData[0].message;
      } catch {}

      // 5) se já tem registro → atualizar
      if (existing) {
        const mergedNotes = [existing.notes || '', notes || '']
          .filter(Boolean)
          .join('\n\n');

        const updatePayload: any = {
          mood: selectedMood.label,
          mood_value: selectedMood.value,
          notes: mergedNotes,
          time: timeStr,
          updated_at: new Date().toISOString(),
        };

        if (!existing.daily_message && dailyMessage)
          updatePayload.daily_message = dailyMessage;

        const { data: updated } = await supabase
          .from('mood_entries')
          .update(updatePayload)
          .eq('id', existing.id)
          .select('*');

        if (updated?.[0]) {
          setEntries(prev =>
            prev.map(e => (e.id === existing.id ? updated[0] : e))
          );
        }

      } else {
        // 6) criar novo registro
        const insertPayload = {
          user_id: user.id,
          mood: selectedMood.label,
          mood_value: selectedMood.value,
          notes,
          date: dateToSave,
          time: timeStr,
          daily_message: dailyMessage,
        };

        const { data: created } = await supabase
          .from('mood_entries')
          .insert(insertPayload)
          .select('*')
          .maybeSingle();

        if (created) setEntries(prev => [...prev, created]);
      }

      setSelectedMood(null);
      setNotes('');
      setManualDate(null);
      setManualDateEnabled(false);

    } catch (err) {
      console.error('Erro ao salvar mood:', err);
    } finally {
      setSaving(false);
    }
  }

  /* ---------------------------------------- */
  /* ------------- LOADING SCREEN ------------ */
  /* ---------------------------------------- */

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  /* ---------------------------------------- */
  /* ------------ FILTRAR 7 DIAS ------------ */
  /* ---------------------------------------- */

  const groupedLatestPerDay: any[] = [];
  const seen: Record<string, boolean> = {};

  [...entries]
    .sort(
      (a, b) =>
        new Date(b.date + 'T' + (b.time || '00:00')).getTime() -
        new Date(a.date + 'T' + (a.time || '00:00')).getTime()
    )
    .forEach(e => {
      if (!seen[e.date]) {
        groupedLatestPerDay.push(e);
        seen[e.date] = true;
      }
    });

  const recentEntries = groupedLatestPerDay.slice(0, 7);

  /* ---------------------------------------- */
  /* --------------- RENDER UI -------------- */
  /* ---------------------------------------- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">

      {/* INTRO IGUAL AO COMMUNITY */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-sm shadow-lg z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </Link>

          <SmilePlus className="w-8 h-8 text-purple-500" />

          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Diário Emoções
          </h1>

          <Link
            href="/mood/history"
            className="ml-auto text-sm text-gray-600 hover:underline"
          >
            Abrir meu diário completo
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-7 space-y-10">

        {/* INTRO / CARD INICIAL */}
        <section className="p-5 rounded-2xl shadow-xl bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 text-white">
          <h2 className="text-xl font-bold mb-2">Acompanhe seu Humor. Entenda Seu Dia.</h2>
          <p className="text-sm mb-3">
            Este é seu espaço pessoal para registrar emoções, observar padrões e entender melhor sua jornada.
          </p>
          <ul className="text-[13px] space-y-1 opacity-95">
            <li>• Registre seu humor diariamente.</li>
            <li>• Anexe notas e observações importantes.</li>
            <li>• Acompanhe sua evolução semanal e mensal.</li>
            <li>• Área totalmente privada — só você vê.</li>
          </ul>
        </section>

        {/* THERMOMETER + EMOJIS */}
        <section className="bg-white p-6 rounded-2xl shadow-xl space-y-4">
          <h2 className="text-lg font-bold text-gray-800">Como você está se sentindo hoje?</h2>

          <div className="w-full h-10 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 transition-all duration-700"
              style={{ width: `${thermo}%` }}
            />
          </div>

          <p className="text-center text-sm mt-2 text-gray-700">
            Seu humor médio: <strong>{thermo}%</strong>
          </p>

          {/* Emojis linha única */}
          <div className="mt-3">
            <div className="flex gap-3 overflow-x-auto py-2 no-scrollbar items-center">
              {MOODS.map(m => (
                <button
                  key={m.key}
                  onClick={() => setSelectedMood(m)}
                  className={`flex flex-col items-center justify-center rounded-2xl p-2 min-w-[64px] text-2xl text-center shadow transition ${
                    selectedMood?.key === m.key
                      ? 'bg-purple-600 text-white scale-105'
                      : 'bg-gray-100'
                  }`}
                >
                  <div className="text-2xl leading-none">{m.emoji}</div>
                  <div className="text-[11px] mt-1 text-gray-700">{m.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Escreva um resumo do seu dia..."
            className="w-full p-3 rounded-xl text-sm bg-gray-100"
            rows={3}
          />

          {/* DATA MANUAL OPCIONAL */}
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={manualDateEnabled}
              onChange={e => setManualDateEnabled(e.target.checked)}
            />
            <label className="text-sm">Definir data manualmente</label>

            {manualDateEnabled && (
              <input
                type="date"
                value={manualDate ?? ''}
                onChange={e => setManualDate(e.target.value || null)}
                className="ml-3 px-3 py-2 rounded-lg border"
              />
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={!selectedMood || saving}
              className="flex-1 py-3 rounded-xl text-white bg-gradient-to-r from-purple-600 to-pink-600 font-semibold shadow-lg disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar meu humor'}
            </button>

            <button
              onClick={() => {
                setSelectedMood(null);
                setNotes('');
                setManualDateEnabled(false);
                setManualDate(null);
              }}
              className="px-4 py-3 rounded-xl bg-white border"
            >
              Limpar
            </button>
          </div>
        </section>

        {/* DIÁRIO DA SEMANA */}
        <section className="bg-white p-6 rounded-2xl shadow-xl">
          <h3 className="text-lg font-bold">Diário da Semana</h3>

          {recentEntries.length === 0 && (
            <p className="text-sm text-gray-600">Nenhum registro ainda.</p>
          )}

          <div className="space-y-4 mt-4">
            {recentEntries.map(entry => {
              const fullNotes = entry.notes || '';
              const parts = fullNotes
                .split(/\n{2,}/)
                .map(s => s.trim())
                .filter(Boolean);
              const lastNote = parts.length ? parts[parts.length - 1] : null;

              return (
                <div
                  key={entry.id}
                  className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {moodValueToEmoji(entry.mood_value)}
                      </div>
                      <span className="text-sm font-semibold">
                        {formatDateShort(entry.date)} — {entry.mood}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {entry.time ?? ''}
                    </span>
                  </div>

                  {lastNote && (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {lastNote}
                    </p>
                  )}

                  {entry.daily_message && (
                    <div className="mt-2 p-2 bg-purple-50 rounded text-sm text-purple-700">
                      {entry.daily_message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Link
            href="/mood/history"
            className="block text-center mt-4 text-purple-600 font-medium hover:underline text-sm"
          >
            Abrir meu diário completo →
          </Link>
        </section>

        {/* GRÁFICO */}
        <section className="bg-white p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Evolução do Humor</h3>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedRange('day')}
                className={`px-3 py-1 rounded-full ${
                  selectedRange === 'day'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100'
                }`}
              >
                Diário
              </button>
              <button
                onClick={() => setSelectedRange('week')}
                className={`px-3 py-1 rounded-full ${
                  selectedRange === 'week'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100'
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => setSelectedRange('month')}
                className={`px-3 py-1 rounded-full ${
                  selectedRange === 'month'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100'
                }`}
              >
                Mês
              </button>
              <button
                onClick={() => setSelectedRange('year')}
                className={`px-3 py-1 rounded-full ${
                  selectedRange === 'year'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100'
                }`}
              >
                Ano
              </button>
            </div>
          </div>

          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="label" stroke="#aaa" />
                <YAxis domain={[0, 100]} stroke="#aaa" />
                <Tooltip />
                <Line
                  dataKey="value"
                  type="monotone"
                  stroke="#d946ef"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#9333ea' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold">Insights</h4>
              <p className="text-sm text-gray-700">{insights.message}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Risco & Tendência</h4>
              <div className="flex items-center gap-4 mt-2">
                <div className="text-sm">
                  Tendência: <strong>{insights.trend}%</strong>
                </div>
                <div className="text-sm">
                  Risco emocional: <strong>{insights.risk}%</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* NOTA FINAL */}
        <section className="bg-white/60 p-4 rounded-xl text-sm text-gray-700">
          <strong>Nota:</strong> Ao salvar novamente no mesmo dia você anexará notas ao registro do dia
          (o humor do dia será atualizado com sua seleção mais recente). A visualização "Diário da Semana"
          mostra apenas o registro principal por dia para manter a página limpa.
        </section>
      </main>
    </div>
  );
}
