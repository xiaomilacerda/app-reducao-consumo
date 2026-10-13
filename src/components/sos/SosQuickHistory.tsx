'use client';

import { useEffect, useState } from 'react';
import { Clock3, HeartHandshake, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type QuickSession = {
  id: number;
  feeling: 'urge' | 'anxiety' | 'irritation' | 'sleep';
  intensity_before: number | null;
  intensity_after: number | null;
  duration_seconds: number;
  created_at: string;
};
const names: Record<string,string> = {
  urge:'Vontade intensa',anxiety:'Ansiedade',irritation:'Irritação',sleep:'Descanso',
};

export default function SosQuickHistory({userId}:{userId:string|null}) {
  const [rows,setRows] = useState<QuickSession[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [confirmDelete,setConfirmDelete] = useState<number|null>(null);
  const [deleting,setDeleting] = useState<number|null>(null);

  useEffect(()=>{
    if(!userId){setRows([]);setLoading(false);return;}
    let live=true;
    setRows([]);
    setLoading(true);setError('');
    (async()=>{
      try {
        const auth=await supabase.auth.getUser();
        if(auth.error||auth.data.user?.id!==userId) throw new Error('Sessão inválida');
        const {data,error:e}=await supabase.from('sos_quick_sessions')
          .select('id,feeling,intensity_before,intensity_after,duration_seconds,created_at')
          .eq('user_id',userId).order('created_at',{ascending:false}).limit(10);
        if(e)throw e;
        if(live)setRows((data??[]) as QuickSession[]);
      } catch {
        if(live)setError('Não foi possível sincronizar suas pausas guiadas agora.');
      } finally { if(live)setLoading(false); }
    })();
    return ()=>{live=false};
  },[userId]);

  async function remove(id:number){
    if(!userId || deleting!==null) return;
    setDeleting(id);setError('');
    try {
      const auth=await supabase.auth.getUser();
      if(auth.error||auth.data.user?.id!==userId) throw new Error('Sessão inválida');
      const {data,error:e}=await supabase.from('sos_quick_sessions')
        .delete().eq('user_id',userId).eq('id',id).select('id').single();
      if(e||!data)throw e||new Error('Não confirmado');
      setRows(prev=>prev.filter(x=>x.id!==id));
      setConfirmDelete(null);
    }catch{setError('Não foi possível excluir este registro. Tente novamente.')}
    finally{setDeleting(null)}
  }

  if(!userId)return null;
  return <section aria-label="Minhas pausas guiadas" className="rounded-2xl border border-emerald-400/15 bg-[#162a2e] p-4 sm:p-5">
    <div className="flex items-center gap-2"><HeartHandshake className="h-5 w-5 text-emerald-300"/>
      <h2 className="text-base font-bold text-white">Minhas pausas guiadas</h2></div>
    <p className="mt-1 text-xs text-slate-300">Somente pausas que você escolheu guardar. Esses registros são privados e podem ser excluídos.</p>
    {error && <p role="alert" className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
    {loading ? <p role="status" className="mt-3 text-xs text-slate-400">Carregando registros privados...</p> :
    rows.length===0 ? <p className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">Você ainda não guardou pausas guiadas. Tudo bem: praticar sem salvar também é válido.</p> :
    <div className="mt-4 grid gap-2">
      {rows.map(r=><article key={r.id} className="min-w-0 rounded-xl border border-white/10 bg-white/[.045] p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{names[r.feeling]||'Pausa guiada'}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Clock3 className="h-3.5 w-3.5"/>
              {new Date(r.created_at).toLocaleString('pt-BR', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
              {' · '}{r.duration_seconds}s de pausa
            </p>
          </div>
          {confirmDelete===r.id ? <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={()=>void remove(r.id)} disabled={deleting!==null}
              className="min-h-9 rounded-lg bg-rose-500/20 px-3 text-xs font-semibold text-rose-100 disabled:opacity-50">
              {deleting===r.id?'Excluindo...':'Confirmar exclusão'}
            </button>
            <button type="button" aria-label="Cancelar exclusão" onClick={()=>setConfirmDelete(null)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 text-slate-300">
              <X className="h-4 w-4"/></button>
          </div> : <button type="button" aria-label="Excluir pausa guiada" onClick={()=>setConfirmDelete(r.id)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 text-slate-400 hover:text-rose-200">
              <Trash2 className="h-4 w-4"/></button>}
        </div>
        {(r.intensity_before!==null || r.intensity_after!==null) && <p className="mt-2 text-xs text-slate-300">
          Intensidade informada: {r.intensity_before===null?'não registrada':r.intensity_before+'/10'} → {r.intensity_after===null?'não registrada':r.intensity_after+'/10'}
        </p>}
      </article>)}
    </div>}
  </section>;
}
