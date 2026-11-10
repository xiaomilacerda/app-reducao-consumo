"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Crown, HeartPulse, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function PremiumPage() {
  const [state, setState] = useState<"loading" | "guest" | "free" | "premium" | "error">("loading");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!active) return;
        if (authError || !user) { setState("guest"); return; }
        const { data: profile, error: profileError } = await supabase.from("profiles")
          .select("is_premium").eq("id", user.id).maybeSingle();
        if (!active) return;
        if (profileError) setState("error");
        else setState(profile?.is_premium === true ? "premium" : "free");
      } catch {
        if (active) setState("error");
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  return (
    <div className="wr-screen min-h-screen w-full bg-[#0d0c1d] text-white">
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        <Link href="/explorar" className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-violet-200 hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Explorar
        </Link>

        <section className="rounded-2xl border border-amber-300/25 bg-gradient-to-br from-[#302840] via-[#191626] to-[#171421] p-5 sm:p-7">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/10">
            <Crown className="h-5 w-5 text-amber-200" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">WeedReset Premium</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Recursos extras para aprofundar sua jornada, com acesso vinculado à sua conta.
          </p>

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
            {state === "premium" ? (
              <>
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
                <div><p className="font-bold text-emerald-200">Premium ativo</p><p className="mt-1 text-xs text-slate-300">Sua conta já possui permissão para os recursos Premium disponíveis.</p></div>
              </>
            ) : state === "loading" ? (
              <p className="text-slate-300">Verificando seu plano...</p>
            ) : state === "error" ? (
              <p className="text-amber-100">Não foi possível verificar seu plano. Entre novamente ou tente mais tarde.</p>
            ) : (
              <>
                <LockKeyhole className="h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
                <div>
                  <p className="font-bold text-amber-100">Novas assinaturas ainda não disponíveis</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    A contratação do Premium será liberada somente após a integração e validação de pagamentos da Google Play. Não há cobrança nesta página.
                  </p>
                </div>
              </>
            )}
          </div>
          {state === "guest" && (
            <Link href="/login?next=%2Fpremium" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-amber-300 px-4 text-xs font-bold text-[#241829]">
              Entrar para ver meu plano
            </Link>
          )}
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2" aria-label="Recursos Premium">
          {[
            { label: "Jornada 365", detail: "Acompanhamento estruturado com missões e reflexões", icon: Sparkles },
            { label: "Apoio e ferramentas", detail: "Recursos de cuidado para momentos mais difíceis", icon: HeartPulse },
            { label: "Privacidade e segurança", detail: "Dados vinculados à conta e protegidos por controles de acesso", icon: ShieldCheck },
          ].map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.label} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-violet-200" aria-hidden="true" />
                <div><h2 className="text-sm font-bold">{feature.label}</h2><p className="mt-1 text-xs leading-relaxed text-slate-400">{feature.detail}</p></div>
              </div>
            );
          })}
        </section>
        <p className="mt-5 text-xs leading-relaxed text-slate-400">
          O WeedReset é uma ferramenta de apoio e informação, não substitui atendimento profissional.
          Valores e meios de pagamento não são apresentados até a implementação efetiva das compras.
        </p>
      </main>
    </div>
  );
}
