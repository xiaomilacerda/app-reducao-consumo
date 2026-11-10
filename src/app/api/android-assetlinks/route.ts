import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// TWA association is intentionally unavailable until the REAL package and
// signing certificate are supplied as server-only Vercel environment variables.
export function GET() {
  const packageName = process.env.ANDROID_APP_PACKAGE_ID?.trim() || '';
  const fingerprints = (process.env.ANDROID_APP_SIGNING_SHA256 || '')
    .split(',').map(value => value.trim().toUpperCase()).filter(Boolean);
  const validPackage = /^[A-Za-z][\w]*(?:\.[A-Za-z][\w]*)+$/.test(packageName);
  const validFingerprints = fingerprints.length > 0 &&
    fingerprints.every(value => /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(value));

  if (!validPackage || !validFingerprints) {
    return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json([{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: packageName,
      sha256_cert_fingerprints: fingerprints,
    },
  }], {
    headers: { 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' },
  });
}
