"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, Crown, HeartPulse, LockKeyhole,
  RefreshCcw, ShieldCheck, Sparkles, Wallet,
} from "lucide-react";
import type { AccessStatus } from "@/lib/access-status";
import { GOOGLE_PLAY_METHOD, SUGGESTED_PRICE_BRL, WEEDRESET_PRODUCT_ID } from "@/config/monetization";

type DigitalProduct = {
  itemId: string;
  title?: string;
  description?: string;
  price: { currency: string; value: number | string };
};
type OwnedPurchase = { itemId: string; purchaseToken: string };
type DigitalGoodsService = {
  getDetails(ids: string[]): Promise<DigitalProduct[]>;
  listPurchases(): Promise<OwnedPurchase[]>;
};
declare global {
  interface Window {
    getDigitalGoodsService?: (method: string) => Promise<DigitalGoodsService>;
  }
}

export default function PremiumPage() {
  const [access, setAccess] = useState<AccessStatus | null>(null);
  const [service, setService] = useState<DigitalGoodsService | null>(null);
  const [product, setProduct] = useState<DigitalProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/access/status", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error("Não foi possível consultar seu acesso.");
    setAccess((await response.json()) as AccessStatus);
  }, []);

  useEffect(() => {
    let live = true;
    void loadStatus().catch(() => { if (live) setError("Não foi possível consultar seu acesso."); });
    // Digital Goods is available only when installed from Play Store in a TWA
    // with playBilling enabled. Do not redirect TWA users to external checkout.
    const connect = async () => {
      if (!window.getDigitalGoodsService) return;
      try {
        const detected = await window.getDigitalGoodsService(GOOGLE_PLAY_METHOD);
        if (!live) return;
        setService(detected);
        const items = await detected.getDetails([WEEDRESET_PRODUCT_ID]);
        if (live) setProduct(items.find((item) => item.itemId === WEEDRESET_PRODUCT_ID) || null);
      } catch {
        // Web/PWA and unconfigured development builds are not sale channels.
      }
    };
    void connect();
    return () => { live = false; };
  }, [loadStatus]);

  async function verifyToken(token: string) {
    const response = await fetch("/api/play/verify", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: WEEDRESET_PRODUCT_ID, purchaseToken: token }),
    });
    const result = (await response.json()) as { success?: boolean; error?: string };
    if (!response.ok || !result.success) throw new Error(result.error || "Compra não validada.");
    await loadStatus();
  }

  async function purchase() {
    if (!service || !product || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    let payment: PaymentResponse | null = null;
    try {
      payment = await new PaymentRequest(
        [{ supportedMethods: GOOGLE_PLAY_METHOD, data: { sku: WEEDRESET_PRODUCT_ID } }],
        { total: { label: "WeedReset · Acesso completo", amount: { currency: product.price.currency, value: "0" } } }
      ).show();
      const details = payment.details as { purchaseToken?: string; token?: string };
      const token = details.purchaseToken || details.token;
      if (!token) throw new Error("A loja não retornou o comprovante da compra.");
      await verifyToken(token);
      await payment.complete("success");
      setMessage("Compra validada! Seu acesso completo está ativo nesta conta.");
    } catch (err) {
      if (payment) await payment.complete("fail").catch(() => undefined);
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message || "Não foi possível concluir a compra.");
      }
    } finally { setBusy(false); }
  }

  async function restore() {
    if (!service || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const purchases = await service.listPurchases();
      const owned = purchases.find((item) => item.itemId === WEEDRESET_PRODUCT_ID && item.purchaseToken);
      if (!owned) throw new Error("Nenhuma compra desse produto foi encontrada na conta Google Play.");
      await verifyToken(owned.purchaseToken);
      setMessage("Compra restaurada com sucesso nesta conta WeedReset.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível restaurar a compra.");
    } finally { setBusy(false); }
  }

  const lifetime = access?.state === "lifetime";
  const preview = access?.state === "preview";
  const guest = access?.state === "guest";
  const trial = access?.state === "trial";
  const daysLeft = trial && access.trialEndsAt
    ? Math.max(1, Math.ceil((Date.parse(access.trialEndsAt) - Date.now()) / 86_400_000))
    : 0;
  const localizedPrice = product?.price
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: product.price.currency })
      .format(Number(product.price.value))
    : null;

  return (
    <div className="wr-screen min-h-screen w-full bg-[#0d0c1d] text-white">
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-6 sm:px-6">
        <Link href="/explorar" className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-violet-200 hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Explorar
        </Link>
        <section className="rounded-3xl border border-violet-300/25 bg-gradient-to-br from-[#38244b] via-[#1e1936] to-[#151421] p-5 shadow-2xl sm:p-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-200/10">
            <Crown className="h-6 w-6 text-amber-200" aria-hidden="true" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200">Um único acesso · Sem assinatura</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">WeedReset Completo</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300">
            Conheça as ferramentas de acompanhamento e, quando as compras estiverem disponíveis,
            pague uma única vez para liberar os recursos completos na sua conta.
          </p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
            {lifetime ? (
              <div className="flex items-center gap-3 text-emerald-200">
                <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden="true" />
                <div><p className="font-bold">Acesso completo ativo</p><p className="mt-1 text-xs text-slate-300">Seu acesso está vinculado à conta WeedReset. Sem renovação mensal.</p></div>
              </div>
            ) : preview ? (
              <div className="flex items-center gap-3 text-violet-100">
                <Sparkles className="h-6 w-6 shrink-0" aria-hidden="true" />
                <div><p className="font-bold">Acesso de pré-lançamento</p><p className="mt-1 text-xs text-slate-300">A cobrança ainda não foi ativada. Você pode continuar usando o app nesta fase.</p></div>
              </div>
            ) : trial ? (
              <div className="flex items-center gap-3 text-amber-100">
                <Sparkles className="h-6 w-6 shrink-0" aria-hidden="true" />
                <div><p className="font-bold">Você está experimentando o acesso completo</p><p className="mt-1 text-xs text-slate-300">{daysLeft} {daysLeft === 1 ? "dia restante" : "dias restantes"} no teste inicial, sem cartão e sem renovação automática.</p></div>
              </div>
            ) : guest ? (
              <div className="flex items-center gap-3 text-violet-100">
                <LockKeyhole className="h-6 w-6 shrink-0" aria-hidden="true" />
                <div><p className="font-bold">Entre para consultar seu acesso</p><p className="mt-1 text-xs text-slate-300">A compra será vinculada à conta em que você estiver conectado.</p></div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-amber-100">
                <LockKeyhole className="h-6 w-6 shrink-0" aria-hidden="true" />
                <div><p className="font-bold">Seu teste inicial terminou</p><p className="mt-1 text-xs text-slate-300">As ferramentas de apoio essenciais, como o SOS, continuam disponíveis.</p></div>
              </div>
            )}
          </div>

          {!lifetime && !preview && (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-wide text-slate-400">Pagamento único</p>
              <p className="mt-1 text-3xl font-black">{localizedPrice ?? SUGGESTED_PRICE_BRL}</p>
              <p className="mt-1 text-xs text-slate-400">
                {localizedPrice ? "Preço informado pela Google Play." : "Preço sugerido de lançamento. Valor definitivo será exibido pela Google Play quando disponível."}
              </p>
              {guest ? (
                <Link href="/login?next=%2Fpremium" className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-violet-300 px-5 text-sm font-bold text-[#1c1032] sm:w-auto">
                  Entrar na minha conta
                </Link>
              ) : (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button type="button" onClick={purchase} disabled={!service || !product || busy}
                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-300 px-5 text-sm font-bold text-[#1c1032] disabled:cursor-not-allowed disabled:opacity-45">
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    {busy ? "Verificando..." : "Comprar acesso único pela Google Play"}
                  </button>
                  <button type="button" onClick={restore} disabled={!service || busy}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-violet-200/30 px-5 text-sm font-semibold text-violet-100 disabled:cursor-not-allowed disabled:opacity-45">
                    <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Restaurar compra
                  </button>
                </div>
              )}
              {!service && !guest && (
                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                  A compra só aparece na versão Android instalada pela Google Play com faturamento configurado.
                  No navegador, entre com a mesma conta para utilizar um acesso já adquirido.
                </p>
              )}
            </div>
          )}
          {message && <p role="status" className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-900/25 p-3 text-sm text-emerald-200">{message}</p>}
          {error && <p role="alert" className="mt-4 rounded-xl border border-rose-300/30 bg-rose-900/20 p-3 text-sm text-rose-200">{error}</p>}
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2" aria-label="O que está incluído">
          {[
            { label: "Jornada e missões", detail: "Acompanhe seus passos e reflexões diárias.", icon: Sparkles },
            { label: "Estatísticas e registros", detail: "Visualize sua evolução ao longo do tempo.", icon: CheckCircle2 },
            { label: "Ferramentas de apoio", detail: "Estratégias de cuidado para momentos difíceis.", icon: HeartPulse },
            { label: "Conta e privacidade", detail: "Seus registros associados à sua conta.", icon: ShieldCheck },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-violet-200" aria-hidden="true" />
                <div><h2 className="text-sm font-bold">{item.label}</h2><p className="mt-1 text-xs leading-relaxed text-slate-400">{item.detail}</p></div>
              </div>
            );
          })}
        </section>
        <p className="mt-5 text-xs leading-relaxed text-slate-400">
          Sem assinatura ou cobrança recorrente. Compras e reembolsos seguem as regras da Google Play.
          O WeedReset oferece informação e apoio, não substitui acompanhamento profissional.
          Veja os <Link href="/terms" className="underline">Termos</Link> e a <Link href="/privacy" className="underline">Privacidade</Link>.
        </p>
      </main>
    </div>
  );
}
