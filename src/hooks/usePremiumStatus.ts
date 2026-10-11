'use client';
import React from 'react';

export default function RewardModal({ open, onClose, rewards }: { open: boolean; onClose: () => void; rewards: any[] }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-w-xl w-full bg-white rounded-2xl shadow-2xl p-6">
        <h3 className="text-lg font-semibold">Recompensas</h3>
        <p className="text-sm text-gray-600 mt-1">Parabéns — estas foram as ações registradas:</p>

        <div className="mt-4 space-y-3 max-h-64 overflow-auto">
          {(!rewards || rewards.length === 0) && <div className="text-sm text-gray-500">Nenhuma recompensa encontrada.</div>}
          {rewards.map((r, i) => (
            <div key={i} className="p-3 rounded-lg border bg-gray-50">
              <div className="flex items-start justify-between">
                <div>
                  {r.mission_title ? <div className="font-semibold">{r.mission_title}</div> : null}
                  <div className="text-sm text-gray-600">{r.message ?? r.description ?? JSON.stringify(r)}</div>
                </div>
                <div className="text-right">
                  {r.reward_xp ? <div className="text-sm text-purple-600">+{r.reward_xp} XP</div> : null}
                  {r.reward_coins ? <div className="text-sm text-yellow-700">+{r.reward_coins} coins</div> : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border">Fechar</button>
        </div>
      </div>
    </div>
  );
}
