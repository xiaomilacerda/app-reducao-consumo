'use client';

import { traduzirErro } from '@/lib/traduzir-erro';

import React, { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Check, Star, Coin } from 'lucide-react';

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function MissionsPanel({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<any[]>([]);
  const [completedTodayMap, setCompletedTodayMap] = useState<Record<number, boolean>>({});
  const [processing, setProcessing] = useState<Record<number, boolean>>({});
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    async function loadAll() {
      setLoading(true);
      try {
        // fetch missions
        const { data: ms } = await supabase.from('missions').select('*').order('id', { ascending: true });
        // fetch today's user_missions
        const { data: um } = await supabase
          .from('user_missions')
          .select('mission_id, completed_at')
          .eq('user_id', userId)
          .gte('completed_at', new Date().toISOString().slice(0,10)); // server-side filtering fallback

        // fetch profile
        const { data: p } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();

        if (!mounted) return;
        setMissions(ms ?? []);
        const todayMap: Record<number, boolean> = {};
        (um ?? []).forEach((r:any) => { todayMap[Number(r.mission_id)] = true; });
        setCompletedTodayMap(todayMap);
        setProfile(p ?? null);
      } catch (err) {
        console.error('Erro carregando missões', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAll();
    return () => { mounted = false; };
  }, [supabase, userId]);

  async function handleComplete(mission:any) {
    if (!userId) return alert('Usuário não autenticado');
    if (completedTodayMap[mission.id]) return; // safety
    setProcessing(prev => ({ ...prev, [mission.id]: true }));

    try {
      // call rpc
      const { data, error } = await supabase.rpc('complete_mission', { p_user_id: userId, p_mission_id: mission.id });
      if (error) throw error;
      if (data && data.success) {
        // optimistic update: mark completed
        setCompletedTodayMap(prev => ({ ...prev, [mission.id]: true }));
        // update profile xp/coins/level locally if provided
        setProfile((p:any) => ({ ...p, xp: data.xp, coins: data.coins, level: data.level }));
        // small animation trigger (CSS class)
        const el = document.getElementById(`reward-${mission.id}`);
        if (el) {
          el.classList.add('animate-reward');
          setTimeout(() => el.classList.remove('animate-reward'), 900);
        }
      } else {
        const msg = data?.error ?? 'Erro ao completar missão.';
        alert(msg);
      }
    } catch (err:any) {
      console.error('Erro complete mission', err);
      alert(traduzirErro(err));
    } finally {
      setProcessing(prev => ({ ...prev, [mission.id]: false }));
    }
  }

  if (loading) return (
    <div className="p-6 bg-white rounded-2xl shadow-md">
      <div className="animate-spin w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full mx-auto" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow">
        <div>
          <h2 className="text-lg font-semibold">Missões</h2>
          <p className="text-sm text-gray-500">Complete missões diárias para ganhar XP e coins.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">Lvl <strong>{profile?.level ?? 1}</strong></div>
          <div className="flex items-center gap-2">
            <span id="xp-badge" className="text-sm">XP <strong>{profile?.xp ?? 0}</strong></span>
            <span className="flex items-center gap-1 px-3 py-1 bg-yellow-50 rounded"> 
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <strong>{profile?.coins ?? 0}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {missions.map((m:any) => (
          <div key={m.id} className="bg-white rounded-2xl p-4 shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{m.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{m.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">{m.category}</div>
                  <div className="mt-2 text-sm">XP <strong>{m.reward_xp}</strong></div>
                  <div className="text-sm">Coins <strong>{m.reward_coins}</strong></div>
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-500">Dificuldade: <strong>{m.difficulty}</strong> {m.premium_only ? <span className="ml-2 text-purple-600">(Premium)</span> : null}</div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div id={`reward-${m.id}`} className="flex items-center gap-3 transition-transform">
                {completedTodayMap[m.id] ? (
                  <div className="px-3 py-1 rounded-full bg-green-50 text-green-700 inline-flex items-center gap-2">
                    <Check className="w-4 h-4" /> Concluído
                  </div>
                ) : (
                  <div className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 inline-flex items-center gap-2">Pendente</div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleComplete(m)}
                  disabled={completedTodayMap[m.id] || processing[m.id]}
                  className={`px-4 py-2 rounded-xl font-medium shadow ${completedTodayMap[m.id] ? 'bg-gray-200 text-gray-500' : 'bg-purple-600 text-white hover:brightness-105'}`}
                >
                  {processing[m.id] ? 'Salvando...' : completedTodayMap[m.id] ? 'Concluído' : 'Concluir'}
                </button>

                <div className="text-sm text-gray-500">{m.premium_only ? 'Premium' : 'Free'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .animate-reward { transform: translateY(-6px) scale(1.02); transition: transform 250ms ease; }
      `}</style>
    </div>
  );
}
