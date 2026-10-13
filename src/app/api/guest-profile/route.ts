// src/app/api/guest-profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  // Sem autenticação e limitação de uso esta rota administrativa de escrita
  // com service_role não deve estar disponível no ambiente de produção.
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const guestId = uuidv4();

    const payload: any = {
      id: guestId,
      display_name: body.display_name ?? null,
      timezone: body.timezone ?? null,
      main_goal: body.main_goal ?? null,
      frequency_tag: body.frequency_tag ?? null,
      daily_cost: body.daily_cost ?? null,
      last_use: body.last_use ?? null,
      wants_reminders: body.wants_reminders ?? null,
      thc_potency: body.thc_potency ?? null,
      grams_per_joint: body.grams_per_joint ?? null,
      currency: body.currency ?? null,
      updated_at: new Date().toISOString(),
    };

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase env not configured' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase.from('profiles').upsert(payload).select('id, display_name');
    if (error) {
      console.error('Error upserting guest profile:', error);
      return NextResponse.json({ error: error.message ?? error }, { status: 500 });
    }

    // Respond and set cookie via NextResponse API
    const res = NextResponse.json({ ok: true, guestId, profile: Array.isArray(data) ? data[0] : data });

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
    console.error('guest-profile route error', err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
