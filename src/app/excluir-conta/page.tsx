"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, ShieldCheck, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const CONFIRMATION = "EXCLUIR MINHA CONTA";

export default function ExcluirContaPage() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [phrase, setPhrase] = useState("");
  const [consent, setConsent] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data, error: authError }: any) => {
      if (active) setSignedIn(!authError && !!data.user);
    }).catch(() => { if (active) setSignedIn(false); });
    return () => { active = false; };
  }, []);

  async function handleDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signedIn || deleting || !consent || phrase !== CONFIRMATION) return;
    setError(null);
    setDeleting(true);
    try {
      const { data, error: functionError } = await supabase.functions.invoke("weedreset-delete-account", {
        body: { confirmation: phrase },
      });
      if (functionError || data?.ok !== true) {
        throw new Error(data?.error || "Não foi possível concluir a exclusão. Sua conta poderá continuar ativa. Entre em contato com o suporte.");
      }

      setDone(true);
      // Invalidate cookies/session first, then remove private local-only records.
      try { await supabase.auth.signOut(); } catch {}
      try { window.localStorage.clear(); window.sessionStorage.clear(); } catch {}
      window.setTimeout(() => router.replace("/login?conta_excluida=1"), 1800);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao excluir conta. Tente novamente ou solicite suporte.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="wr-screen min-h-screen w-full bg-[#0d0b19] text-white">
      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8 sm:px-6">
        <Link href="/settings" className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm text-violet-200 hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Configurações
        </Link>
        <div className="rounded-2xl border border-rose-400/20 bg-[#1b1726] p-5 shadow-lg sm:p-7">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-400/10 text-rose-200">
            <Trash2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-extrabold sm:text-2xl">Excluir minha conta WeedReset</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Você pode solicitar a exclusão da sua conta e dos dados pessoais associados.
            Esse processo é permanente e não pode ser desfeito.
          </p>

          <section aria-label="O que será excluído" className="mt-5 rounded-xl border border-white/10 bg-black/15 p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <ShieldCheck className="h-4 w-4 text-violet-200" aria-hidden="true" />
              O que acontece com seus dados?
            </h2>
            <ul className="mt-2 space-y-2 pl-4 text-xs leading-relaxed text-slate-300">
              <li className="list-disc">Sua conta, perfil, registros de humor, jornadas, missões e histórico são removidos dos sistemas ativos.</li>
              <li className="list-disc">Suas publicações, comentários e interações na Comunidade são excluídos.</li>
              <li className="list-disc">Informações locais deste dispositivo são apagadas após a confirmação.</li>
              <li className="list-disc">Registros mínimos que a lei exigir e cópias técnicas de segurança podem seguir prazos específicos de retenção.</li>
            </ul>
          </section>

          {done ? (
            <div role="status" className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-100">
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              Sua conta foi excluída. Você será redirecionado para a tela inicial.
            </div>
          ) : signedIn === null ? (
            <p role="status" className="mt-5 text-sm text-slate-400">Verificando sua sessão...</p>
          ) : !signedIn ? (
            <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4">
              <p className="text-sm text-amber-100">Para proteger seus dados, entre na conta que deseja excluir e volte para esta página.</p>
              <Link href="/login?next=%2Fexcluir-conta" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-violet-300 px-4 text-sm font-bold text-[#1b1331]">
                Entrar para solicitar exclusão
              </Link>
            </div>
          ) : (
            <form onSubmit={handleDeletion} className="mt-5 space-y-4">
              <div className="flex items-start gap-2 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-200" aria-hidden="true" />
                <p className="text-xs leading-relaxed text-rose-100">A exclusão é definitiva. Não utilize esta opção para apenas sair da conta ou reiniciar sua jornada.</p>
              </div>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Digite <strong>EXCLUIR MINHA CONTA</strong> para confirmar</span>
                <input
                  autoComplete="off"
                  value={phrase}
                  onChange={(event) => setPhrase(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-white/20 bg-[#100e1b] px-3 text-sm text-white outline-none focus-visible:border-rose-300"
                  placeholder={CONFIRMATION}
                  disabled={deleting}
                  required
                />
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-xs text-slate-200">
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={deleting} className="mt-0.5 h-4 w-4 accent-rose-400" />
                <span>Entendi que perderei o acesso e que essa ação não pode ser desfeita.</span>
              </label>
              {error && <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-xs text-rose-100">{error}</p>}
              <button
                type="submit"
                disabled={deleting || phrase !== CONFIRMATION || !consent}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {deleting ? "Excluindo conta e dados..." : "Excluir minha conta permanentemente"}
              </button>
            </form>
          )}

          <p className="mt-5 text-xs leading-relaxed text-slate-400">
            Se não conseguir acessar sua conta ou precisar de ajuda para exercer seus direitos,
            entre em contato com <a href="mailto:contato@weedreset.com" className="font-semibold text-violet-200 underline">contato@weedreset.com</a>.
            Consulte também nossa <Link href="/privacy" className="font-semibold text-violet-200 underline">Política de Privacidade</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
