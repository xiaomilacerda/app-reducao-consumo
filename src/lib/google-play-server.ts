import { createHash, sign } from "node:crypto";
import { WEEDRESET_PRODUCT_ID } from "@/config/monetization";

type ServiceAccount = { client_email: string; private_key: string };
type ProductPurchase = {
  purchaseState?: number;
  acknowledgementState?: number;
  consumptionState?: number;
  productId?: string;
  orderId?: string;
  refundableQuantity?: number;
};

function getServiceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Credenciais Google Play ausentes");
  const account = JSON.parse(raw) as Partial<ServiceAccount>;
  if (!account.client_email || !account.private_key) throw new Error("Credenciais Google Play inválidas");
  return account as ServiceAccount;
}

export function googlePlayReady() {
  return Boolean(
    process.env.WEEDRESET_PAID_ACCESS_ENABLED === "true" &&
    process.env.GOOGLE_PLAY_PACKAGE_NAME &&
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function purchaseTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getGoogleAccessToken(): Promise<string> {
  const account = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const encode = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = encode({ alg: "RS256", typ: "JWT" }) + "." +
    encode({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3000,
    });
  const signature = sign("RSA-SHA256", Buffer.from(unsigned), account.private_key).toString("base64url");
  const form = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: unsigned + "." + signature,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Falha de autenticação com Google Play");
  const token = (await response.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("Token Google Play não retornado");
  return token.access_token;
}

export async function validateAndAcknowledgePurchase(token: string): Promise<ProductPurchase> {
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  if (!packageName) throw new Error("Package ID ausente");
  const accessToken = await getGoogleAccessToken();
  const productUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(WEEDRESET_PRODUCT_ID)}/tokens/${encodeURIComponent(token)}`;
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };
  const verify = await fetch(productUrl, { headers, cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!verify.ok) throw new Error("Compra não encontrada ou não validada pela Google Play");
  const purchase = (await verify.json()) as ProductPurchase;
  // Never grant access to refunded, pending, consumed or mismatched products.
  if (purchase.purchaseState !== 0 ||
      purchase.consumptionState === 1 ||
      (purchase.productId && purchase.productId !== WEEDRESET_PRODUCT_ID) ||
      purchase.refundableQuantity === 0) {
    throw new Error("Compra não aprovada ou reembolsada");
  }
  if (purchase.acknowledgementState !== 1) {
    const ack = await fetch(productUrl + ":acknowledge", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!ack.ok) throw new Error("Não foi possível confirmar a compra com a Google Play");
  }
  return purchase;
}
