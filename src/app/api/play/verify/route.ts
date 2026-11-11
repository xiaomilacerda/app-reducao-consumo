import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { WEEDRESET_PRODUCT_ID } from "@/config/monetization";
import { getRequestSupabase } from "@/lib/supabase-request";
import { googlePlayReady, purchaseTokenHash, validateAndAcknowledgePurchase } from "@/lib/google-play-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }
  if (!googlePlayReady()) {
    return NextResponse.json({ error: "Compras ainda não estão disponíveis." }, { status: 503 });
  }
  try {
    const supabase = await getRequestSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Entre na sua conta para comprar ou restaurar." }, { status: 401 });
    }
    const body = (await request.json()) as { purchaseToken?: unknown; productId?: unknown };
    const purchaseToken = body.purchaseToken;
    if (body.productId !== WEEDRESET_PRODUCT_ID ||
        typeof purchaseToken !== "string" || purchaseToken.length < 10 ||
        purchaseToken.length > 8192 || /\s/.test(purchaseToken)) {
      return NextResponse.json({ error: "Dados da compra inválidos." }, { status: 400 });
    }
    const verified = await validateAndAcknowledgePurchase(purchaseToken);
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error } = await admin.rpc("weedreset_record_google_play_purchase", {
      p_user_id: user.id,
      p_token_hash: purchaseTokenHash(purchaseToken),
      p_product_id: WEEDRESET_PRODUCT_ID,
      p_order_id: verified.orderId ?? null,
    });
    if (error) {
      // Token reuse by a different account is explicitly refused by the SQL RPC.
      if (error.message.includes("purchase_belongs_to_another_account")) {
        return NextResponse.json({ error: "Essa compra já está vinculada a outra conta WeedReset." }, { status: 409 });
      }
      throw new Error("Falha ao vincular compra ao usuário");
    }
    return NextResponse.json({ success: true, state: "lifetime" }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({
      error: "Não foi possível validar a compra. Se ela foi cobrada, use Restaurar compra nesta mesma conta.",
    }, { status: 502 });
  }
}
