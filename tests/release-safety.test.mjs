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
  const short = listing.match(/<!-- SHORT_DESCRIPTION_START -->([\\s\\S]*?)<!-- SHORT_DESCRIPTION_END -->/)?.[1]?.trim();
  const full = listing.match(/<!-- FULL_DESCRIPTION_START -->([\\s\\S]*?)<!-- FULL_DESCRIPTION_END -->/)?.[1]?.trim();
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
