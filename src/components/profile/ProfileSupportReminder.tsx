'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, HeartHandshake, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type SupportPlan = {
  triggers: string[];
  coping_actions: string[];
  support_label: string | null;
};

export default function ProfileSupportReminder({ userId }: { userId: string | null }) {
  const [plan, setPlan] = useState<SupportPlan | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    setPlan(null);
    setLoaded(false);
    if (!userId) { setLoaded(true); return; }
    (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || auth.user?.id !== userId) return;
        const { data, error } = await supabase.from('profile_growth_settings')
          .select('triggers,coping_actions,support_label').eq('user_id', userId).maybeSingle();
        if (active && !error && data) setPlan({
          triggers: Array.isArray(data.triggers) ? data.triggers : [],
          coping_actions: Array.isArray(data.coping_actions) ? data.coping_actions : [],
          support_label: typeof data.support_label === 'string' ? data.support_label : null,
        });
      } catch { /* SOS deve continuar funcionando mesmo quando a API estiver lenta. */ }
      finally { if (active) setLoaded(true); }
    })();
    return () => { active = false; };
  }, [userId]);

  if (!userId || !loaded) return null;
  const hasPlan = Boolean(plan?.triggers?.length || plan?.coping_actions?.length || plan?.support_label);
  return <section aria-label="Meu plano de apoio" className="rounded-3xl border border-emerald-400/25 bg-[#152c29] p-4 text-white shadow-lg sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <HeartHandshake className="h-5 w-5 text-emerald-300"/>
        <h2 className="text-lg font-bold text-white">Meu plano de apoio</h2>
      </div>
      <Link href="/profile" className="inline-flex items-center gap-1 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-white/10">
        {hasPlan ? 'Editar no Perfil' : 'Criar meu plano'} <ArrowRight className="h-4 w-4"/>
      </Link>
    </div>
    {!hasPlan ? <p className="mt-3 text-sm leading-relaxed text-emerald-100/90">
      Você pode salvar seus gatilhos, ações que ajudam e uma pessoa de confiança no Perfil. Seu plano fica disponível aqui sempre que precisar.
    </p> : <>
      <p className="mt-2 text-xs leading-relaxed text-emerald-100/80">Lembretes privados que você escolheu para momentos difíceis.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {!!plan?.triggers?.length && <div className="rounded-xl bg-black/20 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-200">O que costuma desencadear a vontade</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-white/90">{plan.triggers.slice(0,3).map((x,i)=><li key={i} className="break-words">{x}</li>)}</ul>
        </div>}
        {!!plan?.coping_actions?.length && <div className="rounded-xl bg-black/20 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-200">O que posso experimentar agora</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-white/90">{plan.coping_actions.slice(0,3).map((x,i)=><li key={i} className="break-words">{x}</li>)}</ul>
        </div>}
      </div>
      {!!plan?.support_label && <p className="mt-3 rounded-xl border border-emerald-200/15 bg-emerald-400/10 p-3 text-sm text-emerald-50">
        Se precisar conversar, posso procurar: <strong>{plan.support_label}</strong>
      </p>}
    </>}
    <p className="mt-3 flex items-start gap-2 text-xs text-emerald-100/75"><ShieldCheck className="h-4 w-4 shrink-0"/>
      Plano privado. Estas estratégias não substituem apoio profissional ou serviços de emergência.
    </p>
  </section>;
}
