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
