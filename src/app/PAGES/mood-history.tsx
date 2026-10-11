'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

/**
 * History page (timezone-aware)
 * Cole em: src/app/mood/history/page.tsx
 */

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/* util: format date using user's timezone */
function displayDateInTZ(dateStr: string, tz: string) {
  // dateStr stored as YYYY-MM-DD (date-only) or ISO
  try {
    // If it's date-only, append time to ensure valid Date
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? `${dateStr}T00:00:00` : dateStr;
    const d = new Date(iso);
    return new Intl.DateTimeFormat('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  } catch {
    return dateStr;
  }
}

export default function MoodHistoryPage() {
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);

  const [entries, setEntries] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const u = auth.user ?? null;
        if (!mounted) return;
        setUser(u);
        if (!u) {
          setLoading(false);
          return;
        }

        const { data: p } = await supabase.from('profiles').select('*').eq('id', u.id).maybeSingle();
        if (!mounted) return;
        setProfile(p);

        const { data: moods } = await supabase
          .from('mood_entries')
          .select('*')
          .eq('user_id', u.id)
          .order('date', { ascending: false })
          .order('time', { ascending: false });

        if (!mounted) return;
        setEntries(moods ?? []);
        setFiltered(moods ?? []);
      } catch (err) {
        console.error(err);
        setEntries([]);
        setFiltered([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [supabase]);

  useEffect(() => {
    let results = [...entries];
    const s = search.trim().toLowerCase();
    if (s) {
      results = results.filter(e =>
        String(e.mood ?? '').toLowerCase().includes(s) ||
        String(e.notes ?? '').toLowerCase().includes(s)
      );
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      results = results.filter(e => new Date(e.date) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23,59,59,999);
      results = results.filter(e => new Date(e.date) <= to);
    }
    setFiltered(results);
    setPage(1);
  }, [search, entries, dateFrom, dateTo]);

  const groupedByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const e of filtered) {
      const day = new Date(e.date).toISOString().slice(0,10);
      map[day] = map[day] ?? [];
      map[day].push(e);
    }
    const days = Object.keys(map).sort((a,b) => b.localeCompare(a));
    return days.map(d => ({ date: d, items: map[d] }));
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(groupedByDay.length / PAGE_SIZE));
  const pagedDays = useMemo(() => {
    const start = (page-1)*PAGE_SIZE;
    return groupedByDay.slice(start, start+PAGE_SIZE);
  }, [groupedByDay, page]);

  function moodValueToEmoji(value: number | null | undefined) {
    const v = Number(value ?? 0);
    if (isNaN(v)) return '😶';
    if (v >= 85) return '🤩';
    if (v >= 70) return '😊';
    if (v >= 50) return '🙂';
    if (v >= 30) return '😕';
    if (v > 0) return '😔';
    return '😶';
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando histórico...</div>;

  const tz = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <header className="sticky top-0 bg-white/80 backdrop-blur-sm shadow z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/mood" className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="w-6 h-6 text-gray-600" /></Link>
          <h1 className="text-lg font-semibold">Diário Completo</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white p-4 rounded-2xl shadow-md mb-6">
          <div className="flex items-center gap-3">
            <Search className="w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar por humor ou texto..." className="w-full px-3 py-2 rounded-md border" />
            <input type="date" value={dateFrom ?? ''} onChange={(e)=>setDateFrom(e.target.value || null)} className="px-3 py-2 rounded-md border" />
            <input type="date" value={dateTo ?? ''} onChange={(e)=>setDateTo(e.target.value || null)} className="px-3 py-2 rounded-md border" />
            <button onClick={()=>{ setDateFrom(null); setDateTo(null); setSearch(''); }} className="px-3 py-2 rounded-md border">Limpar</button>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            Timezone: <strong>{tz}</strong>
          </div>
        </div>

        {pagedDays.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl shadow">Nenhum registro encontrado.</div>
        ) : (
          <div className="space-y-4">
            {pagedDays.map(day => (
              <div key={day.date} className="bg-white p-4 rounded-2xl shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500">{displayDateInTZ(day.date, tz)}</div>
                    <div className="text-base font-medium">Diária</div>
                  </div>
                  <div className="text-sm text-gray-500">{day.items.length} registros</div>
                </div>

                <div className="mt-4 space-y-3">
                  {day.items.map(it => (
                    <div key={it.id} className="p-3 rounded-lg border bg-white flex items-start gap-3">
                      <div className="text-2xl select-none">{moodValueToEmoji(it.mood_value)}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-gray-500">{it.time ?? ''}</div>
                            <div className="font-medium">{it.mood ?? '—'}</div>
                          </div>

                          <div className="text-xs text-gray-400">{it.created_at ? new Date(it.created_at).toLocaleString('pt-BR', { timeZone: tz }) : ''}</div>
                        </div>

                        {it.notes && <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{it.notes}</p>}

                        {it.daily_message && <div className="mt-2 p-2 bg-purple-50 rounded text-sm text-purple-700">{it.daily_message}</div>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3">
                  <button onClick={() => setExpandedDays(s => ({ ...s, [day.date]: !s[day.date] }))} className="text-sm text-purple-600 underline">
                    {expandedDays[day.date] ? 'Ocultar' : 'Expandir'}
                  </button>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between text-xs text-gray-500">
              <div>
                <button onClick={() => setPage(p => Math.max(1, p-1))} className="px-2 py-1 rounded-lg border mr-2">Anterior</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} className="px-2 py-1 rounded-lg border">Próxima</button>
              </div>
              <div> Página {page} • {totalPages} • Total: {entries.length}</div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
