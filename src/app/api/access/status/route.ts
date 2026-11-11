import { NextResponse } from "next/server";
import { getRequestSupabase } from "@/lib/supabase-request";
import { getAccessStatus } from "@/lib/access-status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await getRequestSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ state: "guest", hasFullAccess: false, trialEndsAt: null }, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    const state = await getAccessStatus(supabase, user);
    return NextResponse.json(state, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível verificar o acesso." }, { status: 503 });
  }
}
