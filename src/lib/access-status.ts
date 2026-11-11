import type { SupabaseClient, User } from "@supabase/supabase-js";
import { TRIAL_DAYS } from "@/config/monetization";

export type AccessStatus =
  | { state: "guest"; hasFullAccess: false; trialEndsAt: null }
  | { state: "preview"; hasFullAccess: true; trialEndsAt: null }
  | { state: "lifetime"; hasFullAccess: true; trialEndsAt: null }
  | { state: "trial"; hasFullAccess: true; trialEndsAt: string }
  | { state: "expired"; hasFullAccess: false; trialEndsAt: string };

export function paidAccessEnabled() {
  const launch = process.env.WEEDRESET_ACCESS_LAUNCH_DATE;
  return process.env.WEEDRESET_PAID_ACCESS_ENABLED === "true" &&
    Boolean(launch && Number.isFinite(Date.parse(launch)) &&
      process.env.GOOGLE_PLAY_PACKAGE_NAME && process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON &&
      process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function trialEndDate(createdAt: string): string {
  // Conta antiga não perde o direito de testar no dia do lançamento.
  const activationDate = process.env.WEEDRESET_ACCESS_LAUNCH_DATE;
  const created = Date.parse(createdAt);
  const release = activationDate ? Date.parse(activationDate) : Number.NaN;
  const start = Math.max(Number.isFinite(created) ? created : 0, Number.isFinite(release) ? release : 0);
  return new Date(start + TRIAL_DAYS * 86_400_000).toISOString();
}

export async function getAccessStatus(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "created_at"> | null
): Promise<AccessStatus> {
  if (!user) return { state: "guest", hasFullAccess: false, trialEndsAt: null };
  if (!paidAccessEnabled()) return { state: "preview", hasFullAccess: true, trialEndsAt: null };

  const [{ data: profile, error: profileError }, { data: entitlement, error: entitlementError }] =
    await Promise.all([
      supabase.from("profiles").select("is_premium").eq("id", user.id).maybeSingle(),
      supabase.from("weedreset_entitlements").select("source").eq("user_id", user.id).maybeSingle(),
    ]);
  // Never return a free trial on an authorization/database failure.
  if (profileError || entitlementError) throw new Error("Falha ao verificar o acesso no banco de dados");
  if (profile?.is_premium === true || entitlement?.source === "google_play" || entitlement?.source === "manual") {
    return { state: "lifetime", hasFullAccess: true, trialEndsAt: null };
  }
  const trialEndsAt = trialEndDate(user.created_at);
  return Date.now() < Date.parse(trialEndsAt)
    ? { state: "trial", hasFullAccess: true, trialEndsAt }
    : { state: "expired", hasFullAccess: false, trialEndsAt };
}
