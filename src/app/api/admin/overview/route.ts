// src/app/api/admin/overview/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from('profiles')
      .select('id, is_premium');

    if (error) throw error;

    const rows = (data ?? []) as Array<{ id: string; is_premium: boolean | null }>;

    const totalUsers = rows.length;
    const activeUsers = rows.filter(r => r.is_premium === true).length;

    // por enquanto não temos tabela de banimentos nem de denúncias
    const bannedUsers = 0;
    const pendingReports = 0;

    return NextResponse.json({
      totalUsers,
      activeUsers,
      bannedUsers,
      pendingReports,
    });
  } catch (error) {
    console.error('GET /api/admin/overview error', error);
    return new NextResponse('Erro ao carregar overview admin', { status: 500 });
  }
}
