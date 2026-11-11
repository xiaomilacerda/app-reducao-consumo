import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { WEEDRESET_PRODUCT_ID } from "@/config/monetization";
import { purchaseTokenHash } from "@/lib/google-play-server";
import { verifyPubsubPushJwt } from "@/lib/google-pubsub-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeveloperNotification = {
  packageName?: string;
  oneTimeProductNotification?: {
    notificationType?: number;
    purchaseToken?: string;
    sku?: string;
  };
  voidedPurchaseNotification?: {
    purchaseToken?: string;
    productType?: number;
    refundType?: number;
  };
};

/**
 * Google Play RTDN via authenticated Google Cloud Pub/Sub push.
 * No authentication by shared URL or unverifiable user email.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!await verifyPubsubPushJwt(auth)) {
    return NextResponse.json({ error: "Notificação não autorizada." }, { status: 401 });
  }
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!packageName || !secret || !url) {
    return NextResponse.json({ error: "Configuração indisponível." }, { status: 503 });
  }
  try {
    const raw = await request.text();
    if (raw.length > 64_000) return NextResponse.json({ error: "Payload muito grande." }, { status: 413 });
    const envelope = JSON.parse(raw) as { message?: { data?: string } };
    if (!envelope.message?.data || envelope.message.data.length > 48_000) {
      return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
    }
    const notification = JSON.parse(
      Buffer.from(envelope.message.data, "base64").toString("utf8")
    ) as DeveloperNotification;
    if (notification.packageName !== packageName) {
      // Acknowledge unrelated messages without changing anything.
      return NextResponse.json({ received: true });
    }

    let token: string | undefined;
    const voided = notification.voidedPurchaseNotification;
    const oneTime = notification.oneTimeProductNotification;
    if (voided?.productType === 2 && voided.refundType === 1) {
      token = voided.purchaseToken;
    } else if (oneTime?.sku === WEEDRESET_PRODUCT_ID && oneTime.notificationType === 2) {
      token = oneTime.purchaseToken;
    }
    if (!token) return NextResponse.json({ received: true });
    if (token.length < 10 || token.length > 8192 || /\s/.test(token)) {
      return NextResponse.json({ error: "Token inválido." }, { status: 400 });
    }

    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await admin.rpc("weedreset_revoke_google_play_purchase", {
      p_token_hash: purchaseTokenHash(token),
    });
    // Return 500 so Pub/Sub retries transient DB failures.
    if (error) return NextResponse.json({ error: "Falha ao atualizar acesso." }, { status: 500 });
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Falha ao processar notificação." }, { status: 400 });
  }
}
