"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import "./globals.css";
import Link from "next/link";
import {
  Home,
  BarChart2,
  SmilePlus,
  Users,
  Grid,
} from "lucide-react";

import { Inter, Inter_Tight } from "next/font/google";

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

/**
 * WEED RESET — LAYOUT PREMIUM (OPÇÃO C)
 * Aperfeiçoado, sem remover nenhuma função.
 * - Inter (corpo)
 * - Inter Tight (títulos automáticos)
 * - Fundo premium com animação suave
 * - Moldura premium preservada
 * - Menu inferior refinado
 */

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [profile, setProfile] = useState<any>(null);
  const pathname = usePathname();

  useEffect(() => {
    async function loadProfile() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user) return;

      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      setProfile(prof);
    }

    loadProfile();
  }, []);

  // === Tema ===
  const theme = profile?.theme ?? "default";
  // Compat: alguns trechos do app usam theme_mode (normal/focus)
  const themeMode = (profile?.theme_mode ?? profile?.themeMode ?? "normal") as
    | "normal"
    | "focus"
    | string;
  const bgClass = themeMode === "focus" ? "wr-focus-bg" : "wr-premium-bg";

  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${interTight.variable} dark`}
    >
      <body
        className={`min-h-screen ${theme} ${bgClass} wr-noise text-white relative font-sans`}
      >
        {/* Moldura Premium */}
        {profile?.frame && (
          <div
            className="pointer-events-none fixed inset-0 z-50"
            style={{
              border: "6px solid rgba(246, 215, 118, 0.6)",
              boxShadow: "0 0 25px rgba(246, 215, 118, 0.4)",
              borderRadius: 20,
            }}
          ></div>
        )}

        {/* Conteúdo principal */}
        <main className="relative z-10 pb-24 pt-4">{children}</main>

        {/* MENU INFERIOR */}
        <nav className="fixed bottom-0 left-0 right-0 bg-[#0d0d12]/90 border-t border-white/10 backdrop-blur-xl z-40">
          <div className="max-w-md mx-auto flex justify-around py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] text-xs text-gray-300">
            <NavItem pathname={pathname} href="/" icon={<Home />} label="Início" />
            <NavItem pathname={pathname} href="/mood" icon={<SmilePlus />} label="Humor" />
            <NavItem pathname={pathname} href="/missions" icon={<Grid />} label="Missões" />
            <NavItem pathname={pathname} href="/analytics" icon={<BarChart2 />} label="Dados" />
            <NavItem pathname={pathname} href="/community" icon={<Users />} label="Comunidade" />
          </div>
        </nav>
      </body>
    </html>
  );
}

/* Componente de ícone do menu */
function NavItem({
  pathname,
  href,
  icon,
  label,
}: {
  pathname: string;
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  const isActive = href === "/" ? pathname === "/" : pathname?.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={
        "flex flex-col items-center gap-1 transition " +
        (isActive
          ? "opacity-100"
          : "opacity-80 hover:opacity-100")
      }
    >
      <div
        className={
          "w-10 h-8 rounded-xl flex items-center justify-center " +
          (isActive
            ? "bg-white/10 border border-white/10 shadow-[0_0_22px_rgba(168,85,247,.35)]"
            : "")
        }
      >
        <div className="w-5 h-5">{icon}</div>
      </div>
      <span className={"text-[10px] " + (isActive ? "text-white" : "")}>{label}</span>
    </Link>
  );
}
