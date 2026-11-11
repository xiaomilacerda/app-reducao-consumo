import { createPublicKey, verify } from "node:crypto";

type VerifiedClaims = {
  iss?: string;
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  iat?: number;
  exp?: number;
};

/**
 * Verify Pub/Sub push OIDC JWT using Google's public signing keys.
 * Neither Authorization header presence nor user-supplied email is sufficient.
 */
export async function verifyPubsubPushJwt(authorization: string | null): Promise<boolean> {
  const audience = process.env.GOOGLE_PUBSUB_AUDIENCE;
  const pushEmail = process.env.GOOGLE_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL;
  if (!audience || !pushEmail || !authorization?.startsWith("Bearer ")) return false;
  const jwt = authorization.substring(7);
  if (jwt.length > 10_000) return false;
  const parts = jwt.split(".");
  if (parts.length !== 3) return false;
  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as {
      alg?: string;
      kid?: string;
    };
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as VerifiedClaims;
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== "RS256" || !header.kid ||
        !["https://accounts.google.com", "accounts.google.com"].includes(claims.iss || "") ||
        claims.aud !== audience ||
        claims.email !== pushEmail ||
        !(claims.email_verified === true || claims.email_verified === "true") ||
        !claims.exp || claims.exp < now - 60 ||
        !claims.iat || claims.iat > now + 60) return false;

    const response = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return false;
    const jwks = (await response.json()) as { keys?: Array<JsonWebKey & { kid?: string }> };
    const jwk = jwks.keys?.find((key) => key.kid === header.kid && key.kty === "RSA");
    if (!jwk) return false;
    const publicKey = createPublicKey({ key: jwk, format: "jwk" });
    return verify(
      "RSA-SHA256",
      Buffer.from(parts[0] + "." + parts[1]),
      publicKey,
      Buffer.from(parts[2], "base64url")
    );
  } catch {
    return false;
  }
}
