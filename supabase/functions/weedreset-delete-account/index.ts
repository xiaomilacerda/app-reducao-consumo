import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.48.1";

/** A self-service deletion endpoint for WeedReset's Google Play account policy.
 * Caller is authenticated by Supabase Auth and may delete ONLY their own account.
 * Privileged service credentials never leave this Edge Function.
 */
const allowedOrigins = new Set([
  "https://app-reducao-consumo.vercel.app",
  "https://weedreset.com",
  "https://www.weedreset.com",
]);
const CONFIRMATION = "EXCLUIR MINHA CONTA";

function response(status: number, data: Record<string, unknown>, origin: string | null) {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin" });
  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  return new Response(JSON.stringify(data), { status, headers });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) {
    return response(403, { error: "Origem não autorizada." }, null);
  }
  if (req.method === "OPTIONS") return response(200, { ok: true }, origin);
  if (req.method !== "POST") return response(405, { error: "Método não permitido." }, origin);
  if (Number(req.headers.get("content-length") || "0") > 1024) {
    return response(413, { error: "Solicitação inválida." }, origin);
  }

  const bearer = req.headers.get("Authorization") || "";
  if (!bearer.startsWith("Bearer ") || bearer.length > 4096) {
    return response(401, { error: "Entre na sua conta para solicitar a exclusão." }, origin);
  }

  let body: { confirmation?: unknown };
  try { body = await req.json(); }
  catch { return response(400, { error: "Dados inválidos." }, origin); }
  if (body.confirmation !== CONFIRMATION) {
    return response(400, { error: "Digite a confirmação exatamente como solicitado." }, origin);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    return response(503, { error: "Serviço temporariamente indisponível." }, origin);
  }

  const publicClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = bearer.slice(7);
  const { data: { user }, error: authError } = await publicClient.auth.getUser(token);
  if (authError || !user?.id) return response(401, { error: "Sessão inválida ou expirada. Entre novamente." }, origin);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // This procedure is a transaction in Postgres and only service_role can call it.
  // Run BEFORE Auth deletion, to avoid leaving personally identifiable orphan data.
  const { error: purgeError } = await admin.rpc("weedreset_purge_account_data", { p_user_id: user.id });
  if (purgeError) {
    console.error("Account deletion data purge failed", { code: purgeError.code });
    return response(500, { error: "Não foi possível excluir os dados. A conta permanece ativa; tente novamente ou contate o suporte." }, origin);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("Account deletion Auth step failed", { status: deleteError.status });
    return response(500, { error: "Os dados da conta foram removidos, mas não foi possível concluir a exclusão do acesso. Entre em contato com o suporte." }, origin);
  }

  return response(200, { ok: true, message: "Conta e dados pessoais excluídos." }, origin);
});
