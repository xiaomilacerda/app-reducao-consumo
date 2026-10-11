// src/app/api/admin/users/[id]/status/route.ts
import { NextResponse } from 'next/server';

type Params = {
  params: { id: string };
};

export async function POST(req: Request, { params }: Params) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action as 'ban' | 'unban' | undefined;

    if (!action) {
      return new NextResponse('Ação inválida', { status: 400 });
    }

    // Aqui poderíamos atualizar um campo "is_banned" em profiles
    // ou inserir em uma tabela "community_bans".
    // Por enquanto só registramos no log:
    console.log('Admin user status change:', params.id, action);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/admin/users/[id]/status error', error);
    return new NextResponse('Erro ao atualizar status do usuário', {
      status: 500,
    });
  }
}
