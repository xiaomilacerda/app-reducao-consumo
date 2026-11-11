import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('No global wildcard CORS on credentialed application routes', () => {
  const config = read('next.config.ts');
  assert.doesNotMatch(config, /key:\s*['"]Access-Control-Allow-Origin['"]/);
  assert.doesNotMatch(config, /key:\s*['"]Access-Control-Allow-Credentials['"]/);
  assert.match(config, /X-Content-Type-Options/);
});

test('Legacy guest cookie/redirect route is unavailable in production', () => {
  const route = read('src/app/set-guest/route.ts');
  assert.match(route, /process\.env\.NODE_ENV === 'production'/);
  assert.match(route, /status: 404/);
  assert.match(route, /!target\.startsWith\('\/\/'\)/);
});

test('Journey progress RPC enforces ownership and revokes anonymous execution', () => {
  const sql = read('supabase/migrations/20261110_weedreset_journey_rpc_ownership.sql');
  assert.match(sql, /p_user_id IS DISTINCT FROM \(SELECT auth\.uid\(\)\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.get_journey_missions\(uuid, integer\) FROM PUBLIC, anon/);
});

test('Password recovery and reset pages are accessible outside the authenticated shell', () => {
  const layout = read('src/app/layout.tsx');
  assert.match(layout, /"\/recuperar-senha"/);
  assert.match(layout, /"\/redefinir-senha"/);
  assert.match(read('src/app/recuperar-senha/page.tsx'), /resetPasswordForEmail/);
  assert.match(read('src/app/redefinir-senha/page.tsx'), /updateUser/);
  assert.match(read('src/app/login/page.tsx'), /href="\/recuperar-senha"/);
});

test('Public account deletion link and offline fallback remain available', () => {
  assert.match(read('src/app/privacy/page.tsx'), /href="\/excluir-conta"/);
  assert.ok(existsSync(new URL('../public/offline.html', import.meta.url)));
  const sw = read('public/sw.js');
  assert.match(sw, /request\.mode !== "navigate"/);
  assert.doesNotMatch(sw, /cache\.put\(/);
});

test('Health surfaces do not claim clinical relapse prediction or invent default spending', () => {
  const ai = read('src/app/ai-insights/page.tsx');
  const analytics = read('src/app/analytics/page.tsx');
  assert.doesNotMatch(ai, /Risco alto \(pico de fissura provável\)/);
  assert.match(ai, /Não mede risco clínico/);
  assert.match(analytics, /sem dados, não presumimos gastos/);
  assert.match(read('src/app/sos/page.tsx'), /tel:192/);
});

test('Free community keeps server-side anti-spam and TWA requires real certificate', () => {
  assert.doesNotMatch(read('src/app/community/page.tsx'), /Apenas membros Premium podem/);
  const migration = read('supabase/migrations/20261110_weedreset_free_community_spam_guard.sql');
  assert.match(migration, /weedreset_guard_community_post/);
  assert.match(migration, /pg_advisory_xact_lock/);
  const assetlinks = read('src/app/api/android-assetlinks/route.ts');
  assert.match(assetlinks, /ANDROID_APP_SIGNING_SHA256/);
  assert.match(assetlinks, /status: 404/);
});

test('Android Digital Asset Links uses a public well-known rewrite', () => {
  const config = read('next.config.ts');
  assert.match(config, /source: '\/\.well-known\/assetlinks\.json'/);
  assert.match(config, /destination: '\/api\/android-assetlinks'/);
});

test('Store listing meets text limits and contains a non-clinical disclaimer', () => {
  const listing = read('docs/play-store-listing-pt-BR.md');
  const short = listing.split('<!-- SHORT_DESCRIPTION_START -->')[1]?.split('<!-- SHORT_DESCRIPTION_END -->')[0]?.trim();
  const full = listing.split('<!-- FULL_DESCRIPTION_START -->')[1]?.split('<!-- FULL_DESCRIPTION_END -->')[0]?.trim();
  assert.ok(short, 'A descrição curta precisa existir');
  assert.ok(full, 'A descrição longa precisa existir');
  assert.ok(short.length <= 80, 'A descrição curta deve ter até 80 caracteres');
  assert.ok(full.length <= 4000, 'A descrição longa deve ter até 4000 caracteres');
  assert.match(full, /não é um dispositivo médico/);
  assert.match(full, /consulte um profissional de saúde/);
  assert.match(full, /18 anos ou mais/);
});

test('Onboarding avoids unsupported medical and anonymity claims', () => {
  const onboarding = read('src/app/onboarding/page.tsx');
  assert.doesNotMatch(onboarding, /Cálculos precisos de economia e saúde/);
  assert.doesNotMatch(onboarding, /Uma comunidade de apoio anônima/);
  assert.match(onboarding, /não é dispositivo médico/);
  assert.match(onboarding, /gramsPerJoint: Math\.max\(0, Number\(gramsPerJoint\) \|\| 0\)/);
  assert.match(onboarding, /thcPotency: Math\.max\(0, Number\(thcPotency\) \|\| 0\)/);
});

test('Community rules and settings expose required user safeguards', () => {
  const community = read('src/app/community/page.tsx');
  const words = community.split('const BLOCKED_WORDS = new Set(')[1]?.split('function hasProfanity')[0] ?? '';
  assert.ok(words, 'A lista de moderação precisa existir');
  assert.doesNotMatch(words, /['"]gay['"]\s*,/);
  assert.match(community, /Não publique ofertas, pedidos de compra/);
  assert.match(community, /opções de denúncia e bloqueio/);
  const settings = read('src/app/settings/page.tsx');
  assert.match(settings, /href="\/privacy"/);
  assert.match(settings, /href="\/terms"/);
  assert.match(settings, /href="\/excluir-conta"/);
});

test('Signing secrets and local Android bundles are ignored', () => {
  const ignore = read('.gitignore');
  assert.match(ignore, /\*\.keystore/);
  assert.match(ignore, /\*\.jks/);
  assert.match(ignore, /\*\.aab/);
  assert.match(ignore, /\.env\.\*/);
});


test('Monetization is single non-consumable SKU with safe preview default', () => {
  const cfg = read('src/config/monetization.ts');
  const prices = read('src/config/pricing.ts');
  const access = read('src/lib/access-status.ts');
  assert.match(cfg, /weedreset_full_access/);
  assert.match(cfg, /TRIAL_DAYS = 7/);
  assert.match(prices, /pricingModel: "one_time"/);
  assert.doesNotMatch(prices, /Premium Mensal|Premium Anual/);
  assert.match(access, /WEEDRESET_PAID_ACCESS_ENABLED/);
  assert.match(access, /WEEDRESET_ACCESS_LAUNCH_DATE/);
});

test('Paid feature gating preserves SOS and account access', () => {
  const middleware = read('src/middleware.ts');
  assert.match(middleware, /PAID_FEATURE_PATH/);
  assert.match(middleware, /getAccessStatus\(supabase, user\)/);
  assert.match(middleware, /new URL\('\/premium'/);
  const gated = middleware.match(/const PAID_FEATURE_PATH = ([^;]+);/)?.[1] || '';
  assert.ok(gated);
  assert.doesNotMatch(gated, /sos|community|mood|privacy|terms|excluir-conta/);
});

test('Purchase permission cannot be set directly from a client-side button', () => {
  const checkout = read('src/app/premium/page.tsx');
  const oldPage = read('src/app/PAGES/premium.tsx');
  assert.match(checkout, /PaymentRequest/);
  assert.match(checkout, /getDigitalGoodsService/);
  assert.match(checkout, /Restaurar compra/);
  assert.match(checkout, /api\/play\/verify/);
  assert.doesNotMatch(checkout, /is_premium:\s*true|localStorage.*isPremium/);
  assert.doesNotMatch(oldPage, /is_premium:\s*true|storage\.saveUserData/);
  assert.match(oldPage, /export \{ default \}/);
});

test('Purchase is verified and acknowledged server-side before granting access', () => {
  const route = read('src/app/api/play/verify/route.ts');
  const google = read('src/lib/google-play-server.ts');
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /validateAndAcknowledgePurchase\(purchaseToken\)/);
  assert.match(route, /weedreset_record_google_play_purchase/);
  assert.match(google, /purchaseState !== 0/);
  assert.match(google, /:acknowledge/);
  assert.match(google, /sha256/);
  assert.doesNotMatch(checkoutSafeString(google), /NEXT_PUBLIC_GOOGLE_PLAY_SERVICE_ACCOUNT/);
});

function checkoutSafeString(source) { return source; }

test('Entitlements reject client writes, share-resistant token and support refund revocation', () => {
  const migration = read('supabase/migrations/20261111_weedreset_play_one_time_entitlements.sql');
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.weedreset_play_purchases from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.weedreset_record_google_play_purchase/);
  assert.match(migration, /purchase_belongs_to_another_account/);
  assert.match(migration, /weedreset_revoke_google_play_purchase/);
});

test('Refund push requires signed Google OIDC and verified merchant package', () => {
  const auth = read('src/lib/google-pubsub-auth.ts');
  const push = read('src/app/api/play/rtdn/route.ts');
  assert.match(auth, /createPublicKey/);
  assert.match(auth, /verify\(/);
  assert.match(auth, /GOOGLE_PUBSUB_AUDIENCE/);
  assert.match(auth, /GOOGLE_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL/);
  assert.match(push, /verifyPubsubPushJwt/);
  assert.match(push, /notification\.packageName !== packageName/);
  assert.match(push, /weedreset_revoke_google_play_purchase/);
});
