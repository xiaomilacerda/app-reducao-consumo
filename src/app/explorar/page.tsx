"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, HeartPulse, BarChart3, Search, X, ChevronRight } from "lucide-react";
import { APP_NAV_GROUPS, getNavMatch } from "@/lib/app-navigation";

const quickLinks = [
  { href: "/sos", label: "Preciso de apoio", icon: HeartPulse, tone: "support" },
  { href: "/jornada", label: "Jornada 365", icon: CalendarDays, tone: "standard" },
  { href: "/analytics", label: "Meu progresso", icon: BarChart3, tone: "standard" },
] as const;

export default function ExplorarPage() {
  const [query, setQuery] = useState("");
  const visibleGroups = useMemo(
    () => APP_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => getNavMatch(item, query)),
    })).filter((group) => group.items.length > 0),
    [query]
  );
  const resultCount = visibleGroups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="wr-explore-page wr-screen min-h-screen w-full pb-8 text-white">
      <main className="mx-auto w-full max-w-5xl px-4 pb-8 pt-5 sm:px-7 sm:pt-7">
        <header className="mb-5">
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-emerald-300/90">Todas as funções</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Explorar WeedReset</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-400">
            Encontre o que precisa sem procurar em várias telas.
          </p>
        </header>

        <div className="wr-explore-search sticky top-12 z-30 mb-5 rounded-2xl border border-violet-300/20 bg-[#1a162c]/95 p-2 shadow-[0_12px_40px_rgba(0,0,0,.28)] backdrop-blur-xl sm:top-14">
          <div className="flex min-h-10 items-center gap-3 px-2">
            <Search className="h-5 w-5 shrink-0 text-violet-300" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar recurso, tema ou atividade..."
              aria-label="Buscar funcionalidades do WeedReset"
              autoComplete="off"
              className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10"
              ><X className="h-4 w-4" /></button>
            )}
          </div>
        </div>

        {!query && (
          <>
            <section aria-label="Acesso rápido" className="mb-6">
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">Acesso rápido</h2>
              </div>
              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
                {quickLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={
                        "group flex min-h-14 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 " +
                        (item.tone === "support"
                          ? "border-rose-400/25 bg-rose-400/10 text-rose-100 hover:bg-rose-400/15"
                          : "border-white/10 bg-white/[.055] text-white hover:bg-violet-400/10")
                      }
                    >
                      <Icon className="h-[19px] w-[19px] shrink-0 opacity-85" aria-hidden="true" />
                      <span className="min-w-0 flex-1 leading-tight">{item.label}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-60 min-[380px]:hidden" aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            </section>

            <nav className="mb-6 flex gap-2 overflow-x-auto pb-2" aria-label="Ir para uma categoria">
              {APP_NAV_GROUPS.map((group) => (
                <a
                  key={group.id}
                  href={"#" + group.id}
                  className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-white/10 bg-white/[.045] px-3 text-xs font-medium text-slate-200 hover:border-violet-300/30 hover:bg-violet-300/10 focus-visible:outline-2 focus-visible:outline-violet-300"
                >
                  {group.title}
                </a>
              ))}
            </nav>
          </>
        )}

        {query && (
          <p className="mb-4 text-xs text-slate-400" role="status" aria-live="polite">
            {resultCount === 1 ? "1 função encontrada" : resultCount + " funções encontradas"}
          </p>
        )}

        {visibleGroups.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[.04] px-6 py-10 text-center">
            <Search className="mx-auto h-6 w-6 text-violet-300/80" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold">Nenhuma função encontrada</p>
            <p className="mt-1 text-xs text-slate-400">Tente outra palavra, como “humor” ou “ajuda”.</p>
            <button type="button" onClick={() => setQuery("")} className="mt-4 min-h-10 rounded-xl border border-violet-300/25 px-4 text-xs font-semibold text-violet-200 hover:bg-violet-300/10">
              Ver todas as funções
            </button>
          </div>
        ) : (
          <div className="space-y-7">
            {visibleGroups.map((group) => (
              <section key={group.id} id={group.id} className="scroll-mt-36" aria-labelledby={"explorar-" + group.id}>
                <div className="mb-3 flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <h2 id={"explorar-" + group.id} className="text-base font-bold tracking-tight text-white sm:text-lg">{group.title}</h2>
                    <p className="mt-0.5 text-xs text-slate-400">{group.description}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-500">{group.items.length} {group.items.length === 1 ? "recurso" : "recursos"}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex min-h-[64px] items-center gap-3 rounded-xl border border-white/10 bg-[#1a182d]/85 px-3.5 py-2.5 transition-[background-color,border-color,transform] hover:border-violet-300/30 hover:bg-[#29223d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 active:scale-[.99]"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-300/[.09] text-violet-200">
                          <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold leading-snug text-white">{item.label}</span>
                          <span className="mt-0.5 block text-xs leading-snug text-slate-400">{item.description}</span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-200" aria-hidden="true" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
