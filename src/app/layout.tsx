"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { LucideIcon } from "lucide-react";
import {
  ChevronRight, HeartPulse, ShieldCheck, Sparkles, UserRound
} from "lucide-react";
import { Inter, Inter_Tight } from "next/font/google";
import NotificationBell from "@/components/notifications/NotificationBell";
import PwaRegistrar from "@/components/pwa/PwaRegistrar";
import { APP_NAV_GROUPS, MAIN_TABS, activeMainTab, isRouteActive } from "@/lib/app-navigation";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-inter-tight",
});

const withoutNav = new Set(["/login", "/signup", "/onboarding", "/privacy", "/terms", "/recuperar-senha", "/redefinir-senha"]);

function NavigationLink({
  href, label, icon: Icon, current, mobile = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  current: boolean;
  mobile?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      data-active={current}
      className={
        "wr-nav-link border " +
        (mobile
          ? "flex min-h-[58px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl border-transparent px-0.5 py-1 text-[11.5px] font-medium leading-tight min-[400px]:text-[12px] "
          : "flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium ") +
        (current ? "border-violet-300/25 text-white" : "border-transparent text-[#c5bed8] hover:text-white")
      }
    >
      <Icon
        className={mobile ? "h-5 w-5 shrink-0" : "h-[18px] w-[18px] shrink-0"}
        strokeWidth={current ? 2.2 : 1.8}
        aria-hidden="true"
      />
      <span className={mobile ? "block max-w-full whitespace-normal break-words text-center leading-tight" : "min-w-0 truncate"}>{label}</span>
    </Link>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        if (!cancelled) setProfile(null);
        return;
      }
      const { data: prof } = await supabase
        .from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
      if (!cancelled) setProfile(prof ?? null);
    }
    void loadProfile();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      // Avoid auth-session network work inside the callback itself.
      void Promise.resolve().then(loadProfile);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [supabase]);

  const theme = profile?.theme ?? "default";
  const themeMode = profile?.theme_mode ?? profile?.themeMode ?? "normal";
  const bgClass = themeMode === "focus" ? "wr-focus-bg" : "wr-premium-bg";
  const showNav = !withoutNav.has(pathname) && !pathname.startsWith("/admin");
  const activeTab = activeMainTab(pathname);

  return (
    <html lang="pt-BR" className={inter.variable + " " + interTight.variable + " dark"}>
      <body className={"wr-app-body min-h-screen " + theme + " " + bgClass + " wr-noise relative font-sans text-white"}>
        <PwaRegistrar />
        {profile?.frame && (
          <div
            className="pointer-events-none fixed inset-0 z-50"
            style={{
              border: "6px solid rgba(246, 215, 118, 0.6)",
              boxShadow: "0 0 25px rgba(246, 215, 118, 0.4)",
              borderRadius: 20,
            }}
          />
        )}

        {showNav && (
          <aside className="wr-desktop-nav fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col lg:flex" aria-label="Navegação do WeedReset">
            <Link href="/" className="mx-4 mb-3 mt-5 flex items-center gap-3 rounded-2xl p-2 outline-offset-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-300/30 bg-violet-400/15">
                <Sparkles className="h-5 w-5 text-violet-200" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-extrabold tracking-tight text-white">WeedReset</span>
                <span className="block text-[11px] text-[#bfb2dc]">Sua jornada, seu ritmo</span>
              </span>
            </Link>
            <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-5" aria-label="Todas as seções">
              <div>
                <p className="wr-eyebrow mb-1.5 px-3">Principal</p>
                {MAIN_TABS.map((item) => (
                  <NavigationLink key={item.href} {...item} current={activeTab === item.href} />
                ))}
              </div>
              <div className="border-t border-white/10 pt-4">
                <p className="wr-eyebrow mb-1.5 px-3">Sua jornada</p>
                {APP_NAV_GROUPS[0].items.filter((item) => [
                  "/jornada", "/analytics", "/rewards", "/jornada/history"
                ].includes(item.href)).map((item) => (
                  <NavigationLink key={item.href} {...item} current={isRouteActive(pathname, item.href)} />
                ))}
              </div>
              <div className="border-t border-white/10 pt-4">
                <p className="wr-eyebrow mb-1.5 px-3">Cuidado e apoio</p>
                {APP_NAV_GROUPS[1].items.filter((item) => [
                  "/sos", "/cant-stop", "/ai-insights", "/body-evolution"
                ].includes(item.href)).map((item) => (
                  <NavigationLink key={item.href} {...item} current={isRouteActive(pathname, item.href)} />
                ))}
              </div>
              <div className="border-t border-white/10 pt-4">
                <p className="wr-eyebrow mb-1.5 px-3">Sua conta</p>
                {APP_NAV_GROUPS[3].items.filter((item) => [
                  "/profile", "/settings"
                ].includes(item.href)).map((item) => (
                  <NavigationLink key={item.href} {...item} current={isRouteActive(pathname, item.href)} />
                ))}
              </div>
            </nav>
            <Link href="/explorar" className="mx-4 mb-4 flex min-h-10 items-center justify-between rounded-xl border border-violet-300/20 bg-violet-400/10 px-3 text-xs font-semibold text-violet-100 transition-colors hover:bg-violet-400/20">
              Todas as funcionalidades <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </aside>
        )}

        <main className={"wr-shell-main relative z-10 min-h-screen " +
          (showNav
            ? "pb-[calc(84px+env(safe-area-inset-bottom))] lg:pb-8 lg:pl-[252px]"
            : "pb-8")}>
          {showNav && (
            <header className="wr-global-topbar sticky top-0 z-[60] border-b border-white/10 bg-[#110e22]/95 backdrop-blur-xl">
              <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-2 px-3 sm:h-14 sm:px-6 lg:justify-end">
                <Link href="/" className="inline-flex min-w-0 items-center gap-2 rounded-lg px-1 text-sm font-bold tracking-tight text-white outline-offset-2 lg:hidden" aria-label="WeedReset, ir para o início">
                  <Sparkles className="h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
                  <span className="truncate lg:font-medium">WeedReset</span>
                </Link>
                <nav className="flex shrink-0 items-center gap-1.5" aria-label="Acesso rápido">
                  {pathname !== "/sos" && (
                    <Link
                      href="/sos"
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-rose-300/20 bg-rose-300/10 px-2.5 text-[11px] font-bold text-rose-200 transition-colors hover:bg-rose-300/20 sm:px-3 sm:text-xs"
                      aria-label="Preciso de apoio: abrir ajuda SOS"
                    >
                      <HeartPulse className="h-[18px] w-[18px]" aria-hidden="true" />
                      SOS
                    </Link>
                  )}
                  <NotificationBell />
                  <Link href="/profile" aria-label="Meu perfil" title="Meu perfil" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-violet-300/20 bg-white/5 text-violet-100 hover:bg-violet-400/15">
                    <UserRound className="h-[19px] w-[19px]" aria-hidden="true" />
                  </Link>
                </nav>
              </div>
            </header>
          )}
          {children}
        </main>

        {showNav && (
          <nav className="wr-mobile-nav fixed inset-x-0 bottom-0 z-40 lg:hidden" aria-label="Navegação principal">
            <div className="mx-auto flex max-w-[560px] items-stretch justify-around gap-0.5 px-1.5 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-1.5">
              {MAIN_TABS.map((item) => (
                <NavigationLink key={item.href} {...item} current={activeTab === item.href} mobile />
              ))}
            </div>
          </nav>
        )}
      </body>
    </html>
  );
}
