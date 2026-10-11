// src/app/api/admin/users/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from('profiles')
      .select('id, full_name, created_at, is_premium');

    if (error) throw error;

    const users = (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.full_name,
      // ainda não temos email na tabela profiles, então deixo vazio
      email: '',
      isBanned: false,        // ainda não temos controle real de ban
      createdAt: row.created_at,
      lastActiveAt: null,     // se depois tiver last_seen, a gente troca
    }));

    return NextResponse.json(users);
  } catch (error) {
    console.error('GET /api/admin/users error', error);
    return new NextResponse('Erro ao carregar usuários', { status: 500 });
  }
}
