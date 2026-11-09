"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import {
  Home,
  BarChart3,
  SmilePlus,
  Users,
  LayoutGrid,
  HeartPulse,
  UserRound,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";
import NotificationBell from "@/components/notifications/NotificationBell";

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

const primaryLinks = [
  { href: "/", label: "Início", icon: Home },
  { href: "/mood", label: "Humor", icon: SmilePlus },
  { href: "/missions", label: "Missões", icon: LayoutGrid },
  { href: "/analytics", label: "Dados", icon: BarChart3 },
  { href: "/community", label: "Comunidade", icon: Users },
];

const extraLinks = [
  { href: "/sos", label: "Preciso de apoio", icon: HeartPulse },
  { href: "/profile", label: "Meu perfil", icon: UserRound },
];

const routesWithoutAppNavigation = new Set([
  "/login",
  "/signup",
  "/onboarding",
  "/privacy",
  "/terms",
]);

function isSelected(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

function MenuLink({
  href, label, icon: Icon, pathname, mobile = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  pathname: string;
  mobile?: boolean;
}) {
  const active = isSelected(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      data-active={active}
      className={
        "wr-nav-link border " +
        (mobile
          ? "flex min-w-0 min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl border-transparent px-1 py-1.5 text-[11px] font-medium "
          : "flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium ") +
        (active
          ? "border-violet-300/25 text-white"
          : "border-transparent text-[#c5bed8] hover:text-white")
      }
    >
      <Icon className={mobile ? "h-[21px] w-[21px]" : "h-[19px] w-[19px] shrink-0"} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
      <span className={mobile ? "truncate max-w-full" : ""}>{label}</span>
    </Link>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [profile, setProfile] = useState<any>(null);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (!cancelled) setProfile(prof);
    }
    loadProfile();
    return () => { cancelled = true; };
  }, []);

  const theme = profile?.theme ?? "default";
  const themeMode = profile?.theme_mode ?? profile?.themeMode ?? "normal";
  const bgClass = themeMode === "focus" ? "wr-focus-bg" : "wr-premium-bg";
  const showNavigation = !routesWithoutAppNavigation.has(pathname) && !pathname.startsWith("/admin");

  return (
    <html lang="pt-BR" className={inter.variable + " " + interTight.variable + " dark"}>
      <body className={"wr-app-body min-h-screen " + theme + " " + bgClass + " wr-noise relative font-sans text-white"}>
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

        {showNavigation && (
          <aside className="wr-desktop-nav fixed inset-y-0 left-0 z-40 hidden w-[244px] flex-col px-3 pb-6 pt-7 lg:flex" aria-label="Navegação do WeedReset">
            <Link href="/" className="mb-9 flex items-center gap-3 rounded-2xl px-3 outline-offset-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-300/30 bg-violet-400/15 shadow-[0_0_28px_rgba(140,96,236,.20)]">
                <Sparkles className="h-6 w-6 text-violet-200" strokeWidth={1.7} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-[17px] font-extrabold tracking-tight text-white">WeedReset</div>
                <div className="text-[11px] tracking-wide text-[#bfb2dc]">Sua jornada, seu ritmo</div>
              </div>
            </Link>
            <div className="wr-eyebrow mb-3 px-4">Explorar</div>
            <nav className="flex flex-col gap-1" aria-label="Seções principais">
              {primaryLinks.map((item) => (
                <MenuLink key={item.href} {...item} pathname={pathname} />
              ))}
            </nav>
            <div className="mt-7 border-t border-white/10 pt-5">
              <div className="wr-eyebrow mb-3 px-4">Sua jornada</div>
              <nav className="flex flex-col gap-1" aria-label="Apoio e perfil">
                {extraLinks.map((item) => (
                  <MenuLink key={item.href} {...item} pathname={pathname} />
                ))}
              </nav>
            </div>
            <div className="mt-auto px-3 pt-6">
              <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/5 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-200">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Um passo de cada vez
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#c5bed8]">
                  Seu progresso é pessoal. Continue no seu ritmo.
                </p>
              </div>
            </div>
          </aside>
        )}

        <main className={"wr-shell-main relative z-10 min-h-screen pt-0 " +
          (showNavigation
            ? "pb-[calc(104px+env(safe-area-inset-bottom))] lg:pb-8 lg:pl-[244px]"
            : "pb-8")}>
          {showNavigation && (
            <header className="wr-global-topbar sticky top-0 z-[60] border-b border-white/10 bg-[#110e22]/90 backdrop-blur-xl">
              <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
                <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold tracking-tight text-white" aria-label="Ir para o início do WeedReset">
                  <Sparkles className="h-4 w-4 text-violet-300" aria-hidden="true" />
                  <span>WeedReset</span>
                </Link>
                <NotificationBell />
              </div>
            </header>
          )}
          {children}
        </main>

        {showNavigation && (
          <nav className="wr-mobile-nav fixed inset-x-0 bottom-0 z-40 lg:hidden" aria-label="Navegação principal">
            <div className="mx-auto flex max-w-[560px] items-stretch justify-around gap-0.5 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2">
              {primaryLinks.map((item) => (
                <MenuLink key={item.href} {...item} pathname={pathname} mobile />
              ))}
            </div>
          </nav>
        )}
      </body>
    </html>
  );
}
