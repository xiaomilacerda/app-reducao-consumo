#!/usr/bin/env node
/**
 * Manual, read-only release smoke check against the deployed WeedReset PWA.
 * Never requires signing passwords or private keys.
 */
const origin = new URL(process.env.WEEDRESET_ORIGIN || 'https://app-reducao-consumo.vercel.app/');
const expectedPackage = (process.env.ANDROID_APP_PACKAGE_ID || '').trim();
const expectedSha = (process.env.ANDROID_APP_SIGNING_SHA256 || '')
  .split(',').map((value) => value.trim().toUpperCase()).filter(Boolean);

let failed = false;
const fail = (message) => { console.error('FALHA:', message); failed = true; };
const pass = (message) => console.log('OK:', message);

async function request(path) {
  const url = new URL(path, origin);
  const response = await fetch(url, { redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (new URL(response.url).origin !== origin.origin) {
    throw new Error('Redirecionamento inesperado para outra origem: ' + response.url);
  }
  return response;
}

async function checkPage(path) {
  const response = await request(path);
  if (!response.ok) fail(path + ' retornou HTTP ' + response.status);
  else pass(path + ' HTTP ' + response.status);
}

async function main() {
  if (origin.protocol !== 'https:') throw new Error('A origem deve usar HTTPS');
  for (const path of ['/', '/privacy', '/terms', '/excluir-conta', '/offline.html']) {
    try { await checkPage(path); } catch (error) { fail(path + ': ' + error.message); }
  }

  try {
    const response = await request('/manifest.webmanifest');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const manifest = await response.json();
    if (manifest.display !== 'standalone') fail('Manifest sem display standalone');
    if (!manifest.name || !manifest.short_name) fail('Manifest sem nome');
    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
    for (const size of ['192x192', '512x512']) {
      const icon = icons.find((item) => item.sizes === size && item.type === 'image/png');
      if (!icon) { fail('Ícone PNG ' + size + ' ausente no manifest'); continue; }
      const iconResponse = await request(icon.src);
      if (!iconResponse.ok || !(iconResponse.headers.get('content-type') || '').includes('image/png')) {
        fail('Ícone ' + size + ' indisponível ou não PNG');
      } else pass('Ícone ' + size + ' disponível');
    }
    pass('Manifest PWA lido');
  } catch (error) { fail('Manifest: ' + error.message); }

  try {
    const response = await request('/.well-known/assetlinks.json');
    if (!expectedPackage || expectedSha.length === 0) {
      fail('Configure ANDROID_APP_PACKAGE_ID e ANDROID_APP_SIGNING_SHA256 reais para verificar a TWA (HTTP atual: ' + response.status + ')');
    } else if (!response.ok) {
      fail('Digital Asset Links indisponível: HTTP ' + response.status);
    } else {
      const links = await response.json();
      const match = Array.isArray(links) && links.some((item) =>
        item.target?.namespace === 'android_app' &&
        item.target?.package_name === expectedPackage &&
        item.relation?.includes('delegate_permission/common.handle_all_urls') &&
        expectedSha.every((sha) => item.target?.sha256_cert_fingerprints?.includes(sha))
      );
      if (!match) fail('Digital Asset Links não corresponde ao package/certificado informado');
      else pass('Digital Asset Links corresponde ao pacote e fingerprints');
    }
  } catch (error) { fail('Digital Asset Links: ' + error.message); }

  if (failed) {
    console.error('PENDENTE: a checagem web não substitui AAB, Play Console, RLS ou testes em Android.');
    process.exitCode = 1;
  } else {
    pass('Checagem web concluída. AAB, testes Android e Play Console continuam obrigatórios.');
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
