// src/app/set-guest/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const guestId = url.searchParams.get('guest');
    const nextParam = url.searchParams.get('next') || '/';

    if (!guestId) {
      return NextResponse.json({ error: 'missing guest id' }, { status: 400 });
    }

    // Build an absolute URL for redirect. If nextParam is already absolute, use it.
    let redirectUrl: string;
    try {
      const candidate = new URL(nextParam);
      // valid absolute URL
      redirectUrl = candidate.toString();
    } catch {
      // relative path -> build absolute using the request origin
      redirectUrl = new URL(nextParam, url.origin).toString();
    }

    const res = NextResponse.redirect(redirectUrl);

    // set cookie server-side (HttpOnly so middleware can read it next request)
    res.cookies.set({
      name: 'weedreset_guest_id',
      value: guestId,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });

    return res;
  } catch (err: any) {
    console.error('set-guest route error', err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
