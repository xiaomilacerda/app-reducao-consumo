"use client";

import Link from "next/link";
import { Activity, Heart, Moon, Smile } from "lucide-react";
import type { HealthMetric } from "@/lib/types";

interface HealthBarsProps {
  metrics: HealthMetric[];
}

/**
 * Former percentages scaled with elapsed days, without a validated clinical
 * relationship. They have been removed to avoid suggesting medical recovery.
 */
export default function HealthBars({ metrics: _metrics }: HealthBarsProps) {
  return (
    <section aria-label="Cuidados e bem-estar" className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-white sm:text-base">
          <Activity className="h-4 w-4 text-violet-200" aria-hidden="true" />
          Cuidando do seu bem-estar
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          O tempo sem consumir é um registro de progresso pessoal; não mede a recuperação dos pulmões,
          do sono ou da saúde mental. Cada pessoa tem sua própria experiência.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { title: "Descanso", body: "Observe como seu sono varia ao longo dos dias.", icon: Moon },
          { title: "Humor", body: "Registre sentimentos e identifique padrões.", icon: Smile },
          { title: "Autocuidado", body: "Movimento, hidratação e apoio podem fazer parte da rotina.", icon: Heart },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-xl border border-white/10 bg-white/[.04] p-3">
              <Icon className="h-4 w-4 text-violet-200" aria-hidden="true" />
              <h4 className="mt-2 text-xs font-bold text-white">{item.title}</h4>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{item.body}</p>
            </div>
          );
        })}
      </div>
      <Link href="/mood" className="inline-flex min-h-10 items-center rounded-lg px-2 text-xs font-semibold text-violet-200 hover:bg-violet-400/10">
        Registrar meu humor
      </Link>
      <p className="text-[11px] leading-relaxed text-slate-500">Não substitui avaliação médica ou psicológica. Não há percentual clínico de recuperação calculado pelo aplicativo.</p>
    </section>
  );
}
