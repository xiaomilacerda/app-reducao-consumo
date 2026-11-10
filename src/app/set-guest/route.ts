import { NextRequest, NextResponse } from 'next/server';

// Legacy development-only bridge. Never allow anonymous callers to select a
// guest identifier or use this endpoint as an open redirect in production.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 });
  }

  const guestId = req.nextUrl.searchParams.get('guest') ?? '';
  if (!UUID_RE.test(guestId)) {
    return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });
  }

  const target = req.nextUrl.searchParams.get('next') ?? '/';
  // Restrict navigation to a single-origin absolute path, not a scheme-relative
  // URL, backslash trick, or external destination.
  const safePath = target.startsWith('/') && !target.startsWith('//') &&
    !target.includes('\\') && !/[\r\n]/.test(target) ? target : '/';

  const res = NextResponse.redirect(new URL(safePath, req.nextUrl.origin));
  res.headers.set('Cache-Control', 'no-store');
  res.cookies.set({
    name: 'weedreset_guest_id',
    value: guestId,
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
  return res;
}
